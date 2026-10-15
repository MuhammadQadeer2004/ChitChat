import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    const otherUser = await User.exists({ _id: userId });
    if (!otherUser) return res.status(404).json({ message: "User not found." });

    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId },
      ],
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

export default router;
