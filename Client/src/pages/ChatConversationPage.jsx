import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ChatWindow from '../components/ChatWindow.jsx'
import { useAppContext } from '../context/AppContext.jsx'
import useAutoDismissFeedback from '../lib/useAutoDismissFeedback.js'
import './HomePage.css'
import './ChatConversationPage.css'

function ChatConversationPage() {
  const { contactId: encodedContactId = '' } = useParams()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)

  const {
    directory,
    isAuthenticated,
    loadConversation,
    messageLoadingByContact,
    messagesByContact,
    sendMessage,
    deleteMessage,
    translateMessageText,
    session,
    setActiveConversationId,
  } = useAppContext()

  const contactId = decodeURIComponent(encodedContactId)
  const selectedContact = directory.find((contact) => contact.id === contactId) || null
  const currentMessages = messagesByContact[contactId] || []
  const currentLoading = messageLoadingByContact[contactId] || false

  const loadConversationRef = useRef(loadConversation)
  const setActiveConversationIdRef = useRef(setActiveConversationId)

  useEffect(() => {
    loadConversationRef.current = loadConversation
    setActiveConversationIdRef.current = setActiveConversationId
  }, [loadConversation, setActiveConversationId])

  useEffect(() => {
    if (!contactId) {
      navigate('/home', { replace: true })
      return
    }

    let disposed = false
    setActiveConversationIdRef.current(contactId)

    async function openConversation() {
      const result = await loadConversationRef.current(contactId)

      if (disposed) {
        return
      }

      if (!result.ok) {
        setFeedback(result.error)
        return
      }

      setFeedback('')
    }

    void openConversation()

    return () => {
      disposed = true
    }
  }, [contactId, navigate])

  return (
    <div className="app-shell chat-route-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <div className="app-frame">
        <main className="content-shell">
          <section className="page-section chat-route-page">
            <div className="home-chat-panel chat-route-panel">
              <ChatWindow
                selectedContact={selectedContact}
                messages={currentMessages}
                loading={currentLoading}
                currentUserId={session.userId}
                isAuthenticated={isAuthenticated}
                onRefreshConversation={loadConversation}
                onSendMessage={sendMessage}
                onDeleteMessage={deleteMessage}
                onTranslateMessage={translateMessageText}
                onBack={() => navigate('/home')}
              />
            </div>

            {feedback ? <p className="feedback-copy">{feedback}</p> : null}
          </section>
        </main>
      </div>
    </div>
  )
}

export default ChatConversationPage
