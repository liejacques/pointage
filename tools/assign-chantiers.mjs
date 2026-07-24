import { createClient } from '@supabase/supabase-js'

// ============================================================
// Rattache les chantiers d'une entreprise à un conducteur donné,
// pour qu'il les voie (RLS : un conducteur ne voit que ses chantiers).
// Pilote mono-conducteur : rattache TOUS les chantiers de l'entreprise.
// ============================================================

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
  throw new Error('\nClé PUBLIQUE fournie — il faut la clé service_role (eyJ... ou sb_secret_...).\n')
}

const companyId = process.env.COMPANY_ID
if (!companyId) throw new Error('COMPANY_ID requis.')
const conducteurIdentifier = (process.env.COND_IDENTIFIER || 'js.ct').trim().toLocaleLowerCase('fr')

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const profil = await admin
  .from('profils')
  .select('id, nom, prenom, role')
  .eq('identifiant_court', conducteurIdentifier)
  .eq('entreprise_id', companyId)
  .maybeSingle()
if (profil.error) throw profil.error
if (!profil.data) throw new Error(`Conducteur "${conducteurIdentifier}" introuvable dans l'entreprise ${companyId}.`)
if (profil.data.role !== 'conducteur') {
  console.log(`Attention : "${conducteurIdentifier}" a le rôle "${profil.data.role}" (attendu : conducteur).`)
}

const updated = await admin
  .from('chantiers')
  .update({ conducteur_profil_id: profil.data.id })
  .eq('entreprise_id', companyId)
  .select('id, no, label')
if (updated.error) throw updated.error

console.log(`Conducteur : ${(profil.data.prenom || '') + ' ' + (profil.data.nom || '')} (${conducteurIdentifier})`)
console.log(`${updated.data.length} chantier(s) rattaché(s) :`)
updated.data
  .slice(0, 30)
  .forEach((c) => console.log(`  - ${c.no || c.label || c.id}`))
console.log('✅ Terminé. Le conducteur voit maintenant ces chantiers.')
