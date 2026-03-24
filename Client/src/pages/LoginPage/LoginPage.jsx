import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './LoginPage.css'

const INITIAL_FORM = {
  email: '',
  password: '',
}

function LoginPage() {
  const { isAuthenticated, login } = useAppContext()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

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

    const result = await login(form)
    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    navigate('/home', { replace: true })
  }

  return (
    <section className="auth-page">
      <article className="auth-card auth-login-card">
        <p className="section-eyebrow">Welcome back</p>
        <h1>Login to continue</h1>
    
        <form className="stack-form" onSubmit={handleSubmit}>
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
            {busy ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="auth-switch-copy">
          New user? <Link to="/register">Create account</Link>
        </p>

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </article>
    </section>
  )
}

export default LoginPage

