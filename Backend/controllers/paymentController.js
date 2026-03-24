import { UserModel as User, TransactionModel as Transaction } from "../prisma/prismaModels.js";

export const sendMoney = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { recipientId, amount, note } = req.body;
        const numericAmount = Number(amount);
        const sanitizedNote = typeof note === "string" ? note.trim() : "";

        if (typeof note !== "undefined" && note !== null && typeof note !== "string") {
            return res.status(400).json({ message: "Invalid note" });
        }

        if (sanitizedNote.length > 280) {
            return res.status(400).json({ message: "Note is too long" });
        }

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        const sender = await User.findById(senderId);
        const recipient = await User.findById(recipientId);

        if (!sender || !recipient) {
            return res.status(404).json({ message: "User not found" });
        }

        if (sender.walletBalance < numericAmount) {
            return res.status(400).json({ message: "Insufficient balance" });
        }

        const senderUpdatedBalance = sender.walletBalance - numericAmount;
        const recipientUpdatedBalance = recipient.walletBalance + numericAmount;
        
        await User.updateBalance(senderId, senderUpdatedBalance);
        await User.updateBalance(recipientId, recipientUpdatedBalance);

        const transaction = await Transaction.create({
            senderId,
            recipientId,
            amount: numericAmount,
            note: sanitizedNote,
            status: "completed",
        });

        res.status(200).json({
            message: "Money sent successfully",
            senderBalance: senderUpdatedBalance,
            recipientBalance: recipientUpdatedBalance,
            transaction,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        const transactions = await Transaction.findByUser(userId);

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

