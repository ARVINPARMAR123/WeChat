import { useEffect, useRef, useState } from 'react'
import { buildInitials, formatTime, shortenId } from '../../lib/formatters.js'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './ChatWindow.css'

const PREFERRED_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }

    reader.onerror = () => {
      reject(new Error('Unable to read selected file.'))
    }

    reader.readAsDataURL(file)
  })
}

function ChatWindow({
  selectedContact,
  messages,
  loading,
  currentUserId,
  isAuthenticated,
  onRefreshConversation,
  onSendMessage,
  onDeleteMessage,
  onTranslateMessage,
  onBack,
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useAutoDismissFeedback(feedback, setFeedback)

  const [isRecording, setIsRecording] = useState(false)
  const [voiceDraft, setVoiceDraft] = useState(null)
  const [photoDraft, setPhotoDraft] = useState(null)
  const [translationLanguage, setTranslationLanguage] = useState('English')
  const [translatedByMessage, setTranslatedByMessage] = useState({})
  const [translatingByMessage, setTranslatingByMessage] = useState({})
  const [activeTranslateMessageKey, setActiveTranslateMessageKey] = useState('')

  const [callMode, setCallMode] = useState('')
  const [callStartedAt, setCallStartedAt] = useState(0)
  const [callDurationSeconds, setCallDurationSeconds] = useState(0)
  const [isCallMuted, setIsCallMuted] = useState(false)
  const [callBusy, setCallBusy] = useState(false)

  const mediaRecorderRef = useRef(null)
  const recorderStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingStartedAtRef = useRef(0)

  const fileInputRef = useRef(null)
  const callStreamRef = useRef(null)
  const callVideoRef = useRef(null)

  useEffect(() => {
    if (!callStartedAt) {
      setCallDurationSeconds(0)
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setCallDurationSeconds(Math.floor((Date.now() - callStartedAt) / 1000))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [callStartedAt])

  useEffect(() => {
    if (!callVideoRef.current) {
      return
    }

    if (callMode === 'video' && callStreamRef.current) {
      callVideoRef.current.srcObject = callStreamRef.current
      void callVideoRef.current.play().catch(() => {})
      return
    }

    callVideoRef.current.srcObject = null
  }, [callMode, callStartedAt])

  useEffect(() => {
    setDraft('')
    setFeedback('')

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    setIsRecording(false)
    setVoiceDraft(null)
    setPhotoDraft(null)
    setTranslatedByMessage({})
    setTranslatingByMessage({})
    setActiveTranslateMessageKey('')

    if (recorderStreamRef.current) {
      recorderStreamRef.current.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
    }

    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach((track) => track.stop())
      callStreamRef.current = null
    }

    if (callVideoRef.current) {
      callVideoRef.current.srcObject = null
    }

    setCallMode('')
    setCallStartedAt(0)
    setCallDurationSeconds(0)
    setIsCallMuted(false)
    setCallBusy(false)
  }, [selectedContact?.id])

  useEffect(() => {
    const callVideoElement = callVideoRef.current

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }

      if (recorderStreamRef.current) {
        recorderStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (callStreamRef.current) {
        callStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (callVideoElement) {
        callVideoElement.srcObject = null
      }
    }
  }, [])

  if (!selectedContact) {
    return (
      <section className="panel chat-window placeholder-panel">
        <p className="section-eyebrow">Chat</p>
        <h2>Pick a conversation</h2>
        <p className="muted-copy">
          Search for a user, pin a contact, or add a manual recipient ID to start messaging.
        </p>
      </section>
    )
  }

  const contactLabel = selectedContact.alias || selectedContact.username || shortenId(selectedContact.id)

  async function sendMediaMessage({ text, media }) {
    setBusy(true)
    setFeedback('')

    const result = await onSendMessage(selectedContact.id, text, media)
    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return false
    }

    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!draft.trim()) {
      setFeedback('Write something before sending.')
      return
    }

    setBusy(true)
    setFeedback('')
    const result = await onSendMessage(selectedContact.id, draft)
    setBusy(false)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    setDraft('')
  }

  async function handleDelete(messageId) {
    const result = await onDeleteMessage(selectedContact.id, messageId)

    if (!result.ok) {
      setFeedback(result.error)
      return
    }
  }

  async function handleTranslateMessage(messageKey, content) {
    if (typeof onTranslateMessage !== 'function') {
      setFeedback('Translate is not available right now.')
      return
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''

    if (!trimmedContent) {
      setFeedback('Only text messages can be translated.')
      return
    }

    setFeedback('')
    setTranslatingByMessage((current) => ({ ...current, [messageKey]: true }))

    const result = await onTranslateMessage(trimmedContent, translationLanguage)

    setTranslatingByMessage((current) => ({ ...current, [messageKey]: false }))

    if (!result.ok) {
      setFeedback(result.error)
      return
    }

    setTranslatedByMessage((current) => ({
      ...current,
      [messageKey]: {
        language: result.language,
        text: result.translatedText,
      },
    }))
  }

  async function handleVoiceRecorder() {
    if (!isAuthenticated || busy) {
      return
    }

    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      setIsRecording(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setFeedback('Voice recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const supportedMimeType = PREFERRED_AUDIO_MIME_TYPES.find((type) => {
        if (typeof MediaRecorder?.isTypeSupported !== 'function') {
          return false
        }

        return MediaRecorder.isTypeSupported(type)
      })

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream)

      recorderStreamRef.current = stream
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recordingStartedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const detectedMimeType = recorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: detectedMimeType })
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000))

        if (blob.size > 0) {
          try {
            const encodedAudio = await readFileAsDataUrl(blob)

            if (!encodedAudio) {
              setFeedback('Could not process this Voice Message. Try again.')
            } else {
              setVoiceDraft({
                url: encodedAudio,
                durationSeconds,
              })
            }
          } catch {
            setFeedback('Could not process this Voice Message. Try again.')
          }
        } else {
          setFeedback('No audio captured. Try recording again.')
        }

        audioChunksRef.current = []
        mediaRecorderRef.current = null

        if (recorderStreamRef.current) {
          recorderStreamRef.current.getTracks().forEach((track) => track.stop())
          recorderStreamRef.current = null
        }

        setIsRecording(false)
      }

      recorder.start()
      setIsRecording(true)
      setFeedback('Recording started. Click again to stop.')
    } catch {
      setFeedback('Microphone permission was denied or unavailable.')
    }
  }

  async function handleSendVoiceDraft() {
    if (!voiceDraft) {
      return
    }

    const wasSent = await sendMediaMessage({
      text: `🎤 Voice Message (${voiceDraft.durationSeconds}s)`,
      media: {
        type: 'audio',
        url: voiceDraft.url,
      },
    })

    if (wasSent) {
      setVoiceDraft(null)
    }
  }

  function discardVoiceDraft() {
    setVoiceDraft(null)
  }

  function handleOpenCameraPicker() {
    if (!isAuthenticated || busy) {
      return
    }

    fileInputRef.current?.click()
  }

  async function handleCameraFilePicked(event) {
    const imageFile = event.target.files?.[0]

    if (!imageFile) {
      return
    }

    if (!imageFile.type.startsWith('image/')) {
      setFeedback('Select an image file from camera or gallery.')
      event.target.value = ''
      return
    }

    try {
      const encodedImage = await readFileAsDataUrl(imageFile)

      if (!encodedImage) {
        setFeedback('Could not process this photo. Try another one.')
        event.target.value = ''
        return
      }

      setPhotoDraft({
        url: encodedImage,
        name: imageFile.name || 'photo.jpg',
      })
    } catch {
      setFeedback('Could not process this photo. Try another one.')
    }

    event.target.value = ''
  }

  async function handleSendPhotoDraft() {
    if (!photoDraft) {
      return
    }

    const wasSent = await sendMediaMessage({
      text: '📷 Photo',
      media: {
        type: 'image',
        url: photoDraft.url,
      },
    })

    if (wasSent) {
      setPhotoDraft(null)
    }
  }

  function discardPhotoDraft() {
    setPhotoDraft(null)
  }

  function endCallSession() {
    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach((track) => track.stop())
      callStreamRef.current = null
    }

    if (callVideoRef.current) {
      callVideoRef.current.srcObject = null
    }

    setCallMode('')
    setCallStartedAt(0)
    setCallDurationSeconds(0)
    setIsCallMuted(false)
  }

  async function handleStartCall(mode) {
    if (!isAuthenticated || callBusy || busy) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback('Calls are not supported in this browser.')
      return
    }

    endCallSession()
    setCallBusy(true)
    setFeedback('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === 'video'
          ? { audio: true, video: true }
          : { audio: true, video: false },
      )

      callStreamRef.current = stream
      setCallMode(mode)
      setCallStartedAt(Date.now())
      setIsCallMuted(false)
    } catch {
      setFeedback(mode === 'video' ? 'Video call permission denied.' : 'Microphone permission denied for call.')
    } finally {
      setCallBusy(false)
    }
  }

  function handleToggleMute() {
    if (!callStreamRef.current) {
      return
    }

    const nextMuted = !isCallMuted
    callStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })

    setIsCallMuted(nextMuted)
  }

  return (
    <section className="panel chat-window conversation-panel">
      <header className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            className="ghost-button compact"
            onClick={onBack}
            title="Back to home"
            style={{ padding: '4px 6px', fontSize: '20px', flexShrink: 0 }}
          >
            ←
          </button>
          <div className="contact-summary">
            <div className="avatar-badge warm">{buildInitials(contactLabel)}</div>
            <div>
              <h2>{contactLabel}</h2>
              <p className="muted-copy">
                {selectedContact.email || shortenId(selectedContact.id)}
              </p>
            </div>
          </div>
        </div>

        <div className="chat-actions">
          <button
            type="button"
            className={`ghost-button compact${callMode === 'voice' ? ' active-tool' : ''}`}
            onClick={() => handleStartCall('voice')}
            disabled={!isAuthenticated || callBusy}
          >
            {callMode === 'voice' ? 'Voice active' : 'Call'}
          </button>

          <button
            type="button"
            className={`ghost-button compact${callMode === 'video' ? ' active-tool' : ''}`}
            onClick={() => handleStartCall('video')}
            disabled={!isAuthenticated || callBusy}
          >
            {callMode === 'video' ? 'Video active' : 'Video call'}
          </button>

          <button
            type="button"
            className="ghost-button compact"
            onClick={() => onRefreshConversation(selectedContact.id)}
            disabled={!isAuthenticated || loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {callMode ? (
        <section className="call-panel">
          <div className="call-meta">
            <p className="section-eyebrow">{callMode === 'video' ? 'Video call' : 'Voice call'}</p>
            <strong>
              {contactLabel} • {formatDuration(callDurationSeconds)}
            </strong>
          </div>

          {callMode === 'video' ? (
            <video ref={callVideoRef} className="call-video-preview" autoPlay playsInline muted />
          ) : (
            <p className="muted-copy">Microphone connected. Voice call is active on this device.</p>
          )}

          <div className="call-controls">
            <button type="button" className="ghost-button compact" onClick={handleToggleMute}>
              {isCallMuted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" className="secondary-button" onClick={endCallSession}>
              End call
            </button>
          </div>
        </section>
      ) : null}

      <div className="message-stack">
        {loading ? <p className="muted-copy">Loading conversation...</p> : null}

        {!loading && !messages.length ? (
          <div className="empty-state subtle">
            <h3>No messages yet</h3>
            <p>Send the first note to turn this contact into an active thread.</p>
          </div>
        ) : null}

        {messages.map((message) => {
          const isOwnMessage = message.senderId === currentUserId
          const hiddenForUsers = Array.isArray(message.deletedForUserIds) ? message.deletedForUserIds : []
          const isDeletedForCurrentUser = hiddenForUsers.includes(currentUserId)

          if (isDeletedForCurrentUser) {
            return null
          }

          const canDelete = !String(message.id).startsWith('local-')
          const mediaType = message.mediaType || ''
          const mediaUrl = message.mediaUrl || ''
          const messageKey = message.id || `${message.createdAt}-${message.message}`
          const isTranslating = Boolean(translatingByMessage[messageKey])
          const translatedMessage = translatedByMessage[messageKey]

          return (
            <article
              key={messageKey}
              className={`message-row ${isOwnMessage ? 'outgoing' : 'incoming'}`}
            >
              <div
                className={`message-bubble ${isOwnMessage ? 'own' : ''}${message.failed ? ' failed' : ''}`}
                onClick={(event) => {
                  if (!message.message) {
                    return
                  }

                  const interactiveElement = event.target.closest(
                    'button, select, option, input, textarea, audio, video, img, footer, a',
                  )

                  if (interactiveElement) {
                    return
                  }

                  setActiveTranslateMessageKey((current) => (current === messageKey ? '' : messageKey))
                }}
                style={{ cursor: 'pointer', marginTop: '10px' }}
              >
                {message.message ? <p>{message.message}</p> : null}

                {mediaType === 'audio' && mediaUrl ? (
                  <audio controls className="message-media-audio" src={mediaUrl} />
                ) : null}

                {mediaType === 'image' && mediaUrl ? (
                  <img src={mediaUrl} alt="Shared media" className="message-media-image" />
                ) : null}

                {message.message && activeTranslateMessageKey === messageKey ? (
                  <div className="stack-form" style={{ marginTop: '0.45rem', gap: '0.35rem' }}>
                    <span className="small-copy">Message options</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <select
                        value={translationLanguage}
                        onChange={(event) => setTranslationLanguage(event.target.value)}
                        disabled={isTranslating || busy || !isAuthenticated}
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Gujarati">Gujarati</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => handleTranslateMessage(messageKey, message.message)}
                        disabled={isTranslating || busy || !isAuthenticated}
                      >
                        {isTranslating ? 'Translating...' : 'Translate'}
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="ghost-button compact"
                          onClick={() => handleDelete(message.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    {translatedMessage?.text ? (
                      <p className="muted-copy small-copy">
                        Translated ({translatedMessage.language}): {translatedMessage.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <footer>
                  <span>{formatTime(message.createdAt)}</span>
                  {message.failed ? <span className="error-text">Failed</span> : null}
                </footer>
              </div>
            </article>
          )
        })}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-tools">
          <button
            type="button"
            className={`ghost-button compact${isRecording ? ' active-tool' : ''}`}
            onClick={handleVoiceRecorder}
            disabled={!isAuthenticated || busy}
          >
            {isRecording ? 'Stop recorder' : 'Voice recorder'}
          </button>

          <button
            type="button"
            className="ghost-button compact"
            onClick={handleOpenCameraPicker}
            disabled={!isAuthenticated || busy}
          >
            Camera
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden-file-input"
            onChange={handleCameraFilePicked}
          />
        </div>

        {voiceDraft ? (
          <div className="media-draft-panel">
            <p className="section-eyebrow">Voice Message ({voiceDraft.durationSeconds}s)</p>
            <audio controls className="message-media-audio" src={voiceDraft.url} />
            <div className="media-draft-actions">
              <button type="button" className="primary-button" onClick={handleSendVoiceDraft} disabled={busy}>
                Send Voice Message
              </button>
              <button type="button" className="ghost-button" onClick={discardVoiceDraft} disabled={busy}>
                Discard
              </button>
            </div>
          </div>
        ) : null}

        {photoDraft ? (
          <div className="media-draft-panel">
            <p className="section-eyebrow">Camera photo</p>
            <img src={photoDraft.url} alt="Camera draft" className="photo-draft-preview" />
            <div className="media-draft-actions">
              <button type="button" className="primary-button" onClick={handleSendPhotoDraft} disabled={busy}>
                Send photo
              </button>
              <button type="button" className="ghost-button" onClick={discardPhotoDraft} disabled={busy}>
                Discard
              </button>
            </div>
          </div>
        ) : null}

        <label className="composer-input" htmlFor="message-draft">
          <span>Message</span>
          <textarea
            id="message-draft"
            name="message-draft"
            rows="3"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message, idea, or next step"
            disabled={!isAuthenticated || busy}
          />
        </label>

        <button type="submit" className="primary-button" disabled={!isAuthenticated || busy}>
          {busy ? 'Sending...' : 'Send message'}
        </button>
      </form>

      {feedback ? <p className="feedback-copy">{feedback}</p> : null}
    </section>
  )
}

export default ChatWindow
