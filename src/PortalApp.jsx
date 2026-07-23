import { useEffect, useMemo, useState } from 'react'
import App from './App'
import ConducteurApp from './conducteur/ConducteurApp'
import RhApp from './rh/RhApp'
import { demoProfile } from './demoData'
import {
  getSession,
  isSupabaseConfigured,
  loadProfile,
  signIn,
  signInShort,
  signOut,
  supabase,
} from './services/aetherisApi'

const MODULE_DETAILS = {
  terrain: {
    label: 'Terrain',
    eyebrow: 'ÉQUIPE & POINTAGE',
    description: 'Voir l’équipe du jour et pointer rapidement sur le chantier.',
  },
  conducteur: {
    label: 'Conduite de travaux',
    eyebrow: 'PLANNING & SUIVI',
    description: 'Planifier les équipes, suivre les heures, les documents et la logistique.',
  },
  rh: {
    label: 'Ressources humaines',
    eyebrow: 'CRÉATION DES ACCÈS',
    description: 'Créer rapidement les utilisateurs et choisir leurs modules.',
  },
}

const ROLE_FALLBACK_MODULE = {
  admin: 'conducteur',
  direction: 'conducteur',
  bureau: 'conducteur',
  conducteur: 'conducteur',
  rh: 'rh',
  chef_equipe: 'terrain',
  ouvrier: 'terrain',
}

function modulesForProfile(profile) {
  if (profile?.modules?.length) return profile.modules.filter((module) => MODULE_DETAILS[module])
  const fallback = ROLE_FALLBACK_MODULE[profile?.role]
  return fallback ? [fallback] : []
}

function LoginPage({ onShortLogin, onMagicLogin, onDemo, busy, error, notice }) {
  const [mode, setMode] = useState('short')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(value - 1, 0)), 1_000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  async function submit(event) {
    event.preventDefault()
    if (mode === 'short') {
      await onShortLogin(identifier, password)
      return
    }
    const sent = await onMagicLogin(email.trim())
    if (sent) setCooldown(60)
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="erp-mark" /><div>AETHERIS<strong>POINTAGE & CHANTIERS</strong></div></div>
        <div className="login-copy">
          <span>ACCÈS RAPIDE</span>
          <h1>Bonjour, connectez-vous.</h1>
          <p>Votre accès ouvre uniquement les modules autorisés par les ressources humaines.</p>
        </div>

        <div className="login-mode-tabs">
          <button className={mode === 'short' ? 'active' : ''} onClick={() => setMode('short')}>IDENTIFIANT COURT</button>
          <button className={mode === 'email' ? 'active' : ''} onClick={() => setMode('email')}>LIEN PAR E-MAIL</button>
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === 'short' ? (
            <>
              <label><span>IDENTIFIANT</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value.toLocaleLowerCase('fr').replace(/\s/g, ''))} autoComplete="username" required placeholder="Votre identifiant court" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
              <label>
                <span>MOT DE PASSE</span>
                <div className="login-password">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Votre mot de passe court" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'MASQUER' : 'VOIR'}</button>
                </div>
              </label>
            </>
          ) : (
            <label><span>ADRESSE E-MAIL</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="prenom@aetheris.fr" /></label>
          )}
          {notice && <div className="form-notice" role="status">{notice}</div>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy || cooldown > 0 || !isSupabaseConfigured}>
            {busy
              ? 'CONNEXION…'
              : mode === 'short'
                ? 'SE CONNECTER'
                : cooldown > 0
                  ? `RENVOYER DANS ${cooldown} S`
                  : 'RECEVOIR MON LIEN SÉCURISÉ'}
          </button>
        </form>

        {!isSupabaseConfigured && (
          <div className="demo-access">
            <p>Supabase n’est pas encore relié à ce déploiement. Les interfaces complètes restent consultables.</p>
            <button onClick={() => onDemo('rh')}>VOIR LE MODULE RH</button>
            <button onClick={() => onDemo('conducteur')}>VOIR LE MODULE CONDUCTEUR</button>
            <button onClick={() => onDemo('terrain')}>VOIR LE MODULE TERRAIN</button>
          </div>
        )}
        <footer>Session sécurisée · Modules définis par les RH · Aucun mot de passe stocké en clair</footer>
      </section>
      <aside className="login-aside">
        <div><span>AUJOURD’HUI</span><strong>Chacun accède directement aux outils utiles à son poste.</strong></div>
      </aside>
    </main>
  )
}

function ModuleChooser({ profile, modules, onChoose, onLogout }) {
  return (
    <main className="module-page">
      <header className="module-header">
        <div className="login-brand"><span className="erp-mark" /><div>AETHERIS<strong>CHOIX DU MODULE</strong></div></div>
        <button onClick={onLogout}>SE DÉCONNECTER</button>
      </header>
      <section className="module-welcome">
        <span>ACCÈS DE {profile.nom_complet.toLocaleUpperCase('fr')}</span>
        <h1>Que voulez-vous ouvrir ?</h1>
        <p>Seuls les modules autorisés par les ressources humaines sont proposés.</p>
      </section>
      <section className="module-grid">
        {modules.map((module) => {
          const details = MODULE_DETAILS[module]
          return (
            <button key={module} onClick={() => onChoose(module)}>
              <span>{details.eyebrow}</span>
              <strong>{details.label}</strong>
              <p>{details.description}</p>
              <em>OUVRIR →</em>
            </button>
          )
        })}
      </section>
    </main>
  )
}

function LoadingScreen() {
  return <div className="portal-loading"><span className="erp-mark" /><strong>Chargement Aetheris…</strong></div>
}

export default function PortalApp() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activeModule, setActiveModule] = useState(null)
  const [demoModule, setDemoModule] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true

    async function initializeAuth() {
      try {
        const params = new URLSearchParams(window.location.search)
        const tokenHash = params.get('token_hash')
        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: params.get('type') || 'email',
          })
          if (verifyError) throw verifyError
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        const current = await getSession()
        if (!mounted) return
        setSession(current)
        if (!current) setLoading(false)
      } catch (reason) {
        if (mounted) {
          setError(reason.message)
          setLoading(false)
        }
      }
    }
    initializeAuth()

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setActiveModule(null)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    setLoading(true)
    loadProfile(session.user.id)
      .then((value) => {
        setProfile(value)
        if (!value?.actif) setError('Votre compte existe mais doit encore être activé par les ressources humaines.')
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  const modules = useMemo(() => modulesForProfile(profile), [profile])

  useEffect(() => {
    if (!profile || !modules.length) return
    const remembered = localStorage.getItem('aetheris-module-actif')
    if (modules.length === 1) setActiveModule(modules[0])
    else if (remembered && modules.includes(remembered)) setActiveModule(remembered)
  }, [profile?.id, modules.join(',')])

  async function shortLogin(identifier, password) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await signInShort(identifier, password)
      return true
    } catch (reason) {
      setError(reason.message === 'Invalid login credentials' ? 'Identifiant ou mot de passe incorrect.' : reason.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function magicLogin(email) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await signIn(email)
      setNotice('Lien envoyé. Ouvrez votre e-mail sur ce téléphone pour vous connecter.')
      return true
    } catch (reason) {
      setError(reason.status === 429 ? 'Un lien vient déjà d’être envoyé. Attendez une minute avant de réessayer.' : reason.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  function chooseModule(module) {
    if (!modules.includes(module)) return
    localStorage.setItem('aetheris-module-actif', module)
    setActiveModule(module)
  }

  function leaveModule() {
    localStorage.removeItem('aetheris-module-actif')
    setActiveModule(null)
  }

  async function logout() {
    localStorage.removeItem('aetheris-module-actif')
    if (demoModule) {
      setDemoModule(null)
      return
    }
    await signOut()
  }

  if (loading) return <LoadingScreen />

  if (demoModule === 'rh') {
    return <RhApp profile={{ ...demoProfile, role: 'rh', initiales: 'RH', nom_complet: 'Responsable RH', modules: ['rh'] }} demo onLogout={logout} />
  }
  if (demoModule === 'conducteur') {
    return <ConducteurApp profile={demoProfile} demo onLogout={logout} />
  }
  if (demoModule === 'terrain') {
    return <App onLogout={logout} />
  }

  if (!session || !profile?.actif) {
    return <LoginPage onShortLogin={shortLogin} onMagicLogin={magicLogin} onDemo={setDemoModule} busy={busy} error={error} notice={notice} />
  }

  if (!modules.length) {
    return (
      <main className="no-module-page">
        <span className="erp-mark" />
        <h1>Aucun module autorisé</h1>
        <p>Demandez aux ressources humaines d’ajouter un module à votre profil.</p>
        <button onClick={logout}>SE DÉCONNECTER</button>
      </main>
    )
  }

  if (!activeModule || !modules.includes(activeModule)) {
    return <ModuleChooser profile={profile} modules={modules} onChoose={chooseModule} onLogout={logout} />
  }

  const exit = modules.length > 1 ? leaveModule : null
  if (activeModule === 'rh') return <RhApp profile={profile} onExit={exit} onLogout={logout} />
  if (activeModule === 'conducteur') return <ConducteurApp profile={profile} onLogout={exit || logout} />
  return <App profile={profile} onLogout={exit || logout} />
}
