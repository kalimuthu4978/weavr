import express from "express";
import User from "../../models/User";

// Viewing user accounts, deleting them, and activating or deactivating them.
const router = express.Router();

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

// PATCH /api/admin/users/:userId/active  ->  activate or deactivate an account.
// Body: { isActive: true } or { isActive: false }
// Deactivating is the gentler alternative to deleting: the account and all its
// messages stay, but the person can no longer log in.
router.patch("/users/:userId/active", async (req, res) => {
  try {
    const userIdToChange = String(req.params.userId);
    const currentUserId = (req as any).userId;
    const shouldBeActive = req.body.isActive;

    if (typeof shouldBeActive !== "boolean") {
      return res
        .status(400)
        .json({ message: "isActive must be true or false" });
    }

    // Safety: an admin shouldn't be able to lock themselves out
    if (userIdToChange === currentUserId) {
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own admin account" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userIdToChange,
      { isActive: shouldBeActive },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const wordForAction = shouldBeActive ? "activated" : "deactivated";
    res.status(200).json({
      message: "User " + wordForAction + " successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("Error changing user active state:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});


export default router;
