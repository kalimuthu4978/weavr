import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, //stores emails in lowercase
    },
    password: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "offline",
    },
    // A short "about" line the user can set, e.g. "Working from home"
    statusMessage: {
      type: String,
      default: "",
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // auto adds createdat and updatedAt fields
  },
);

// Reuse the already-compiled model if it exists, otherwise create it.
// This prevents "Cannot overwrite model" errors when the dev server hot-reloads.
const user = mongoose.models.User || mongoose.model("User", userSchema);

export default user;
