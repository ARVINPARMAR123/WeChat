import express from "express"
import { sendMoney, getTransactions } from "../controllers/paymentController.js"
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router()

// Send money (protected)
router.post("/transfer", authMiddleware, sendMoney)

// Get transactions (protected)
router.get("/transactions/:userId", authMiddleware, getTransactions)

export default router