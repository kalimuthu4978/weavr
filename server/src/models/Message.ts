import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: false,   // <-- was true; an image-only message has no text
      default: "",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // If this message is a file, its URL and original name live here.
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

const Message = mongoose.model("Message", messageSchema);

export default Message;