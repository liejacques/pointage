import { createClient } from '@supabase/supabase-js'

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RH_IDENTIFIER',
  'RH_PASSWORD',
]
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Variables manquantes : ${missing.join(', ')}`)

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const rhIdentifier = process.env.RH_IDENTIFIER.trim().toLocaleLowerCase('fr')
const rhPassword = process.env.RH_PASSWORD
const suffix = Date.now().toString(36)
const testIdentifier = `test-${suffix}`
const testPassword = `T5!${suffix.slice(-5)}`
const technicalPassword = (value) => `Ae26!${value}`

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const rh = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const user = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let testUserId = null
let companionId = null
let siteId = null
let vehicleId = null
let documentId = null
let documentPath = null

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function unwrap(promise, label) {
  const result = await promise
  if (result.error) throw new Error(`${label} : ${result.error.message}`)
  return result.data
}

async function cleanup(promise, label) {
  try {
    const result = await promise
    if (result?.error) console.error(`Nettoyage ${label} : ${result.error.message}`)
  } catch (error) {
    console.error(`Nettoyage ${label} : ${error.message}`)
  }
}

try {
  await unwrap(rh.auth.signInWithPassword({
    email: `${rhIdentifier}@login.aetheris.local`,
    password: technicalPassword(rhPassword),
  }), 'Connexion RH')

  const rhContext = await unwrap(rh.rpc('get_pointage_user_context_v1'), 'Contexte RH')
  assert(rhContext?.modules?.includes('rh'), 'Le compte RH ne possède pas le module RH.')

  const created = await unwrap(rh.functions.invoke('create-short-user', {
    body: {
      name: 'Test Codex',
      identifier: testIdentifier,
      password: testPassword,
      modules: ['terrain', 'conducteur'],
    },
  }), 'Création utilisateur')
  testUserId = created.user.id

  await unwrap(user.auth.signInWithPassword({
    email: `${testIdentifier}@login.aetheris.local`,
    password: technicalPassword(testPassword),
  }), 'Connexion utilisateur')

  const context = await unwrap(user.rpc('get_pointage_user_context_v1'), 'Contexte utilisateur')
  assert(context?.modules?.includes('terrain') && context?.modules?.includes('conducteur'), 'Droits modules incomplets.')

  const companion = await unwrap(
    admin.from('compagnons').select('id').eq('profil_id', testUserId).single(),
    'Compagnon lié',
  )
  companionId = companion.id

  siteId = await unwrap(user.rpc('creer_chantier_pointage_v1', {
    p_reference: `TEST-${suffix}`,
    p_nom: 'Chantier de vérification',
    p_adresse: '1 rue du Test',
    p_code_postal: '68000',
    p_ville: 'Colmar',
  }), 'Création chantier')

  vehicleId = await unwrap(user.rpc('creer_vehicule_pointage_v1', {
    p_libelle: 'Véhicule de vérification',
    p_immatriculation: `T-${suffix.slice(-6).toUpperCase()}`,
    p_type: 'Fourgon',
    p_capacite: 'Test',
  }), 'Création véhicule')

  await unwrap(user.rpc('enregistrer_affectation_pointage_v1', {
    p_chantier_id: siteId,
    p_compagnon_id: companionId,
    p_vehicule_id: vehicleId,
    p_jour: new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }),
    p_heure_debut: '07:30',
    p_heure_fin: '17:00',
  }), 'Affectation planning')

  const startActionId = crypto.randomUUID()
  await unwrap(user.rpc('demarrer_pointage_v2', {
    p_compagnon_id: companionId,
    p_activite: 'production',
    p_chantier_id: siteId,
    p_debut: new Date().toISOString(),
    p_source: 'chef',
    p_confiance: 'haute',
    p_note: 'action:start',
    p_client_action_id: startActionId,
  }), 'Début pointage')
  await unwrap(user.rpc('terminer_pointage_v2', {
    p_compagnon_id: companionId,
    p_fin: new Date().toISOString(),
    p_client_action_id: crypto.randomUUID(),
  }), 'Fin pointage')

  await unwrap(user.rpc('creer_operation_logistique_pointage_v1', {
    p_chantier_id: siteId,
    p_type_operation: 'grutage',
    p_debut_prevu: new Date(Date.now() + 86_400_000).toISOString(),
    p_fournisseur: 'Test levage',
    p_chauffeur_nom: 'Chauffeur Test',
    p_chauffeur_telephone: '0600000000',
    p_vehicule_id: vehicleId,
    p_camion_externe: null,
    p_capacite: '26 t',
    p_chargement: ['Matériel de vérification'],
    p_note: 'Vérification automatique',
  }), 'Mouvement logistique')

  documentPath = `${context.entreprise_id}/${siteId}/${crypto.randomUUID()}-verification.pdf`
  const pdf = new Blob(['%PDF-1.4\n% Aetheris smoke test\n%%EOF'], { type: 'application/pdf' })
  await unwrap(user.storage.from('documents').upload(documentPath, pdf), 'Envoi document')
  documentId = await unwrap(user.rpc('enregistrer_document_pointage_v1', {
    p_chantier_id: siteId,
    p_categorie: 'devis',
    p_nom: 'verification.pdf',
    p_chemin: documentPath,
    p_mime_type: 'application/pdf',
    p_taille: pdf.size,
  }), 'Classement document')
  const signed = await unwrap(
    user.storage.from('documents').createSignedUrl(documentPath, 60),
    'Ouverture document',
  )
  assert(Boolean(signed.signedUrl), 'URL signée absente.')

  const planning = await unwrap(
    user.from('planning_entries').select('id').contains('compagnon_ids', [companionId]),
    'Lecture planning',
  )
  const logistics = await unwrap(
    user.from('operations_logistiques').select('id').eq('chantier_id', siteId),
    'Lecture logistique',
  )
  assert(planning.length === 1, 'Affectation planning non relue.')
  assert(logistics.length === 1, 'Mouvement logistique non relu.')

  console.log('Vérification backend réussie : RH, droits, planning, pointage, véhicule, logistique et document.')
} finally {
  if (documentPath) await cleanup(admin.storage.from('documents').remove([documentPath]), 'fichier')
  if (documentId) await cleanup(admin.from('documents').delete().eq('id', documentId), 'document')
  if (companionId) {
    await cleanup(admin.from('pointage_evenements').delete().eq('compagnon_id', companionId), 'événements')
    await cleanup(admin.from('planning_affectation_details').delete().eq('compagnon_id', companionId), 'détails planning')
  }
  if (siteId) {
    await cleanup(admin.from('operations_logistiques').delete().eq('chantier_id', siteId), 'logistique')
    await cleanup(admin.from('planning_entries').delete().eq('chantier_id', siteId), 'planning')
    await cleanup(admin.from('chantiers').delete().eq('id', siteId), 'chantier')
  }
  if (vehicleId) await cleanup(admin.from('vehicules').delete().eq('id', vehicleId), 'véhicule')
  if (companionId) await cleanup(admin.from('compagnons').delete().eq('id', companionId), 'compagnon')
  if (testUserId) await cleanup(admin.auth.admin.deleteUser(testUserId), 'utilisateur Auth')
}
