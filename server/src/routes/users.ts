import express from "express";
import User from "../models/User";
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

export default router;