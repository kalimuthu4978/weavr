import express from "express";
import Message from "../models/Message";
import GroupMessage from "../models/GroupMessage";
import requireAuth from "../middleware/auth";

const router = express.Router();

// GET /api/messages/search
// Finds messages involving the logged-in user, with optional filters.
//
// Query parameters (all optional):
//   term=hello          text must contain this
//   withUser=<userId>   only the conversation with this person
//   from=2026-01-01     only messages sent on or after this date
//   to=2026-01-31       only messages sent on or before this date
//   contentType=image   one of: text, image, video, file
router.get("/search", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    const term = req.query.term;
    const withUser = req.query.withUser;
    const fromDate = req.query.from;
    const toDate = req.query.to;
    const contentType = req.query.contentType;

    // We build up a list of conditions and require ALL of them ($and).
    // The first one is always "this conversation involves me".
    const conditions: any[] = [
      {
        $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      },
    ];

    // --- Keyword filter ---
    // Search the message text AND the attachment's filename, so searching
    // "report" also finds report.pdf.
    if (typeof term === "string" && term.trim() !== "") {
      const trimmedTerm = term.trim();
      conditions.push({
        $or: [
          { text: { $regex: trimmedTerm, $options: "i" } },
          { fileName: { $regex: trimmedTerm, $options: "i" } },
        ],
      });
    }

    // --- User filter: only messages between me and this specific person ---
    if (typeof withUser === "string" && withUser.trim() !== "") {
      const otherUserId = withUser.trim();
      conditions.push({
        $or: [
          { sender: currentUserId, receiver: otherUserId },
          { sender: otherUserId, receiver: currentUserId },
        ],
      });
    }

    // --- Date range filter ---
    // $gte = "on or after", $lte = "on or before".
    const dateRange: { $gte?: Date; $lte?: Date } = {};

    if (typeof fromDate === "string" && fromDate.trim() !== "") {
      const parsedFrom = new Date(fromDate);
      if (!isNaN(parsedFrom.getTime())) {
        dateRange.$gte = parsedFrom;
      }
    }
    if (typeof toDate === "string" && toDate.trim() !== "") {
      const parsedTo = new Date(toDate);
      if (!isNaN(parsedTo.getTime())) {
        // The date input gives us midnight. Push it to the end of that day so
        // "to: 5th March" includes everything sent during the 5th.
        parsedTo.setHours(23, 59, 59, 999);
        dateRange.$lte = parsedTo;
      }
    }
    if (dateRange.$gte || dateRange.$lte) {
      conditions.push({ createdAt: dateRange });
    }

    // --- Content type filter ---
    if (typeof contentType === "string" && contentType.trim() !== "") {
      const wantedType = contentType.trim();

      if (wantedType === "text") {
        // A plain text message has no attachment
        conditions.push({
          $or: [{ fileType: "" }, { fileType: { $exists: false } }],
        });
      } else if (
        wantedType === "image" ||
        wantedType === "video" ||
        wantedType === "file"
      ) {
        conditions.push({ fileType: wantedType });
      }
      // Anything else we simply ignore rather than erroring
    }

    // If the only condition is "involves me", the user gave us no filters at
    // all. Return nothing rather than dumping their entire history.
    if (conditions.length === 1) {
      return res.status(200).json([]);
    }

    const matchingMessages = await Message.find({ $and: conditions })
      .sort({ createdAt: -1 }) // newest matches first
      .limit(50); // safety cap so a huge result set can't overwhelm us

    res.status(200).json(matchingMessages);
  } catch (error) {
    console.log("Error searching messages:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// POST /api/messages/:kind/:messageId/flag  ->  report a message to the admins.
// :kind is "direct" or "group". Body: { reason: "..." }
router.post("/:kind/:messageId/flag", requireAuth, async (req, res) => {
  try {
    const kind = String(req.params.kind);
    const messageId = String(req.params.messageId);
    const reason = req.body.reason;

    if (kind !== "direct" && kind !== "group") {
      return res
        .status(400)
        .json({ message: "Message kind must be 'direct' or 'group'" });
    }

    // Pick the right collection for this kind of message.
    // Typed as `any` because the two models have different shapes, and
    // TypeScript can't work out which one's methods to offer on the union.
    const modelToUse: any = kind === "direct" ? Message : GroupMessage;

    const flaggedMessage = await modelToUse.findByIdAndUpdate(
      messageId,
      {
        isFlagged: true,
        flagReason: typeof reason === "string" ? reason.trim() : "",
      },
      { new: true }
    );

    if (!flaggedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({ message: "Message reported to the admins" });
  } catch (error) {
    console.log("Error flagging message:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

export default router;
