
import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Get messages visible to the logged-in user.
router.get("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.userId)
    ) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const otherUser = await User.exists({ _id: userId });

    if (!otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId },
      ],
      deletedBy: { $ne: req.userId },
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    res.json(messages);
  } catch (error) {
    console.error("Messages error:", error);
    res.status(500).json({ message: "Could not load messages." });
  }
});

// Delete one message from the current user's history.
router.delete("/message/:messageId", protect, async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID." });
    }

    const message = await Message.findOne({
      _id: messageId,
      $or: [{ sender: req.userId }, { receiver: req.userId }],
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found or access denied.",
      });
    }

    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { deletedBy: req.userId } }
    );

    req.app.get("io")?.to(String(req.userId)).emit("message-deleted", {
      messageId: String(messageId),
    });

    res.json({
      ok: true,
      message: "Message deleted from your history.",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ message: "Could not delete message." });
  }
});

// Clear a conversation from the current user's history.
router.delete("/conversation/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.userId)
    ) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const otherUser = await User.exists({ _id: userId });

    if (!otherUser) {
      return res.status(404).json({ message: "User not found." });
    }

    await Message.updateMany(
      {
        $or: [
          { sender: req.userId, receiver: userId },
          { sender: userId, receiver: req.userId },
        ],
        deletedBy: { $ne: req.userId },
      },
      { $addToSet: { deletedBy: req.userId } }
    );

    req.app.get("io")?.to(String(req.userId)).emit("conversation-deleted", {
      conversationUserId: String(userId),
    });

    res.json({
      ok: true,
      message: "Chat cleared from your history.",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ message: "Could not clear conversation." });
  }
});

export default router;
