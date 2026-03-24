import prisma from "../lib/prisma.js";

const mapUser = (record) => {
  if (!record) {
    return null;
  }

  return {
    ...record,
    _id: record.id,
    balance: record.walletBalance,
  };
};

const mapMessage = (record) => {
  if (!record) {
    return null;
  }

  return {
    ...record,
    _id: record.id,
  };
};

const mapTransaction = (record) => {
  if (!record) {
    return null;
  }

  return {
    ...record,
    _id: record.id,
  };
};

export const UserModel = {
  async findOne(where) {
    const record = await prisma.user.findFirst({ where });
    return mapUser(record);
  },

  async findMany() {
    const records = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(mapUser);
  },

  async findById(id) {
    if (!id) {
      return null;
    }

    const record = await prisma.user.findUnique({ where: { id } });
    return mapUser(record);
  },

  async create(data) {
    const record = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: data.password,
        displayName: data.displayName ?? data.username ?? null,
        about: data.about ?? null,
        statusLine: data.statusLine ?? null,
        accent: data.accent ?? null,
        city: data.city ?? null,
        phone: data.phone ?? null,
        profilePicture: data.profilePicture ?? null,
        friends: Array.isArray(data.friends) ? data.friends : [],
        friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : [],
        sentRequests: Array.isArray(data.sentRequests) ? data.sentRequests : [],
        online: data.online ?? false,
        walletBalance: Number(data.walletBalance ?? data.balance ?? 0),
      },
    });

    return mapUser(record);
  },

  async updateProfile(id, data = {}) {
    if (!id) {
      return null;
    }

    const updateData = {};
    const profileFields = ["displayName", "about", "statusLine", "accent", "city", "phone", "profilePicture"];

    profileFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updateData[field] = data[field];
      }
    });

    if (!Object.keys(updateData).length) {
      return this.findById(id);
    }

    const record = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return mapUser(record);
  },

  async updateBalance(id, balance) {
    const record = await prisma.user.update({
      where: { id },
      data: {
        walletBalance: Number(balance),
      },
    });

    return mapUser(record);
  },
};

export const MessageModel = {
  async create(data) {
    const record = await prisma.message.create({
      data: {
        senderId: data.senderId,
        recipientId: data.recipientId,
        message: data.message,
        mediaType: data.mediaType || null,
        mediaUrl: data.mediaUrl || null,
        deletedForUserIds: [],
      },
    });

    return mapMessage(record);
  },

  async findConversation(userId1, userId2) {
    const records = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId1, recipientId: userId2 },
          { senderId: userId2, recipientId: userId1 },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map(mapMessage);
  },

  async markDeletedForUser(id, userId) {
    if (!id || !userId) {
      return null;
    }

    const existingMessage = await prisma.message.findUnique({ where: { id } });

    if (!existingMessage) {
      return null;
    }

    const isParticipant = existingMessage.senderId === userId || existingMessage.recipientId === userId;

    if (!isParticipant) {
      return null;
    }

    const existingHiddenUsers = Array.isArray(existingMessage.deletedForUserIds)
      ? existingMessage.deletedForUserIds
      : [];

    if (existingHiddenUsers.includes(userId)) {
      return mapMessage(existingMessage);
    }

    const record = await prisma.message.update({
      where: { id },
      data: {
        deletedForUserIds: [...existingHiddenUsers, userId],
      },
    });

    return mapMessage(record);
  },

  async deleteById(id) {
    const result = await prisma.message.deleteMany({
      where: { id },
    });

    return result.count > 0;
  },
};

export const TransactionModel = {
  async create(data) {
    const record = await prisma.transaction.create({
      data: {
        senderId: data.senderId,
        recipientId: data.recipientId,
        amount: Number(data.amount),
        note: typeof data.note === "string" && data.note.trim() ? data.note.trim() : null,
        status: data.status ?? "pending",
      },
    });

    return mapTransaction(record);
  },

  async findByUser(userId) {
    const records = await prisma.transaction.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(mapTransaction);
  },
};