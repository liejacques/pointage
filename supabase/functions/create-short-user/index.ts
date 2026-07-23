import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedModules = new Set(['terrain', 'conducteur', 'rh'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function firstConfiguredKey(legacyName: string, dictionaryName: string) {
  const legacy = Deno.env.get(legacyName)
  if (legacy) return legacy

  const raw = Deno.env.get(dictionaryName)
  if (!raw) return null
  try {
    const keys = JSON.parse(raw) as Record<string, string>
    return keys.default || Object.values(keys)[0] || null
  } catch {
    return null
  }
}

function normalizeIdentifier(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('fr')
}

function technicalEmail(identifier: string) {
  return `${identifier}@login.aetheris.local`
}

function technicalPassword(shortPassword: string) {
  return `Ae26!${shortPassword}`
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return { prenom: '', nom: parts[0] }
  return {
    prenom: parts[0],
    nom: parts.slice(1).join(' '),
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ message: 'Méthode non autorisée.' }, 405)

  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ message: 'Session requise.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = firstConfiguredKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS')
  if (!supabaseUrl || !serviceKey) return json({ message: 'Configuration serveur incomplète.' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ message: 'Session invalide.' }, 401)

  const callerResult = await admin
    .from('profils')
    .select('id, entreprise_id, role, actif')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (callerResult.error || !callerResult.data?.actif || !callerResult.data.entreprise_id) {
    return json({ message: 'Profil RH inactif ou incomplet.' }, 403)
  }
  const caller = callerResult.data

  const moduleResult = await admin
    .from('profil_modules')
    .select('module')
    .eq('profil_id', caller.id)
    .eq('module', 'rh')
    .maybeSingle()
  const canCreate = ['admin', 'direction'].includes(caller.role) || Boolean(moduleResult.data)
  if (!canCreate) return json({ message: 'Le module RH est requis pour créer un utilisateur.' }, 403)

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return json({ message: 'Données invalides.' }, 400)
  }

  const name = String(payload.name || '').trim().replace(/\s+/g, ' ')
  const identifier = normalizeIdentifier(payload.identifier)
  const password = String(payload.password || '')
  const modules = [...new Set(
    (Array.isArray(payload.modules) ? payload.modules : [])
      .map(String)
      .filter((module) => allowedModules.has(module)),
  )]

  if (name.length < 2 || name.length > 80) return json({ message: 'Le nom doit contenir entre 2 et 80 caractères.' }, 400)
  if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(identifier)) {
    return json({ message: 'L’identifiant doit contenir 2 à 31 lettres, chiffres, points, tirets ou tirets bas.' }, 400)
  }
  if (!/^\S{5,32}$/.test(password)) {
    return json({ message: 'Le mot de passe court doit contenir entre 5 et 32 caractères sans espace.' }, 400)
  }
  if (!modules.length) return json({ message: 'Choisissez au moins un module.' }, 400)

  const role = modules.includes('conducteur')
    ? 'conducteur'
    : modules.includes('terrain')
      ? 'chef_equipe'
      : 'rh'

  const createdUser = await admin.auth.admin.createUser({
    email: technicalEmail(identifier),
    password: technicalPassword(password),
    email_confirm: true,
    user_metadata: { nom_complet: name, identifiant_court: identifier },
  })

  if (createdUser.error || !createdUser.data.user) {
    const duplicate = /already|registered|exists/i.test(createdUser.error?.message || '')
    return json({
      message: duplicate ? 'Cet identifiant est déjà utilisé.' : createdUser.error?.message || 'Création impossible.',
    }, duplicate ? 409 : 400)
  }

  const createdId = createdUser.data.user.id
  let companionId: string | null = null
  let companionWasCreated = false
  let companionWasLinked = false
  const personName = splitName(name)

  try {
    const profileResult = await admin.from('profils').upsert({
      id: createdId,
      entreprise_id: caller.entreprise_id,
      role,
      email: technicalEmail(identifier),
      nom: personName.nom,
      prenom: personName.prenom,
      identifiant_court: identifier,
      actif: true,
    }, { onConflict: 'id' })
    if (profileResult.error) throw profileResult.error

    const modulesResult = await admin.from('profil_modules').insert(
      modules.map((module) => ({
        profil_id: createdId,
        entreprise_id: caller.entreprise_id,
        module,
        cree_par: caller.id,
      })),
    )
    if (modulesResult.error) throw modulesResult.error

    if (modules.includes('terrain')) {
      const existingCompanion = await admin
        .from('compagnons')
        .select('id, profil_id')
        .eq('entreprise_id', caller.entreprise_id)
        .ilike('nom', personName.nom)
        .ilike('prenom', personName.prenom)
        .limit(1)
        .maybeSingle()
      if (existingCompanion.error) throw existingCompanion.error

      if (existingCompanion.data?.profil_id && existingCompanion.data.profil_id !== createdId) {
        throw new Error('Cette personne possède déjà un compte de connexion.')
      }

      if (existingCompanion.data) {
        const companionResult = await admin
          .from('compagnons')
          .update({ profil_id: createdId, actif: true })
          .eq('id', existingCompanion.data.id)
          .select('id')
          .single()
        if (companionResult.error) throw companionResult.error
        companionId = companionResult.data.id
        companionWasLinked = true
      } else {
        const companionResult = await admin
          .from('compagnons')
          .insert({
            entreprise_id: caller.entreprise_id,
            profil_id: createdId,
            nom: personName.nom,
            prenom: personName.prenom,
            initials: initialsFor(name),
            role: 'compagnon',
            actif: true,
          })
          .select('id')
          .single()
        if (companionResult.error) throw companionResult.error
        companionId = companionResult.data.id
        companionWasCreated = true
      }
    }

    return json({
      user: {
        id: createdId,
        name,
        identifier,
        modules,
      },
    }, 201)
  } catch (error) {
    if (companionWasCreated && companionId) {
      await admin.from('compagnons').delete().eq('id', companionId)
    } else if (companionWasLinked && companionId) {
      await admin.from('compagnons').update({ profil_id: null }).eq('id', companionId)
    }
    await admin.auth.admin.deleteUser(createdId)
    return json({ message: error instanceof Error ? error.message : 'Création annulée.' }, 400)
  }
})
