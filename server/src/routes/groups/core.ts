import express from "express";
import Group from "../../models/Group";
import GroupMessage from "../../models/GroupMessage";
import requireAuth from "../../middleware/auth";
import { stripHiddenMessages } from "../../utils/moderation";
import { isMemberOfGroup, isAdminOfGroup, toIdString } from "./helpers";

// Creating a group, listing your own groups, reading one group and its
// messages, and changing or deleting a group.
const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    const name = req.body.name;
    // memberIds: an array of user ids the creator wants in the group
    const memberIds = req.body.memberIds;

    // Basic validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Please choose at least one member" });
    }

    // The creator should always be a member too.
    // Start with the chosen members, then add the creator if not already there.
    const allMembers = [...memberIds];
    if (!allMembers.includes(currentUserId)) {
      allMembers.push(currentUserId);
    }

    // Create and save the group. The creator starts as the only group admin.
    const newGroup = new Group({
      name: name.trim(),
      members: allMembers,
      createdBy: currentUserId,
      groupAdmins: [currentUserId],
    });
    await newGroup.save();

    res.status(201).json({
      message: "Group created successfully",
      group: newGroup,
    });
  } catch (error) {
    console.log("Error creating group:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/groups  ->  list groups the logged-in user is a member of
router.get("/", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    // Find groups where the members array CONTAINS my id.
    // Mongoose matches an array field against a single value automatically.
    const groups = await Group.find({ members: currentUserId }).sort({
      createdAt: -1,
    });

    res.status(200).json(groups);
  } catch (error) {
    console.log("Error fetching groups:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/groups/:groupId/messages  ->  load one group's message history
router.get("/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;

    // Safety: make sure this group exists AND the user is a member of it,
    // so people can't read messages from groups they're not in.
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some(
      (memberId: any) => memberId.toString() === currentUserId
    );
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    // Load this group's messages, oldest first
    const messages = await GroupMessage.find({ group: groupId }).sort({
      createdAt: 1,
    });

    res.status(200).json(stripHiddenMessages(messages));
  } catch (error) {
    console.log("Error loading group messages:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/groups/discover  ->  public groups the user is NOT already in,
// so they can find and join one themselves.
//
// This is declared BEFORE /:groupId, otherwise Express would treat the word
// "discover" as a group id and try to look it up.

router.get("/:groupId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;

    // .populate replaces the member ids with the actual user documents,
    // so the frontend gets usernames and pictures in one request.
    const group = await Group.findById(groupId).populate(
      "members",
      "username email profilePicture status"
    );

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!isMemberOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error loading group:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// PUT /api/groups/:groupId  ->  rename the group or change its picture.
// Only a group admin may do this.
router.put("/:groupId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!isAdminOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "Only a group admin can change group settings" });
    }

    // Only change the fields that were actually sent
    const newName = req.body.name;
    const newGroupPicture = req.body.groupPicture;
    const newIsPublic = req.body.isPublic;

    if (newName !== undefined) {
      if (newName.trim() === "") {
        return res.status(400).json({ message: "Group name cannot be empty" });
      }
      group.name = newName.trim();
    }
    if (newGroupPicture !== undefined) {
      group.groupPicture = newGroupPicture;
    }
    if (typeof newIsPublic === "boolean") {
      group.isPublic = newIsPublic;
    }

    await group.save();

    res.status(200).json({
      message: "Group updated successfully",
      group: group,
    });
  } catch (error) {
    console.log("Error updating group:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// DELETE /api/groups/:groupId  ->  delete the whole group and its messages.
// Only the person who created the group may do this - it's destructive, and
// letting any promoted admin delete someone else's group would be too easy
// to do by accident.
router.delete("/:groupId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = String(req.params.groupId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (toIdString(group.createdBy) !== currentUserId) {
      return res
        .status(403)
        .json({ message: "Only the group creator can delete this group" });
    }

    await Group.findByIdAndDelete(groupId);
    // Don't leave orphaned messages pointing at a group that's gone
    await GroupMessage.deleteMany({ group: groupId });

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.log("Error deleting group:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// POST /api/groups/:groupId/members  ->  add one or more members.
// Body: { memberIds: ["...", "..."] }

export default router;
