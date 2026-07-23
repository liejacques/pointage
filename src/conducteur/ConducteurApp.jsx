import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { demoConductorData } from '../demoData'
import {
  deleteAssignment,
  loadConductorData,
  localDate,
  openSiteDocument,
  resolveAlert,
  saveAssignment,
  saveLogistics,
  saveSite,
  saveVehicle,
  subscribeToConductorData,
  uploadSiteDocument,
} from '../services/aetherisApi'

const NAVIGATION = [
  ['direct', 'Direct'],
  ['planning', 'Planning'],
  ['heures', 'Heures'],
  ['documents', 'Documents'],
  ['logistique', 'Logistique'],
  ['ressources', 'Chantiers & véhicules'],
]

const ACTIONS = {
  debut_activite: 'Début d’activité',
  faconnage: 'Façonnage',
  pause: 'Pause',
  fin_activite: 'Fin d’activité',
  consigne: 'Consigne',
  reunion: 'Réunion',
  enlevement_materiaux: 'Enlèvement matériaux',
  carburant: 'Carburant',
  panne_vehicule: 'Panne véhicule',
  enlevement_fournisseur: 'Enlèvement fournisseur',
  grutage: 'Grutage',
  approvisionnement: 'Approvisionnement',
}

const EMPTY_DATA = {
  sites: [], people: [], vehicles: [], assignments: [], punches: [],
  reports: [], alerts: [], documents: [], logistics: [],
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatHours(minutes = 0) {
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}

function relativeState(lastPunch) {
  if (!lastPunch) return { label: 'Pas encore pointé', tone: 'missing' }
  if (lastPunch.action === 'fin_activite') return { label: `Terminé à ${formatTime(lastPunch.pointe_a)}`, tone: 'done' }
  if (lastPunch.action === 'pause') return { label: `En pause depuis ${formatTime(lastPunch.pointe_a)}`, tone: 'pause' }
  return { label: `En activité · ${formatTime(lastPunch.pointe_a)}`, tone: 'live' }
}

function Field({ label, children }) {
  return <label className="control-field"><span>{label}</span>{children}</label>
}

function Empty({ children }) {
  return <div className="conductor-empty">{children}</div>
}

function DirectView({ data, date, onResolve }) {
  const bySite = data.sites
    .map((site) => ({
      site,
      assignments: data.assignments.filter((item) => item.chantier_id === site.id),
    }))
    .filter((item) => item.assignments.length)

  return (
    <div className="direct-layout">
      <section className="live-sites">
        <div className="section-heading"><div><span>PRÉSENCE TERRAIN</span><h2>Qui est sur quel chantier</h2></div><em>{date}</em></div>
        <div className="site-live-grid">
          {bySite.map(({ site, assignments }) => (
            <article className="live-site-card" key={site.id}>
              <header><div><span>CHANTIER {site.reference}</span><strong>{site.nom}</strong><em>{site.ville}</em></div><b>{assignments.length}</b></header>
              <div className="live-people">
                {assignments.map((assignment) => {
                  const last = data.punches.find((punch) => punch.compagnon_id === assignment.compagnon_id)
                  const state = relativeState(last)
                  return (
                    <div className="live-person" key={assignment.id}>
                      <span className="conductor-avatar">{assignment.compagnons?.initiales}</span>
                      <div><strong>{assignment.compagnons?.nom_complet}</strong><em>{assignment.vehicules ? `${assignment.vehicules.libelle} · ${assignment.vehicules.immatriculation}` : 'Sans véhicule'}</em></div>
                      <b className={`live-state ${state.tone}`}>{state.label}</b>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
          {!bySite.length && <Empty>Aucune équipe planifiée pour cette date.</Empty>}
        </div>
      </section>

      <aside className="direct-side">
        <section className="alerts-panel">
          <div className="section-heading compact"><div><span>À CONTRÔLER</span><h2>Alertes ouvertes</h2></div><b>{data.alerts.length}</b></div>
          <div className="alert-list">
            {data.alerts.map((alert) => (
              <article className={`alert-item severity-${alert.severite}`} key={alert.id}>
                <span>!</span><div><strong>{alert.message}</strong><em>{alert.chantiers ? `Chantier ${alert.chantiers.reference}` : 'Affectation'}</em></div>
                <button onClick={() => onResolve(alert.id)}>TRAITÉ</button>
              </article>
            ))}
            {!data.alerts.length && <Empty>Aucune alerte ouverte.</Empty>}
          </div>
        </section>
        <section className="feed-panel">
          <div className="section-heading compact"><div><span>TEMPS RÉEL</span><h2>Derniers pointages</h2></div><i className="live-dot" /></div>
          <div className="punch-feed">
            {data.punches.slice(0, 12).map((punch) => (
              <div key={punch.id}><time>{formatTime(punch.pointe_a)}</time><span className="conductor-avatar small">{punch.compagnons?.initiales}</span><p><strong>{punch.compagnons?.nom_complet}</strong><span>{ACTIONS[punch.action] || punch.action} · {punch.chantiers?.reference}</span></p></div>
            ))}
            {!data.punches.length && <Empty>Aucun pointage reçu.</Empty>}
          </div>
        </section>
      </aside>
    </div>
  )
}

function PlanningView({ data, date, setDate, onAdd, onDelete, busy }) {
  const [form, setForm] = useState({ siteId: '', personId: '', vehicleId: '' })
  const grouped = data.sites.map((site) => ({
    site,
    assignments: data.assignments.filter((item) => item.chantier_id === site.id),
  })).filter((group) => group.assignments.length)

  function submit(event) {
    event.preventDefault()
    if (!form.siteId || !form.personId) return
    onAdd(form)
  }

  return (
    <div className="workspace-stack">
      <section className="control-bar">
        <div><span>PLANNING TERRAIN</span><h2>Affecter les équipes</h2></div>
        <Field label="JOUR"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      </section>
      <section className="planning-composer">
        <div><span>NOUVELLE AFFECTATION</span><strong>Placer une personne sur un chantier</strong></div>
        <form onSubmit={submit}>
          <Field label="CHANTIER"><select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}><option value="">Choisir…</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.reference} · {site.nom}</option>)}</select></Field>
          <Field label="PERSONNE"><select value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })}><option value="">Choisir…</option>{data.people.map((person) => <option key={person.id} value={person.id}>{person.nom_complet}</option>)}</select></Field>
          <Field label="VÉHICULE"><select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}><option value="">Aucun</option>{data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.libelle} · {vehicle.immatriculation}</option>)}</select></Field>
          <button disabled={busy}>AFFECTER</button>
        </form>
      </section>
      <section className="planning-board">
        {grouped.map(({ site, assignments }) => (
          <article className="planning-site" key={site.id}>
            <header><span>{site.reference}</span><div><strong>{site.nom}</strong><em>{site.ville}</em></div><b>{assignments.length} pers.</b></header>
            {assignments.map((assignment) => (
              <div className="planning-row" key={assignment.id}>
                <span className="conductor-avatar">{assignment.compagnons?.initiales}</span>
                <strong>{assignment.compagnons?.nom_complet}</strong>
                <em>{assignment.vehicules ? `${assignment.vehicules.libelle} · ${assignment.vehicules.immatriculation}` : 'Sans véhicule'}</em>
                <time>{String(assignment.heure_debut_prevue || '07:30').slice(0, 5)} — {String(assignment.heure_fin_prevue || '17:00').slice(0, 5)}</time>
                <button onClick={() => onDelete(assignment.id)} aria-label={`Retirer ${assignment.compagnons?.nom_complet}`}>×</button>
              </div>
            ))}
          </article>
        ))}
        {!grouped.length && <Empty>Le planning est vide pour cette date.</Empty>}
      </section>
    </div>
  )
}

function HoursView({ data, date, setDate }) {
  const total = data.reports.reduce((sum, report) => sum + (report.minutes_travaillees || 0), 0)
  return (
    <div className="workspace-stack">
      <section className="control-bar">
        <div><span>RAPPORT JOURNALIER</span><h2>Heures et pointages réalisés</h2></div>
        <div className="hours-total"><span>TOTAL ÉQUIPE</span><strong>{formatHours(total)}</strong></div>
        <Field label="JOUR"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      </section>
      <section className="hours-table">
        <header><span>Personne</span><span>Chantier</span><span>Début</span><span>Fin</span><span>Pointages</span><span>Heures</span><span>État</span></header>
        {data.reports.map((report) => (
          <div key={report.affectation_id}>
            <strong>{report.compagnon_nom}</strong>
            <span>{report.chantier_reference} · {report.chantier_nom}</span>
            <time>{formatTime(report.premier_pointage)}</time>
            <time>{formatTime(report.dernier_pointage)}</time>
            <b>{report.nombre_pointages}</b>
            <strong>{formatHours(report.minutes_travaillees)}</strong>
            <em className={report.journee_terminee ? 'report-done' : report.nombre_pointages ? 'report-live' : 'report-missing'}>{report.journee_terminee ? 'Terminée' : report.nombre_pointages ? 'En cours' : 'Manquant'}</em>
          </div>
        ))}
        {!data.reports.length && <Empty>Aucun rapport pour cette date.</Empty>}
      </section>
    </div>
  )
}

function DocumentsView({ data, onUpload, onOpen, busy, demo }) {
  const [siteId, setSiteId] = useState('')
  const [type, setType] = useState('devis')
  const [file, setFile] = useState(null)

  function submit(event) {
    event.preventDefault()
    if (siteId && file) onUpload({ siteId, type, file }).then(() => setFile(null))
  }

  return (
    <div className="documents-layout">
      <section className="upload-card">
        <span>AJOUTER UN DOCUMENT</span><h2>Classer le PDF sur le bon chantier</h2>
        <form onSubmit={submit}>
          <Field label="CHANTIER"><select value={siteId} onChange={(event) => setSiteId(event.target.value)} required><option value="">Choisir…</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.reference} · {site.nom}</option>)}</select></Field>
          <Field label="TYPE"><select value={type} onChange={(event) => setType(event.target.value)}><option value="devis">Devis</option><option value="plan">Plan</option><option value="bon_livraison">Bon de livraison</option><option value="consigne">Consigne</option><option value="rapport">Rapport</option><option value="autre">Autre</option></select></Field>
          <label className="file-drop"><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /><strong>{file ? file.name : 'Choisir un PDF ou une image'}</strong><span>25 Mo maximum</span></label>
          <button disabled={busy || !file || !siteId || demo}>{demo ? 'DISPONIBLE AVEC SUPABASE' : 'ENVOYER AU CHANTIER'}</button>
        </form>
      </section>
      <section className="document-register">
        <div className="section-heading"><div><span>REGISTRE</span><h2>Documents chantier</h2></div><b>{data.documents.length}</b></div>
        <div>
          {data.documents.map((document) => (
            <article key={document.id}><span className="pdf-badge">{document.type_document === 'devis' ? 'DEVIS' : 'PDF'}</span><div><strong>{document.nom_fichier}</strong><em>{document.chantiers?.reference} · {document.chantiers?.nom}</em></div><time>{new Intl.DateTimeFormat('fr-FR').format(new Date(document.created_at))}</time><button onClick={() => onOpen(document)}>OUVRIR</button></article>
          ))}
          {!data.documents.length && <Empty>Aucun document classé.</Empty>}
        </div>
      </section>
    </div>
  )
}

function LogisticsView({ data, profile, onSave, busy, demo }) {
  const firstSite = data.sites[0]?.id || ''
  const [form, setForm] = useState({
    siteId: firstSite, type: 'livraison', at: '', supplier: '', driver: '',
    phone: '', vehicleId: '', externalTruck: '', capacity: '', cargo: '', note: '',
  })
  const next = data.logistics[0]

  function submit(event) {
    event.preventDefault()
    if (!form.siteId || !form.at) return
    onSave({
      entreprise_id: profile.entreprise_id,
      chantier_id: form.siteId,
      type_operation: form.type,
      statut: 'planifiee',
      debut_prevu: new Date(form.at).toISOString(),
      fournisseur: form.supplier || null,
      chauffeur_nom: form.driver || null,
      chauffeur_telephone: form.phone || null,
      vehicule_id: form.vehicleId || null,
      camion_externe: form.externalTruck || null,
      capacite: form.capacity || null,
      chargement: form.cargo.split('\n').map((line) => line.trim()).filter(Boolean),
      note: form.note || null,
      cree_par: profile.id,
    })
  }

  return (
    <div className="logistics-layout">
      <section className="next-movement">
        <span>PROCHAIN MOUVEMENT</span>
        {next ? (
          <>
            <header><div><em>{next.type_operation}</em><h2>{formatDateTime(next.debut_prevu)}</h2><strong>Chantier {next.chantiers?.reference} · {next.chantiers?.nom}</strong></div><b>{next.statut}</b></header>
            <div className="movement-facts">
              <div><span>CHAUFFEUR</span><strong>{next.chauffeur_nom || 'Non communiqué'}</strong><a href={next.chauffeur_telephone ? `tel:${next.chauffeur_telephone.replace(/\s/g, '')}` : undefined}>{next.chauffeur_telephone || 'Numéro non disponible'}</a></div>
              <div><span>CAMION / CAPACITÉ</span><strong>{next.vehicules ? `${next.vehicules.libelle} · ${next.vehicules.immatriculation}` : next.camion_externe || 'Non défini'}</strong><em>{next.capacite || 'Capacité non renseignée'}</em></div>
            </div>
            <div className="movement-cargo"><span>CE QUI ARRIVE SUR LE CHANTIER</span>{(next.chargement || []).map((item) => <strong key={item}>✓ {item}</strong>)}</div>
          </>
        ) : <Empty>Aucun mouvement planifié aujourd’hui.</Empty>}
      </section>
      <section className="logistics-form-card">
        <span>PLANIFIER</span><h2>Grutage, livraison ou approvisionnement</h2>
        <form onSubmit={submit}>
          <div className="form-grid two">
            <Field label="CHANTIER"><select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.reference} · {site.nom}</option>)}</select></Field>
            <Field label="TYPE"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="livraison">Livraison</option><option value="grutage">Grutage</option><option value="approvisionnement">Approvisionnement</option><option value="enlevement">Enlèvement</option></select></Field>
            <Field label="DATE ET HEURE"><input type="datetime-local" value={form.at} onChange={(event) => setForm({ ...form, at: event.target.value })} required /></Field>
            <Field label="FOURNISSEUR"><input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Entreprise" /></Field>
            <Field label="CHAUFFEUR"><input value={form.driver} onChange={(event) => setForm({ ...form, driver: event.target.value })} placeholder="Nom si disponible" /></Field>
            <Field label="TÉLÉPHONE"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="06…" /></Field>
            <Field label="VÉHICULE AETHERIS"><select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}><option value="">Camion externe</option>{data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.libelle} · {vehicle.immatriculation}</option>)}</select></Field>
            <Field label="CAMION EXTERNE"><input value={form.externalTruck} onChange={(event) => setForm({ ...form, externalTruck: event.target.value })} placeholder="Type de camion" /></Field>
            <Field label="CAPACITÉ"><input value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="26 t · portée 18 m" /></Field>
          </div>
          <Field label="CHARGEMENT — UNE LIGNE PAR ÉLÉMENT"><textarea value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} placeholder={'12 rouleaux de zinc\n6 palettes de volige'} /></Field>
          <Field label="CONSIGNES"><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Accès, déchargement, contact…" /></Field>
          <button disabled={busy || demo}>{demo ? 'DISPONIBLE AVEC SUPABASE' : 'PLANIFIER LE MOUVEMENT'}</button>
        </form>
      </section>
    </div>
  )
}

function ResourcesView({ data, profile, onSite, onVehicle, busy, demo }) {
  const [site, setSite] = useState({ reference: '', nom: '', adresse: '', codePostal: '', ville: '' })
  const [vehicle, setVehicle] = useState({ libelle: '', plate: '', type: '', capacity: '' })

  return (
    <div className="resources-layout">
      <section>
        <div className="section-heading"><div><span>CHANTIERS</span><h2>{data.sites.length} chantiers accessibles</h2></div></div>
        <form className="resource-form" onSubmit={(event) => {
          event.preventDefault()
          onSite({
            entreprise_id: profile.entreprise_id,
            reference: site.reference,
            nom: site.nom,
            adresse: site.adresse,
            code_postal: site.codePostal,
            ville: site.ville,
            conducteur_id: profile.role === 'conducteur' ? profile.id : null,
            statut: 'a_planifier',
          })
        }}>
          <Field label="RÉFÉRENCE"><input value={site.reference} onChange={(event) => setSite({ ...site, reference: event.target.value })} required /></Field>
          <Field label="NOM DU CHANTIER"><input value={site.nom} onChange={(event) => setSite({ ...site, nom: event.target.value })} required /></Field>
          <Field label="ADRESSE"><input value={site.adresse} onChange={(event) => setSite({ ...site, adresse: event.target.value })} required /></Field>
          <Field label="CODE POSTAL"><input value={site.codePostal} onChange={(event) => setSite({ ...site, codePostal: event.target.value })} /></Field>
          <Field label="VILLE"><input value={site.ville} onChange={(event) => setSite({ ...site, ville: event.target.value })} required /></Field>
          <button disabled={busy || demo}>AJOUTER LE CHANTIER</button>
        </form>
        <div className="resource-list">{data.sites.map((item) => <div key={item.id}><b>{item.reference}</b><strong>{item.nom}</strong><em>{item.ville}</em><span>{item.statut}</span></div>)}</div>
      </section>
      <section>
        <div className="section-heading"><div><span>PARC</span><h2>{data.vehicles.length} véhicules actifs</h2></div></div>
        <form className="resource-form" onSubmit={(event) => {
          event.preventDefault()
          onVehicle({
            entreprise_id: profile.entreprise_id,
            libelle: vehicle.libelle,
            immatriculation: vehicle.plate || null,
            type_vehicule: vehicle.type || null,
            capacite: vehicle.capacity || null,
          })
        }}>
          <Field label="NOM"><input value={vehicle.libelle} onChange={(event) => setVehicle({ ...vehicle, libelle: event.target.value })} required placeholder="Renault Master" /></Field>
          <Field label="IMMATRICULATION"><input value={vehicle.plate} onChange={(event) => setVehicle({ ...vehicle, plate: event.target.value.toUpperCase() })} /></Field>
          <Field label="TYPE"><input value={vehicle.type} onChange={(event) => setVehicle({ ...vehicle, type: event.target.value })} placeholder="Fourgon, porteur-grue…" /></Field>
          <Field label="CAPACITÉ"><input value={vehicle.capacity} onChange={(event) => setVehicle({ ...vehicle, capacity: event.target.value })} /></Field>
          <button disabled={busy || demo}>AJOUTER LE VÉHICULE</button>
        </form>
        <div className="resource-list">{data.vehicles.map((item) => <div key={item.id}><b>{item.immatriculation || '—'}</b><strong>{item.libelle}</strong><em>{item.type_vehicule || 'Type non renseigné'}</em><span>{item.capacite || '—'}</span></div>)}</div>
      </section>
    </div>
  )
}

export default function ConducteurApp({ profile, demo = false, onLogout }) {
  const [tab, setTab] = useState('direct')
  const [date, setDate] = useState(localDate())
  const [data, setData] = useState(demo ? demoConductorData : EMPTY_DATA)
  const [loading, setLoading] = useState(!demo)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(demo ? 'Mode démonstration — les données ne sont pas enregistrées.' : '')
  const refreshTimer = useRef(null)

  const refresh = useCallback(async () => {
    if (demo) return
    setLoading(true)
    try {
      setData(await loadConductorData(date))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [date, demo])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (demo) return undefined
    return subscribeToConductorData(profile.entreprise_id, () => {
      window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(refresh, 250)
    })
  }, [demo, profile.entreprise_id, refresh])

  const stats = useMemo(() => {
    const pointed = new Set(data.punches.filter((item) => item.action === 'debut_activite').map((item) => item.compagnon_id)).size
    return {
      teams: new Set(data.assignments.map((item) => item.chantier_id)).size,
      assigned: data.assignments.length,
      pointed,
      missing: Math.max(data.assignments.length - pointed, 0),
    }
  }, [data.assignments, data.punches])

  async function mutate(operation, success) {
    if (demo) {
      setMessage('Mode démonstration : reliez Supabase pour enregistrer.')
      return
    }
    setBusy(true)
    try {
      await operation()
      setMessage(success)
      await refresh()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="conductor-shell">
      <header className="conductor-header">
        <div className="conductor-brand"><span className="erp-mark" /><div>AETHERIS<strong>CONDUITE DE TRAVAUX</strong></div></div>
        <div className="conductor-date"><span>JOURNÉE SUIVIE</span><strong>{new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))}</strong></div>
        <div className="conductor-user"><span>{profile.initiales}</span><div><strong>{profile.nom_complet}</strong><em>{profile.role.replace('_', ' ')}</em></div><button onClick={onLogout}>QUITTER</button></div>
      </header>
      <nav className="conductor-nav">
        {NAVIGATION.map(([id, label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}{id === 'direct' && data.alerts.length > 0 && <b>{data.alerts.length}</b>}</button>)}
      </nav>
      <section className="conductor-kpis">
        <div><span>CHANTIERS ACTIFS</span><strong>{stats.teams}</strong><em>avec une équipe aujourd’hui</em></div>
        <div><span>PERSONNES PLANIFIÉES</span><strong>{stats.assigned}</strong><em>sur {stats.teams} chantiers</em></div>
        <div><span>POINTÉES</span><strong>{stats.pointed}</strong><em>activité reçue en direct</em></div>
        <div className={stats.missing ? 'attention' : ''}><span>À CONTRÔLER</span><strong>{stats.missing}</strong><em>sans début d’activité</em></div>
      </section>
      <main className="conductor-main">
        {loading && <div className="conductor-loading">Mise à jour des données…</div>}
        {tab === 'direct' && <DirectView data={data} date={date} onResolve={(id) => mutate(() => resolveAlert(id, profile.id), 'Alerte traitée.')} />}
        {tab === 'planning' && <PlanningView data={data} date={date} setDate={setDate} busy={busy} onAdd={(form) => mutate(() => saveAssignment({ entrepriseId: profile.entreprise_id, siteId: form.siteId, personId: form.personId, vehicleId: form.vehicleId, date, userId: profile.id }), 'Affectation enregistrée.')} onDelete={(id) => mutate(() => deleteAssignment(id), 'Affectation retirée.')} />}
        {tab === 'heures' && <HoursView data={data} date={date} setDate={setDate} />}
        {tab === 'documents' && <DocumentsView data={data} busy={busy} demo={demo} onUpload={(payload) => mutate(() => uploadSiteDocument({ ...payload, profile }), 'Document envoyé au chantier.')} onOpen={(document) => demo ? window.open('/documents/devis-2025-0847.pdf', '_blank', 'noopener,noreferrer') : mutate(() => openSiteDocument(document.storage_path), 'Document ouvert.')} />}
        {tab === 'logistique' && <LogisticsView data={data} profile={profile} busy={busy} demo={demo} onSave={(payload) => mutate(() => saveLogistics(payload), 'Mouvement planifié.')} />}
        {tab === 'ressources' && <ResourcesView data={data} profile={profile} busy={busy} demo={demo} onSite={(payload) => mutate(() => saveSite(payload), 'Chantier ajouté.')} onVehicle={(payload) => mutate(() => saveVehicle(payload), 'Véhicule ajouté.')} />}
      </main>
      {message && <button className="conductor-toast" onClick={() => setMessage('')} title="Fermer">{message}</button>}
    </div>
  )
}

