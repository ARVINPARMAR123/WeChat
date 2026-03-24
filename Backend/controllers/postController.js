import prisma from '../lib/prisma.js'

const ALLOWED_POST_REACTIONS = new Set(['❤️', '😂', '😭', '😢'])

function formatPost(post) {
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content || '',
    mediaType: post.mediaType || '',
    mediaUrl: post.mediaUrl || '',
    likes: (post.likes || []).map((entry) => ({
      id: entry.userId,
      createdAt: entry.createdAt.toISOString(),
    })),
    reactions: (post.reactions || []).map((entry) => ({
      id: entry.userId,
      emoji: entry.emoji,
      createdAt: entry.createdAt.toISOString(),
    })),
    replies: (post.replies || []).map((entry) => ({
      id: entry.id,
      authorId: entry.authorId,
      content: entry.content,
      createdAt: entry.createdAt.toISOString(),
    })),
    createdAt: post.createdAt.toISOString(),
  }
}

async function ensurePost(postId) {
  return prisma.post.findUnique({ where: { id: postId } })
}

export async function createPost(req, res) {
  try {
    const authorId = req.user.userId
    const { content = '', mediaType = '', mediaUrl = '' } = req.body

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    const normalizedMediaType = mediaType === 'video'
      ? 'video'
      : mediaType === 'image'
        ? 'image'
        : mediaType === 'audio'
          ? 'audio'
          : ''
    const normalizedMediaUrl = typeof mediaUrl === 'string' ? mediaUrl.trim() : ''

    if (!trimmedContent && !normalizedMediaUrl) {
      return res.status(400).json({ message: 'Post needs text, image, video, or song.' })
    }

    if (mediaType && !normalizedMediaType) {
      return res.status(400).json({ message: 'Invalid media type.' })
    }

    const post = await prisma.post.create({
      data: {
        authorId,
        content: trimmedContent || null,
        mediaType: normalizedMediaType || null,
        mediaUrl: normalizedMediaUrl || null,
      },
      include: {
        likes: true,
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return res.status(201).json({ ok: true, data: formatPost(post) })
  } catch (error) {
    console.error('Error creating post:', error)
    return res.status(500).json({ message: 'Unable to create post.' })
  }
}

export async function getPosts(req, res) {
  try {
    const posts = await prisma.post.findMany({
      include: {
        likes: true,
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 80,
    })

    return res.json({ ok: true, data: posts.map(formatPost) })
  } catch (error) {
    console.error('Error getting posts:', error)
    return res.status(500).json({ message: 'Unable to fetch posts.' })
  }
}

export async function togglePostLike(req, res) {
  try {
    const { postId } = req.params
    const userId = req.user.userId

    const post = await ensurePost(postId)
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' })
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    })

    if (existingLike) {
      await prisma.postLike.delete({ where: { id: existingLike.id } })
    } else {
      await prisma.postLike.create({
        data: {
          postId,
          userId,
        },
      })
    }

    const likes = await prisma.postLike.findMany({ where: { postId } })

    return res.json({
      ok: true,
      liked: !existingLike,
      likes: likes.map((entry) => ({
        id: entry.userId,
        createdAt: entry.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error toggling like:', error)
    return res.status(500).json({ message: 'Unable to update like.' })
  }
}

export async function togglePostReaction(req, res) {
  try {
    const { postId } = req.params
    const userId = req.user.userId
    const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : ''

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required.' })
    }

    if (!ALLOWED_POST_REACTIONS.has(emoji)) {
      return res.status(400).json({ message: 'Invalid emoji.' })
    }

    const post = await ensurePost(postId)
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' })
    }

    const existingReaction = await prisma.postReaction.findFirst({
      where: {
        postId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let reacted = false

    if (existingReaction && existingReaction.emoji === emoji) {
      await prisma.postReaction.deleteMany({
        where: {
          postId,
          userId,
        },
      })
      reacted = false
    } else {
      await prisma.postReaction.deleteMany({
        where: {
          postId,
          userId,
        },
      })

      await prisma.postReaction.create({
        data: {
          postId,
          userId,
          emoji,
        },
      })

      reacted = true
    }

    const reactions = await prisma.postReaction.findMany({ where: { postId } })

    return res.json({
      ok: true,
      reacted,
      reactions: reactions.map((entry) => ({
        id: entry.userId,
        emoji: entry.emoji,
        createdAt: entry.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error toggling reaction:', error)
    return res.status(500).json({ message: 'Unable to update reaction.' })
  }
}

export async function addPostReply(req, res) {
  try {
    const { postId } = req.params
    const authorId = req.user.userId
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''

    if (!content) {
      return res.status(400).json({ message: 'Reply text is required.' })
    }

    const post = await ensurePost(postId)
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' })
    }

    const reply = await prisma.postReply.create({
      data: {
        postId,
        authorId,
        content,
      },
    })

    return res.status(201).json({
      ok: true,
      data: {
        id: reply.id,
        authorId: reply.authorId,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error adding reply:', error)
    return res.status(500).json({ message: 'Unable to add reply.' })
  }
}

export async function deletePost(req, res) {
  try {
    const { postId } = req.params
    const userId = req.user.userId

    const post = await ensurePost(postId)
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' })
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ message: 'Only author can delete this post.' })
    }

    await prisma.post.delete({ where: { id: postId } })

    return res.json({ ok: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    return res.status(500).json({ message: 'Unable to delete post.' })
  }
}
