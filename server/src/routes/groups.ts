import express from "express";
import Group from "../models/Group";
import requireAuth from "../middleware/auth";

const router = express.Router();

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

    // Create and save the group
    const newGroup = new Group({
      name: name.trim(),
      members: allMembers,
      createdBy: currentUserId,
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

export default router;
