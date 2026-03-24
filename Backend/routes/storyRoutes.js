import express from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import {
  createStory,
  getStories,
  getMyStories,
  markStoryAsViewed,
  deleteStory,
} from '../controllers/storyController.js'

const router = express.Router()

// Protect all story routes with auth middleware
router.use(authMiddleware)

// POST /api/stories - Create a new story
router.post('/', createStory)

// GET /api/stories - Get all stories (feed)
router.get('/', getStories)

// GET /api/stories/my-stories - Get user's own stories
router.get('/my-stories', getMyStories)

// POST /api/stories/:storyId/view - Mark story as viewed
router.post('/:storyId/view', markStoryAsViewed)

// DELETE /api/stories/:storyId - Delete a story
router.delete('/:storyId', deleteStory)

export default router
