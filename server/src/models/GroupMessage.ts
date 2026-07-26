import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: false,   // an attachment-only message has no text
      default: "",
    },
    // If this message carries a file, its details live here.
    // Empty string means "this is a plain text message."
    fileUrl: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    fileType: {
      type: String,
      default: "",   // "image", "video", "file", or "" for text messages
    },
    // Who sent it
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Which group it belongs to (instead of a single receiver)
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    // --- Content moderation ---
    // Any user can flag a message. Flagged messages show up in the admin
    // dashboard for review; an admin then either clears the flag or hides it.
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      default: "",
    },
    // Hidden messages stay in the database (so there is an audit trail) but
    // are replaced with a placeholder in the chat UI.
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);

export default GroupMessage;