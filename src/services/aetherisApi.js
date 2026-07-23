import { isSupabaseConfigured, supabase } from '../lib/supabase'

const OFFLINE_QUEUE_KEY = 'aetheris-pointages-en-attente'
const SHORT_LOGIN_DOMAIN = 'login.aetheris.local'

export function normalizeShortIdentifier(value) {
  return String(value || '').trim().toLocaleLowerCase('fr')
}

function technicalPassword(shortPassword) {
  return `Ae26!${shortPassword}`
}

export function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function signIn(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data
}

export async function signInShort(identifier, password) {
  const normalized = normalizeShortIdentifier(identifier)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${normalized}@${SHORT_LOGIN_DOMAIN}`,
    password: technicalPassword(password),
  })
  if (error) throw error
  return data.session
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadProfile(userId) {
  const { data, error } = await supabase.rpc('get_user_context_v1')
  if (error) throw error
  if (!data || data.id !== userId) return null
  return {
    ...data,
    modules: Array.isArray(data.modules) ? data.modules : [],
    entreprises: data.entreprise,
  }
}

export async function loadRhUsers() {
  const { data, error } = await supabase
    .from('profils')
    .select('id, nom_complet, initiales, identifiant_court, role, actif, created_at, profil_modules(module)')
    .not('identifiant_court', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((profile) => ({
    ...profile,
    modules: (profile.profil_modules || []).map((item) => item.module),
  }))
}

export async function createShortUser(payload) {
  const { data, error } = await supabase.functions.invoke('create-short-user', {
    body: {
      name: payload.name,
      identifier: normalizeShortIdentifier(payload.identifier),
      password: payload.password,
      modules: payload.modules,
    },
  })
  if (error) {
    let message = error.message
    try {
      const details = await error.context?.json()
      message = details?.message || message
    } catch {
      // La réponse n'est pas toujours un JSON exploitable.
    }
    throw new Error(message)
  }
  return data.user
}

function unwrap(value) {
  return Array.isArray(value) ? value[0] : value
}

export async function loadConductorData(date = localDate()) {
  const start = new Date(`${date}T00:00:00`).toISOString()
  const end = new Date(`${date}T23:59:59`).toISOString()
  const [
    sitesResult,
    peopleResult,
    vehiclesResult,
    assignmentsResult,
    punchesResult,
    reportsResult,
    alertsResult,
    documentsResult,
    logisticsResult,
  ] = await Promise.all([
    supabase.from('chantiers').select('*').neq('statut', 'archive').order('reference'),
    supabase.from('compagnons').select('*').eq('actif', true).order('nom_complet'),
    supabase.from('vehicules').select('*').eq('actif', true).order('libelle'),
    supabase
      .from('affectations')
      .select('*, chantiers(id, reference, nom, ville), compagnons(id, nom_complet, initiales), vehicules(id, libelle, immatriculation)')
      .eq('jour', date)
      .neq('statut', 'annulee')
      .order('heure_debut_prevue'),
    supabase
      .from('pointages')
      .select('*, compagnons(nom_complet, initiales), chantiers(reference, nom)')
      .eq('jour_travail', date)
      .order('pointe_a', { ascending: false }),
    supabase
      .from('rapports_heures_journaliers')
      .select('*')
      .eq('jour', date)
      .order('compagnon_nom'),
    supabase
      .from('alertes')
      .select('*, compagnons(nom_complet), chantiers(reference, nom)')
      .eq('resolue', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents_chantier')
      .select('*, chantiers(reference, nom)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('operations_logistiques')
      .select('*, chantiers(reference, nom), vehicules(libelle, immatriculation)')
      .gte('debut_prevu', start)
      .lte('debut_prevu', end)
      .order('debut_prevu'),
  ])

  const results = [
    sitesResult,
    peopleResult,
    vehiclesResult,
    assignmentsResult,
    punchesResult,
    reportsResult,
    alertsResult,
    documentsResult,
    logisticsResult,
  ]
  const failed = results.find((result) => result.error)
  if (failed) throw failed.error

  return {
    sites: sitesResult.data,
    people: peopleResult.data,
    vehicles: vehiclesResult.data,
    assignments: assignmentsResult.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
      compagnons: unwrap(item.compagnons),
      vehicules: unwrap(item.vehicules),
    })),
    punches: punchesResult.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
      compagnons: unwrap(item.compagnons),
    })),
    reports: reportsResult.data,
    alerts: alertsResult.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
      compagnons: unwrap(item.compagnons),
    })),
    documents: documentsResult.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
    })),
    logistics: logisticsResult.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
      vehicules: unwrap(item.vehicules),
    })),
  }
}

export function subscribeToConductorData(entrepriseId, onChange) {
  if (!supabase || !entrepriseId) return () => {}
  const channel = supabase
    .channel(`conducteur-${entrepriseId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'pointages',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'affectations',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'alertes',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'operations_logistiques',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function saveAssignment({ entrepriseId, siteId, personId, vehicleId, date, userId }) {
  const { error } = await supabase.from('affectations').upsert({
    entreprise_id: entrepriseId,
    chantier_id: siteId,
    compagnon_id: personId,
    vehicule_id: vehicleId || null,
    jour: date,
    statut: 'confirmee',
    cree_par: userId,
  }, { onConflict: 'compagnon_id,jour' })
  if (error) throw error
}

export async function deleteAssignment(id) {
  const { error } = await supabase.from('affectations').delete().eq('id', id)
  if (error) throw error
}

export async function updateAssignment(id, changes) {
  const { error } = await supabase.from('affectations').update(changes).eq('id', id)
  if (error) throw error
}

export async function updateAssignments(ids, changes) {
  if (!ids.length) return
  const { error } = await supabase.from('affectations').update(changes).in('id', ids)
  if (error) throw error
}

export async function resolveAlert(id, userId) {
  const { error } = await supabase
    .from('alertes')
    .update({ resolue: true, resolue_par: userId, resolue_a: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function uploadSiteDocument({ profile, siteId, type, file }) {
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${profile.entreprise_id}/${siteId}/${crypto.randomUUID()}-${safeName}`
  const upload = await supabase.storage.from('chantier-documents').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) throw upload.error

  const insert = await supabase.from('documents_chantier').insert({
    entreprise_id: profile.entreprise_id,
    chantier_id: siteId,
    type_document: type,
    nom_fichier: file.name,
    storage_path: path,
    mime_type: file.type,
    taille_octets: file.size,
    ajoute_par: profile.id,
  })
  if (insert.error) {
    await supabase.storage.from('chantier-documents').remove([path])
    throw insert.error
  }
}

export async function openSiteDocument(path) {
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  const { data, error } = await supabase.storage
    .from('chantier-documents')
    .createSignedUrl(path, 300)
  if (error) {
    popup?.close()
    throw error
  }
  if (popup) popup.location = data.signedUrl
  else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function saveLogistics(payload) {
  const { error } = await supabase.from('operations_logistiques').insert(payload)
  if (error) throw error
}

export async function saveVehicle(payload) {
  const { error } = await supabase.from('vehicules').insert(payload)
  if (error) throw error
}

export async function saveSite(payload) {
  const { error } = await supabase.from('chantiers').insert(payload)
  if (error) throw error
}

export async function loadTerrainData(date = localDate()) {
  const assignments = await supabase
    .from('affectations')
    .select('*, chantiers(*), compagnons(*), vehicules(*)')
    .eq('jour', date)
    .neq('statut', 'annulee')
    .order('created_at')
  if (assignments.error) throw assignments.error

  const siteIds = [...new Set(assignments.data.map((item) => item.chantier_id))]
  const documents = siteIds.length
    ? await supabase
        .from('documents_chantier')
        .select('*')
        .in('chantier_id', siteIds)
        .eq('visible_terrain', true)
        .order('created_at', { ascending: false })
    : { data: [], error: null }
  if (documents.error) throw documents.error

  const logistics = siteIds.length
    ? await supabase
        .from('operations_logistiques')
        .select('*, vehicules(*)')
        .in('chantier_id', siteIds)
        .gte('debut_prevu', new Date().toISOString())
        .neq('statut', 'annulee')
        .order('debut_prevu')
    : { data: [], error: null }
  if (logistics.error) throw logistics.error

  const people = await supabase.from('compagnons').select('*').eq('actif', true).order('nom_complet')
  if (people.error) throw people.error

  const vehicles = await supabase.from('vehicules').select('*').eq('actif', true).order('libelle')
  if (vehicles.error) throw vehicles.error

  return {
    assignments: assignments.data.map((item) => ({
      ...item,
      chantiers: unwrap(item.chantiers),
      compagnons: unwrap(item.compagnons),
      vehicules: unwrap(item.vehicules),
    })),
    people: people.data,
    vehicles: vehicles.data,
    documents: documents.data,
    logistics: logistics.data.map((item) => ({ ...item, vehicules: unwrap(item.vehicules) })),
  }
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

async function sendPunch(item) {
  const { error } = await supabase.rpc('enregistrer_pointage', {
    p_client_uuid: item.clientUuid,
    p_compagnon_id: item.personId,
    p_chantier_id: item.siteId,
    p_action: item.action,
    p_pointe_a: item.eventAt,
    p_note: item.note || null,
    p_source: 'web-terrain',
  })
  if (error) throw error
}

export async function flushPunchQueue() {
  if (!supabase || !navigator.onLine) return readQueue().length
  const queue = readQueue()
  const remaining = []
  for (const item of queue) {
    try {
      await sendPunch(item)
    } catch {
      remaining.push(item)
    }
  }
  writeQueue(remaining)
  return remaining.length
}

export async function recordPunches({ personIds, siteId, action, note }) {
  const items = personIds.map((personId) => ({
    clientUuid: crypto.randomUUID(),
    personId,
    siteId,
    action,
    eventAt: new Date().toISOString(),
    note,
  }))

  if (!supabase || !navigator.onLine) {
    writeQueue([...readQueue(), ...items])
    return { queued: items.length }
  }

  const failed = []
  for (const item of items) {
    try {
      await sendPunch(item)
    } catch (error) {
      failed.push(item)
      if (!String(error.message || '').toLowerCase().includes('fetch')) throw error
    }
  }
  if (failed.length) writeQueue([...readQueue(), ...failed])
  return { queued: failed.length }
}

export { isSupabaseConfigured, supabase }
