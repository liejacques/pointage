import { useEffect, useMemo, useState } from 'react'
import {
  deleteAssignment,
  flushPunchQueue,
  loadTerrainData,
  localDate,
  openSiteDocument,
  recordPunches,
  saveAssignment,
  updateAssignment,
  updateAssignments,
} from './services/aetherisApi'

const SITES = [
  {
    id: '112430',
    title: 'Réfection toiture zinc joint debout',
    city: 'Labaroche',
    address: '12 rue des Vignes, 68910 Labaroche',
    client: 'Famille Meyer',
    manager: 'Nicolas Forny',
    rain: 'Pluie probable 65 %',
    rainTime: '11:40 — 12:15',
    rainAmount: '0,8 mm',
    weatherUrl: 'https://meteofrance.com/previsions-meteo-france/labaroche/68910',
  },
  {
    id: '112518',
    title: 'Gouttières et descentes zinc',
    city: 'Colmar',
    address: '8 avenue d’Alsace, 68000 Colmar',
    client: 'SCI Les Tilleuls',
    manager: 'Nicolas Forny',
    rain: 'Pas de pluie prévue',
    rainTime: 'Journée sèche',
    rainAmount: '0 mm',
    weatherUrl: 'https://meteofrance.com/previsions-meteo-france/colmar/68000',
  },
  {
    id: '112387',
    title: 'Réfection couverture tuiles',
    city: 'Kaysersberg',
    address: '1 rue des Sorbiers, 68240 Kaysersberg',
    client: 'Mme Schumacher',
    manager: 'Claire Kern',
    rain: 'Averses possibles 35 %',
    rainTime: '15:20 — 16:10',
    rainAmount: '0,4 mm',
    weatherUrl: 'https://meteofrance.com/previsions-meteo-france/kaysersberg/68240',
  },
]

const EMPTY_SITE = {
  id: '—',
  title: 'Aucun chantier affecté aujourd’hui',
  city: '',
  address: '',
  client: '',
  manager: '',
  rain: '',
  rainTime: '',
  rainAmount: '0 mm',
  weatherUrl: '',
}

const INITIAL_TEAM = [
  { id: 'fabien-susin', name: 'Fabien Susin', initials: 'FS', present: true },
  { id: 'kevin-garnier', name: 'Kevin Garnier', initials: 'KG', present: true },
  { id: 'jocelin-saur', name: 'Jocelin Saur', initials: 'JS', present: true },
  { id: 'michael-daluin', name: 'Michael Daluin', initials: 'MD', present: true },
]

const INITIAL_AVAILABLE = [
  { id: 'rodolphe-blanchard', name: 'Rodolphe Blanchard', initials: 'RB', present: true },
  { id: 'alexandre-bonani', name: 'Alexandre Bonani', initials: 'AB', present: true },
  { id: 'lucas-collarde', name: 'Lucas Collarde', initials: 'LC', present: true },
  { id: 'benjamin-martin', name: 'Benjamin Martin', initials: 'BM', present: true },
  { id: 'kevin-perrin', name: 'Kévin Perrin', initials: 'KP', present: true },
  { id: 'julien-pierrevelcin', name: 'Julien Pierrevelcin', initials: 'JP', present: true },
]

const VEHICLES = [
  { id: 'trafic', label: 'Renault Trafic · FM-637-SA' },
  { id: 'boxer', label: 'Peugeot Boxer · GK-218-ND' },
  { id: 'master', label: 'Renault Master · GH-904-KL' },
  { id: 'none', label: 'Aucun véhicule affecté' },
]

const ACTIONS = [
  { id: 'start', label: "Début d'activité", short: 'DÉBUT ACTIVITÉ', importance: 'primary' },
  { id: 'fabrication', label: 'Façonnage', short: 'FAÇONNAGE', importance: 'standard' },
  { id: 'pause', label: 'Pause', short: 'PAUSE', importance: 'standard' },
  { id: 'finish', label: "Fin d'activité", short: 'FIN ACTIVITÉ', importance: 'standard' },
  { id: 'instruction', label: 'Consigne', short: 'CONSIGNE', importance: 'secondary' },
  { id: 'meeting', label: 'Réunion', short: 'RÉUNION', importance: 'secondary' },
  { id: 'materials', label: 'Enlèvement matériaux', short: 'ENLÈVEMENT MATÉRIAUX', importance: 'secondary' },
]

const HISTORY_ACTIONS = {
  debut_activite: "Début d'activité",
  faconnage: 'Façonnage',
  pause: 'Pause',
  fin_activite: "Fin d'activité",
  consigne: 'Consigne',
  reunion: 'Réunion',
  enlevement_materiaux: 'Enlèvement matériaux',
}

const FILES = [
  { id: 'quote', label: 'Devis', meta: 'Document PDF', icon: 'file', status: 'PDF', primary: true },
  { id: 'overview', label: 'Infos chantier', meta: 'Client, contacts et consignes', icon: 'info', status: 'À JOUR' },
  { id: 'photos', label: 'Photos chantier', meta: '28 photos · ajout rapide', icon: 'camera', status: '28' },
  { id: 'plans', label: 'Plans techniques', meta: '6 documents disponibles', icon: 'plan', status: '6' },
  { id: 'delivery', label: 'Livraison VMZINC', meta: 'Aujourd’hui · 13:30', icon: 'truck', status: 'CONFIRMÉE' },
  { id: 'lifting', label: 'Grutage', meta: 'Demain · 08:15', icon: 'crane', status: 'PLANIFIÉ' },
]

const NEXT_LIFTING = {
  when: 'Demain à 08:15',
  company: 'Alsace Levage',
  driver: 'Julien Schmitt',
  phone: null,
  truck: 'Porteur-grue 26 t',
  capacity: 'Grue 32 t/m · portée 18 m',
  duration: '45 minutes',
  cargo: [
    '12 rouleaux de zinc',
    '6 palettes de volige',
    '1 bac de façonnage',
    'Garde-corps et accessoires de rive',
  ],
}

function timeNow() {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function dateToday() {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
    .format(new Date())
    .replace(/\./g, '')
    .toUpperCase()
}

function dateTodayLong() {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date())
}

function formatPunchTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatWorkedMinutes(value = 0) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

function googleMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function Icon({ name, size = 20 }) {
  const paths = {
    down: <path d="m7 10 5 5 5-5" />,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" /></>,
    phone: <path d="M7 4 4.5 6.5c-.8.8.5 4.8 3.8 8.1 3.3 3.3 7.3 4.6 8.1 3.8L19 16l-4-3-2 2c-1.5-.7-3.3-2.5-4-4l2-2-4-5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    arrow: <path d="m9 6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    rain: <><path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.8A3.2 3.2 0 0 0 7 15Z" /><path d="m8 19-1 2M13 19l-1 2M18 19l-1 2" /></>,
    history: <><path d="M4 12a8 8 0 1 0 2-5.3L4 9" /><path d="M4 4v5h5M12 8v5l3 2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M18 14a5 5 0 0 1 4 5" /></>,
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h5M9 13h6M9 17h5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
    plan: <><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z" /><path d="M9 4v14M15 6v14" /></>,
    truck: <><path d="M3 6h11v11H3ZM14 10h4l3 3v4h-7Z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    crane: <><path d="M5 21h8M9 21V5M5 5h12M9 8h8l3 3M15 5v5M19 11v4" /><path d="M17 15h4v3h-4Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function Header({ site, clock, todayLabel, openSiteSelector, profile, onLogout }) {
  return (
    <header className="erp-header">
      <div className="erp-brand"><span className="erp-mark" />AETHERIS <b>TERRAIN</b></div>
      <button className="site-selector" onClick={openSiteSelector} aria-label="Sélectionner un chantier">
        <span>CHANTIER</span><strong>{site.id}</strong><em>{site.city}</em><Icon name="down" size={17} />
      </button>
      <div className="header-spacer" />
      <span className="sync-check" title="Synchronisé"><Icon name="check" size={15} /></span>
      <div className="erp-clock"><strong>{clock}</strong><span>{todayLabel}</span></div>
      <button className="user-code" onClick={onLogout} aria-label={onLogout ? 'Se déconnecter' : 'Profil de Jocelin Saur'}>{profile?.initiales || 'JS'}</button>
    </header>
  )
}

function SiteContext({ site, flash, openFile, openQuote, lifting = NEXT_LIFTING, empty = false, loading = false }) {
  if (empty) {
    return (
      <section className="site-context site-context-empty">
        <span className="essential-icon"><Icon name="info" size={21} /></span>
        <div>
          <span>AFFECTATION DU JOUR</span>
          <h1>{loading ? 'Chargement du chantier…' : 'Aucun chantier affecté aujourd’hui'}</h1>
          <p>{loading ? 'Synchronisation du planning et de l’équipe.' : 'Le conducteur doit ajouter cette personne au planning avant le premier pointage.'}</p>
        </div>
      </section>
    )
  }

  const hasRain = site.rainAmount !== '0 mm'
  return (
    <section className="site-context">
      <div className="site-identification">
        <div className="context-label">CHANTIER EN COURS · {site.id}</div>
        <h1>{site.title}</h1>
        <div className="site-contact-line">
          <a className="address-line" href={googleMapsUrl(site.address)} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${site.address} dans Google Maps`}><Icon name="route" size={17} />{site.address}</a>
          <button className="context-contact" onClick={() => flash(`Appel prêt · ${site.manager}`)}><Icon name="phone" size={16} />{site.manager}</button>
        </div>
      </div>
      <div className="site-essentials">
        <a className="essential-row weather-row" href={site.weatherUrl} target="_blank" rel="noreferrer" aria-label={`Voir la météo Météo-France à ${site.city}`}>
          <span className="essential-icon"><Icon name="rain" size={20} /></span>
          <div><span>{hasRain ? 'PROCHAINE PLUIE ESTIMÉE' : 'MÉTÉO DU CHANTIER'}</span><strong>{site.rainTime}</strong></div>
          <em>{hasRain ? `${site.rain.replace('Pluie probable ', '')} · ${site.rainAmount}` : site.rain}</em>
          <Icon name="arrow" size={15} />
        </a>
        <button className="essential-row" onClick={() => openFile('lifting')}>
          <span className="essential-icon"><Icon name="crane" size={20} /></span>
          <div><span>PROCHAIN GRUTAGE</span><strong>{lifting.when}</strong><em>{lifting.truck}</em></div>
          <Icon name="arrow" size={15} />
        </button>
        <button className="quote-shortcut" onClick={openQuote} aria-label="Ouvrir directement le devis au format PDF" disabled={site.quoteAvailable === false}>
          <span className="essential-icon"><Icon name="file" size={19} /></span>
          <div><span>DEVIS</span><strong>{site.quoteAvailable === false ? 'Aucun PDF disponible' : 'Ouvrir le PDF'}</strong></div>
          <Icon name="arrow" size={15} />
        </button>
      </div>
    </section>
  )
}

function PointageHistory({ punches = [], reports = [], siteDbId }) {
  const sitePunches = punches.filter((punch) => punch.chantier_id === siteDbId).slice(0, 20)
  const siteReports = reports.filter((report) => report.chantier_id === siteDbId)
  const totalMinutes = siteReports.reduce((sum, report) => sum + (report.minutes_travaillees || 0), 0)

  return (
    <section className="erp-panel pointage-history">
      <header className="history-header">
        <div><span>HISTORIQUE DU JOUR</span><h2>{dateTodayLong()}</h2></div>
        <div className="history-totals">
          <span><strong>{sitePunches.length}</strong> pointages réalisés</span>
          <span><strong>{formatWorkedMinutes(totalMinutes)}</strong> aujourd’hui</span>
        </div>
      </header>
      <div className="history-body">
        <div className="history-people">
          {siteReports.map((report) => (
            <article key={report.affectation_id}>
              <span className="person-initials">{report.compagnon_nom?.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div><strong>{report.compagnon_nom}</strong><span>{report.nombre_pointages} pointage{report.nombre_pointages === 1 ? '' : 's'}</span></div>
              <b>{formatWorkedMinutes(report.minutes_travaillees)}</b>
            </article>
          ))}
          {!siteReports.length && <p className="empty-state">Aucune heure calculée pour ce chantier aujourd’hui.</p>}
        </div>
        <div className="history-events">
          {sitePunches.map((punch) => (
            <article key={punch.id}>
              <time>{formatPunchTime(punch.pointe_a)}</time>
              <span className="person-initials">{punch.compagnons?.initiales || '—'}</span>
              <div><strong>{punch.compagnons?.nom_complet || 'Personne'}</strong><span>{HISTORY_ACTIONS[punch.action] || punch.action}</span></div>
              <span className="history-valid"><Icon name="check" size={13} />ENVOYÉ</span>
            </article>
          ))}
          {!sitePunches.length && <p className="empty-state">Les pointages de la journée apparaîtront ici dès la première action.</p>}
        </div>
      </div>
    </section>
  )
}

function ActionPanel({ onAction, targetLabel, disabled }) {
  return (
    <section className="erp-panel actions-panel">
      <header className="panel-header">
        <div><span>POINTAGE</span><h2>Choisir une action</h2></div>
        <div className="pointage-target"><span>POUR</span><strong>{targetLabel}</strong></div>
      </header>
      <div className="action-grid">
        {ACTIONS.map((action) => (
          <button className={`action-button ${action.importance}`} key={action.id} onClick={() => onAction(action)} disabled={disabled}>
            <strong>{action.label}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

function TeamPanel({
  team,
  presentTeam,
  available,
  selectedTarget,
  selectTarget,
  vehicleId,
  changeVehicle,
  togglePresence,
  removeMember,
  addMember,
  vehicles = VEHICLES,
}) {
  const [mode, setMode] = useState('current')
  const [showVehicle, setShowVehicle] = useState(false)
  const [search, setSearch] = useState('')
  const filteredPeople = available.filter((person) => person.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')))

  if (mode === 'add') return (
    <section className="erp-panel team-panel team-standard is-adding">
      <header className="panel-header team-header">
        <div className="team-mode-title">
          <button className="team-mode-back" onClick={() => setMode('current')} aria-label="Retour à l’équipe actuelle"><Icon name="arrow" size={17} /></button>
          <div><span>ANNUAIRE</span><h2>Ajouter dans l’équipe</h2></div>
        </div>
        <button className="finish-team-button" onClick={() => setMode('current')}><Icon name="check" size={14} />TERMINER</button>
      </header>
      <div className="inline-team-directory">
        <label className="directory-search"><Icon name="search" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une personne…" autoFocus /></label>
        <div className="management-section-title"><span>PERSONNES À AJOUTER</span><strong>{filteredPeople.length} résultats</strong></div>
        <div className="directory-list">
          {filteredPeople.map((person) => (
            <div className="directory-person" key={person.id}>
              <span className="person-initials">{person.initials}</span>
              <strong>{person.name}</strong>
              <button onClick={() => addMember(person.id)}><Icon name="plus" size={16} />AJOUTER</button>
            </div>
          ))}
          {!filteredPeople.length && <p className="empty-state">Toutes les personnes sont déjà dans l’équipe ou aucun résultat ne correspond.</p>}
        </div>
      </div>
    </section>
  )

  return (
    <section className="erp-panel team-panel team-standard">
      <header className="panel-header team-header standard-team-header">
        <div><span>ÉQUIPE ACTUELLE</span><h2>{team.length} personne{team.length === 1 ? '' : 's'}</h2></div>
        <div className="standard-team-actions">
          <button className={showVehicle ? 'is-active' : ''} onClick={() => setShowVehicle((current) => !current)}><Icon name="truck" size={15} /><span>CHANGER VÉHICULE</span></button>
          <button onClick={() => setMode('add')}><Icon name="plus" size={15} /><span>AJOUTER DANS L’ÉQUIPE</span></button>
        </div>
      </header>
      <div className="standard-team-body">
        {showVehicle && (
          <label className="vehicle-selector">
            <span className="management-icon"><Icon name="truck" size={18} /></span>
            <div><span>VÉHICULE AFFECTÉ</span><select value={vehicleId} onChange={(event) => changeVehicle(event.target.value)}>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.label}</option>)}</select></div>
          </label>
        )}
        <button className={`current-target-all ${selectedTarget === 'team' ? 'is-selected' : ''}`} onClick={() => selectTarget('team')} disabled={!presentTeam.length} aria-pressed={selectedTarget === 'team'}>
          <span className="team-target-icon"><Icon name="people" size={18} /></span>
          <div><strong>Toute l’équipe</strong><span>{presentTeam.length} personne{presentTeam.length === 1 ? '' : 's'} cochée{presentTeam.length === 1 ? '' : 's'}</span></div>
          <span className="selection-check"><Icon name="check" size={13} /></span>
        </button>
        <div className="standard-team-list">
          {team.map((member) => (
            <div className={`standard-member ${member.present ? '' : 'is-unchecked'} ${selectedTarget === member.id ? 'is-targeted' : ''}`} key={member.id}>
              <button className="standard-member-target" onClick={() => member.present && selectTarget(member.id)} disabled={!member.present} aria-pressed={selectedTarget === member.id}>
                <span className="person-initials">{member.initials}</span>
                <strong>{member.name}</strong>
                {selectedTarget === member.id && <span className="target-indicator">CIBLE</span>}
              </button>
              <button className={`presence-checkbox ${member.present ? 'is-checked' : ''}`} onClick={() => togglePresence(member.id)} aria-label={`${member.name} ${member.present ? 'coché' : 'non coché'}`} aria-pressed={member.present} title={member.present ? 'Coché' : 'Non coché'}><Icon name="check" size={15} /></button>
              <button className="management-remove" onClick={() => removeMember(member.id)} aria-label={`Retirer ${member.name} de l’équipe`}><Icon name="close" size={17} /></button>
            </div>
          ))}
          {!team.length && <p className="empty-state">L’équipe est vide. Utilisez « Ajouter dans l’équipe ».</p>}
        </div>
      </div>
    </section>
  )
}

function SiteDrawer({ site, sites = SITES, selectSite, close }) {
  return (
    <Drawer title="Sélectionner un chantier" subtitle="Option manuelle" close={close}>
      <div className="site-list">
        {sites.map((item) => (
          <button className={item.id === site.id ? 'selected' : ''} key={item.id} onClick={() => selectSite(item.id)}><span>{item.id}</span><div><strong>{item.title}</strong><em>{item.city} · {item.client}</em></div>{item.id === site.id && <span className="small-check"><Icon name="check" size={14} /></span>}</button>
        ))}
      </div>
    </Drawer>
  )
}

function FileDrawer({ fileId, site, close, flash, lifting = NEXT_LIFTING }) {
  const file = FILES.find((item) => item.id === fileId) ?? FILES[0]
  const content = {
    overview: <div className="info-table"><div><span>CLIENT</span><strong>{site.client}</strong></div><div><span>CONDUCTEUR</span><strong>{site.manager}</strong></div><div><span>COMMANDE</span><strong>17/11/2025</strong></div><div><span>STATUT</span><strong>En cours</strong></div><p>Protéger la terrasse avant dépose. Le client est absent entre 11:30 et 14:00.</p></div>,
    quote: <div className="document-summary"><span>DEVIS 2025-0847</span><strong>Document chantier</strong><p>PDF disponible · dernière mise à jour le 18/07/2026</p><a href="/documents/devis-2025-0847.pdf" target="_blank" rel="noreferrer">OUVRIR LE PDF</a></div>,
    photos: <div className="photo-grid"><button onClick={() => flash('Photo avant travaux ouverte')}>AVANT TRAVAUX</button><button onClick={() => flash('Photo versant nord ouverte')}>VERSANT NORD</button><button onClick={() => flash('Photo zinguerie ouverte')}>ZINGUERIE</button><button onClick={() => flash('Appareil photo prêt')}>+ AJOUTER UNE PHOTO</button></div>,
    delivery: <div className="info-table"><div><span>FOURNISSEUR</span><strong>VMZINC</strong></div><div><span>CRÉNEAU</span><strong>Aujourd’hui 13:30</strong></div><div><span>RÉFÉRENCE</span><strong>BL-45518</strong></div><div><span>STATUT</span><strong>Confirmée</strong></div><p>Déchargement dans la cour arrière. Laisser libre l’accès au garage.</p></div>,
    lifting: (
      <div className="lifting-detail">
        <div className="lifting-summary">
          <span className="lifting-icon"><Icon name="crane" size={26} /></span>
          <div><span>PROCHAIN GRUTAGE</span><strong>{lifting.when}</strong><em>{lifting.company}</em></div>
        </div>
        <div className="lifting-vehicle">
          <span>CAMION ET CAPACITÉ</span>
          <strong>{lifting.truck}</strong>
          <p>{lifting.capacity} · intervention prévue {lifting.duration}</p>
        </div>
        <div className="driver-card">
          <div><span>CHAUFFEUR</span><strong>{lifting.driver}</strong><em>{lifting.phone ? 'Numéro disponible' : 'Numéro non communiqué'}</em></div>
          {lifting.phone ? (
            <a href={`tel:${lifting.phone.replace(/\s/g, '')}`}><Icon name="phone" size={18} /><span>APPELER</span><strong>{lifting.phone}</strong></a>
          ) : (
            <div className="driver-unavailable"><Icon name="phone" size={18} /><span>CONTACT</span><strong>NON COMMUNIQUÉ</strong></div>
          )}
        </div>
        <div className="cargo-section">
          <div><span>CHARGEMENT PRÉVU</span><strong>{lifting.cargo.length} éléments à réceptionner</strong></div>
          <ul>{lifting.cargo.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
        </div>
        <p className="lifting-note">Accès par la cour arrière. Garder la zone de stabilisation libre avant 08:00.</p>
      </div>
    ),
    plans: <div className="document-list"><button onClick={() => flash('Plan de calepinage ouvert')}>PL-01 · Plan de calepinage</button><button onClick={() => flash('Coupe de rive ouverte')}>PL-02 · Coupe de rive</button><button onClick={() => flash('Détail joint debout ouvert')}>PL-03 · Détail joint debout</button></div>,
  }
  return <Drawer title={file.label} subtitle={`Chantier ${site.id}`} close={close}>{content[file.id]}</Drawer>
}

function Drawer({ title, subtitle, close, children }) {
  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && close()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header><div><span>{subtitle}</span><strong>{title}</strong></div><button onClick={close} aria-label="Fermer"><Icon name="close" size={22} /></button></header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export default function App({ profile = null, onLogout = null }) {
  const [siteId, setSiteId] = useState(profile ? '' : '112430')
  const [sites, setSites] = useState(profile ? [] : SITES)
  const [team, setTeam] = useState(profile ? [] : INITIAL_TEAM)
  const [available, setAvailable] = useState(profile ? [] : INITIAL_AVAILABLE)
  const [vehicleId, setVehicleId] = useState(profile ? 'none' : VEHICLES[0].id)
  const [vehicles, setVehicles] = useState(profile ? [{ id: 'none', label: 'Aucun véhicule affecté' }] : VEHICLES)
  const [terrainData, setTerrainData] = useState(null)
  const [selectedTarget, setSelectedTarget] = useState('team')
  const [drawer, setDrawer] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [toast, setToast] = useState('')
  const [clock, setClock] = useState(timeNow())
  const [loadingTerrain, setLoadingTerrain] = useState(Boolean(profile))

  const site = useMemo(() => sites.find((item) => item.id === siteId) ?? sites[0] ?? (profile ? EMPTY_SITE : SITES[0]), [profile, siteId, sites])
  const presentTeam = useMemo(() => team.filter((member) => member.present), [team])
  const targetLabel = selectedTarget === 'team'
    ? `Toute l’équipe · ${presentTeam.length}`
    : team.find((member) => member.id === selectedTarget)?.name ?? 'Toute l’équipe'
  const todayLabel = dateToday()
  const nextLifting = useMemo(() => {
    const operation = terrainData?.logistics.find((item) => item.chantier_id === site.dbId && item.type_operation === 'grutage')
    if (!operation) {
      if (!profile) return NEXT_LIFTING
      return {
        when: 'Aucun grutage planifié',
        company: 'Aucune opération à venir',
        driver: 'Non communiqué',
        phone: null,
        truck: 'À planifier',
        capacity: 'Non communiquée',
        duration: 'non définie',
        cargo: [],
      }
    }
    return {
      when: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(operation.debut_prevu)),
      company: operation.fournisseur || 'Prestataire non communiqué',
      driver: operation.chauffeur_nom || 'Non communiqué',
      phone: operation.chauffeur_telephone,
      truck: operation.vehicules ? `${operation.vehicules.libelle} · ${operation.vehicules.immatriculation || ''}` : operation.camion_externe || 'Camion non communiqué',
      capacity: operation.capacite || 'Capacité non communiquée',
      duration: 'selon planning',
      cargo: operation.chargement || [],
    }
  }, [profile, terrainData, site.dbId])

  function applySiteTeam(reference, data = terrainData) {
    if (!data) return
    const backendSite = data.assignments.find((item) => item.chantiers?.reference === reference)?.chantiers
    if (!backendSite) return
    const assignments = data.assignments.filter((item) => item.chantier_id === backendSite.id)
    const assignedIds = new Set(assignments.map((item) => item.compagnon_id))
    setTeam(assignments.map((item) => ({
      id: item.compagnon_id,
      assignmentId: item.id,
      name: item.compagnons?.nom_complet,
      initials: item.compagnons?.initiales,
      present: item.inclus_pointage,
    })))
    setAvailable(data.people.filter((person) => !assignedIds.has(person.id)).map((person) => ({
      id: person.id,
      name: person.nom_complet,
      initials: person.initiales,
      present: true,
    })))
    setVehicleId(assignments.find((item) => item.vehicule_id)?.vehicule_id || 'none')
    setSelectedTarget('team')
  }

  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setClock(timeNow())
    }, 30_000)
    return () => window.clearInterval(clockTimer)
  }, [])

  useEffect(() => {
    if (!profile) return undefined
    let active = true
    setLoadingTerrain(true)
    loadTerrainData()
      .then((data) => {
        if (!active) return
        const backendSites = [...new Map(data.assignments.map((item) => [item.chantier_id, item.chantiers])).values()]
          .filter(Boolean)
          .map((item) => {
            const addressParts = [item.adresse, item.code_postal, item.ville]
              .filter(Boolean)
              .filter((value, index, values) => values.indexOf(value) === index)
            return {
              id: item.reference,
              dbId: item.id,
              title: item.nom,
              city: item.ville,
              address: addressParts.join(', '),
              client: item.client_nom || 'Client chantier',
              manager: 'Conducteur de travaux',
              rain: 'Voir les prévisions',
              rainTime: 'Prévisions locales',
              rainAmount: '0 mm',
              weatherUrl: item.meteo_url || `https://meteofrance.com/previsions-meteo-france/${encodeURIComponent(item.ville)}/${item.code_postal || ''}`,
              quoteAvailable: data.documents.some((document) => document.chantier_id === item.id && document.type_document === 'devis'),
            }
          })
        if (backendSites.length) {
          setSites(backendSites)
          setSiteId(backendSites[0].id)
        } else {
          setSites([])
          setSiteId('')
          setTeam([])
          setAvailable(data.people.map((person) => ({
            id: person.id,
            name: person.nom_complet,
            initials: person.initiales,
            present: true,
          })))
        }
        setVehicles([
          ...data.vehicles.map((item) => ({ id: item.id, label: `${item.libelle}${item.immatriculation ? ` · ${item.immatriculation}` : ''}` })),
          { id: 'none', label: 'Aucun véhicule affecté' },
        ])
        setTerrainData(data)
        if (backendSites[0]) applySiteTeam(backendSites[0].id, data)
        flushPunchQueue()
      })
      .catch((error) => setToast(error.message))
      .finally(() => {
        if (active) setLoadingTerrain(false)
      })

    const reconnect = () => flushPunchQueue().then((remaining) => {
      if (!remaining) setToast('Pointages en attente synchronisés')
    })
    window.addEventListener('online', reconnect)
    return () => {
      active = false
      window.removeEventListener('online', reconnect)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2_300)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function recordAction(action) {
    if (!presentTeam.length) {
      setToast('Aucune personne cochée à pointer')
      return
    }
    if (!profile || !terrainData || !site.dbId) {
      setToast(`${action.label} · ${targetLabel} · ${timeNow()}`)
      return
    }
    const actionMap = {
      start: 'debut_activite',
      fabrication: 'faconnage',
      pause: 'pause',
      finish: 'fin_activite',
      instruction: 'consigne',
      meeting: 'reunion',
      materials: 'enlevement_materiaux',
    }
    const people = selectedTarget === 'team'
      ? presentTeam.map((member) => member.id)
      : [selectedTarget]
    try {
      const result = await recordPunches({ personIds: people, siteId: site.dbId, action: actionMap[action.id] })
      if (!result.queued) {
        setTerrainData(await loadTerrainData())
      }
      setToast(result.queued ? `${result.queued} pointage(s) gardé(s) hors connexion` : `${action.label} · ${targetLabel} · ${timeNow()}`)
    } catch (error) {
      setToast(error.message)
    }
  }

  async function togglePresence(id) {
    const member = team.find((person) => person.id === id)
    if (!member) return
    setTeam((current) => current.map((person) => person.id === id ? { ...person, present: !person.present } : person))
    if (selectedTarget === id && member.present) setSelectedTarget('team')
    setToast(`${member.name} · ${member.present ? 'décoché' : 'coché'}`)
    if (profile && member.assignmentId) {
      try {
        await updateAssignment(member.assignmentId, { inclus_pointage: !member.present })
      } catch (error) {
        setToast(error.message)
      }
    }
  }

  async function removeMember(id) {
    const member = team.find((person) => person.id === id)
    if (!member) return
    setTeam((current) => current.filter((person) => person.id !== id))
    setAvailable((current) => [...current, { ...member, present: true }])
    if (selectedTarget === id) setSelectedTarget('team')
    setToast(`${member.name} retiré de l’équipe`)
    if (profile && member.assignmentId) {
      try {
        await deleteAssignment(member.assignmentId)
      } catch (error) {
        setToast(error.message)
      }
    }
  }

  async function addMember(id) {
    const member = available.find((person) => person.id === id)
    if (!member) return
    setAvailable((current) => current.filter((person) => person.id !== id))
    setTeam((current) => [...current, { ...member, present: true }])
    setToast(`${member.name} ajouté à l’équipe`)
    if (profile && site.dbId) {
      try {
        await saveAssignment({
          entrepriseId: profile.entreprise_id,
          siteId: site.dbId,
          personId: member.id,
          vehicleId: vehicleId === 'none' ? null : vehicleId,
          date: localDate(),
          userId: profile.id,
        })
      } catch (error) {
        setToast(error.message)
      }
    }
  }

  function selectSite(id) {
    setSiteId(id)
    applySiteTeam(id)
    setDrawer(null)
    setToast(`Chantier ${id} sélectionné`)
  }

  function openFile(id) {
    setFileId(id)
    setDrawer('file')
  }

  async function changeVehicle(id) {
    setVehicleId(id)
    if (!profile) return
    try {
      await updateAssignments(team.map((member) => member.assignmentId).filter(Boolean), { vehicule_id: id === 'none' ? null : id })
      setToast('Véhicule de l’équipe mis à jour')
    } catch (error) {
      setToast(error.message)
    }
  }

  async function openQuote() {
    const quote = terrainData?.documents.find((item) => item.chantier_id === site.dbId && item.type_document === 'devis')
    if (!quote) {
      if (profile) {
        setToast('Aucun devis PDF disponible pour ce chantier')
        return
      }
      window.open('/documents/devis-2025-0847.pdf', '_blank', 'noopener,noreferrer')
      return
    }
    try {
      await openSiteDocument(quote.storage_path)
    } catch (error) {
      setToast(error.message)
    }
  }

  return (
    <div className="app-shell">
      <Header site={site} clock={clock} todayLabel={todayLabel} openSiteSelector={() => setDrawer('site')} profile={profile} onLogout={onLogout} />
      <main className="erp-dashboard">
        <TeamPanel team={team} presentTeam={presentTeam} available={available} selectedTarget={selectedTarget} selectTarget={setSelectedTarget} vehicleId={vehicleId} changeVehicle={changeVehicle} vehicles={vehicles} togglePresence={togglePresence} removeMember={removeMember} addMember={addMember} />
        <ActionPanel onAction={recordAction} targetLabel={targetLabel} disabled={!presentTeam.length} />
        <SiteContext site={site} flash={setToast} openFile={openFile} openQuote={openQuote} lifting={nextLifting} empty={Boolean(profile) && !site.dbId} loading={loadingTerrain} />
        <PointageHistory punches={terrainData?.punches} reports={terrainData?.reports} siteDbId={site.dbId} />
      </main>
      {drawer === 'site' && <SiteDrawer site={site} sites={sites} selectSite={selectSite} close={() => setDrawer(null)} />}
      {drawer === 'file' && <FileDrawer fileId={fileId} site={site} close={() => setDrawer(null)} flash={setToast} lifting={nextLifting} />}
      {toast && <div className="toast" role="status"><span className="green-check"><Icon name="check" size={13} /></span>{toast}</div>}
    </div>
  )
}
