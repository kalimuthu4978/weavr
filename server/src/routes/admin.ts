import express from "express";
import User from "../models/user";
import Group from "../models/Group";
import Message from "../models/Message";
import GroupMessage from "../models/GroupMessage";
import requireAuth from "../middleware/auth";
import requireAdmin from "../middleware/admin";

const router = express.Router();

// Every route here requires BOTH: logged in AND admin.
// We can apply both middlewares to the whole router at once:
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stats  ->  basic counts for the dashboard
router.get("/stats", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const groupCount = await Group.countDocuments();
    const messageCount = await Message.countDocuments();
    const groupMessageCount = await GroupMessage.countDocuments();

    res.status(200).json({
      users: userCount,
      groups: groupCount,
      directMessages: messageCount,
      groupMessages: groupMessageCount,
    });
  } catch (error) {
    console.log("Error loading stats:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/users  ->  every user (no passwords)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.log("Error loading users:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/groups  ->  every group
router.get("/groups", async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    console.log("Error loading groups:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /api/admin/users/:userId  ->  remove a user
router.delete("/users/:userId", async (req, res) => {
  try {
    const userIdToDelete = req.params.userId;
    const currentUserId = (req as any).userId;

    // Safety: an admin shouldn't be able to delete themselves
    if (userIdToDelete === currentUserId) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own admin account" });
    }

    const deletedUser = await User.findByIdAndDelete(userIdToDelete);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log("Error deleting user:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;