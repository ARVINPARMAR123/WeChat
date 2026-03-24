import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import useAutoDismissFeedback from '../lib/useAutoDismissFeedback.js'
import './AIAssistantPage.css'

function createLocalMessage(role, content) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function formatMessageTime(value) {
  if (!value) {
    return '--:--'
  }

  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    return '--:--'
  }

  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

const AI_MESSAGES_STORAGE_KEY = 'pulse-ai-messages'

function AIAssistantPage() {
  const { requestAssistant } = useAppContext()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)
  const [messages, setMessages] = useState(() => {
    try {
      const stored = window.localStorage.getItem(AI_MESSAGES_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [copiedMessageId, setCopiedMessageId] = useState('')
  const requestAbortRef = useRef(null)
  const pendingUserMessageIdRef = useRef('')

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_MESSAGES_STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // ignore storage errors
    }
  }, [messages])

  async function copyResponse(message) {
    const textToCopy = typeof message?.content === 'string' ? message.content.trim() : ''

    if (!textToCopy) {
      return
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedMessageId(message.id)
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? '' : current))
      }, 1800)
    } catch {
      setFeedback('Copy failed. Please copy manually.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setFeedback('Write your query first.')
      return
    }

    const history = messages.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }))

    const userMessage = createLocalMessage('user', trimmedQuery)
    pendingUserMessageIdRef.current = userMessage.id
    setMessages((current) => [...current, userMessage])
    setQuery('')
    setBusy(true)

    if (requestAbortRef.current) {
      requestAbortRef.current.abort()
    }

    const abortController = new AbortController()
    requestAbortRef.current = abortController

    const result = await requestAssistant(trimmedQuery, history)

    if (requestAbortRef.current === abortController) {
      requestAbortRef.current = null
    }

    setBusy(false)

    if (result?.canceled) {
      const pendingId = pendingUserMessageIdRef.current
      if (pendingId) {
        setMessages((current) => current.filter((message) => message.id !== pendingId))
      }
      pendingUserMessageIdRef.current = ''
      setFeedback('Response stopped.')
      return
    }

    if (!result.ok) {
      pendingUserMessageIdRef.current = ''
      setFeedback(result.error)
      return
    }

    pendingUserMessageIdRef.current = ''
    setMessages((current) => [...current, createLocalMessage('assistant', result.response)])
  }

  function handleStopResponse() {
    if (!requestAbortRef.current) {
      return
    }

    requestAbortRef.current.abort()
    requestAbortRef.current = null
    setBusy(false)
    const pendingId = pendingUserMessageIdRef.current
    if (pendingId) {
      setMessages((current) => current.filter((message) => message.id !== pendingId))
    }
    pendingUserMessageIdRef.current = ''
    setQuery('')
    setFeedback('Response stopped.')
  }

  return (
    <section className="page-section ai-page-grid">
      <section className="panel ai-chat-panel">
        <div className="ai-chat-header">
          <div>
            <p className="section-eyebrow">AI Assistant</p>
            <h2>Ask your query and get AI replies</h2>
          </div>
        </div>

        {messages.length ? (
          <div className="ai-thread" role="log" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`ai-message ${message.role}`}>
                <header>
                  <strong>{message.role === 'assistant' ? 'AI Assistant' : 'You'}</strong>
                  <span>{formatMessageTime(message.createdAt)}</span>
                  {message.role === 'assistant' ? (
                    <button
                      type="button"
                      className="ai-copy-button"
                      onClick={() => copyResponse(message)}
                      aria-label="Copy AI response"
                      title="Copy"
                    >
                      <span aria-hidden="true">⧉</span>
                      <small>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</small>
                    </button>
                  ) : null}
                </header>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state subtle">
            <h3>Start AI conversation</h3>
          </div>
        )}

        <form className="ai-composer" onSubmit={handleSubmit}>
          <label className="stack-form" htmlFor="ai-query-input">
            <span>Your query</span>
            <div className="ai-query-field">
              <textarea
                id="ai-query-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask anything..."
                rows="3"
                disabled={busy}
              />
              {busy ? (
                <button
                  type="button"
                  className="ghost-button ai-stop-button ai-stop-inside"
                  onClick={handleStopResponse}
                  aria-label="Stop response"
                  title="Stop response"
                >
                  <span className="ai-spinner" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </label>

          <button type="submit" className="primary-button" disabled={busy || !query.trim()}>
            {busy ? 'Generating...' : 'Send query'}
          </button>
        </form>

        {feedback ? <p className="feedback-copy">{feedback}</p> : null}
      </section>
    </section>
  )
}

export default AIAssistantPage