import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select("username email createdAt")
      .sort({ username: 1 })
      .lean();
    res.json(users);
  } catch (error) {
    console.error("Users error:", error);
    res.status(500).json({ message: "Could not load users." });
  }
});

export default router;
