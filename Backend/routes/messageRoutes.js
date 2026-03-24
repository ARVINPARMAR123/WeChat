import express from "express"
import { sendMessage, getMessages, deleteMessage } from "../controllers/messageController.js"
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router()

// Send message (protected)
router.post("/send", authMiddleware, sendMessage)

// Get conversation messages (protected)
router.get("/:userId1/:userId2", authMiddleware, getMessages)

// Delete message (protected)
router.delete("/:messageId", authMiddleware, deleteMessage)

export default router