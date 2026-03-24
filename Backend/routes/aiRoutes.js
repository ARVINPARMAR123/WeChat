import express from "express"
import { aiChat, aiHealth } from "../controllers/aiController.js"
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router()

// AI Health (debug)
router.get("/health", aiHealth)

// AI Chat (protected)
router.post("/chat", authMiddleware, aiChat)

export default router