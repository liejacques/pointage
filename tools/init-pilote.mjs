import { createClient } from '@supabase/supabase-js'

// ============================================================
// Initialisation du pilote Aetheris sur une base vierge.
// Crée (de façon idempotente) :
//   1) une entreprise (le tenant)
//   2) un compte RH           (module rh)
//   3) un compte Conducteur   (module conducteur)
//   4) un compte Chef d'équipe (module terrain + fiche compagnon)
//
// À lancer avec la clé service_role dans les variables d'environnement.
// Relançable sans créer de doublon (réutilise l'entreprise existante,
// réinitialise le mot de passe si le compte existe déjà).
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
  throw new Error(
    `\nLa clé fournie est une clé PUBLIQUE (${kind}) — elle ne peut pas écrire (bloquée par la RLS).\n`
    + 'Il faut la clé SECRÈTE (service_role). Dashboard > Project Settings > API Keys :\n'
    + '  • section "Secret keys"  ->  "sb_secret_..."\n'
    + '  • (ancienne page "API"   ->  "service_role" -> "eyJ...")\n'
    + 'La clé secrète ne commence PAS par "sb_publishable_".\n',
  )
}

const companyName = (process.env.COMPANY_NAME || 'Entreprise Aetheris').trim()

const accounts = [
  {
    label: 'RH',
    passwordVar: 'RH_PASSWORD',
    identifier: (process.env.RH_IDENTIFIER || 'js.rh').trim().toLocaleLowerCase('fr'),
    password: process.env.RH_PASSWORD || '',
    name: (process.env.RH_NAME || 'Jocelin RH').trim(),
    role: 'rh',
    modules: ['rh'],
  },
  {
    label: 'Conducteur',
    passwordVar: 'COND_PASSWORD',
    identifier: (process.env.COND_IDENTIFIER || 'js.ct').trim().toLocaleLowerCase('fr'),
    password: process.env.COND_PASSWORD || '',
    name: (process.env.COND_NAME || 'Jocelin Conducteur').trim(),
    role: 'conducteur',
    modules: ['conducteur'],
  },
  {
    label: 'Chef équipe',
    passwordVar: 'CHEF_PASSWORD',
    identifier: (process.env.CHEF_IDENTIFIER || 'js.ch').trim().toLocaleLowerCase('fr'),
    password: process.env.CHEF_PASSWORD || '',
    name: (process.env.CHEF_NAME || 'Jocelin Chef').trim(),
    role: 'chef_equipe',
    modules: ['terrain'],
  },
]

const idRegex = /^[a-z0-9][a-z0-9._-]{1,30}$/
const pwdRegex = /^\S{5,32}$/
for (const acc of accounts) {
  if (!idRegex.test(acc.identifier)) {
    throw new Error(`Identifiant ${acc.label} invalide : "${acc.identifier}" (2 à 31 lettres/chiffres/._-).`)
  }
  if (!pwdRegex.test(acc.password)) {
    throw new Error(`Mot de passe ${acc.label} invalide : renseigne ${acc.passwordVar} (5 à 32 caractères, sans espace).`)
  }
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const technicalEmail = (identifier) => `${identifier}@login.aetheris.local`
const technicalPassword = (password) => `Ae26!${password}`

function splitName(name) {
  const parts = name.split(/\s+/)
  if (parts.length === 1) return { prenom: '', nom: parts[0] }
  return { prenom: parts[0], nom: parts.slice(1).join(' ') }
}

function initialsFor(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'US'
}

async function findOrCreateUser({ email, password, name, identifier }) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom_complet: name, identifiant_court: identifier },
  })
  if (!created.error && created.data.user) return { id: created.data.user.id, isNew: true }
  if (created.error && !/already|registered|exists/i.test(created.error.message)) throw created.error

  // Le compte existe déjà : on le retrouve et on réinitialise le mot de passe.
  let user = null
  for (let page = 1; page <= 20 && !user; page += 1) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (list.error) throw list.error
    user = list.data.users.find((item) => item.email === email) || null
    if (list.data.users.length < 100) break
  }
  if (!user) throw new Error(`Compte ${email} introuvable malgré le conflit.`)
  const updated = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true })
  if (updated.error) throw updated.error
  return { id: user.id, isNew: false }
}

// 1) Entreprise cible.
//    - COMPANY_ID fourni  -> on l'utilise (recommandé, évite le seed de démo).
//    - sinon              -> première entreprise existante, sinon on la crée.
const requestedCompanyId = process.env.COMPANY_ID || null
let company

if (requestedCompanyId) {
  const found = await admin
    .from('entreprises')
    .select('id, raison_sociale')
    .eq('id', requestedCompanyId)
    .maybeSingle()
  if (found.error) throw found.error
  if (!found.data) throw new Error(`Entreprise ${requestedCompanyId} introuvable.`)
  company = found.data
  console.log(`Entreprise ciblée         : "${company.raison_sociale}"  (id=${company.id})`)
} else {
  company = (await admin
    .from('entreprises')
    .select('id, raison_sociale')
    .order('created_at')
    .limit(1)
    .maybeSingle()).data
  if (!company) {
    const inserted = await admin
      .from('entreprises')
      .insert({ raison_sociale: companyName })
      .select('id, raison_sociale')
      .single()
    if (inserted.error) throw inserted.error
    company = inserted.data
    console.log(`Entreprise créée          : "${company.raison_sociale}"  (id=${company.id})`)
  } else {
    console.log(`Entreprise existante      : "${company.raison_sociale}"  (id=${company.id})`)
  }
}

// 2) Comptes RH, Conducteur, Chef d'équipe.
for (const acc of accounts) {
  const email = technicalEmail(acc.identifier)
  const { id: userId, isNew } = await findOrCreateUser({
    email,
    password: technicalPassword(acc.password),
    name: acc.name,
    identifier: acc.identifier,
  })
  const person = splitName(acc.name)

  const profil = await admin.from('profils').upsert({
    id: userId,
    entreprise_id: company.id,
    role: acc.role,
    email,
    nom: person.nom,
    prenom: person.prenom,
    identifiant_court: acc.identifier,
    actif: true,
  }, { onConflict: 'id' })
  if (profil.error) throw profil.error

  const modules = await admin.from('profil_modules').upsert(
    acc.modules.map((module) => ({ profil_id: userId, entreprise_id: company.id, module })),
    { onConflict: 'profil_id,module' },
  )
  if (modules.error) throw modules.error

  // Le terrain (chef d'équipe / ouvrier) a besoin d'une fiche compagnon
  // pour être planifié et pouvoir pointer.
  if (acc.modules.includes('terrain')) {
    const existing = await admin
      .from('compagnons')
      .select('id')
      .eq('profil_id', userId)
      .limit(1)
      .maybeSingle()
    if (!existing.data) {
      const compagnon = await admin.from('compagnons').insert({
        entreprise_id: company.id,
        profil_id: userId,
        nom: person.nom || acc.identifier,
        prenom: person.prenom,
        initials: initialsFor(acc.name),
        role: 'compagnon',
        actif: true,
      })
      if (compagnon.error) throw compagnon.error
    }
  }

  console.log(`Compte ${acc.label.padEnd(11)} ${isNew ? 'créé      ' : 'mis à jour'} → identifiant "${acc.identifier}"  | rôle ${acc.role} | modules: ${acc.modules.join(', ')}`)
}

console.log('')
console.log('✅ Pilote initialisé. Connecte-toi dans l\'app avec un identifiant court + son mot de passe.')
