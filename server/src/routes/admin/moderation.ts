import express from "express";
import Message from "../../models/Message";
import GroupMessage from "../../models/GroupMessage";

// Reviewing messages users have reported, and acting on them.
const router = express.Router();

// --- Content moderation ---

// GET /api/admin/flagged  ->  every message a user has flagged, for review.
// Returns direct messages and group messages together, newest first.
router.get("/flagged", async (req, res) => {
  try {
    const flaggedDirect = await Message.find({ isFlagged: true })
      .populate("sender", "username email")
      .sort({ createdAt: -1 });

    const flaggedGroup = await GroupMessage.find({ isFlagged: true })
      .populate("sender", "username email")
      .populate("group", "name")
      .sort({ createdAt: -1 });

    // Tag each one so the dashboard knows which endpoint to call when the
    // admin acts on it.
    const directForReview = flaggedDirect.map((oneMessage: any) => ({
      _id: oneMessage._id,
      kind: "direct",
      text: oneMessage.text,
      fileName: oneMessage.fileName,
      fileType: oneMessage.fileType,
      sender: oneMessage.sender,
      groupName: "",
      flagReason: oneMessage.flagReason,
      isHidden: oneMessage.isHidden,
      createdAt: oneMessage.createdAt,
    }));

    const groupForReview = flaggedGroup.map((oneMessage: any) => ({
      _id: oneMessage._id,
      kind: "group",
      text: oneMessage.text,
      fileName: "",
      fileType: "",
      sender: oneMessage.sender,
      groupName: oneMessage.group ? oneMessage.group.name : "",
      flagReason: oneMessage.flagReason,
      isHidden: oneMessage.isHidden,
      createdAt: oneMessage.createdAt,
    }));

    // Combine both lists and sort the whole thing newest first
    const allForReview = [...directForReview, ...groupForReview];
    allForReview.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.status(200).json(allForReview);
  } catch (error) {
    console.log("Error loading flagged messages:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// PATCH /api/admin/messages/:kind/:messageId  ->  act on a flagged message.
// :kind is "direct" or "group".
// Body: { isHidden?: boolean, clearFlag?: boolean }
router.patch("/messages/:kind/:messageId", async (req, res) => {
  try {
    const kind = String(req.params.kind);
    const messageId = String(req.params.messageId);
    const shouldHide = req.body.isHidden;
    const shouldClearFlag = req.body.clearFlag;

    if (kind !== "direct" && kind !== "group") {
      return res
        .status(400)
        .json({ message: "Message kind must be 'direct' or 'group'" });
    }

    // Build the changes from whichever fields were sent
    const fieldsToUpdate: {
      isHidden?: boolean;
      isFlagged?: boolean;
      flagReason?: string;
    } = {};

    if (typeof shouldHide === "boolean") {
      fieldsToUpdate.isHidden = shouldHide;
    }
    if (shouldClearFlag === true) {
      fieldsToUpdate.isFlagged = false;
      fieldsToUpdate.flagReason = "";
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // Pick the right collection for this kind of message.
    // Typed as `any` because the two models have different shapes, and
    // TypeScript can't work out which one's methods to offer on the union.
    const modelToUse: any = kind === "direct" ? Message : GroupMessage;

    const updatedMessage = await modelToUse.findByIdAndUpdate(
      messageId,
      fieldsToUpdate,
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({
      message: "Message updated successfully",
      moderatedMessage: updatedMessage,
    });
  } catch (error) {
    console.log("Error moderating message:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});


export default router;
