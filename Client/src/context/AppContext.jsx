/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { decodeToken } from '../lib/auth.js'
import { api, authConfig, getErrorMessage, SOCKET_URL } from '../lib/api.js'

const AppContext = createContext(null)

const STORAGE_KEYS = {
  session: 'pulse-chat-session',
  contacts: 'pulse-chat-contacts',
  stories: 'pulse-chat-stories',
  posts: 'pulse-chat-posts',
  activity: 'pulse-chat-activity',
  unreadMessages: 'pulse-chat-unread-messages',
  hasRegistered: 'pulse-chat-has-registered',
}

const SUPPORTED_TRANSLATION_LANGUAGES = new Set(['English', 'Hindi', 'Gujarati', 'Marathi'])

const LEGACY_DEFAULT_ABOUT = 'Available for sharp conversations.'
const LEGACY_DEFAULT_STATUS_LINE = 'Designing fast chat flows'

const DEFAULT_SESSION = {
  token: '',
  userId: '',
  username: '',
  email: '',
  profilePicture: '',
  walletBalance: 0,
  displayName: '',
  about: '',
  statusLine: '',
  gender: 'Male',
  city: '',
  phone: '',
  joinedAt: '',
  online: false,
}

function sanitizeLegacySessionDefaults(storedSession = {}) {
  return {
    ...storedSession,
    about: storedSession.about === LEGACY_DEFAULT_ABOUT ? '' : storedSession.about,
    statusLine: storedSession.statusLine === LEGACY_DEFAULT_STATUS_LINE ? '' : storedSession.statusLine,
  }
}

function createSeedStories() {
  return [
    {
      id: 'seed-design-desk',
      authorId: 'design-desk',
      authorName: 'Design Desk',
      title: 'Soft glass rollout',
      content: 'Fresh seaside gradients shipped across the interface this morning.',
      tone: 'Design',
      mediaType: '',
      mediaUrl: '',
      viewers: [
        { id: 'wallet-lab', name: 'Wallet Lab', viewedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
      ],
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-wallet-lab',
      authorId: 'wallet-lab',
      authorName: 'Wallet Lab',
      title: 'Balance pulse',
      content: 'Transfers are tracking cleanly. Today looks steady.',
      tone: 'Finance',
      mediaType: '',
      mediaUrl: '',
      viewers: [
        { id: 'design-desk', name: 'Design Desk', viewedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString() },
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-assistant',
      authorId: 'assistant-dock',
      authorName: 'Assistant Dock',
      title: 'AI ready',
      content: 'Use the assistant panel to draft replies, statuses, or payment notes.',
      tone: 'AI',
      mediaType: '',
      mediaUrl: '',
      viewers: [
        { id: 'design-desk', name: 'Design Desk', viewedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'wallet-lab', name: 'Wallet Lab', viewedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
      ],
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

function readStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    return rawValue ? JSON.parse(rawValue) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function createActivity(type, title, detail, meta = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    detail,
    meta,
    createdAt: new Date().toISOString(),
  }
}

function normalizeUser(user) {
  if (!user) {
    return null
  }

  const { id, _id } = user

  return {
    ...user,
    id: id || _id,
  }
}

function normalizeMessage(message) {
  if (!message) {
    return null
  }

  const { id, _id, localId } = message

  return {
    ...message,
    id: id || _id || localId,
  }
}

function normalizeTransaction(transaction) {
  if (!transaction) {
    return null
  }

  const { id, _id } = transaction

  return {
    ...transaction,
    id: id || _id,
  }
}

function mergeSession(previous, update = {}) {
  const updateUsername = typeof update.username === 'string' ? update.username.trim() : ''
  const previousUsername = typeof previous.username === 'string' ? previous.username.trim() : ''
  const resolvedUsername = updateUsername || previousUsername

  const updateDisplayName = typeof update.displayName === 'string' ? update.displayName.trim() : ''
  const previousDisplayName = typeof previous.displayName === 'string' ? previous.displayName.trim() : ''
  const resolvedDisplayName = updateDisplayName || updateUsername || previousDisplayName || resolvedUsername

  return {
    ...previous,
    ...update,
    userId: update.userId || update.id || update._id || previous.userId,
    username: resolvedUsername,
    email: update.email ?? previous.email,
    profilePicture: update.profilePicture ?? previous.profilePicture,
    walletBalance:
      typeof update.walletBalance === 'number'
        ? update.walletBalance
        : typeof update.balance === 'number'
          ? update.balance
          : previous.walletBalance,
    displayName: resolvedDisplayName,
    about: update.about ?? previous.about,
    statusLine: update.statusLine ?? previous.statusLine,
    accent: update.accent ?? previous.accent,
    city: update.city ?? previous.city,
    phone: update.phone ?? previous.phone,
    joinedAt: update.joinedAt ?? update.createdAt ?? previous.joinedAt,
    online: update.online ?? previous.online,
  }
}

function dedupeDirectory(users, contacts) {
  const directoryMap = new Map()

  users
    .map(normalizeUser)
    .filter(Boolean)
    .forEach((user) => {
      directoryMap.set(user.id, {
        ...user,
        alias: user.alias || '',
        source: 'server',
      })
    })

  contacts
    .filter(Boolean)
    .forEach((contact) => {
      const existing = directoryMap.get(contact.id) || {}
      directoryMap.set(contact.id, {
        ...existing,
        ...contact,
        id: contact.id || existing.id,
        username: contact.username || existing.username || contact.alias || 'Unknown contact',
        email: contact.email || existing.email || '',
        source: contact.source || existing.source || 'manual',
      })
    })

  return Array.from(directoryMap.values()).sort((left, right) => {
    const leftLabel = (left.alias || left.username || '').toLowerCase()
    const rightLabel = (right.alias || right.username || '').toLowerCase()
    return leftLabel.localeCompare(rightLabel)
  })
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => mergeSession(
    DEFAULT_SESSION,
    sanitizeLegacySessionDefaults(readStorage(STORAGE_KEYS.session, {})),
  ))
  const [contacts, setContacts] = useState(() => readStorage(STORAGE_KEYS.contacts, []))
  const [hasRegistered, setHasRegistered] = useState(() => Boolean(readStorage(STORAGE_KEYS.hasRegistered, false)))
  const [stories, setStories] = useState(() => {
    const storedStories = readStorage(STORAGE_KEYS.stories, [])
    return Array.isArray(storedStories) && storedStories.length ? storedStories : createSeedStories()
  })
  const [posts, setPosts] = useState(() => readStorage(STORAGE_KEYS.posts, []))
  const [activity, setActivity] = useState(() => readStorage(STORAGE_KEYS.activity, []))
  const [users, setUsers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [messagesByContact, setMessagesByContact] = useState({})
  const [unreadMessagesByContact, setUnreadMessagesByContact] = useState(() => readStorage(STORAGE_KEYS.unreadMessages, {}))
  const [messageLoadingByContact, setMessageLoadingByContact] = useState({})
  const [activeConversationId, setActiveConversationId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [syncState, setSyncState] = useState('offline')
  const socketRef = useRef(null)
  const activeConversationRef = useRef('')

  const decodedSessionToken = decodeToken(session.token)
  const isTokenExpired = Boolean(
    decodedSessionToken?.exp && Number(decodedSessionToken.exp) * 1000 <= Date.now(),
  )
  const isAuthenticated = Boolean(session.token && session.userId && !isTokenExpired)
  const directory = dedupeDirectory(users, contacts)

  useEffect(() => {
    writeStorage(STORAGE_KEYS.session, session)
  }, [session])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.contacts, contacts)
  }, [contacts])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.hasRegistered, hasRegistered)
  }, [hasRegistered])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.stories, stories)
  }, [stories])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.posts, posts)
  }, [posts])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.activity, activity)
  }, [activity])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.unreadMessages, unreadMessagesByContact)
  }, [unreadMessagesByContact])

  useEffect(() => {
    activeConversationRef.current = activeConversationId

    if (!activeConversationId) {
      return
    }

    setUnreadMessagesByContact((current) => {
      if (!current[activeConversationId]) {
        return current
      }

      const next = { ...current }
      delete next[activeConversationId]
      return next
    })
  }, [activeConversationId])

  useEffect(() => {
    setStories((current) => current.filter((story) => !story.expiresAt || Date.parse(story.expiresAt) > Date.now()))
  }, [])

  useEffect(() => {
    if (!session.token || !isTokenExpired) {
      return
    }

    setSession(DEFAULT_SESSION)
    setUsers([])
    setTransactions([])
    setPosts([])
    setMessagesByContact({})
    setUnreadMessagesByContact({})
    setMessageLoadingByContact({})
    setActiveConversationId('')
    setSyncState('offline')
  }, [session.token, isTokenExpired])

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }

      setUsers([])
      setTransactions([])
      setPosts([])
      setMessagesByContact({})
      setUnreadMessagesByContact({})
      setMessageLoadingByContact({})
      setSyncState('offline')
      return undefined
    }

    let isDisposed = false
    const socket = io(SOCKET_URL, {
      auth: {
        userId: session.userId,
      },
      transports: ['polling'],
      timeout: 4000,
      reconnectionAttempts: 2,
    })

    socketRef.current = socket
    setSyncState('syncing')

    socket.on('connect', () => {
      socket.emit('joinRoom', session.userId)

      if (!isDisposed) {
        setSyncState('live')
      }
    })

    socket.on('disconnect', () => {
      if (!isDisposed) {
        setSyncState('offline')
      }
    })

    socket.on('connect_error', () => {
      if (!isDisposed) {
        setSyncState('degraded')
      }
    })

    socket.on('receiveMessage', (incomingMessage) => {
      if (isDisposed) {
        return
      }

      const message = normalizeMessage(incomingMessage)

      if (!message?.senderId || !message?.recipientId) {
        return
      }

      const counterpartId = message.senderId === session.userId ? message.recipientId : message.senderId

      setMessagesByContact((current) => ({
        ...current,
        [counterpartId]: (current[counterpartId] || []).some((entry) => entry.id && entry.id === message.id)
          ? (current[counterpartId] || [])
          : [...(current[counterpartId] || []), message],
      }))

      if (message.senderId !== session.userId && activeConversationRef.current !== counterpartId) {
        setUnreadMessagesByContact((current) => ({
          ...current,
          [counterpartId]: (Number(current[counterpartId]) || 0) + 1,
        }))
      }

      setActivity((current) => [
        createActivity('message', 'Incoming message', message.message, { contactId: counterpartId }),
        ...current,
      ].slice(0, 80))
    })

    async function bootstrapAuthenticatedState() {
      setUsersLoading(true)
      setTransactionsLoading(true)

      try {
        const [profileResponse, usersResponse, transactionsResponse, storiesResponse, postsResponse] = await Promise.all([
          api.get('/auth/me', authConfig(session.token)),
          api.get('/auth/users', authConfig(session.token)),
          api.get(`/payments/transactions/${session.userId}`, authConfig(session.token)),
          api.get('/stories', authConfig(session.token)),
          api.get('/posts', authConfig(session.token)),
        ])

        if (isDisposed) {
          return
        }

        setSession((current) => mergeSession(current, profileResponse.data))
        setUsers((usersResponse.data || []).map(normalizeUser).filter(Boolean))
        setTransactions((transactionsResponse.data || []).map(normalizeTransaction).filter(Boolean))
        
        if (storiesResponse.data?.ok && Array.isArray(storiesResponse.data?.data)) {
          setStories(storiesResponse.data.data)
        }

        if (postsResponse.data?.ok && Array.isArray(postsResponse.data?.data)) {
          setPosts(postsResponse.data.data)
        }
      } catch (error) {
        if (!isDisposed && error?.response?.status === 401) {
          setSession(DEFAULT_SESSION)
          setUsers([])
          setTransactions([])
          setPosts([])
          setMessagesByContact({})
          setUnreadMessagesByContact({})
          setMessageLoadingByContact({})
          setActiveConversationId('')
          setSyncState('offline')
          return
        }

        if (!isDisposed) {
          setSyncState('degraded')
        }
      } finally {
        if (!isDisposed) {
          setUsersLoading(false)
          setTransactionsLoading(false)
        }
      }
    }

    void bootstrapAuthenticatedState()

    return () => {
      isDisposed = true
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, session.token, session.userId])

  async function refreshDirectory() {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    setUsersLoading(true)

    try {
      const response = await api.get('/auth/users', authConfig(session.token))
      setUsers((response.data || []).map(normalizeUser).filter(Boolean))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to refresh people.') }
    } finally {
      setUsersLoading(false)
    }
  }

  async function refreshTransactions() {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    setTransactionsLoading(true)

    try {
      const response = await api.get(`/payments/transactions/${session.userId}`, authConfig(session.token))
      setTransactions((response.data || []).map(normalizeTransaction).filter(Boolean))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to refresh transactions.') }
    } finally {
      setTransactionsLoading(false)
    }
  }

  async function login(credentials) {
    const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
    const password = credentials?.password
    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : ''

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      })

      const token = response.data?.token
      const decodedToken = decodeToken(token)

      if (!token || !decodedToken?.userId) {
        return { ok: false, error: 'The server returned an invalid token.' }
      }

      const fallbackUsername = username || email.split('@')[0]

      setSession((current) => mergeSession(
        {
          ...DEFAULT_SESSION,
          ...current,
        },
        {
          token,
          userId: decodedToken.userId,
          email,
          username: fallbackUsername,
          displayName: fallbackUsername,
        },
      ))

      setActivity((current) => [
        createActivity('auth', 'Signed in', 'Realtime chat and wallet features are unlocked.'),
        ...current,
      ].slice(0, 80))

      setHasRegistered(true)

      return { ok: true }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to sign in.') }
    }
  }

  async function register(credentials) {
    const username = typeof credentials?.username === 'string' ? credentials.username.trim() : ''
    const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
    const password = credentials?.password

    try {
      await api.post('/auth/register', {
        username,
        email,
        password,
      })

      const result = await login({ username, email, password })

      if (result.ok) {
        setHasRegistered(true)

        setSession((current) => mergeSession(current, {
          username,
          displayName: current.displayName || username,
        }))

        setActivity((current) => [
          createActivity('auth', 'Account created', 'Your new account is ready for chat and payments.'),
          ...current,
        ].slice(0, 80))
      }

      return result
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to register.') }
    }
  }

  async function logout() {
    try {
      if (isAuthenticated) {
        await api.post('/auth/logout', {}, authConfig(session.token))
      }
    } catch {
      return { ok: true }
    } finally {
      setSession(DEFAULT_SESSION)
      setUsers([])
      setTransactions([])
      setPosts([])
      setMessagesByContact({})
      setUnreadMessagesByContact({})
      setMessageLoadingByContact({})
      setActiveConversationId('')
      setSyncState('offline')
    }

    return { ok: true }
  }

  async function loadConversation(contactId, options = {}) {
    const targetId = contactId?.trim()
    const { markAsRead = true } = options
    const shouldMarkAsRead = markAsRead !== false

    if (!isAuthenticated || !targetId) {
      return { ok: false, error: 'Sign in and choose a conversation.' }
    }

    setMessageLoadingByContact((current) => ({
      ...current,
      [targetId]: true,
    }))

    try {
      const response = await api.get(`/messages/${session.userId}/${targetId}`, authConfig(session.token))
      const normalizedMessages = (response.data || []).map(normalizeMessage).filter(Boolean)

      setMessagesByContact((current) => ({
        ...current,
        [targetId]: normalizedMessages,
      }))

      if (shouldMarkAsRead) {
        setUnreadMessagesByContact((current) => {
          if (!current[targetId]) {
            return current
          }

          const next = { ...current }
          delete next[targetId]
          return next
        })
      }

      return { ok: true, data: normalizedMessages }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to load the conversation.') }
    } finally {
      setMessageLoadingByContact((current) => ({
        ...current,
        [targetId]: false,
      }))
    }
  }

  async function sendMessage(contactId, text, media = {}) {
    const targetId = contactId?.trim()
    const messageText = typeof text === 'string' ? text.trim() : ''
    const normalizedMediaType = media?.type === 'audio'
      ? 'audio'
      : media?.type === 'image'
        ? 'image'
        : media?.type === 'video'
          ? 'video'
          : ''
    const normalizedMediaUrl = typeof media?.url === 'string' ? media.url.trim() : ''
    const fallbackText = normalizedMediaType === 'audio'
      ? '🎤 Voice note'
      : normalizedMediaType === 'image'
        ? '📷 Photo'
        : normalizedMediaType === 'video'
          ? '🎬 Video'
          : 'Media message'
    const resolvedMessageText = messageText || (normalizedMediaUrl ? fallbackText : '')

    if (!isAuthenticated || !targetId) {
      return { ok: false, error: 'Sign in before sending a message.' }
    }

    if (!resolvedMessageText && !normalizedMediaUrl) {
      return { ok: false, error: 'Write a message or attach media first.' }
    }

    const optimisticId = `local-${Date.now()}`
    const optimisticMessage = normalizeMessage({
      id: optimisticId,
      senderId: session.userId,
      recipientId: targetId,
      message: resolvedMessageText,
      mediaType: normalizedMediaType,
      mediaUrl: normalizedMediaUrl,
      createdAt: new Date().toISOString(),
      optimistic: true,
    })

    setMessagesByContact((current) => ({
      ...current,
      [targetId]: [...(current[targetId] || []), optimisticMessage],
    }))

    try {
      const response = await api.post(
        '/messages/send',
        {
          recipientId: targetId,
          message: resolvedMessageText,
          mediaType: normalizedMediaType,
          mediaUrl: normalizedMediaUrl,
        },
        authConfig(session.token),
      )

      const savedMessage = normalizeMessage(response.data)

      setMessagesByContact((current) => ({
        ...current,
        [targetId]: (current[targetId] || []).map((entry) => (
          entry.id === optimisticId ? savedMessage : entry
        )),
      }))

      if (socketRef.current) {
        socketRef.current.emit('sendMessage', {
          id: savedMessage.id,
          senderId: savedMessage.senderId,
          recipientId: savedMessage.recipientId,
          message: savedMessage.message,
          mediaType: savedMessage.mediaType || '',
          mediaUrl: savedMessage.mediaUrl || '',
          createdAt: savedMessage.createdAt,
        })
      }

      const resolvedContact = resolveContact(targetId)
      const contactLabel = resolvedContact?.alias || resolvedContact?.username || targetId
      const activityDetail = resolvedMessageText || fallbackText
      setActivity((current) => [
        createActivity('message', `Message to ${contactLabel}`, activityDetail, { contactId: targetId }),
        ...current,
      ].slice(0, 80))

      return { ok: true, data: savedMessage }
    } catch (error) {
      setMessagesByContact((current) => ({
        ...current,
        [targetId]: (current[targetId] || []).map((entry) => (
          entry.id === optimisticId
            ? { ...entry, failed: true, optimistic: false }
            : entry
        )),
      }))

      return { ok: false, error: getErrorMessage(error, 'Unable to send the message.') }
    }
  }

  async function deleteMessage(contactId, messageId) {
    if (!isAuthenticated || !messageId) {
      return { ok: false, error: 'Choose a saved message first.' }
    }

    try {
      await api.delete(`/messages/${messageId}`, authConfig(session.token))

      setMessagesByContact((current) => ({
        ...current,
        [contactId]: (current[contactId] || []).filter((entry) => entry.id !== messageId),
      }))

      setActivity((current) => [
        createActivity('message', 'Message deleted', 'A sent message was removed from the thread.', { contactId }),
        ...current,
      ].slice(0, 80))

      return { ok: true }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to delete the message.') }
    }
  }

  async function requestAssistant(prompt, history = [], options = {}) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in to use the AI assistant.' }
    }

    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : ''

    if (!trimmedPrompt) {
      return { ok: false, error: 'Enter your query for the assistant.' }
    }

    const normalizedHistory = Array.isArray(history)
      ? history
        .filter((entry) => entry?.role === 'assistant' || entry?.role === 'user')
        .map((entry) => ({
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: typeof entry.content === 'string' ? entry.content.trim() : '',
        }))
        .filter((entry) => entry.content)
        .slice(-12)
      : []

    try {
      const requestConfig = {
        ...authConfig(session.token),
        signal: options?.signal,
      }

      const response = await api.post(
        '/ai/chat',
        {
          message: trimmedPrompt,
          history: normalizedHistory,
        },
        requestConfig,
      )

      setActivity((current) => [
        createActivity('ai', 'Assistant prompt', trimmedPrompt, {}),
        ...current,
      ].slice(0, 80))

      return {
        ok: true,
        response: response.data?.response || 'No response returned.',
      }
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
        return { ok: false, canceled: true, error: 'Response stopped.' }
      }

      return { ok: false, error: getErrorMessage(error, 'Unable to reach the assistant.') }
    }
  }

  async function translateMessageText(message, language = 'English') {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in to translate chat messages.' }
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : ''

    if (!trimmedMessage) {
      return { ok: false, error: 'Select a message with text to translate.' }
    }

    const safeLanguage = SUPPORTED_TRANSLATION_LANGUAGES.has(language) ? language : 'English'
    const translationPrompt = [
      `Translate this chat message to ${safeLanguage}.`,
      'Return only the translated text.',
      '',
      trimmedMessage,
    ].join('\n')

    try {
      const response = await api.post(
        '/ai/chat',
        { message: translationPrompt },
        authConfig(session.token),
      )

      const translatedText = typeof response.data?.response === 'string' ? response.data.response.trim() : ''

      if (!translatedText) {
        return { ok: false, error: 'No translated text returned.' }
      }

      return { ok: true, translatedText, language: safeLanguage }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to translate this message.') }
    }
  }

  async function sendPayment({ recipientId, amount, note }) {
    const targetId = recipientId?.trim()
    const numericAmount = Number(amount)
    const trimmedNote = typeof note === 'string' ? note.trim() : ''

    if (!isAuthenticated || !targetId) {
      return { ok: false, error: 'Sign in and choose a recipient first.' }
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { ok: false, error: 'Enter a valid amount.' }
    }

    try {
      const response = await api.post(
        '/payments/transfer',
        { recipientId: targetId, amount: numericAmount, note: trimmedNote },
        authConfig(session.token),
      )

      if (typeof response.data?.senderBalance === 'number') {
        setSession((current) => mergeSession(current, {
          walletBalance: response.data.senderBalance,
        }))
      }

      await refreshTransactions()

      const resolvedContact = resolveContact(targetId)
      const contactLabel = resolvedContact?.alias || resolvedContact?.username || targetId
      const detail = trimmedNote
        ? `${numericAmount} sent to ${contactLabel}. ${trimmedNote}`
        : `${numericAmount} sent to ${contactLabel}.`

      setActivity((current) => [
        createActivity('payment', 'Money transferred', detail, { recipientId: targetId, amount: numericAmount }),
        ...current,
      ].slice(0, 80))

      return { ok: true, data: response.data }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to send money.') }
    }
  }

  async function addStory({ content, mediaType = '', mediaUrl = '' }) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    const trimmedContent = content?.trim() || ''
    const normalizedMediaType = mediaType === 'video'
      ? 'video'
      : mediaType === 'image'
        ? 'image'
        : mediaType === 'audio'
          ? 'audio'
          : ''
    const normalizedMediaUrl = typeof mediaUrl === 'string' ? mediaUrl.trim() : ''

    if (!trimmedContent && !normalizedMediaUrl) {
      return { ok: false, error: 'Add text, image, video, or song before posting.' }
    }

    const title = trimmedContent
      ? trimmedContent.slice(0, 48)
      : normalizedMediaType === 'video'
        ? 'Video status'
        : normalizedMediaType === 'audio'
          ? 'Song status'
        : normalizedMediaType === 'image'
          ? 'Photo status'
          : 'Fresh update'

    try {
      const response = await api.post(
        '/stories',
        {
          title,
          content: trimmedContent,
          mediaType: normalizedMediaType,
          mediaUrl: normalizedMediaUrl,
        },
        authConfig(session.token),
      )

      if (response.data?.ok && response.data?.data) {
        const newStory = response.data.data
        setStories((current) => [newStory, ...current].slice(0, 40))
        setActivity((current) => [
          createActivity('status', 'Status posted', title, { storyId: newStory.id }),
          ...current,
        ].slice(0, 80))

        return { ok: true, data: newStory }
      }

      return { ok: false, error: response.data?.error || 'Failed to post story' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to post story.') }
    }
  }

  async function fetchStories() {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.get('/stories', authConfig(session.token))

      if (response.data?.ok && Array.isArray(response.data?.data)) {
        const fetchedStories = response.data.data
        setStories(fetchedStories)
        return { ok: true, data: fetchedStories }
      }

      return { ok: false, error: 'Failed to fetch stories' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to fetch stories.') }
    }
  }

  async function markStoryViewed(storyId) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.post(
        `/stories/${storyId}/view`,
        {},
        authConfig(session.token),
      )

      return response.data?.ok ? { ok: true } : { ok: false, error: 'Failed to mark as viewed' }
    } catch {
      // Silently fail for expired stories or already viewed
      return { ok: false }
    }
  }

  async function deleteStory(storyId) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.delete(`/stories/${storyId}`, authConfig(session.token))

      if (response.data?.ok) {
        setStories((current) => current.filter((s) => s.id !== storyId))
        return { ok: true }
      }

      return { ok: false, error: response.data?.error || 'Failed to delete story' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to delete story.') }
    }
  }

  async function fetchPosts() {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.get('/posts', authConfig(session.token))

      if (response.data?.ok && Array.isArray(response.data?.data)) {
        setPosts(response.data.data)
        return { ok: true, data: response.data.data }
      }

      return { ok: false, error: response.data?.message || 'Failed to fetch posts.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to fetch posts.') }
    }
  }

  async function addPost({ content, mediaType = '', mediaUrl = '' }) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    const payload = {
      content: typeof content === 'string' ? content.trim() : '',
      mediaType: mediaType === 'video'
        ? 'video'
        : mediaType === 'image'
          ? 'image'
          : mediaType === 'audio'
            ? 'audio'
            : '',
      mediaUrl: typeof mediaUrl === 'string' ? mediaUrl.trim() : '',
    }

    if (!payload.content && !payload.mediaUrl) {
      return { ok: false, error: 'Add text, image, video, or song before posting.' }
    }

    try {
      const response = await api.post('/posts', payload, authConfig(session.token))

      if (response.data?.ok && response.data?.data) {
        const nextPost = response.data.data
        setPosts((current) => [nextPost, ...current].slice(0, 120))
        setActivity((current) => [
          createActivity('status', 'Post uploaded', payload.content || 'Shared media update', { postId: nextPost.id }),
          ...current,
        ].slice(0, 80))
        return { ok: true, data: nextPost }
      }

      return { ok: false, error: response.data?.message || 'Unable to create post.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to create post.') }
    }
  }

  async function togglePostLike(postId) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.post(`/posts/${postId}/like`, {}, authConfig(session.token))

      if (response.data?.ok) {
        setPosts((current) => current.map((post) => (
          post.id === postId
            ? {
              ...post,
              likes: Array.isArray(response.data.likes) ? response.data.likes : post.likes,
            }
            : post
        )))

        return { ok: true, liked: Boolean(response.data.liked) }
      }

      return { ok: false, error: response.data?.message || 'Unable to update like.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to update like.') }
    }
  }

  async function togglePostReaction(postId, emoji) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    const normalizedEmoji = typeof emoji === 'string' ? emoji.trim() : ''

    if (!normalizedEmoji) {
      return { ok: false, error: 'Choose an emoji.' }
    }

    try {
      const response = await api.post(`/posts/${postId}/reactions`, { emoji: normalizedEmoji }, authConfig(session.token))

      if (response.data?.ok) {
        setPosts((current) => current.map((post) => (
          post.id === postId
            ? {
              ...post,
              reactions: Array.isArray(response.data.reactions) ? response.data.reactions : post.reactions,
            }
            : post
        )))

        return { ok: true, reacted: Boolean(response.data.reacted) }
      }

      return { ok: false, error: response.data?.message || 'Unable to update reaction.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to update reaction.') }
    }
  }

  async function addPostReply(postId, content) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    const trimmed = typeof content === 'string' ? content.trim() : ''

    if (!trimmed) {
      return { ok: false, error: 'Write a reply first.' }
    }

    try {
      const response = await api.post(`/posts/${postId}/replies`, { content: trimmed }, authConfig(session.token))

      if (response.data?.ok && response.data?.data) {
        const reply = response.data.data

        setPosts((current) => current.map((post) => (
          post.id === postId
            ? {
              ...post,
              replies: [...(Array.isArray(post.replies) ? post.replies : []), reply],
            }
            : post
        )))

        return { ok: true, data: reply }
      }

      return { ok: false, error: response.data?.message || 'Unable to add reply.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to add reply.') }
    }
  }

  async function deletePost(postId) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in first.' }
    }

    try {
      const response = await api.delete(`/posts/${postId}`, authConfig(session.token))

      if (response.data?.ok) {
        setPosts((current) => current.filter((post) => post.id !== postId))
        return { ok: true }
      }

      return { ok: false, error: response.data?.message || 'Unable to delete post.' }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to delete post.') }
    }
  }

  async function updateProfile(values) {
    if (!isAuthenticated) {
      return { ok: false, error: 'Sign in to save profile changes.' }
    }

    const payload = {
      displayName: typeof values.displayName === 'string' ? values.displayName.trim() : '',
      about: typeof values.about === 'string' ? values.about.trim() : '',
      statusLine: typeof values.statusLine === 'string' ? values.statusLine.trim() : '',
      city: typeof values.city === 'string' ? values.city.trim() : '',
      phone: typeof values.phone === 'string' ? values.phone.trim() : '',
      accent: typeof values.accent === 'string' ? values.accent.trim() : '',
      profilePicture: typeof values.profilePicture === 'string' ? values.profilePicture.trim() : '',
    }

    try {
      const response = await api.put('/auth/profile', payload, authConfig(session.token))
      const updatedUser = response.data?.user || response.data || {}

      setSession((current) => mergeSession(current, updatedUser))
      setActivity((current) => [
        createActivity('profile', 'Profile updated', 'Your profile was saved to your account.'),
        ...current,
      ].slice(0, 80))

      return { ok: true }
    } catch (error) {
      return { ok: false, error: getErrorMessage(error, 'Unable to save profile.') }
    }
  }

  function addManualContact({ id, name, email }) {
    const contactId = typeof id === 'string' ? id.trim() : ''
    const contactName = typeof name === 'string' ? name.trim() : ''
    const contactEmail = typeof email === 'string' ? email.trim() : ''

    if (!contactId || !contactName) {
      return { ok: false, error: 'Add both a recipient ID and a label.' }
    }

    const contactRecord = {
      id: contactId,
      username: contactName,
      alias: contactName,
      email: contactEmail,
      source: 'manual',
      pinnedAt: new Date().toISOString(),
    }

    setContacts((current) => {
      const remainingContacts = current.filter((entry) => entry.id !== contactId)
      return [contactRecord, ...remainingContacts]
    })

    setActivity((current) => [
      createActivity('contact', `Pinned ${contactName}`, `Manual recipient saved with ID ${contactId}.`, { contactId }),
      ...current,
    ].slice(0, 80))

    return { ok: true }
  }

  function pinUser(user) {
    const nextUser = normalizeUser(user)

    if (!nextUser?.id) {
      return { ok: false, error: 'Unable to pin this person.' }
    }

    setContacts((current) => {
      const remainingContacts = current.filter((entry) => entry.id !== nextUser.id)
      return [{
        id: nextUser.id,
        username: nextUser.username,
        alias: nextUser.alias || nextUser.username,
        email: nextUser.email || '',
        profilePicture: nextUser.profilePicture || '',
        source: 'server',
        pinnedAt: new Date().toISOString(),
      }, ...remainingContacts]
    })

    return { ok: true }
  }

  function resolveContact(contactId) {
    return directory.find((entry) => entry.id === contactId) || null
  }

  const value = {
    session,
    hasRegistered,
    isAuthenticated,
    users,
    directory,
    contacts,
    stories,
    posts,
    activity,
    transactions,
    messagesByContact,
    unreadMessagesByContact,
    messageLoadingByContact,
    activeConversationId,
    searchQuery,
    usersLoading,
    transactionsLoading,
    syncState,
    setSearchQuery,
    setActiveConversationId,
    refreshDirectory,
    refreshTransactions,
    login,
    register,
    logout,
    loadConversation,
    sendMessage,
    deleteMessage,
    requestAssistant,
    translateMessageText,
    sendPayment,
    addStory,
    fetchStories,
    markStoryViewed,
    deleteStory,
    addPost,
    fetchPosts,
    togglePostLike,
    togglePostReaction,
    addPostReply,
    deletePost,
    updateProfile,
    addManualContact,
    pinUser,
    resolveContact,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider.')
  }

  return context
}