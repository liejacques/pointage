import { useEffect, useMemo, useState } from 'react'
import {
  createShortUser,
  loadRhUsers,
  normalizeShortIdentifier,
} from '../services/aetherisApi'

const MODULES = [
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Équipe du jour et pointage chantier',
  },
  {
    id: 'conducteur',
    label: 'Conducteur',
    description: 'Planning, heures, documents et logistique',
  },
  {
    id: 'rh',
    label: 'RH',
    description: 'Création rapide des utilisateurs',
  },
]

const EMPTY_FORM = {
  name: '',
  identifier: '',
  password: '',
  modules: ['terrain'],
}

function moduleLabel(module) {
  return MODULES.find((item) => item.id === module)?.label || module
}

export default function RhApp({ profile, demo = false, onExit, onLogout }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(demo ? 'Mode démonstration : aucune donnée ne sera enregistrée.' : '')
  const [error, setError] = useState('')

  async function refresh() {
    if (demo) return
    setLoading(true)
    try {
      setUsers(await loadRhUsers())
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [demo])

  const activeUsers = useMemo(() => users.filter((user) => user.actif).length, [users])

  function toggleModule(module) {
    setForm((current) => {
      const selected = current.modules.includes(module)
        ? current.modules.filter((item) => item !== module)
        : [...current.modules, module]
      return { ...current, modules: selected }
    })
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const payload = {
      ...form,
      name: form.name.trim().replace(/\s+/g, ' '),
      identifier: normalizeShortIdentifier(form.identifier),
    }

    if (payload.name.length < 2) {
      setError('Indiquez le nom de la personne.')
      return
    }
    if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(payload.identifier)) {
      setError('L’identifiant doit contenir 2 à 31 lettres, chiffres, points ou tirets.')
      return
    }
    if (!/^\S{5,32}$/.test(payload.password)) {
      setError('Le mot de passe court doit contenir au moins 5 caractères, sans espace.')
      return
    }
    if (!payload.modules.length) {
      setError('Choisissez au moins un module.')
      return
    }

    setSaving(true)
    try {
      if (demo) {
        setUsers((current) => [{
          id: crypto.randomUUID(),
          nom_complet: payload.name,
          initiales: payload.name.split(/\s+/).map((item) => item[0]).join('').slice(0, 2).toUpperCase(),
          identifiant_court: payload.identifier,
          modules: payload.modules,
          actif: true,
          created_at: new Date().toISOString(),
        }, ...current])
      } else {
        await createShortUser(payload)
        await refresh()
      }
      setMessage(`${payload.name} peut maintenant se connecter avec l’identifiant « ${payload.identifier} ».`)
      setForm(EMPTY_FORM)
      setShowPassword(false)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rh-shell">
      <header className="rh-header">
        <div className="rh-brand"><span className="erp-mark" /><div>AETHERIS<strong>RESSOURCES HUMAINES</strong></div></div>
        <div className="rh-user">
          <span>{profile.initiales || 'RH'}</span>
          <div><strong>{profile.nom_complet}</strong><em>Accès RH</em></div>
          {onExit && <button onClick={onExit}>MODULES</button>}
          <button onClick={onLogout}>QUITTER</button>
        </div>
      </header>

      <main className="rh-main">
        <section className="rh-intro">
          <div><span>CRÉATION RAPIDE</span><h1>Ajouter un utilisateur</h1><p>Un nom, un identifiant court, un mot de passe court et les modules autorisés.</p></div>
          <div className="rh-counter"><span>COMPTES ACTIFS</span><strong>{activeUsers}</strong></div>
        </section>

        <div className="rh-layout">
          <section className="rh-create-card">
            <header><span>NOUVEAU PROFIL</span><strong>Informations de connexion</strong></header>
            <form onSubmit={submit}>
              <label className="rh-field">
                <span>NOM ET PRÉNOM</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Fabien Susin" autoComplete="off" autoFocus />
              </label>

              <div className="rh-credentials">
                <label className="rh-field">
                  <span>IDENTIFIANT COURT</span>
                  <input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: normalizeShortIdentifier(event.target.value) })} placeholder="Ex. fsusin" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                </label>
                <label className="rh-field">
                  <span>MOT DE PASSE COURT</span>
                  <div className="rh-password">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="5 caractères minimum" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'MASQUER' : 'VOIR'}</button>
                  </div>
                </label>
              </div>

              <fieldset className="rh-modules">
                <legend>MODULES AUTORISÉS</legend>
                {MODULES.map((module) => {
                  const selected = form.modules.includes(module.id)
                  return (
                    <button type="button" className={selected ? 'selected' : ''} onClick={() => toggleModule(module.id)} key={module.id} aria-pressed={selected}>
                      <span className="rh-module-check">{selected ? '✓' : ''}</span>
                      <div><strong>{module.label}</strong><em>{module.description}</em></div>
                    </button>
                  )
                })}
              </fieldset>

              {error && <div className="rh-error" role="alert">{error}</div>}
              {message && <div className="rh-success" role="status">{message}</div>}

              <button className="rh-submit" disabled={saving}>
                {saving ? 'CRÉATION EN COURS…' : 'CRÉER L’UTILISATEUR'}
              </button>
            </form>
          </section>

          <section className="rh-users-card">
            <header><div><span>UTILISATEURS CRÉÉS</span><strong>Accès disponibles</strong></div><b>{users.length}</b></header>
            <div className="rh-user-list">
              {users.map((user) => (
                <article key={user.id}>
                  <span className="rh-avatar">{user.initiales}</span>
                  <div className="rh-user-name"><strong>{user.nom_complet}</strong><em>Identifiant : {user.identifiant_court}</em></div>
                  <div className="rh-user-modules">{user.modules.map((module) => <span key={module}>{moduleLabel(module)}</span>)}</div>
                  <b className={user.actif ? 'active' : ''}>{user.actif ? 'ACTIF' : 'INACTIF'}</b>
                </article>
              ))}
              {!users.length && !loading && <p className="rh-empty">Aucun utilisateur avec identifiant court pour le moment.</p>}
              {loading && <p className="rh-empty">Chargement des utilisateurs…</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

