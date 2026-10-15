import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import User from "./models/User.js";
import Message from "./models/Message.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import messageRoutes from "./routes/messages.js";

const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in backend/.env`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "20kb" }));

app.get("/", (_req, res) => res.json({ message: "ChitChat API is running." }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const userId = String(socket.userId);
  socket.join(userId);

  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socket.id);
  onlineUsers.set(userId, sockets);
  io.emit("online-users", [...onlineUsers.keys()]);

  socket.on("private-message", async (payload, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};
    try {
      const receiverId = String(payload?.receiverId || "");
      const messageText = String(payload?.text || "").trim();

      if (!mongoose.isValidObjectId(receiverId)) {
        return reply({ ok: false, message: "Invalid recipient." });
      }
      if (!messageText || messageText.length > 5000) {
        return reply({ ok: false, message: "Message must be 1–5000 characters." });
      }
      if (receiverId === userId) {
        return reply({ ok: false, message: "You cannot message yourself." });
      }
      const receiverExists = await User.exists({ _id: receiverId });
      if (!receiverExists) return reply({ ok: false, message: "Recipient not found." });

      const saved = await Message.create({
        sender: userId,
        receiver: receiverId,
        text: messageText,
      });
      const message = saved.toObject();
      io.to(userId).to(receiverId).emit("new-message", message);
      reply({ ok: true });
    } catch (error) {
      console.error("Send message error:", error);
      reply({ ok: false, message: "Message could not be sent." });
    }
  });

  socket.on("disconnect", () => {
    const active = onlineUsers.get(userId);
    if (active) {
      active.delete(socket.id);
      if (active.size === 0) onlineUsers.delete(userId);
      else onlineUsers.set(userId, active);
    }
    io.emit("online-users", [...onlineUsers.keys()]);
  });
});

const PORT = process.env.PORT || 5000;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
  server.listen(PORT, () => console.log(`ChitChat API listening on port ${PORT}`));
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}
