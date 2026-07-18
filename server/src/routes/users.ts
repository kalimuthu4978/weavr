import express from "express";
import User from "../models/user";
import requireAuth from "../middleware/auth";

const router = express.Router();

// GET /api/users  ->  list every user EXCEPT the logged-in one
router.get("/", requireAuth, async (req, res) => {
  try {
    // requireAuth attached the logged-in user's id to the request
    const currentUserId = (req as any).userId;

    // $ne means "not equal": find users whose _id is NOT mine.
    // .select("-password") removes the password hash from the results.
    const users = await User.find({ _id: { $ne: currentUserId } }).select(
      "-password"
    );

    res.status(200).json(users);
  } catch (error) {
    console.log("Error fetching users:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// PUT /api/users/profile  ->  update the logged-in user's own profile
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    // Read the fields the user wants to change
    const newUsername = req.body.username;
    const newStatusMessage = req.body.statusMessage;

    // Build an object with only the fields that were actually provided,
    // so a user can update just one thing without wiping the other.
    const fieldsToUpdate: { username?: string; statusMessage?: string } = {};

    if (newUsername !== undefined) {
      fieldsToUpdate.username = newUsername;
    }
    if (newStatusMessage !== undefined) {
      fieldsToUpdate.statusMessage = newStatusMessage;
    }

    // Update the user and get the UPDATED document back.
    // { new: true } returns the document AFTER the change (not before).
    // .select("-password") keeps the password hash out of the response.
    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      fieldsToUpdate,
      { new: true }
    ).select("-password");

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("Error updating profile:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

export default router;