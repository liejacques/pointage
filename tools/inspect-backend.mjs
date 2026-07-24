import { createClient } from '@supabase/supabase-js'

// Diagnostic en LECTURE SEULE de la base Aetheris.
// N'écrit rien. Sert à voir entreprises, profils, compagnons et chantiers
// avant de créer les comptes RH / conducteur.

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error('Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.')
}

function keyKind(key) {
  if (key.startsWith('sb_publishable_')) return 'publishable'
  if (key.startsWith('sb_secret_')) return 'secret'
  if (key.startsWith('eyJ')) {
    try {
      const part = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(Buffer.from(part, 'base64').toString('utf8')).role || 'jwt-inconnu'
    } catch {
      return 'jwt-inconnu'
    }
  }
  return 'inconnu'
}

const kind = keyKind(serviceKey)
if (kind === 'publishable' || kind === 'anon') {
  throw new Error(
    `\nLa clé fournie est une clé PUBLIQUE (${kind}) : la RLS masque toutes les données `
    + '(tu verrais 0 partout, à tort).\nUtilise la clé SECRÈTE (service_role) : '
    + 'Dashboard > Project Settings > API Keys > "Secret keys" ("sb_secret_..."), '
    + 'ou ancienne page "service_role" ("eyJ...").\n',
  )
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sep = () => console.log('-'.repeat(64))

async function count(table) {
  const result = await admin.from(table).select('id', { count: 'exact', head: true })
  return result.error ? `erreur (${result.error.message})` : String(result.count)
}

sep()
console.log('ENTREPRISES')
const entreprises = await admin
  .from('entreprises')
  .select('id, raison_sociale, created_at')
  .order('created_at')
if (entreprises.error) {
  console.log('  ERREUR :', entreprises.error.message)
} else if (!entreprises.data.length) {
  console.log('  >>> AUCUNE entreprise dans la base.')
} else {
  entreprises.data.forEach((e) => console.log(`  - "${e.raison_sociale || '(sans nom)'}"  id=${e.id}`))
}

sep()
console.log('PROFILS')
const profils = await admin
  .from('profils')
  .select('id, nom, prenom, role, actif, entreprise_id, identifiant_court')
  .order('created_at')
if (profils.error) {
  console.log('  ERREUR :', profils.error.message)
} else if (!profils.data.length) {
  console.log('  >>> AUCUN profil dans la base.')
} else {
  profils.data.forEach((p) => console.log(
    `  - ${(p.prenom || '') + ' ' + (p.nom || '')}`.padEnd(26)
    + ` role=${String(p.role).padEnd(12)} actif=${p.actif}`
    + ` entreprise=${p.entreprise_id || 'AUCUNE'} court=${p.identifiant_court || '-'}`,
  ))
}

sep()
console.log('VOLUMES')
console.log(`  compagnons : ${await count('compagnons')}`)
console.log(`  chantiers  : ${await count('chantiers')}`)
console.log(`  vehicules  : ${await count('vehicules')}`)
sep()
console.log('Diagnostic terminé (aucune donnée modifiée).')
