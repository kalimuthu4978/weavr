import express from "express";
import requireAuth from "../../middleware/auth";
import requireAdmin from "../../middleware/admin";
import reportingRoutes from "./reporting";
import userRoutes from "./users";
import groupRoutes from "./groups";
import moderationRoutes from "./moderation";

// The /api/admin routes, split by area to keep each file readable:
//   reporting.ts  - stats and the analytics report
//   users.ts      - viewing, deleting, activating and deactivating accounts
//   groups.ts     - creating, editing, deleting groups and their membership
//   moderation.ts - the reported-message queue
const router = express.Router();

// Every route below requires BOTH: logged in AND an admin.
// Applying it here means the individual files don't have to repeat it.
router.use(requireAuth);
router.use(requireAdmin);

router.use(reportingRoutes);
router.use(userRoutes);
router.use(groupRoutes);
router.use(moderationRoutes);

export default router;
