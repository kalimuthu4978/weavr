import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // A list of user ids who belong to this group.
    // [] with a ref means "an array of references to User documents."
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Who created the group (also a member, and always an admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Members who are allowed to manage the group: add/remove members,
    // rename it, change its picture, promote other members to admin.
    // The creator is put in here when the group is created.
    groupAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Cloudinary URL of the group's picture. Empty string means "no picture",
    // and the UI falls back to showing the first letter of the group name.
    groupPicture: {
      type: String,
      default: "",
    },
    // A public group is listed in "Discover groups" so anyone can find and
    // join it themselves. A private one is invite-only: you're only in it if
    // a group admin adds you.
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Group = mongoose.model("Group", groupSchema);

export default Group;