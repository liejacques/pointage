import { useEffect, useState } from 'react'
import App from './App'
import ConducteurApp from './conducteur/ConducteurApp'
import { demoProfile } from './demoData'
import {
  getSession,
  isSupabaseConfigured,
  loadProfile,
  signIn,
  signOut,
  supabase,
} from './services/aetherisApi'

const MANAGEMENT_ROLES = ['admin', 'direction', 'bureau', 'conducteur']

function LoginPage({ onLogin, onDemo, busy, error, notice }) {
  const [email, setEmail] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(value - 1, 0)), 1_000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  async function submit(event) {
    event.preventDefault()
    const sent = await onLogin(email.trim())
    if (sent) setCooldown(60)
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="erp-mark" /><div>AETHERIS<strong>POINTAGE & CHANTIERS</strong></div></div>
        <div className="login-copy">
          <span>ACCÈS SÉCURISÉ</span>
          <h1>Bonjour, entrez votre e-mail.</h1>
          <p>Vous recevez un lien sécurisé. En l’ouvrant, votre poste affiche automatiquement le bon module.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label><span>ADRESSE E-MAIL</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="prenom@aetheris.fr" /></label>
          {notice && <div className="form-notice" role="status">{notice}</div>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy || cooldown > 0 || !isSupabaseConfigured}>{busy ? 'ENVOI…' : cooldown > 0 ? `RENVOYER DANS ${cooldown} S` : 'RECEVOIR MON LIEN SÉCURISÉ'}</button>
        </form>
        {!isSupabaseConfigured && (
          <div className="demo-access">
            <p>Supabase n’est pas encore relié à ce déploiement. L’interface complète reste consultable.</p>
            <button onClick={() => onDemo('conducteur')}>VOIR LE MODULE CONDUCTEUR</button>
            <button onClick={() => onDemo('terrain')}>VOIR LE MODULE TERRAIN</button>
          </div>
        )}
        <footer>Aucun mot de passe · Session conservée · Accès défini par votre poste</footer>
      </section>
      <aside className="login-aside">
        <div><span>AUJOURD’HUI</span><strong>Les équipes, les heures et les livraisons au même endroit.</strong></div>
      </aside>
    </main>
  )
}

function LoadingScreen() {
  return <div className="portal-loading"><span className="erp-mark" /><strong>Chargement Aetheris…</strong></div>
}

export default function PortalApp() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [demoRole, setDemoRole] = useState(null)
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
        if (!value?.actif) setError('Votre compte existe mais doit encore être activé par un administrateur.')
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  async function login(email) {
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

  async function logout() {
    if (demoRole) {
      setDemoRole(null)
      return
    }
    await signOut()
  }

  if (loading) return <LoadingScreen />

  if (demoRole === 'conducteur') {
    return <ConducteurApp profile={demoProfile} demo onLogout={logout} />
  }
  if (demoRole === 'terrain') {
    return <App onLogout={logout} />
  }

  if (!session || !profile?.actif) {
    return <LoginPage onLogin={login} onDemo={setDemoRole} busy={busy} error={error} notice={notice} />
  }

  if (MANAGEMENT_ROLES.includes(profile.role)) {
    return <ConducteurApp profile={profile} onLogout={logout} />
  }

  return <App profile={profile} onLogout={logout} />
}
