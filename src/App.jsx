import { useEffect, useMemo, useState } from 'react'

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

const INITIAL_TEAM = [
  { id: 'fabien-susin', name: 'Fabien Susin', initials: 'FS' },
  { id: 'kevin-garnier', name: 'Kevin Garnier', initials: 'KG' },
  { id: 'jocelin-saur', name: 'Jocelin Saur', initials: 'JS' },
  { id: 'michael-daluin', name: 'Michael Daluin', initials: 'MD' },
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
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function Header({ site, clock, todayLabel, openSiteSelector }) {
  return (
    <header className="erp-header">
      <div className="erp-brand"><span className="erp-mark" />AETHERIS <b>TERRAIN</b></div>
      <button className="site-selector" onClick={openSiteSelector} aria-label="Sélectionner un chantier">
        <span>CHANTIER</span><strong>{site.id}</strong><em>{site.city}</em><Icon name="down" size={17} />
      </button>
      <div className="header-spacer" />
      <span className="sync-check" title="Synchronisé"><Icon name="check" size={15} /></span>
      <div className="erp-clock"><strong>{clock}</strong><span>{todayLabel}</span></div>
      <button className="user-code" aria-label="Profil de Jocelin Saur">JS</button>
    </header>
  )
}

function SiteContext({ site, flash, openFile }) {
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
          <div><span>PROCHAIN GRUTAGE</span><strong>{NEXT_LIFTING.when}</strong><em>{NEXT_LIFTING.truck}</em></div>
          <Icon name="arrow" size={15} />
        </button>
        <a className="quote-shortcut" href="/documents/devis-2025-0847.pdf" target="_blank" rel="noreferrer" aria-label="Ouvrir directement le devis au format PDF">
          <span className="essential-icon"><Icon name="file" size={19} /></span>
          <div><span>DEVIS</span><strong>Ouvrir le PDF</strong></div>
          <Icon name="arrow" size={15} />
        </a>
      </div>
    </section>
  )
}

function ActionPanel({ onAction, targetLabel }) {
  return (
    <section className="erp-panel actions-panel">
      <header className="panel-header">
        <div><span>POINTAGE</span><h2>Choisir une action</h2></div>
        <div className="pointage-target"><span>POUR</span><strong>{targetLabel}</strong></div>
      </header>
      <div className="action-grid">
        {ACTIONS.map((action) => (
          <button className={`action-button ${action.importance}`} key={action.id} onClick={() => onAction(action)}>
            <strong>{action.label}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

function TeamPanel({ team, selectedTarget, selectTarget }) {
  return (
    <section className="erp-panel team-panel">
      <header className="panel-header team-header">
        <div><span>ÉQUIPE DU JOUR</span><h2>Qui pointer ?</h2></div>
        <span className="team-count">{team.length} PERSONNES</span>
      </header>
      <button
        className={`whole-team-target ${selectedTarget === 'team' ? 'is-selected' : ''}`}
        onClick={() => selectTarget('team')}
        aria-pressed={selectedTarget === 'team'}
      >
        <span className="team-target-icon"><Icon name="people" size={20} /></span>
        <div><strong>Toute l’équipe</strong><span>Pointer les {team.length} personnes</span></div>
        <span className="selection-check"><Icon name="check" size={14} /></span>
      </button>
      <div className="team-target-grid">
        {team.map((member) => (
          <button
            className={`person-target ${selectedTarget === member.id ? 'is-selected' : ''}`}
            key={member.id}
            onClick={() => selectTarget(member.id)}
            aria-pressed={selectedTarget === member.id}
          >
            <span className="person-initials">{member.initials}</span>
            <strong>{member.name}</strong>
            <span className="selection-check"><Icon name="check" size={13} /></span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SiteDrawer({ site, selectSite, close }) {
  return (
    <Drawer title="Sélectionner un chantier" subtitle="Option manuelle" close={close}>
      <div className="site-list">
        {SITES.map((item) => (
          <button className={item.id === site.id ? 'selected' : ''} key={item.id} onClick={() => selectSite(item.id)}><span>{item.id}</span><div><strong>{item.title}</strong><em>{item.city} · {item.client}</em></div>{item.id === site.id && <span className="small-check"><Icon name="check" size={14} /></span>}</button>
        ))}
      </div>
    </Drawer>
  )
}

function FileDrawer({ fileId, site, close, flash }) {
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
          <div><span>PROCHAIN GRUTAGE</span><strong>{NEXT_LIFTING.when}</strong><em>{NEXT_LIFTING.company}</em></div>
        </div>
        <div className="lifting-vehicle">
          <span>CAMION ET CAPACITÉ</span>
          <strong>{NEXT_LIFTING.truck}</strong>
          <p>{NEXT_LIFTING.capacity} · intervention prévue {NEXT_LIFTING.duration}</p>
        </div>
        <div className="driver-card">
          <div><span>CHAUFFEUR</span><strong>{NEXT_LIFTING.driver}</strong><em>{NEXT_LIFTING.phone ? 'Numéro disponible' : 'Numéro non communiqué'}</em></div>
          {NEXT_LIFTING.phone ? (
            <a href={`tel:${NEXT_LIFTING.phone.replace(/\s/g, '')}`}><Icon name="phone" size={18} /><span>APPELER</span><strong>{NEXT_LIFTING.phone}</strong></a>
          ) : (
            <div className="driver-unavailable"><Icon name="phone" size={18} /><span>CONTACT</span><strong>NON COMMUNIQUÉ</strong></div>
          )}
        </div>
        <div className="cargo-section">
          <div><span>CHARGEMENT PRÉVU</span><strong>{NEXT_LIFTING.cargo.length} éléments à réceptionner</strong></div>
          <ul>{NEXT_LIFTING.cargo.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
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

export default function App() {
  const [siteId, setSiteId] = useState('112430')
  const [selectedTarget, setSelectedTarget] = useState('team')
  const [drawer, setDrawer] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [toast, setToast] = useState('')
  const [clock, setClock] = useState(timeNow())

  const site = useMemo(() => SITES.find((item) => item.id === siteId) ?? SITES[0], [siteId])
  const targetLabel = selectedTarget === 'team'
    ? `Toute l’équipe · ${INITIAL_TEAM.length}`
    : INITIAL_TEAM.find((member) => member.id === selectedTarget)?.name ?? 'Toute l’équipe'
  const todayLabel = dateToday()

  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setClock(timeNow())
    }, 30_000)
    return () => window.clearInterval(clockTimer)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2_300)
    return () => window.clearTimeout(timer)
  }, [toast])

  function recordAction(action) {
    setToast(`${action.label} · ${targetLabel} · ${timeNow()}`)
  }

  function selectSite(id) {
    setSiteId(id)
    setDrawer(null)
    setToast(`Chantier ${id} sélectionné`)
  }

  function openFile(id) {
    setFileId(id)
    setDrawer('file')
  }

  return (
    <div className="app-shell">
      <Header site={site} clock={clock} todayLabel={todayLabel} openSiteSelector={() => setDrawer('site')} />
      <main className="erp-dashboard">
        <TeamPanel team={INITIAL_TEAM} selectedTarget={selectedTarget} selectTarget={setSelectedTarget} />
        <ActionPanel onAction={recordAction} targetLabel={targetLabel} />
        <SiteContext site={site} flash={setToast} openFile={openFile} />
      </main>
      {drawer === 'site' && <SiteDrawer site={site} selectSite={selectSite} close={() => setDrawer(null)} />}
      {drawer === 'file' && <FileDrawer fileId={fileId} site={site} close={() => setDrawer(null)} flash={setToast} />}
      {toast && <div className="toast" role="status"><span className="green-check"><Icon name="check" size={13} /></span>{toast}</div>}
    </div>
  )
}
