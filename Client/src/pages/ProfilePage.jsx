import { useState } from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import { buildInitials, formatCurrency, formatDate, shortenId } from '../lib/formatters.js'
import useAutoDismissFeedback from '../lib/useAutoDismissFeedback.js'
import './ProfilePage.css'

const MAX_PROFILE_IMAGE_BYTES = 900 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }

    reader.onerror = () => {
      reject(new Error('Unable to read image.'))
    }

    reader.readAsDataURL(file)
  })
}

function ProfilePage() {
  const { isAuthenticated, session, updateProfile } = useAppContext()
  const [draft, setDraft] = useState({})
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)

  const form = {
    displayName: draft.displayName ?? session.displayName,
    about: draft.about ?? session.about,
    statusLine: draft.statusLine ?? session.statusLine,
    city: draft.city ?? session.city,
    phone: draft.phone ?? session.phone,
    accent: draft.accent ?? session.accent,
    profilePicture: draft.profilePicture ?? session.profilePicture,
  }

  function handleChange(event) {
    const { name, value } = event.target
    setDraft((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleImageChange(event) {
    const imageFile = event.target.files?.[0]

    if (!imageFile) {
      return
    }

    if (!imageFile.type.startsWith('image/')) {
      setFeedback('Choose an image file for your DP.')
      event.target.value = ''
      return
    }

    if (imageFile.size > MAX_PROFILE_IMAGE_BYTES) {
      setFeedback('Image is too large. Use a file smaller than 900KB.')
      event.target.value = ''
      return
    }

    try {
      const encodedImage = await readFileAsDataUrl(imageFile)

      if (!encodedImage) {
        setFeedback('Unable to process this image. Try another one.')
        event.target.value = ''
        return
      }

      setDraft((current) => ({
        ...current,
        profilePicture: encodedImage,
      }))
      setFeedback('DP selected. Click Save profile to update image.')
    } catch {
      setFeedback('Unable to read image file. Please try again.')
    } finally {
      event.target.value = ''
    }
  }

  function handleRemoveImage() {
    setDraft((current) => ({
      ...current,
      profilePicture: '',
    }))
    setFeedback('DP removed. Click Save profile to apply changes.')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const result = await updateProfile(form)

    if (!result.ok) {
      setFeedback(result.error || 'Unable to save profile right now.')
      return
    }

    setDraft({})
    setFeedback('Profile changes saved successfully.')
  }

  return (
    <section className="page-section profile-grid">
      <section className="panel profile-hero">
        <div className="profile-avatar-shell">
          {form.profilePicture ? (
            <img
              className="profile-dp-image"
              src={form.profilePicture}
              alt={`${form.displayName || session.username || 'User'} profile`}
            />
          ) : (
            <div className="avatar-badge xl">{buildInitials(form.displayName || session.username || 'Guest')}</div>
          )}
        </div>
        <p className="section-eyebrow">Profile</p>
        <h2>{form.displayName || session.username || 'Guest profile'}</h2>
        <p className="lead-copy">{form.about}</p>

        <dl className="detail-grid">
          <div>
            <dt>User ID</dt>
            <dd>{shortenId(session.userId)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.email || 'Connect a backend session'}</dd>
          </div>
          <div>
            <dt>Wallet balance</dt>
            <dd>{formatCurrency(session.walletBalance)}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDate(session.joinedAt)}</dd>
          </div>
        </dl>

        <p className="muted-copy">
          {isAuthenticated
            ? 'Your profile and account details are secured and Unauthorized persons cannot access them.'
            : 'Sign in to pull your profile into this page.'}
        </p>
      </section>

      <section className="panel profile-form-panel">
        <div className="split-header">
          <div>
            <p className="section-eyebrow">Personalize</p>
            <h2>Update Profile</h2>
          </div>
          <span className="contact-tag">Account settings</span>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Display name</span>
            <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Public label" />
          </label>

          <label>
            <span>About</span>
            <textarea name="about" rows="3" value={form.about} onChange={handleChange} placeholder="Short bio" />
          </label>

          <label>
            <span>Status line</span>
            <input name="statusLine" value={form.statusLine} onChange={handleChange} placeholder="Visible subtitle" />
          </label>

          <div className="dual-grid">
            <label>
              <span>City</span>
              <input name="city" value={form.city} onChange={handleChange} placeholder="Your city" />
            </label>
            <label>
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Optional phone" />
            </label>
          </div>

          <label>
            <span>Gender</span>
            <select name="accent" value={form.accent} onChange={handleChange}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="cutome">Custom</option>
            </select>
          </label>

          <label>
            <span>Display picture (DP)</span>
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </label>

          <p className="profile-image-note">Upload JPG, PNG, or WebP image up to 900KB.</p>

          {form.profilePicture ? (
            <div className="profile-image-actions">
              <button type="button" className="ghost-button" onClick={handleRemoveImage}>
                Remove current DP
              </button>
            </div>
          ) : null}

          <button type="submit" className="primary-button">Save profile</button>
        </form>

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </section>
    </section>
  )
}

export default ProfilePage