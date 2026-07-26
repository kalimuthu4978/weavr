import express from "express";
import User from "../models/User";
import Message from "../models/Message";
import GroupMessage from "../models/GroupMessage";
import Group from "../models/Group";
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
    // The Cloudinary URL of an already-uploaded picture. The client uploads
    // the image to /api/upload first, then sends the URL here.
    const newProfilePicture = req.body.profilePicture;

    // Build an object with only the fields that were actually provided,
    // so a user can update just one thing without wiping the other.
    const fieldsToUpdate: {
      username?: string;
      statusMessage?: string;
      profilePicture?: string;
    } = {};

    if (newUsername !== undefined) {
      fieldsToUpdate.username = newUsername;
    }
    if (newStatusMessage !== undefined) {
      fieldsToUpdate.statusMessage = newStatusMessage;
    }
    if (newProfilePicture !== undefined) {
      fieldsToUpdate.profilePicture = newProfilePicture;
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

// GET /api/users/:userId/profile  ->  another user's public profile.
//
// Shows who they are plus a summary of their recent activity. Deliberately
// does NOT include their message content - only counts and timings - so
// viewing a profile can't be used to read private conversations.
router.get("/:userId/profile", requireAuth, async (req, res) => {
  try {
    const viewedUserId = String(req.params.userId);

    const user = await User.findById(viewedUserId).select(
      "username email status statusMessage profilePicture createdAt"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // --- Recent activity ---

    // When did they last send anything? Look at both kinds of message and
    // keep whichever is newer.
    const newestDirect = await Message.findOne({ sender: viewedUserId })
      .sort({ createdAt: -1 })
      .select("createdAt");
    const newestGroup = await GroupMessage.findOne({ sender: viewedUserId })
      .sort({ createdAt: -1 })
      .select("createdAt");

    let lastMessageAt: Date | null = null;
    if (newestDirect) {
      lastMessageAt = (newestDirect as any).createdAt;
    }
    if (newestGroup) {
      const groupTime = (newestGroup as any).createdAt;
      if (lastMessageAt === null || groupTime > lastMessageAt) {
        lastMessageAt = groupTime;
      }
    }

    // How much they've sent overall
    const directCount = await Message.countDocuments({ sender: viewedUserId });
    const groupCount = await GroupMessage.countDocuments({
      sender: viewedUserId,
    });

    // How many groups they're in
    const groupsJoined = await Group.countDocuments({
      members: viewedUserId,
    });

    res.status(200).json({
      _id: user._id,
      username: (user as any).username,
      email: (user as any).email,
      status: (user as any).status,
      statusMessage: (user as any).statusMessage,
      profilePicture: (user as any).profilePicture,
      joinedAt: (user as any).createdAt,
      recentActivity: {
        lastMessageAt: lastMessageAt,
        messagesSent: directCount + groupCount,
        groupsJoined: groupsJoined,
      },
    });
  } catch (error) {
    console.log("Error loading user profile:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

export default router;