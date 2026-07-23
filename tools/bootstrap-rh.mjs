import { createClient } from '@supabase/supabase-js'

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RH_IDENTIFIER',
  'RH_PASSWORD',
]

const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  throw new Error(`Variables manquantes : ${missing.join(', ')}`)
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const identifier = process.env.RH_IDENTIFIER.trim().toLocaleLowerCase('fr')
const password = process.env.RH_PASSWORD
const name = (process.env.RH_NAME || 'Responsable RH').trim()
const requestedCompanyId = process.env.COMPANY_ID || null

if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(identifier)) throw new Error('Identifiant RH invalide.')
if (!/^\S{5,32}$/.test(password)) throw new Error('Mot de passe RH invalide.')

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let companyId = requestedCompanyId
let companyName = ''

if (companyId) {
  const companyResult = await admin
    .from('entreprises')
    .select('id, raison_sociale')
    .eq('id', companyId)
    .single()
  if (companyResult.error) throw companyResult.error
  companyName = companyResult.data.raison_sociale
} else {
  const adminProfile = await admin
    .from('profils')
    .select('entreprise_id, entreprises(raison_sociale)')
    .in('role', ['admin', 'direction'])
    .not('entreprise_id', 'is', null)
    .eq('actif', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (adminProfile.error || !adminProfile.data?.entreprise_id) {
    throw adminProfile.error || new Error('Aucune entreprise administrée disponible.')
  }
  companyId = adminProfile.data.entreprise_id
  companyName = adminProfile.data.entreprises?.raison_sociale || 'Entreprise Aetheris'
}

const email = `${identifier}@login.aetheris.local`
const technicalPassword = `Ae26!${password}`
let user = null

const createResult = await admin.auth.admin.createUser({
  email,
  password: technicalPassword,
  email_confirm: true,
  user_metadata: { nom_complet: name, identifiant_court: identifier },
})

if (createResult.error) {
  if (!/already|registered|exists/i.test(createResult.error.message)) throw createResult.error
  for (let page = 1; page <= 20 && !user; page += 1) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (list.error) throw list.error
    user = list.data.users.find((item) => item.email === email) || null
    if (list.data.users.length < 100) break
  }
  if (!user) throw new Error('Compte RH existant introuvable.')
  const updatePassword = await admin.auth.admin.updateUserById(user.id, {
    password: technicalPassword,
    email_confirm: true,
  })
  if (updatePassword.error) throw updatePassword.error
} else {
  user = createResult.data.user
}

const initials = name
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()
const nameParts = name.split(/\s+/)
const firstName = nameParts.length > 1 ? nameParts[0] : ''
const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]

const profileResult = await admin.from('profils').upsert({
  id: user.id,
  entreprise_id: companyId,
  role: 'rh',
  email,
  nom: lastName,
  prenom: firstName,
  identifiant_court: identifier,
  actif: true,
}, { onConflict: 'id' })
if (profileResult.error) throw profileResult.error

const moduleResult = await admin.from('profil_modules').upsert({
  profil_id: user.id,
  entreprise_id: companyId,
  module: 'rh',
}, { onConflict: 'profil_id,module' })
if (moduleResult.error) throw moduleResult.error

console.log(`Compte RH activé dans l’entreprise « ${companyName} » (${initials || 'RH'}).`)
