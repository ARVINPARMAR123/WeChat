import { MessageModel as Message } from "../prisma/prismaModels.js";

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const recipientId = typeof req.body?.recipientId === "string" ? req.body.recipientId.trim() : "";
        const messageText = typeof req.body?.message === "string" ? req.body.message.trim() : "";
        const rawMediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType.trim().toLowerCase() : "";
        const mediaType = ["image", "video", "audio"].includes(rawMediaType) ? rawMediaType : "";
        const mediaUrl = typeof req.body?.mediaUrl === "string" ? req.body.mediaUrl.trim() : "";

        if (!recipientId) {
            return res.status(400).json({ message: "Recipient is required." });
        }

        if (rawMediaType && !mediaType) {
            return res.status(400).json({ message: "Invalid media type." });
        }

        if (!messageText && !mediaUrl) {
            return res.status(400).json({ message: "Message text or media is required." });
        }

        const finalMessage = messageText || (
            mediaType === "audio"
                ? "🎤 Voice note"
                : mediaType === "image"
                    ? "📷 Photo"
                    : mediaType === "video"
                        ? "🎬 Video"
                        : "Media message"
        );

        const createdMessage = await Message.create({
            senderId,
            recipientId,
            message: finalMessage,
            mediaType,
            mediaUrl,
        });

        res.status(201).json(createdMessage);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;

        const messages = await Message.findConversation(userId1, userId2);
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        const updatedMessage = await Message.markDeletedForUser(messageId, userId);

        if (!updatedMessage) {
            return res.status(404).json({ message: "Message not found." });
        }

        const isParticipant = updatedMessage.senderId === userId || updatedMessage.recipientId === userId;

        if (!isParticipant) {
            return res.status(403).json({ message: "You can delete only your own conversation messages." });
        }

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
};
