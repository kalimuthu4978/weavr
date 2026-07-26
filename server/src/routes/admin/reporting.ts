import express from "express";
import User from "../../models/User";
import Group from "../../models/Group";
import Message from "../../models/Message";
import GroupMessage from "../../models/GroupMessage";
import { buildAnalyticsReport } from "../../utils/analytics";

// The dashboard's headline counters and the full reporting section.
const router = express.Router();

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

export default router;
