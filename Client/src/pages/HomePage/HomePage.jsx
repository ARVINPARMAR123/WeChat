import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext.jsx'
import { buildInitials, formatTime, shortenId } from '../../lib/formatters.js'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './HomePage.css'

function HomePage() {
  const {
    activeConversationId,
    directory,
    isAuthenticated,
    loadConversation,
    messageLoadingByContact,
    messagesByContact,
    unreadMessagesByContact,
    searchQuery,
    session,
    setActiveConversationId,
    setSearchQuery,
    usersLoading,
  } = useAppContext()

  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)
  const previewLoadedRef = useRef(new Set())
  const deferredSearch = useDeferredValue(searchQuery)

  const filteredDirectory = directory
    .filter((contact) => contact.id !== session.userId)
    .filter((contact) => {
      if (!deferredSearch.trim()) {
        return true
      }

      const query = deferredSearch.trim().toLowerCase()
      return [contact.alias, contact.username, contact.email, contact.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })

  useEffect(() => {
    if (!isAuthenticated) {
      previewLoadedRef.current.clear()
      return
    }

    let disposed = false

    async function preloadConversationPreviews() {
      const visibleContacts = filteredDirectory.slice(0, 12)

      for (const contact of visibleContacts) {
        if (disposed) {
          return
        }

        if (previewLoadedRef.current.has(contact.id)) {
          continue
        }

        previewLoadedRef.current.add(contact.id)
        await loadConversation(contact.id, { markAsRead: false })
      }
    }

    void preloadConversationPreviews()

    return () => {
      disposed = true
    }
  }, [filteredDirectory, isAuthenticated, loadConversation])

  const sortedContacts = [...filteredDirectory].sort((left, right) => {
    const leftMessages = messagesByContact[left.id] || []
    const rightMessages = messagesByContact[right.id] || []
    const leftLast = leftMessages[leftMessages.length - 1]
    const rightLast = rightMessages[rightMessages.length - 1]

    const leftTime = leftLast?.createdAt ? Date.parse(leftLast.createdAt) : 0
    const rightTime = rightLast?.createdAt ? Date.parse(rightLast.createdAt) : 0

    if (leftTime === rightTime) {
      const leftLabel = (left.alias || left.username || left.id).toLowerCase()
      const rightLabel = (right.alias || right.username || right.id).toLowerCase()
      return leftLabel.localeCompare(rightLabel)
    }

    return rightTime - leftTime
  })

  async function handleSelectConversation(contactId) {
    setActiveConversationId(contactId)
    const result = await loadConversation(contactId)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    setFeedback('')
    navigate(`/chat/${encodeURIComponent(contactId)}`)
  }

  return (
    <section className="page-section home-grid">
      <aside className="panel directory-panel">
        <div className="split-header home-directory-header">
          <div className="home-directory-title">
            <p className="section-eyebrow">Chat with Friends</p>
            <h2>Find user chat</h2>
          </div>
          <Link
          to="/assistant"
          className="ghost-button compact home-ai-assistant-link"
          aria-label="Open AI Assistant page"
          >
            🤖 AI Assistant
          </Link>
        </div>

        <label className="chat-search-shell" htmlFor="chat-user-search">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="chat-user-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search User chat using Username or Email"
          />
        </label>

        {usersLoading ? <p className="muted-copy small-copy">Loading users...</p> : null}

        {!filteredDirectory.length ? (
          <div className="empty-state subtle">
            <h3>No user found</h3>
            <p>Try another search keyword to find a user for chat.</p>
          </div>
        ) : (
          <div className="contact-list">
            {sortedContacts.map((contact) => {
              const contactLabel = contact.alias || contact.username || shortenId(contact.id)
              const messages = messagesByContact[contact.id] || []
              const lastMessage = messages[messages.length - 1]
              const previewText = lastMessage?.message || 'No chat yet. Tap to start messaging.'
              const previewTime = lastMessage?.createdAt ? formatTime(lastMessage.createdAt) : ''
              const hasAvatar = Boolean(contact.profilePicture)
              const loadingPreview = messageLoadingByContact[contact.id] && !lastMessage
              const unreadCount = Number(unreadMessagesByContact[contact.id]) || 0

              return (
                <button
                  key={contact.id}
                  type="button"
                  className={`contact-card chat-list-item${contact.id === activeConversationId ? ' active' : ''}`}
                  onClick={() => handleSelectConversation(contact.id)}
                >
                  <div className="chat-list-avatar">
                    {hasAvatar ? (
                      <img
                        src={contact.profilePicture}
                        alt={`${contactLabel} avatar`}
                        className="chat-list-image"
                      />
                    ) : (
                      <div className="avatar-badge warm">{buildInitials(contactLabel)}</div>
                    )}
                  </div>

                  <div className="chat-list-content">
                    <div className="chat-list-row">
                      <strong>{contactLabel}</strong>
                      <div className="chat-list-meta">
                        <span className="chat-list-time">{previewTime || '--:--'}</span>
                        {unreadCount > 0 ? <span className="chat-list-unread-badge">{unreadCount}</span> : null}
                      </div>
                    </div>
                    <p className={`chat-list-preview${unreadCount > 0 ? ' with-unread' : ''}`}>
                      {loadingPreview ? 'Loading last chat...' : previewText}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </aside>
    </section>
  )
}

export default HomePage

