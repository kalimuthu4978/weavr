import express from "express";
import Group from "../models/Group";
import requireAuth from "../middleware/auth";
import GroupMessage from "../models/GroupMessage";
import { stripHiddenMessages } from "../utils/moderation";

const router = express.Router();

// --- Small helpers used by the group-management routes below ---

// Turns a member entry into a plain id string.
//
// A group's members can arrive in two different shapes:
//   - as plain ObjectIds, when we loaded the group normally
//   - as full user documents, when we used .populate("members")
// This handles both, so the checks below work either way.
function toIdString(memberOrId: any) {
  if (!memberOrId) {
    return "";
  }
  // A populated user document keeps its id in _id
  if (memberOrId._id) {
    return memberOrId._id.toString();
  }
  return memberOrId.toString();
}

// Is this user a member of the group?
function isMemberOfGroup(group: any, userId: string) {
  return group.members.some(
    (oneMember: any) => toIdString(oneMember) === userId
  );
}

// Is this user allowed to manage the group?
// The creator always counts, even for older groups that were saved before
// the groupAdmins field existed.
function isAdminOfGroup(group: any, userId: string) {
  if (group.createdBy && toIdString(group.createdBy) === userId) {
    return true;
  }
  if (!Array.isArray(group.groupAdmins)) {
    return false;
  }
  return group.groupAdmins.some(
    (oneAdmin: any) => toIdString(oneAdmin) === userId
  );
}

// POST /api/groups  ->  create a new group
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

// GET /api/groups/:groupId  ->  one group, with its members' details filled in.
// Used by the group settings panel so it can show names and pictures.
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

    if (newName !== undefined) {
      if (newName.trim() === "") {
        return res.status(400).json({ message: "Group name cannot be empty" });
      }
      group.name = newName.trim();
    }
    if (newGroupPicture !== undefined) {
      group.groupPicture = newGroupPicture;
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
router.post("/:groupId/members", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;
    const memberIds = req.body.memberIds;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Please choose at least one person to add" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!isAdminOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "Only a group admin can add members" });
    }

    // Add each id, skipping anyone who is already in the group
    let addedCount = 0;
    for (const oneMemberId of memberIds) {
      if (!isMemberOfGroup(group, oneMemberId)) {
        group.members.push(oneMemberId);
        addedCount = addedCount + 1;
      }
    }

    if (addedCount === 0) {
      return res
        .status(400)
        .json({ message: "Those people are already in the group" });
    }

    await group.save();

    res.status(200).json({
      message: "Members added successfully",
      group: group,
    });
  } catch (error) {
    console.log("Error adding members:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// DELETE /api/groups/:groupId/members/:memberId  ->  remove one member.
// A group admin can remove anyone; any member can remove themselves (leave).
router.delete("/:groupId/members/:memberId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;
    const memberIdToRemove = String(req.params.memberId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isLeavingMyself = memberIdToRemove === currentUserId;
    if (!isLeavingMyself && !isAdminOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "Only a group admin can remove members" });
    }

    // The creator is the one person who cannot be removed, otherwise a group
    // could be left with nobody able to manage it.
    if (group.createdBy.toString() === memberIdToRemove) {
      return res
        .status(400)
        .json({ message: "The group creator cannot be removed" });
    }

    if (!isMemberOfGroup(group, memberIdToRemove)) {
      return res
        .status(404)
        .json({ message: "That person is not in this group" });
    }

    // Keep everyone EXCEPT the person being removed
    group.members = group.members.filter(
      (memberId: any) => memberId.toString() !== memberIdToRemove
    );
    // If they were an admin, they lose that too
    group.groupAdmins = group.groupAdmins.filter(
      (adminId: any) => adminId.toString() !== memberIdToRemove
    );

    await group.save();

    res.status(200).json({
      message: "Member removed successfully",
      group: group,
    });
  } catch (error) {
    console.log("Error removing member:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// POST /api/groups/:groupId/admins/:memberId  ->  promote a member to group admin
router.post("/:groupId/admins/:memberId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;
    const memberIdToPromote = String(req.params.memberId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!isAdminOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "Only a group admin can promote members" });
    }
    if (!isMemberOfGroup(group, memberIdToPromote)) {
      return res
        .status(400)
        .json({ message: "That person must be a member of the group first" });
    }
    if (isAdminOfGroup(group, memberIdToPromote)) {
      return res
        .status(400)
        .json({ message: "That person is already a group admin" });
    }

    group.groupAdmins.push(memberIdToPromote as any);
    await group.save();

    res.status(200).json({
      message: "Member promoted to group admin",
      group: group,
    });
  } catch (error) {
    console.log("Error promoting member:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// DELETE /api/groups/:groupId/admins/:memberId  ->  demote a group admin back
// to an ordinary member
router.delete("/:groupId/admins/:memberId", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = req.params.groupId;
    const memberIdToDemote = String(req.params.memberId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!isAdminOfGroup(group, currentUserId)) {
      return res
        .status(403)
        .json({ message: "Only a group admin can demote members" });
    }
    // The creator keeps their admin rights permanently, so the group always
    // has at least one person who can manage it.
    if (group.createdBy.toString() === memberIdToDemote) {
      return res
        .status(400)
        .json({ message: "The group creator cannot be demoted" });
    }

    group.groupAdmins = group.groupAdmins.filter(
      (adminId: any) => adminId.toString() !== memberIdToDemote
    );
    await group.save();

    res.status(200).json({
      message: "Group admin demoted to member",
      group: group,
    });
  } catch (error) {
    console.log("Error demoting member:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

export default router;
