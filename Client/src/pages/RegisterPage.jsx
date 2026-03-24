import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import useAutoDismissFeedback from '../lib/useAutoDismissFeedback.js'
import './RegisterPage.css'


const INITIAL_FORM = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function RegisterPage() {
  const { isAuthenticated, register } = useAppContext()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)
  const passwordsMatch = Boolean(form.password) && form.password === form.confirmPassword

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    if (feedback) {
      setFeedback('')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback('')

    if (form.password !== form.confirmPassword) {
      setFeedback('Password and confirm password do not match.')
      return
    }

    setBusy(true)

    const result = await register({
      username: form.username,
      email: form.email,
      password: form.password,
    })
    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    navigate('/home', { replace: true })
  }

  return (
    <section className="auth-page">
      <article className="auth-card auth-register-card">
        <p className="section-eyebrow">Get started</p>
        <h1>Create your account</h1>
        <p className="muted-copy">
          Register first, Please enter your details to create an account. 
        </p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Choose your username"
              required
            />
          </label>

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
              placeholder="Create a password"
              required
            />
          </label>

           <label>
            <span>Confirm Password</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
            />
          </label>

          <button type="submit" className="primary-button" disabled={busy || !passwordsMatch}>
            {busy ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-switch-copy">
          Already registered? <Link to="/login">Go to login</Link>
        </p>

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </article>
    </section>
  )
}

export default RegisterPage
