import express from "express";
import User from "../models/User";
import Group from "../models/Group";
import Message from "../models/Message";
import GroupMessage from "../models/GroupMessage";
import requireAuth from "../middleware/auth";
import requireAdmin from "../middleware/admin";
import { buildAnalyticsReport } from "../utils/analytics";

const router = express.Router();

// Every route here requires BOTH: logged in AND admin.
// We can apply both middlewares to the whole router at once:
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stats  ->  basic counts for the dashboard
router.get("/stats", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const groupCount = await Group.countDocuments();
    const messageCount = await Message.countDocuments();
    const groupMessageCount = await GroupMessage.countDocuments();

    res.status(200).json({
      users: userCount,
      groups: groupCount,
      directMessages: messageCount,
      groupMessages: groupMessageCount,
    });
  } catch (error) {
    console.log("Error loading stats:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/analytics?days=14  ->  the full reporting section:
// message volume over time, most active users and groups, user activity,
// engagement figures and basic system health.
// The heavy lifting lives in utils/analytics.ts to keep this file readable.
router.get("/analytics", async (req, res) => {
  try {
    // Default to a fortnight, and keep the range sensible
    let numberOfDays = Number(req.query.days) || 14;
    if (numberOfDays < 1) {
      numberOfDays = 1;
    }
    if (numberOfDays > 90) {
      numberOfDays = 90;
    }

    const report = await buildAnalyticsReport(numberOfDays);
    res.status(200).json(report);
  } catch (error) {
    console.log("Error building analytics:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/users  ->  every user (no passwords)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.log("Error loading users:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /api/admin/groups  ->  every group
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
router.delete("/users/:userId", async (req, res) => {
  try {
    const userIdToDelete = req.params.userId;
    const currentUserId = (req as any).userId;

    // Safety: an admin shouldn't be able to delete themselves
    if (userIdToDelete === currentUserId) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own admin account" });
    }

    const deletedUser = await User.findByIdAndDelete(userIdToDelete);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log("Error deleting user:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// PATCH /api/admin/users/:userId/active  ->  activate or deactivate an account.
// Body: { isActive: true } or { isActive: false }
// Deactivating is the gentler alternative to deleting: the account and all its
// messages stay, but the person can no longer log in.
router.patch("/users/:userId/active", async (req, res) => {
  try {
    const userIdToChange = String(req.params.userId);
    const currentUserId = (req as any).userId;
    const shouldBeActive = req.body.isActive;

    if (typeof shouldBeActive !== "boolean") {
      return res
        .status(400)
        .json({ message: "isActive must be true or false" });
    }

    // Safety: an admin shouldn't be able to lock themselves out
    if (userIdToChange === currentUserId) {
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own admin account" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userIdToChange,
      { isActive: shouldBeActive },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const wordForAction = shouldBeActive ? "activated" : "deactivated";
    res.status(200).json({
      message: "User " + wordForAction + " successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("Error changing user active state:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

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

// --- Content moderation ---

// GET /api/admin/flagged  ->  every message a user has flagged, for review.
// Returns direct messages and group messages together, newest first.
router.get("/flagged", async (req, res) => {
  try {
    const flaggedDirect = await Message.find({ isFlagged: true })
      .populate("sender", "username email")
      .sort({ createdAt: -1 });

    const flaggedGroup = await GroupMessage.find({ isFlagged: true })
      .populate("sender", "username email")
      .populate("group", "name")
      .sort({ createdAt: -1 });

    // Tag each one so the dashboard knows which endpoint to call when the
    // admin acts on it.
    const directForReview = flaggedDirect.map((oneMessage: any) => ({
      _id: oneMessage._id,
      kind: "direct",
      text: oneMessage.text,
      fileName: oneMessage.fileName,
      fileType: oneMessage.fileType,
      sender: oneMessage.sender,
      groupName: "",
      flagReason: oneMessage.flagReason,
      isHidden: oneMessage.isHidden,
      createdAt: oneMessage.createdAt,
    }));

    const groupForReview = flaggedGroup.map((oneMessage: any) => ({
      _id: oneMessage._id,
      kind: "group",
      text: oneMessage.text,
      fileName: "",
      fileType: "",
      sender: oneMessage.sender,
      groupName: oneMessage.group ? oneMessage.group.name : "",
      flagReason: oneMessage.flagReason,
      isHidden: oneMessage.isHidden,
      createdAt: oneMessage.createdAt,
    }));

    // Combine both lists and sort the whole thing newest first
    const allForReview = [...directForReview, ...groupForReview];
    allForReview.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.status(200).json(allForReview);
  } catch (error) {
    console.log("Error loading flagged messages:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// PATCH /api/admin/messages/:kind/:messageId  ->  act on a flagged message.
// :kind is "direct" or "group".
// Body: { isHidden?: boolean, clearFlag?: boolean }
router.patch("/messages/:kind/:messageId", async (req, res) => {
  try {
    const kind = String(req.params.kind);
    const messageId = String(req.params.messageId);
    const shouldHide = req.body.isHidden;
    const shouldClearFlag = req.body.clearFlag;

    if (kind !== "direct" && kind !== "group") {
      return res
        .status(400)
        .json({ message: "Message kind must be 'direct' or 'group'" });
    }

    // Build the changes from whichever fields were sent
    const fieldsToUpdate: {
      isHidden?: boolean;
      isFlagged?: boolean;
      flagReason?: string;
    } = {};

    if (typeof shouldHide === "boolean") {
      fieldsToUpdate.isHidden = shouldHide;
    }
    if (shouldClearFlag === true) {
      fieldsToUpdate.isFlagged = false;
      fieldsToUpdate.flagReason = "";
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // Pick the right collection for this kind of message.
    // Typed as `any` because the two models have different shapes, and
    // TypeScript can't work out which one's methods to offer on the union.
    const modelToUse: any = kind === "direct" ? Message : GroupMessage;

    const updatedMessage = await modelToUse.findByIdAndUpdate(
      messageId,
      fieldsToUpdate,
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json({
      message: "Message updated successfully",
      moderatedMessage: updatedMessage,
    });
  } catch (error) {
    console.log("Error moderating message:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;