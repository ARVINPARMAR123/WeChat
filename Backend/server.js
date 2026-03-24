import dotenv from "dotenv"

dotenv.config()

import express from "express"
import cors from "cors"
import prisma from "./lib/prisma.js"

import authRoutes from "./routes/authRoutes.js"
import messageRoutes from "./routes/messageRoutes.js"
import aiRoutes from "./routes/aiRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import storyRoutes from "./routes/storyRoutes.js"
import postRoutes from "./routes/postRoutes.js"

const app = express()

app.use(cors())
app.use(express.json({ limit: "15mb" }))
app.use(express.urlencoded({ extended: true, limit: "15mb" }))

app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/stories", storyRoutes)
app.use("/api/posts", postRoutes)

const PORT = process.env.PORT || 5000

const startServer = async () => {
    try {
        await prisma.$connect()
        console.log("Connected to MongoDB via Prisma")

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (err) {
        console.error("Error connecting to MongoDB:", err)
        process.exit(1)
    }
}

startServer()