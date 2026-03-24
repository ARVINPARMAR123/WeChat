import { createServer } from "http";
import { Server } from "socket.io";

const server = createServer();

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.SOCKET_PORT || 4000;

server.listen(PORT, () => {
    console.log(`Socket running on ${PORT}`);
});

io.on("connection", (socket) => {
    console.log("A user connected: " + socket.id);

    const connectedUserId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (typeof connectedUserId === "string" && connectedUserId.trim()) {
        socket.join(connectedUserId.trim());
    }

    socket.on("joinRoom", (roomId) => {
        if (typeof roomId === "string" && roomId.trim()) {
            socket.join(roomId.trim());
        }
    });

    socket.on("sendMessage", (data) => {
        const {
            id,
            senderId,
            recipientId,
            message,
            mediaType = "",
            mediaUrl = "",
            createdAt,
        } = data || {};

        if (typeof recipientId !== "string" || !recipientId.trim()) {
            return;
        }

        io.to(recipientId.trim()).emit("receiveMessage", {
            id,
            senderId,
            recipientId: recipientId.trim(),
            message,
            mediaType,
            mediaUrl,
            createdAt: createdAt || new Date().toISOString(),
        });
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected: " + socket.id);
    });
});

export default io;