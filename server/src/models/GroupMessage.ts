import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
  }
);

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);

export default GroupMessage;