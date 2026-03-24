import express from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import {
  addPostReply,
  createPost,
  deletePost,
  getPosts,
  togglePostLike,
  togglePostReaction,
} from '../controllers/postController.js'

const router = express.Router()

router.use(authMiddleware)

router.get('/', getPosts)
router.post('/', createPost)
router.post('/:postId/like', togglePostLike)
router.post('/:postId/reactions', togglePostReaction)
router.post('/:postId/replies', addPostReply)
router.delete('/:postId', deletePost)

export default router
