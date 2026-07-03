import mongoose from "mongoose";

// Describes what one chat message looks like in the database
const messageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    // We'll expand this later (who sent it, which chat it belongs to).
    // For now we just store the text and rely on timestamps for ordering.
  },
  {
    timestamps: true, // auto-adds createdAt (used to sort oldest -> newest)
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;