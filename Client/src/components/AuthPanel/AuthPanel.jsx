import { useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { shortenId } from '../../lib/formatters.js'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './AuthPanel.css'

const INITIAL_FORM = {
  username: '',
  email: '',
  password: '',
}

function AuthPanel() {
  const { login, register, isAuthenticated, session, syncState } = useAppContext()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(INITIAL_FORM)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')

    const result = mode === 'register'
      ? await register(form)
      : await login(form)

    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    setFeedback(mode === 'register' ? 'Account created and signed in.' : 'Signed in successfully.')
    setForm((current) => ({
      ...INITIAL_FORM,
      email: current.email,
    }))
  }

  if (isAuthenticated) {
    return (
      <section className="panel auth-card">
        <p className="section-eyebrow">Connected</p>
        <h2>{session.displayName || session.username || 'Workspace member'}</h2>
        <p className="muted-copy">
          Token-backed session is active. Live sync is currently in {syncState} mode.
        </p>

        <dl className="detail-grid compact-details">
          <div>
            <dt>User ID</dt>
            <dd>{shortenId(session.userId)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.email || 'Stored locally'}</dd>
          </div>
          <div>
            <dt>Status line</dt>
            <dd>{session.statusLine}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>{session.walletBalance}</dd>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <section className="panel auth-card">
      <div className="split-header">
        <div>
          <p className="section-eyebrow">Secure access</p>
          <h2>Connect your backend session</h2>
        </div>

        <div className="toggle-group" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`toggle-chip${mode === 'login' ? ' active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`toggle-chip${mode === 'register' ? ' active' : ''}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <label>
            <span>Username</span>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Pick a public username"
              required
            />
          </label>
        ) : null}

        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />
        </label>

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Connecting...' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="muted-copy small-copy">
        Protected chat, AI, and payment endpoints all unlock after login.
      </p>

      {feedback ? <p className="feedback-copy">{feedback}</p> : null}
    </section>
  )
}

export default AuthPanel