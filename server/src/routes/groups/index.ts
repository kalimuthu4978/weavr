import express from "express";
import membershipRoutes from "./membership";
import coreRoutes from "./core";

// The /api/groups routes, split across two files to keep each one readable:
//   membership.ts - discovering, joining, members and group admins
//   core.ts       - creating, reading, updating and deleting a group
//
// ORDER MATTERS. membership must be mounted FIRST, because it defines the
// literal "/discover" path while core defines "/:groupId". Express matches in
// the order routes were registered, so mounting core first would make it read
// "discover" as a group id and return "Group not found".
const router = express.Router();

router.use(membershipRoutes);
router.use(coreRoutes);

export default router;
