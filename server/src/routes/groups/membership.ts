import express from "express";
import Group from "../../models/Group";
import requireAuth from "../../middleware/auth";
import { isMemberOfGroup, isAdminOfGroup } from "./helpers";

// Everything about who is in a group: discovering and joining public groups,
// adding and removing members, and promoting or demoting group admins.
const router = express.Router();

router.get("/discover", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;

    // Public groups where my id is NOT in the members array
    const openGroups = await Group.find({
      isPublic: true,
      members: { $ne: currentUserId },
    }).sort({ createdAt: -1 });

    // Only send what the browse list needs
    const summaries = openGroups.map((oneGroup: any) => ({
      _id: oneGroup._id,
      name: oneGroup.name,
      groupPicture: oneGroup.groupPicture,
      memberCount: oneGroup.members.length,
    }));

    res.status(200).json(summaries);
  } catch (error) {
    console.log("Error loading public groups:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// POST /api/groups/:groupId/join  ->  join a public group yourself
router.post("/:groupId/join", requireAuth, async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const groupId = String(req.params.groupId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Private groups are invite-only - a group admin has to add you
    if (!group.isPublic) {
      return res
        .status(403)
        .json({ message: "This group is private, so you need an invite" });
    }

    if (isMemberOfGroup(group, currentUserId)) {
      return res
        .status(400)
        .json({ message: "You are already in this group" });
    }

    group.members.push(currentUserId);
    await group.save();

    res.status(200).json({
      message: "Joined the group",
      group: group,
    });
  } catch (error) {
    console.log("Error joining group:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/groups/:groupId  ->  one group, with its members' details filled in.
// Used by the group settings panel so it can show names and pictures.

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
