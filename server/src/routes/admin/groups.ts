import express from "express";
import Group from "../../models/Group";
import GroupMessage from "../../models/GroupMessage";

// Admin-side group management: creating, renaming and deleting any group,
// plus managing its membership and permissions.
const router = express.Router();

router.get("/groups", async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    console.log("Error loading groups:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /api/admin/users/:userId  ->  remove a user

// --- Group management ---

// POST /api/admin/groups  ->  create a group on behalf of the platform.
// Body: { name, memberIds }
router.post("/groups", async (req, res) => {
  try {
    const currentUserId = (req as any).userId;
    const name = req.body.name;
    const memberIds = req.body.memberIds;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Group name is required" });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Please choose at least one member" });
    }

    // The admin who created it is a member and a group admin, so the group
    // is always manageable from inside the app too.
    const allMembers = [...memberIds];
    if (!allMembers.includes(currentUserId)) {
      allMembers.push(currentUserId);
    }

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
    console.log("Error creating group as admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// PUT /api/admin/groups/:groupId  ->  rename any group
router.put("/groups/:groupId", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);
    const newName = req.body.name;

    if (!newName || newName.trim() === "") {
      return res.status(400).json({ message: "Group name cannot be empty" });
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { name: newName.trim() },
      { new: true }
    );

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.log("Error updating group as admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/groups/:groupId  ->  one group with its members' details,
// so the dashboard can manage who is in it. Unlike the user-facing version
// of this route, an admin doesn't have to be a member.
router.get("/groups/:groupId", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);

    const group = await Group.findById(groupId).populate(
      "members",
      "username email profilePicture status"
    );
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error loading group as admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /api/admin/groups/:groupId/members  ->  add people to any group.
// Body: { memberIds: ["...", "..."] }
router.post("/groups/:groupId/members", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);
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

    // Add each id, skipping anyone already in the group
    let addedCount = 0;
    for (const oneMemberId of memberIds) {
      const alreadyIn = group.members.some(
        (existingId: any) => existingId.toString() === oneMemberId
      );
      if (!alreadyIn) {
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
    res.status(200).json({ message: "Members added", group: group });
  } catch (error) {
    console.log("Error adding members as admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /api/admin/groups/:groupId/members/:memberId  ->  remove anyone
// from any group. The creator is protected, since removing them would leave
// the group without its guaranteed manager.
router.delete("/groups/:groupId/members/:memberId", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);
    const memberIdToRemove = String(req.params.memberId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.createdBy.toString() === memberIdToRemove) {
      return res.status(400).json({
        message: "The group creator cannot be removed - delete the group instead",
      });
    }

    group.members = group.members.filter(
      (oneId: any) => oneId.toString() !== memberIdToRemove
    );
    group.groupAdmins = group.groupAdmins.filter(
      (oneId: any) => oneId.toString() !== memberIdToRemove
    );

    await group.save();
    res.status(200).json({ message: "Member removed", group: group });
  } catch (error) {
    console.log("Error removing member as admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// PATCH /api/admin/groups/:groupId/permissions/:memberId
// Grants or revokes group-admin rights. Body: { isGroupAdmin: true|false }
router.patch("/groups/:groupId/permissions/:memberId", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);
    const memberId = String(req.params.memberId);
    const shouldBeGroupAdmin = req.body.isGroupAdmin;

    if (typeof shouldBeGroupAdmin !== "boolean") {
      return res
        .status(400)
        .json({ message: "isGroupAdmin must be true or false" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some(
      (oneId: any) => oneId.toString() === memberId
    );
    if (!isMember) {
      return res
        .status(400)
        .json({ message: "That person must be a member of the group first" });
    }

    if (shouldBeGroupAdmin) {
      const alreadyAdmin = group.groupAdmins.some(
        (oneId: any) => oneId.toString() === memberId
      );
      if (!alreadyAdmin) {
        group.groupAdmins.push(memberId as any);
      }
    } else {
      // The creator keeps their rights permanently
      if (group.createdBy.toString() === memberId) {
        return res
          .status(400)
          .json({ message: "The group creator cannot be demoted" });
      }
      group.groupAdmins = group.groupAdmins.filter(
        (oneId: any) => oneId.toString() !== memberId
      );
    }

    await group.save();
    res.status(200).json({ message: "Permissions updated", group: group });
  } catch (error) {
    console.log("Error changing group permissions:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /api/admin/groups/:groupId  ->  delete a group AND its messages
router.delete("/groups/:groupId", async (req, res) => {
  try {
    const groupId = String(req.params.groupId);

    const deletedGroup = await Group.findByIdAndDelete(groupId);
    if (!deletedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Don't leave orphaned messages behind pointing at a group that's gone
    await GroupMessage.deleteMany({ group: groupId });

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.log("Error deleting group:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});


export default router;
