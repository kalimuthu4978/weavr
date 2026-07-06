import express from "express";
import Message from "../models/Message";
import requireAuth from "../middleware/auth";

const router = express.Router();

// GET /api/messages/search?term=hello
// Finds messages involving the logged-in user whose text matches the term.
router.get("/search", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    // The search term comes in as a query parameter (?term=...)
    const term = req.query.term;

    // If no term (or empty), return an empty list - nothing to search for
    if (!term || typeof term !== "string" || term.trim() === "") {
      return res.status(200).json([]);
    }

    const trimmedTerm = term.trim();

    // Find messages where:
    //  - I'm either the sender OR the receiver, AND
    //  - the text contains the search term (case-insensitive)
    const matchingMessages = await Message.find({
      // both conditions must be true
      $and: [
        {
          $or: [{ sender: currentUserId }, { receiver: currentUserId }],
        },
        {
          // "i" = case-insensitive regular expression match
          text: { $regex: trimmedTerm, $options: "i" },
        },
      ],
    })
      .sort({ createdAt: -1 }) // newest matches first
      .limit(50); // safety cap so a huge result set can't overwhelm us

    res.status(200).json(matchingMessages);
  } catch (error) {
    console.log("Error searching messages:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

export default router;