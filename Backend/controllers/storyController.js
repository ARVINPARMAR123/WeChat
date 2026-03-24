import prisma from '../lib/prisma.js'

/**
 * Create a new story
 * POST /api/stories
 */
export async function createStory(req, res) {
  try {
    const { title, content = '', mediaType = '', mediaUrl = '' } = req.body
    const authorId = req.user.userId

    if (!title && !content && !mediaUrl) {
      return res.status(400).json({ error: 'Story must have title, content, or media' })
    }

    if (mediaType && !['image', 'video', 'audio'].includes(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type. Must be image, video, or audio' })
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const story = await prisma.story.create({
      data: {
        authorId,
        title: title || (mediaType === 'video'
          ? 'Video status'
          : mediaType === 'audio'
            ? 'Song status'
            : mediaType === 'image'
              ? 'Photo status'
              : 'Fresh update'),
        content: content || '',
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || null,
        expiresAt,
      },
    })

    res.status(201).json({
      ok: true,
      data: {
        id: story.id,
        authorId: story.authorId,
        title: story.title,
        content: story.content,
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl,
        viewers: [],
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating story:', error)
    res.status(500).json({ error: 'Unable to create story' })
  }
}

/**
 * Get all stories (for feed)
 * GET /api/stories
 */
export async function getStories(req, res) {
  try {
    const now = new Date()

    // Delete expired stories
    await prisma.story.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    })

    // Fetch non-expired stories with viewer info
    const stories = await prisma.story.findMany({
      where: {
        expiresAt: {
          gte: now,
        },
      },
      include: {
        viewers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    // Format response
    const formatted = stories.map((story) => ({
      id: story.id,
      authorId: story.authorId,
      title: story.title,
      content: story.content,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl,
      viewers: story.viewers.map((v) => ({
        id: v.userId,
        viewedAt: v.viewedAt.toISOString(),
      })),
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
    }))

    res.json({ ok: true, data: formatted })
  } catch (error) {
    console.error('Error fetching stories:', error)
    res.status(500).json({ error: 'Unable to fetch stories' })
  }
}

/**
 * Get user's own stories
 * GET /api/stories/my-stories
 */
export async function getMyStories(req, res) {
  try {
    const authorId = req.user.userId
    const now = new Date()

    // Fetch user's non-expired stories with viewer info
    const stories = await prisma.story.findMany({
      where: {
        authorId,
        expiresAt: {
          gte: now,
        },
      },
      include: {
        viewers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Format response
    const formatted = stories.map((story) => ({
      id: story.id,
      authorId: story.authorId,
      title: story.title,
      content: story.content,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl,
      viewers: story.viewers.map((v) => ({
        id: v.userId,
        viewedAt: v.viewedAt.toISOString(),
      })),
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
    }))

    res.json({ ok: true, data: formatted })
  } catch (error) {
    console.error('Error fetching user stories:', error)
    res.status(500).json({ error: 'Unable to fetch your stories' })
  }
}

/**
 * Mark story as viewed
 * POST /api/stories/:storyId/view
 */
export async function markStoryAsViewed(req, res) {
  try {
    const { storyId } = req.params
    const viewerId = req.user.userId

    // Check if story exists and is not expired
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    })

    if (!story) {
      return res.status(404).json({ error: 'Story not found' })
    }

    if (new Date() > story.expiresAt) {
      return res.status(400).json({ error: 'Story has expired' })
    }

    // Don't allow authors to view their own stories
    if (story.authorId === viewerId) {
      return res.status(400).json({ error: 'Cannot view your own story' })
    }

    // Check if already viewed
    const existingView = await prisma.viewer.findUnique({
      where: {
        storyId_userId: {
          storyId,
          userId: viewerId,
        },
      },
    })

    if (existingView) {
      return res.json({ ok: true, message: 'Story already viewed' })
    }

    // Record the view
    await prisma.viewer.create({
      data: {
        storyId,
        userId: viewerId,
      },
    })

    res.json({ ok: true, message: 'Story marked as viewed' })
  } catch (error) {
    console.error('Error marking story as viewed:', error)
    res.status(500).json({ error: 'Unable to mark story as viewed' })
  }
}

/**
 * Delete a story (only author can delete)
 * DELETE /api/stories/:storyId
 */
export async function deleteStory(req, res) {
  try {
    const { storyId } = req.params
    const authorId = req.user.userId

    const story = await prisma.story.findUnique({
      where: { id: storyId },
    })

    if (!story) {
      return res.status(404).json({ error: 'Story not found' })
    }

    if (story.authorId !== authorId) {
      return res.status(403).json({ error: 'Can only delete your own stories' })
    }

    await prisma.story.delete({
      where: { id: storyId },
    })

    res.json({ ok: true, message: 'Story deleted' })
  } catch (error) {
    console.error('Error deleting story:', error)
    res.status(500).json({ error: 'Unable to delete story' })
  }
}
