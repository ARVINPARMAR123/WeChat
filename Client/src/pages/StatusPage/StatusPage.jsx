import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { formatRelativeTime } from '../../lib/formatters.js'
import useAutoDismissFeedback from '../../lib/useAutoDismissFeedback.js'
import './StatusPage.css'

const MAX_IMAGE_BYTES = 900 * 1024
const MAX_VIDEO_BYTES = 1800 * 1024
const MAX_AUDIO_BYTES = 2800 * 1024
const REACTION_OPTIONS = ['❤️', '😂', '😭', '😢']

function getNameInitial(name, fallback = 'U') {
  const label = typeof name === 'string' ? name.trim() : ''
  return label ? label.charAt(0).toUpperCase() : fallback
}

function getNameAvatarText(name, fallback = 'U') {
  const label = typeof name === 'string' ? name.trim() : ''

  if (!label) {
    return fallback
  }

  const parts = label.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
  }

  if (label.length >= 2) {
    return label.slice(0, 2).toUpperCase()
  }

  return getNameInitial(label, fallback)
}

function getMediaTypeLabel(type) {
  if (type === 'video') {
    return 'Video'
  }

  if (type === 'image') {
    return 'Image'
  }

  if (type === 'audio') {
    return 'Song'
  }

  return 'Media'
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }

    reader.onerror = () => {
      reject(new Error('Unable to read media file.'))
    }

    reader.readAsDataURL(file)
  })
}

async function createMediaDraft(file) {
  if (!file) {
    return { ok: false, error: 'No media selected.' }
  }

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const isAudio = file.type.startsWith('audio/')

  if (!isImage && !isVideo && !isAudio) {
    return { ok: false, error: 'Select image, video, or song only.' }
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES

  if (file.size > maxBytes) {
    return {
      ok: false,
      error: isVideo
        ? 'Video is too large. Use a file under 1.8MB.'
        : isAudio
          ? 'Song is too large. Use a file under 2.8MB.'
        : 'Image is too large. Use a file under 900KB.',
    }
  }

  const encodedMedia = await readFileAsDataUrl(file)

  if (!encodedMedia) {
    return { ok: false, error: 'Could not process this file. Try another one.' }
  }

  return {
    ok: true,
    data: {
      type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      url: encodedMedia,
      name: file.name || 'status-media',
    },
  }
}

function StatusPage() {
  const {
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
    resolveContact,
    session,
    stories,
    posts,
  } = useAppContext()
  const [storyForm, setStoryForm] = useState({ content: '' })
  const [storyMediaDraft, setStoryMediaDraft] = useState({ type: '', url: '', name: '' })
  const [storyFeedback, setStoryFeedback] = useState('')
  const [postForm, setPostForm] = useState({ content: '' })
  const [postMediaDraft, setPostMediaDraft] = useState({ type: '', url: '', name: '' })
  const [postFeedback, setPostFeedback] = useState('')
  useAutoDismissFeedback(storyFeedback, setStoryFeedback)
  useAutoDismissFeedback(postFeedback, setPostFeedback)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [selectedStoryId, setSelectedStoryId] = useState('')
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false)
  const [busyState, setBusyState] = useState({ story: false, post: false })
  const [recentlyClickedEmoji, setRecentlyClickedEmoji] = useState({})
  const [recentlyClickedLike, setRecentlyClickedLike] = useState({})
  const hydratedUserRef = useRef('')
  const storyMediaInputRef = useRef(null)
  const emojiTimeoutRef = useRef({})
  const likeTimeoutRef = useRef({})

  const currentAuthorId = session.userId || ''
  const currentUserStory = useMemo(
    () => stories
      .filter((story) => story.authorId === currentAuthorId && (!story.expiresAt || Date.parse(story.expiresAt) > Date.now()))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null,
    [stories, currentAuthorId],
  )
  const otherUsersStories = useMemo(
    () => [...stories]
      .filter((story) => story.authorId !== currentAuthorId && (!story.expiresAt || Date.parse(story.expiresAt) > Date.now()))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    [stories, currentAuthorId],
  )
  const activeStories = useMemo(
    () => [currentUserStory, ...otherUsersStories].filter(Boolean),
    [currentUserStory, otherUsersStories],
  )

  const selectedStory = useMemo(
    () => activeStories.find((story) => story.id === selectedStoryId) || null,
    [activeStories, selectedStoryId],
  )

  useEffect(() => {
    if (!currentAuthorId) {
      hydratedUserRef.current = ''
      return
    }

    if (hydratedUserRef.current === currentAuthorId) {
      return
    }

    hydratedUserRef.current = currentAuthorId
    void fetchStories()
    void fetchPosts()
  }, [currentAuthorId, fetchPosts, fetchStories])

  useEffect(() => {
    if (!activeStories.length) {
      setSelectedStoryId('')
      setIsStoryViewerOpen(false)
      return
    }

    if (selectedStoryId && !activeStories.some((story) => story.id === selectedStoryId)) {
      setSelectedStoryId('')
      setIsStoryViewerOpen(false)
    }
  }, [activeStories, selectedStoryId])

  useEffect(() => {
    if (!isStoryViewerOpen) {
      return undefined
    }

    function handleEscapeKey(event) {
      if (event.key === 'Escape') {
        setIsStoryViewerOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)

    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isStoryViewerOpen])

  function handleStoryChange(event) {
    const { name, value } = event.target
    setStoryForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handlePostChange(event) {
    const { name, value } = event.target
    setPostForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleStoryMediaChange(event) {
    const mediaFile = event.target.files?.[0]

    if (!mediaFile) {
      return
    }

    try {
      const result = await createMediaDraft(mediaFile)

      if (!result.ok) {
        setStoryFeedback(result.error || 'Could not process media.')
        event.target.value = ''
        return
      }

      setStoryMediaDraft(result.data)
      setStoryFeedback(`${getMediaTypeLabel(result.data.type)} ready for story.`)
    } catch {
      setStoryFeedback('Unable to read media file. Please try again.')
    } finally {
      event.target.value = ''
    }
  }

  async function handlePostMediaChange(event) {
    const mediaFile = event.target.files?.[0]

    if (!mediaFile) {
      return
    }

    try {
      const result = await createMediaDraft(mediaFile)

      if (!result.ok) {
        setPostFeedback(result.error || 'Could not process media.')
        event.target.value = ''
        return
      }

      setPostMediaDraft(result.data)
      setPostFeedback(`${getMediaTypeLabel(result.data.type)} ready for post.`)
    } catch {
      setPostFeedback('Unable to read media file. Please try again.')
    } finally {
      event.target.value = ''
    }
  }

  function handleRemoveStoryMedia() {
    setStoryMediaDraft({ type: '', url: '', name: '' })
    setStoryFeedback('Story media removed.')
  }

  function handleRemovePostMedia() {
    setPostMediaDraft({ type: '', url: '', name: '' })
    setPostFeedback('Post media removed.')
  }

  async function handleStorySubmit(event) {
    event.preventDefault()

    const caption = storyForm.content.trim()

    if (!caption && !storyMediaDraft.url) {
      setStoryFeedback('Add text, image, video, or song before posting story.')
      return
    }

    setBusyState((current) => ({ ...current, story: true }))

    const result = await addStory({
      content: caption,
      mediaType: storyMediaDraft.type,
      mediaUrl: storyMediaDraft.url,
    })

    if (!result.ok) {
      setBusyState((current) => ({ ...current, story: false }))
      setStoryFeedback(result.error || 'Unable to post status right now.')
      return
    }

    setStoryForm({ content: '' })
    setStoryMediaDraft({ type: '', url: '', name: '' })
    setStoryFeedback('Uploaded Status is show for 24 hours.')
    await fetchStories()
    setBusyState((current) => ({ ...current, story: false }))
  }

  async function handlePostSubmit(event) {
    event.preventDefault()

    const text = postForm.content.trim()

    if (!text && !postMediaDraft.url) {
      setPostFeedback('Add text, image, video, or song before uploading post.')
      return
    }

    setBusyState((current) => ({ ...current, post: true }))

    const result = await addPost({
      content: text,
      mediaType: postMediaDraft.type,
      mediaUrl: postMediaDraft.url,
    })

    if (!result.ok) {
      setBusyState((current) => ({ ...current, post: false }))
      setPostFeedback(result.error || 'Unable to upload post right now.')
      return
    }

    setPostForm({ content: '' })
    setPostMediaDraft({ type: '', url: '', name: '' })
    setPostFeedback('Post uploaded.')
    setBusyState((current) => ({ ...current, post: false }))
  }

  function getViewerNames(story) {
    const viewers = Array.isArray(story.viewers) ? story.viewers : []

    const names = viewers
      .map((viewer) => {
        if (viewer?.name) {
          return viewer.name
        }

        if (viewer?.id) {
          const contact = resolveContact(viewer.id)
          return contact?.alias || contact?.username || viewer.id
        }

        return ''
      })
      .filter(Boolean)

    return [...new Set(names)]
  }

  function resolveNameById(userId, fallback = 'User') {
    if (!userId) {
      return fallback
    }

    if (userId === currentAuthorId) {
      return session.displayName || session.username || 'You'
    }

    const contact = resolveContact(userId)
    return contact?.alias || contact?.username || fallback
  }

  function resolveProfilePictureById(userId) {
    if (!userId) {
      return ''
    }

    if (userId === currentAuthorId) {
      return typeof session.profilePicture === 'string' ? session.profilePicture.trim() : ''
    }

    const contact = resolveContact(userId)
    return typeof contact?.profilePicture === 'string' ? contact.profilePicture.trim() : ''
  }

  async function handleStoryOpen(story) {
    if (!story?.id) {
      return
    }

    if (isStoryViewerOpen && selectedStoryId === story.id) {
      setIsStoryViewerOpen(false)
      return
    }

    setSelectedStoryId(story.id)
    setIsStoryViewerOpen(true)

    if (story.authorId === currentAuthorId) {
      return
    }

    await markStoryViewed(story.id)
    await fetchStories()
  }

  async function handleDeleteStory(storyId) {
    const result = await deleteStory(storyId)

    if (!result.ok) {
      setStoryFeedback(result.error || 'Could not delete status.')
      return
    }

    if (selectedStoryId === storyId) {
      setSelectedStoryId('')
      setIsStoryViewerOpen(false)
    }

    setStoryFeedback('Status deleted.')
    await fetchStories()
  }

  function handleStoryViewerClose() {
    setIsStoryViewerOpen(false)
  }

  function getPostLikeCount(post) {
    return Array.isArray(post.likes) ? post.likes.length : 0
  }

  function isPostLikedByMe(post) {
    return Array.isArray(post.likes) && post.likes.some((entry) => entry.id === currentAuthorId)
  }

  function getReactionCount(post, emoji) {
    if (!Array.isArray(post.reactions)) {
      return 0
    }

    return post.reactions.filter((entry) => entry.emoji === emoji).length
  }

  function isReactedByMe(post, emoji) {
    if (!Array.isArray(post.reactions)) {
      return false
    }

    return post.reactions.some((entry) => entry.id === currentAuthorId && entry.emoji === emoji)
  }

  function handleReplyDraftChange(postId, value) {
    setReplyDrafts((current) => ({
      ...current,
      [postId]: value,
    }))
  }

  async function handleReplySubmit(postId) {
    const draft = replyDrafts[postId] || ''
    const result = await addPostReply(postId, draft)

    if (!result.ok) {
      setPostFeedback(result.error || 'Unable to add reply.')
      return
    }

    setReplyDrafts((current) => ({
      ...current,
      [postId]: '',
    }))
    await fetchPosts()
  }

  async function handlePostDelete(postId) {
    const result = await deletePost(postId)

    if (!result.ok) {
      setPostFeedback(result.error || 'Unable to delete post.')
      return
    }

    setPostFeedback('Post deleted.')
  }

  const currentUserLabel = session.displayName || session.username || 'You'
  const currentUserProfilePicture = typeof session.profilePicture === 'string' ? session.profilePicture.trim() : ''
  const storyCardStory = selectedStory && isStoryViewerOpen
    ? selectedStory
    : null

  return (
    <section className="page-section status-page-layout">
      <section className="panel status-stories-panel">
        <div className="split-header">
          <div>
            <h2 className="section-eyebrow">Status</h2>
          </div>
          <span className="contact-tag">24h</span>
        </div>

        <form className="stack-form status-upload-form" onSubmit={handleStorySubmit}>
          <label>
            <span>Status caption</span>
            <textarea
              name="content"
              rows="3"
              value={storyForm.content}
              onChange={handleStoryChange}
              placeholder="Write something about your status "
            />
          </label>

          <label>
            <span>Image, video, or song</span>
            <input 
              ref={storyMediaInputRef}
              type="file" 
              accept="image/*,video/*,audio/*" 
              onChange={handleStoryMediaChange} 
            />
          </label>

          {storyMediaDraft.url ? (
            <article className="status-media-preview-shell">
              {storyMediaDraft.type === 'video' ? (
                <video src={storyMediaDraft.url} className="status-media-preview-video" controls playsInline preload="metadata" />
              ) : storyMediaDraft.type === 'audio' ? (
                <audio src={storyMediaDraft.url} className="status-media-preview-audio" controls preload="metadata" />
              ) : (
                <img src={storyMediaDraft.url} alt="Story draft" className="status-media-preview-image" />
              )}
              <div className="status-preview-meta">
                <span>{storyMediaDraft.name}</span>
                <button type="button" className="ghost-button" onClick={handleRemoveStoryMedia}>Remove media</button>
              </div>
            </article>
          ) : null}

          <button type="submit" className="primary-button" disabled={busyState.story}>
            {busyState.story ? 'Posting...' : 'Upload Status'}
          </button>
        </form>

        {storyFeedback ? <p className="feedback-copy">{storyFeedback}</p> : null}

        <>
          <div className="story-strip" role="list">
            {!currentUserStory ? (
              <button
                type="button"
                className="story-pill story-upload-pill"
                onClick={() => storyMediaInputRef.current?.click()}
                title="Upload your story"
              >
                <span className="story-pill-avatar story-upload-avatar">
                  {currentUserProfilePicture ? (
                    <img src={currentUserProfilePicture} alt={`${currentUserLabel} profile`} className="story-pill-thumb" />
                  ) : (
                    <span className="story-pill-fallback">{getNameAvatarText(currentUserLabel, 'Y')}</span>
                  )}
                  <span className="story-upload-plus-badge">+</span>
                </span>
                <span className="story-pill-name">{currentUserLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                className={`story-pill story-user-pill ${selectedStory?.id === currentUserStory.id ? 'active' : ''}`}
                onClick={() => void handleStoryOpen(currentUserStory)}
              >
                <span className="story-pill-avatar">
                  {currentUserStory.mediaType === 'image' && currentUserStory.mediaUrl ? (
                    <img src={currentUserStory.mediaUrl} alt="Your story" className="story-pill-thumb" />
                  ) : currentUserProfilePicture ? (
                    <img src={currentUserProfilePicture} alt={`${currentUserLabel} profile`} className="story-pill-thumb" />
                  ) : (
                    <span className="story-pill-fallback">{getNameAvatarText(currentUserLabel, 'Y')}</span>
                  )}
                </span>
                <span className="story-pill-name">{currentUserLabel}</span>
              </button>
            )}
            {otherUsersStories.map((story) => {
              const storyAuthorName = resolveNameById(story.authorId, 'Contact')
              const storyAuthorProfilePicture = resolveProfilePictureById(story.authorId)

              return (
                <button
                  type="button"
                  key={story.id}
                  className={`story-pill ${selectedStory?.id === story.id ? 'active' : ''}`}
                  onClick={() => void handleStoryOpen(story)}
                >
                  <span className="story-pill-avatar">
                    {story.mediaType === 'image' && story.mediaUrl ? (
                      <img src={story.mediaUrl} alt={story.title || 'Story'} className="story-pill-thumb" />
                    ) : storyAuthorProfilePicture ? (
                      <img src={storyAuthorProfilePicture} alt={`${storyAuthorName} profile`} className="story-pill-thumb" />
                    ) : (
                      <span className="story-pill-fallback">{getNameAvatarText(storyAuthorName, 'S')}</span>
                    )}
                  </span>
                  <span className="story-pill-name">{storyAuthorName}</span>
                </button>
              )
            })}
          </div>

          {storyCardStory ? (
            <article className="status-card story-selected-card story-fullscreen-card">
              {(() => {
                const storyAuthorName = resolveNameById(storyCardStory.authorId, 'User')
                const storyAuthorProfilePicture = resolveProfilePictureById(storyCardStory.authorId)

                return (
              <div className="status-card-header">
                <div className="story-header-info">
                  {storyAuthorProfilePicture ? (
                    <img src={storyAuthorProfilePicture} alt={`${storyAuthorName} profile`} className="story-author-dp" />
                  ) : (
                    <div className="story-author-dp-fallback">
                      {getNameAvatarText(storyAuthorName, 'U')}
                    </div>
                  )}
                  <div className="story-header-text">
                    <strong>{storyAuthorName}</strong>
                    <span className="story-time-badge">{formatRelativeTime(storyCardStory.createdAt)}</span>
                  </div>
                </div>
                <div className="status-header-actions">
                  {storyCardStory.authorId === currentAuthorId ? (
                    <button type="button" className="ghost-button" onClick={() => void handleDeleteStory(storyCardStory.id)}>
                      Delete
                    </button>
                  ) : null}
                  {selectedStory && isStoryViewerOpen ? (
                    <button type="button" className="ghost-button" onClick={handleStoryViewerClose}>
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
                )
              })()}

              {storyCardStory.mediaType === 'image' && storyCardStory.mediaUrl ? (
                <img src={storyCardStory.mediaUrl} alt="Selected story" className="status-media-image" />
              ) : null}

              {storyCardStory.mediaType === 'video' && storyCardStory.mediaUrl ? (
                <video src={storyCardStory.mediaUrl} className="status-media-video" controls playsInline preload="metadata" />
              ) : null}

              {storyCardStory.mediaType === 'audio' && storyCardStory.mediaUrl ? (
                <audio src={storyCardStory.mediaUrl} className="status-media-audio" controls preload="metadata" />
              ) : null}

              {storyCardStory.content ? <p className="status-caption">{storyCardStory.content}</p> : null}

              {storyCardStory.authorId === currentAuthorId ? (
                <div className="status-viewers">
                  <p>
                    <strong>{getViewerNames(storyCardStory).length}</strong> views
                  </p>
                  <p className="status-viewer-names">
                    {getViewerNames(storyCardStory).length
                      ? getViewerNames(storyCardStory).join(', ')
                      : 'No one viewed yet.'}
                  </p>
                </div>
              ) : (
                <div className="status-meta-info">
                  <span className="status-view-indicator">✓ Story viewed</span>
                </div>
              )}
            </article>
          ) : null}
        </>
      </section>

      <section className="panel status-posts-panel">
        <div className="split-header">
          <div>
            <p className="section-eyebrow">Posts</p>
            <h2>Upload Post</h2>
          </div>
          <span className="contact-tag">Feed</span>
        </div>

        <form className="stack-form status-upload-form" onSubmit={handlePostSubmit}>
          <label>
            <span>Post text</span>
            <textarea
              name="content"
              rows="3"
              value={postForm.content}
              onChange={handlePostChange}
              placeholder="Share an update for everyone"
            />
          </label>

          <label>
            <span>Image, video, or song</span>
            <input type="file" accept="image/*,video/*,audio/*" onChange={handlePostMediaChange} />
          </label>

          {postMediaDraft.url ? (
            <article className="status-media-preview-shell">
              {postMediaDraft.type === 'video' ? (
                <video src={postMediaDraft.url} className="status-media-preview-video" controls playsInline preload="metadata" />
              ) : postMediaDraft.type === 'audio' ? (
                <audio src={postMediaDraft.url} className="status-media-preview-audio" controls preload="metadata" />
              ) : (
                <img src={postMediaDraft.url} alt="Post draft" className="status-media-preview-image" />
              )}
              <div className="status-preview-meta">
                <span>{postMediaDraft.name}</span>
                <button type="button" className="ghost-button" onClick={handleRemovePostMedia}>Remove media</button>
              </div>
            </article>
          ) : null}

          <button type="submit" className="primary-button" disabled={busyState.post}>
            {busyState.post ? 'Uploading...' : 'Upload Post'}
          </button>
        </form>

        {postFeedback ? <p className="feedback-copy">{postFeedback}</p> : null}

        {!posts.length ? (
          <div className="empty-state subtle">
            <h3>No posts yet</h3>
            <p>Upload a post to start your feed.</p>
          </div>
        ) : (
          <div className="status-list">
            {posts.map((post) => {
              const likeCount = getPostLikeCount(post)
              const likedByMe = isPostLikedByMe(post)
              const replies = Array.isArray(post.replies) ? post.replies : []
              const isMine = post.authorId === currentAuthorId

              return (
                <article key={post.id} className="status-card post-card">
                  <div className="status-card-header">
                    <strong>{resolveNameById(post.authorId, 'User')}</strong>
                    <div className="status-header-actions">
                      <span className="status-time">{formatRelativeTime(post.createdAt)}</span>
                      {isMine ? (
                        <button type="button" className="ghost-button" onClick={() => void handlePostDelete(post.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {post.mediaType === 'image' && post.mediaUrl ? (
                    <img src={post.mediaUrl} alt="Post media" className="status-media-image" />
                  ) : null}

                  {post.mediaType === 'video' && post.mediaUrl ? (
                    <video src={post.mediaUrl} className="status-media-video" controls playsInline preload="metadata" />
                  ) : null}

                  {post.mediaType === 'audio' && post.mediaUrl ? (
                    <audio src={post.mediaUrl} className="status-media-audio" controls preload="metadata" />
                  ) : null}

                  {post.content ? <p className="status-caption">{post.content}</p> : null}

                  <div className="post-interactions-bar">
                    {likeCount > 0 ? (
                      <div className="like-count-badge">
                        <span>Like</span>
                        <span className="like-count-number">{likeCount}</span>
                      </div>
                    ) : null}

                    <div className="emoji-action-group">
                      {REACTION_OPTIONS.map((emoji) => {
                        const count = getReactionCount(post, emoji)
                        const active = isReactedByMe(post, emoji)

                        return (
                          <button
                            type="button"
                            key={`${post.id}-${emoji}`}
                            className={`post-emoji-button ${active ? 'active' : ''} ${recentlyClickedEmoji[`${post.id}-${emoji}`] ? 'clicked-pulse' : ''}`}
                            onClick={async () => {
                              const btnKey = `${post.id}-${emoji}`
                              setRecentlyClickedEmoji((prev) => ({ ...prev, [btnKey]: true }))
                              if (emojiTimeoutRef.current[btnKey]) {
                                clearTimeout(emojiTimeoutRef.current[btnKey])
                              }
                              emojiTimeoutRef.current[btnKey] = setTimeout(() => {
                                setRecentlyClickedEmoji((prev) => {
                                  const updated = { ...prev }
                                  delete updated[btnKey]
                                  return updated
                                })
                              }, 2000)
                              await togglePostReaction(post.id, emoji)
                              await fetchPosts()
                            }}
                          >
                            <span>{emoji}</span>
                            {isMine && count ? <span>{count}</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="post-reaction-bar">
                    <button
                      type="button"
                      className={`post-like-button ${likedByMe ? 'active' : ''} ${recentlyClickedLike[post.id] ? 'clicked-pulse' : ''}`}
                      onClick={async () => {
                        const btnKey = post.id
                        setRecentlyClickedLike((prev) => ({ ...prev, [btnKey]: true }))
                        if (likeTimeoutRef.current[btnKey]) {
                          clearTimeout(likeTimeoutRef.current[btnKey])
                        }
                        likeTimeoutRef.current[btnKey] = setTimeout(() => {
                          setRecentlyClickedLike((prev) => {
                            const updated = { ...prev }
                            delete updated[btnKey]
                            return updated
                          })
                        }, 2000)
                        await togglePostLike(post.id)
                        await fetchPosts()
                      }}
                      title={likedByMe ? 'Unlike' : 'Like'}
                    >
                      👍 {likedByMe ? 'Unlike' : 'Like'}
                    </button>
                  </div>
                  <div className="post-reply-shell">
                    <div className="post-reply-input-row">
                      <input
                        type="text"
                        value={replyDrafts[post.id] || ''}
                        onChange={(event) => handleReplyDraftChange(post.id, event.target.value)}
                        placeholder="Write a Comment"
                      />
                      <button type="button" className="ghost-button" onClick={() => void handleReplySubmit(post.id)}>
                        Comment
                      </button>
                    </div>

                    {replies.length ? (
                      <div className="post-replies-list">
                        {replies.map((reply) => (
                          <p key={reply.id} className="post-reply-item">
                            <strong>{resolveNameById(reply.authorId, 'User')}:</strong> {reply.content}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

export default StatusPage
