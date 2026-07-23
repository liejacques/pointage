import { isSupabaseConfigured, supabase } from '../lib/supabase'

const OFFLINE_QUEUE_KEY = 'aetheris-pointages-en-attente'
const SHORT_LOGIN_DOMAIN = 'login.aetheris.local'
const PARIS_TIMEZONE = 'Europe/Paris'

export function normalizeShortIdentifier(value) {
  return String(value || '').trim().toLocaleLowerCase('fr')
}

function technicalPassword(shortPassword) {
  return `Ae26!${shortPassword}`
}

export function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: PARIS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function dayRange(date) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatTimeValue(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function fullName(person) {
  return [person?.prenom, person?.nom].filter(Boolean).join(' ').trim() || 'Utilisateur'
}

function normalizePerson(person) {
  return {
    ...person,
    nom_complet: fullName(person),
    initiales: person.initials || fullName(person)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  }
}

function normalizeSite(site) {
  return {
    ...site,
    reference: site.no || 'SANS RÉF.',
    nom: site.label || site.client || 'Chantier',
    ville: site.city || '',
    adresse: site.adresse_chantier || '',
    code_postal: '',
    client_nom: site.client || '',
  }
}

function normalizeDocument(document) {
  return {
    ...document,
    type_document: document.categorie_metier || (document.type === 'pdf' ? 'autre' : document.type),
    nom_fichier: document.nom,
    storage_path: document.chemin_fichier,
    mime_type: document.mime_type,
    taille_octets: document.taille,
    chantiers: document.chantiers ? normalizeSite(document.chantiers) : null,
  }
}

function assignmentParts(id) {
  const [planningEntryId, personId] = String(id || '').split(':')
  if (!planningEntryId || !personId) throw new Error('Affectation invalide.')
  return { planningEntryId, personId }
}

function normalizeAssignments({ planning, sites, people, vehicles, details }) {
  const siteById = new Map(sites.map((site) => [site.id, normalizeSite(site)]))
  const personById = new Map(people.map((person) => [person.id, normalizePerson(person)]))
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const detailByKey = new Map(details.map((detail) => [
    `${detail.planning_entry_id}:${detail.compagnon_id}`,
    detail,
  ]))

  return planning.flatMap((entry) => (entry.compagnon_ids || []).map((personId) => {
    const detail = detailByKey.get(`${entry.id}:${personId}`)
    const vehicle = detail?.vehicule_id ? vehicleById.get(detail.vehicule_id) : null
    return {
      id: `${entry.id}:${personId}`,
      planning_entry_id: entry.id,
      entreprise_id: entry.entreprise_id,
      chantier_id: entry.chantier_id,
      compagnon_id: personId,
      vehicule_id: detail?.vehicule_id || null,
      jour: localDate(new Date(entry.date_debut)),
      heure_debut_prevue: formatTimeValue(entry.date_debut),
      heure_fin_prevue: formatTimeValue(entry.date_fin),
      inclus_pointage: detail?.inclus_pointage ?? true,
      statut: 'confirmee',
      chantiers: siteById.get(entry.chantier_id) || null,
      compagnons: personById.get(personId) || null,
      vehicules: vehicle || null,
    }
  }))
}

function actionFromEvent(event) {
  const explicit = String(event.note || '').match(/(?:^|\n)action:([a-z_]+)/)?.[1]
  if (explicit) return explicit
  if (event.activite === 'pause') return 'pause'
  if (event.activite === 'admin') return 'reunion'
  if (event.activite === 'preparation') return 'enlevement_materiaux'
  return 'debut_activite'
}

function eventPunches(events, personById, siteById) {
  return events.flatMap((event) => {
    const common = {
      compagnon_id: event.compagnon_id,
      chantier_id: event.chantier_id,
      compagnons: personById.get(event.compagnon_id) || null,
      chantiers: siteById.get(event.chantier_id) || null,
    }
    const punches = [{
      ...common,
      id: `${event.id}-start`,
      action: actionFromEvent(event),
      pointe_a: event.debut,
    }]
    if (event.fin) {
      punches.push({
        ...common,
        id: `${event.id}-finish`,
        action: 'fin_activite',
        pointe_a: event.fin,
      })
    }
    return punches
  }).sort((a, b) => new Date(b.pointe_a) - new Date(a.pointe_a))
}

function dailyReports(assignments, events) {
  return assignments.map((assignment) => {
    const personEvents = events
      .filter((event) => event.compagnon_id === assignment.compagnon_id)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut))
    const workedMs = personEvents.reduce((sum, event) => {
      if (event.activite === 'pause') return sum
      const end = event.fin ? new Date(event.fin) : new Date()
      return sum + Math.max(end - new Date(event.debut), 0)
    }, 0)
    const finishedEvents = personEvents.filter((event) => event.fin)
    return {
      affectation_id: assignment.id,
      entreprise_id: assignment.entreprise_id,
      jour: assignment.jour,
      chantier_id: assignment.chantier_id,
      chantier_reference: assignment.chantiers?.reference,
      chantier_nom: assignment.chantiers?.nom,
      compagnon_id: assignment.compagnon_id,
      compagnon_nom: assignment.compagnons?.nom_complet,
      premier_pointage: personEvents[0]?.debut || null,
      dernier_pointage: finishedEvents.at(-1)?.fin || null,
      minutes_travaillees: Math.round(workedMs / 60_000),
      nombre_pointages: personEvents.length + finishedEvents.length,
      journee_terminee: personEvents.length > 0 && personEvents.every((event) => event.fin),
    }
  }).sort((a, b) => String(a.compagnon_nom).localeCompare(String(b.compagnon_nom), 'fr'))
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
  const { data, error } = await supabase.rpc('get_pointage_user_context_v1')
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
    .select('id, nom, prenom, identifiant_court, role, actif, created_at, profil_modules(module)')
    .not('identifiant_court', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((profile) => {
    const person = normalizePerson(profile)
    return {
      ...profile,
      nom_complet: person.nom_complet,
      initiales: person.initiales,
      modules: (profile.profil_modules || []).map((item) => item.module),
    }
  })
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

async function loadOperationalData(date, { refreshAlerts = false } = {}) {
  const { start, end } = dayRange(date)
  if (refreshAlerts) {
    const refreshed = await supabase.rpc('refresh_alertes_pointage_v1', { p_jour: date })
    if (refreshed.error) throw refreshed.error
  }

  const [
    sitesResult,
    peopleResult,
    vehiclesResult,
    planningResult,
    detailsResult,
    eventsResult,
    alertsResult,
    documentsResult,
    logisticsResult,
  ] = await Promise.all([
    supabase.from('chantiers').select('*').order('no'),
    supabase
      .from('compagnons')
      .select('id, entreprise_id, profil_id, nom, prenom, initials, role, couleur, actif, created_at, updated_at')
      .eq('actif', true)
      .order('nom'),
    supabase.from('vehicules').select('*').eq('actif', true).order('libelle'),
    supabase
      .from('planning_entries')
      .select('*')
      .lt('date_debut', end)
      .gt('date_fin', start)
      .order('date_debut'),
    supabase.from('planning_affectation_details').select('*'),
    supabase
      .from('pointage_evenements')
      .select('*')
      .gte('debut', start)
      .lt('debut', end)
      .order('debut', { ascending: false }),
    supabase
      .from('alertes_pointage')
      .select('*, chantiers(*)')
      .eq('jour', date)
      .eq('resolue', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('*, chantiers(*)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('operations_logistiques')
      .select('*, chantiers(*), vehicules(*)')
      .gte('debut_prevu', start)
      .order('debut_prevu'),
  ])

  const results = [
    sitesResult,
    peopleResult,
    vehiclesResult,
    planningResult,
    detailsResult,
    eventsResult,
    alertsResult,
    documentsResult,
    logisticsResult,
  ]
  const failed = results.find((result) => result.error)
  if (failed) throw failed.error

  const sites = sitesResult.data.filter((site) => !['termine', 'facture'].includes(site.statut))
  const people = peopleResult.data.map(normalizePerson)
  const assignments = normalizeAssignments({
    planning: planningResult.data,
    sites,
    people,
    vehicles: vehiclesResult.data,
    details: detailsResult.data,
  })
  const personById = new Map(people.map((person) => [person.id, person]))
  const siteById = new Map(sites.map((site) => [site.id, normalizeSite(site)]))
  const punches = eventPunches(eventsResult.data, personById, siteById)

  return {
    sites: sites.map(normalizeSite),
    people,
    vehicles: vehiclesResult.data,
    assignments,
    events: eventsResult.data,
    punches,
    reports: dailyReports(assignments, eventsResult.data),
    alerts: alertsResult.data.map((alert) => ({
      ...alert,
      chantiers: alert.chantiers ? normalizeSite(alert.chantiers) : null,
      compagnons: personById.get(alert.compagnon_id) || null,
    })),
    documents: documentsResult.data.map(normalizeDocument),
    logistics: logisticsResult.data
      .filter((operation) => operation.statut !== 'annulee')
      .map((operation) => ({
        ...operation,
        chantiers: operation.chantiers ? normalizeSite(operation.chantiers) : null,
        vehicules: operation.vehicules || null,
      })),
  }
}

export async function loadConductorData(date = localDate()) {
  return loadOperationalData(date, { refreshAlerts: true })
}

export function subscribeToConductorData(entrepriseId, onChange) {
  if (!supabase || !entrepriseId) return () => {}
  const channel = supabase
    .channel(`conducteur-${entrepriseId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'pointage_evenements',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'planning_entries',
      filter: `entreprise_id=eq.${entrepriseId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'alertes_pointage',
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

export async function saveAssignment({ siteId, personId, vehicleId, date }) {
  const { error } = await supabase.rpc('enregistrer_affectation_pointage_v1', {
    p_chantier_id: siteId,
    p_compagnon_id: personId,
    p_vehicule_id: vehicleId || null,
    p_jour: date,
    p_heure_debut: '07:30',
    p_heure_fin: '17:00',
  })
  if (error) throw error
}

export async function deleteAssignment(id) {
  const { planningEntryId, personId } = assignmentParts(id)
  const { error } = await supabase.rpc('supprimer_affectation_pointage_v1', {
    p_planning_entry_id: planningEntryId,
    p_compagnon_id: personId,
  })
  if (error) throw error
}

export async function updateAssignment(id, changes) {
  const { planningEntryId, personId } = assignmentParts(id)
  const changesVehicle = Object.hasOwn(changes, 'vehicule_id')
  const { error } = await supabase.rpc('modifier_affectation_pointage_v1', {
    p_planning_entry_id: planningEntryId,
    p_compagnon_id: personId,
    p_inclus_pointage: Object.hasOwn(changes, 'inclus_pointage') ? changes.inclus_pointage : null,
    p_vehicule_id: changesVehicle ? changes.vehicule_id : null,
    p_change_vehicule: changesVehicle,
  })
  if (error) throw error
}

export async function updateAssignments(ids, changes) {
  await Promise.all(ids.map((id) => updateAssignment(id, changes)))
}

export async function resolveAlert(id) {
  const { error } = await supabase.rpc('resoudre_alerte_pointage_v1', {
    p_alerte_id: id,
  })
  if (error) throw error
}

export async function uploadSiteDocument({ profile, siteId, type, file }) {
  const safeName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${profile.entreprise_id}/${siteId}/${crypto.randomUUID()}-${safeName}`
  const upload = await supabase.storage.from('documents').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) throw upload.error

  const register = await supabase.rpc('enregistrer_document_pointage_v1', {
    p_chantier_id: siteId,
    p_categorie: type,
    p_nom: file.name,
    p_chemin: path,
    p_mime_type: file.type || 'application/octet-stream',
    p_taille: file.size,
  })
  if (register.error) {
    await supabase.storage.from('documents').remove([path])
    throw register.error
  }
}

export async function openSiteDocument(path) {
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 300)
  if (error) {
    popup?.close()
    throw error
  }
  if (popup) popup.location = data.signedUrl
  else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function saveLogistics(payload) {
  const { error } = await supabase.rpc('creer_operation_logistique_pointage_v1', {
    p_chantier_id: payload.chantier_id,
    p_type_operation: payload.type_operation,
    p_debut_prevu: payload.debut_prevu,
    p_fournisseur: payload.fournisseur,
    p_chauffeur_nom: payload.chauffeur_nom,
    p_chauffeur_telephone: payload.chauffeur_telephone,
    p_vehicule_id: payload.vehicule_id,
    p_camion_externe: payload.camion_externe,
    p_capacite: payload.capacite,
    p_chargement: payload.chargement,
    p_note: payload.note,
  })
  if (error) throw error
}

export async function saveVehicle(payload) {
  const { error } = await supabase.rpc('creer_vehicule_pointage_v1', {
    p_libelle: payload.libelle,
    p_immatriculation: payload.immatriculation,
    p_type: payload.type_vehicule,
    p_capacite: payload.capacite,
  })
  if (error) throw error
}

export async function saveSite(payload) {
  const { error } = await supabase.rpc('creer_chantier_pointage_v1', {
    p_reference: payload.reference,
    p_nom: payload.nom,
    p_adresse: payload.adresse,
    p_code_postal: payload.code_postal,
    p_ville: payload.ville,
  })
  if (error) throw error
}

export async function loadTerrainData(date = localDate()) {
  const data = await loadOperationalData(date)
  const siteIds = new Set(data.assignments.map((assignment) => assignment.chantier_id))
  return {
    assignments: data.assignments,
    people: data.people,
    vehicles: data.vehicles,
    documents: data.documents.filter((document) => (
      document.visible_terrain && siteIds.has(document.chantier_id)
    )),
    logistics: data.logistics.filter((operation) => (
      siteIds.has(operation.chantier_id) && new Date(operation.debut_prevu) >= new Date()
    )),
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

const ACTION_ACTIVITY = {
  start: 'production',
  fabrication: 'production',
  pause: 'pause',
  instruction: 'admin',
  meeting: 'admin',
  materials: 'preparation',
}

async function sendPunch(item) {
  if (item.action === 'finish') {
    const { error } = await supabase.rpc('terminer_pointage_v2', {
      p_compagnon_id: item.personId,
      p_fin: item.eventAt,
      p_client_action_id: item.clientUuid,
    })
    if (error) throw error
    return
  }

  const { error } = await supabase.rpc('demarrer_pointage_v2', {
    p_compagnon_id: item.personId,
    p_activite: ACTION_ACTIVITY[item.action] || 'autre',
    p_chantier_id: item.siteId,
    p_debut: item.eventAt,
    p_source: 'chef',
    p_confiance: 'haute',
    p_note: [`action:${item.action}`, item.note].filter(Boolean).join('\n'),
    p_client_action_id: item.clientUuid,
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
