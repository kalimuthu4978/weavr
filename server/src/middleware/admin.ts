import { Request, Response, NextFunction } from "express";
import User from "../models/User";

// This runs AFTER requireAuth. It checks the logged-in user is an admin.
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // requireAuth already attached the user's id to the request
    const currentUserId = (req as any).userId;

    // Look up the user to read their isAdmin flag
    const user = await User.findById(currentUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      // Logged in, but not an admin -> forbidden
      return res.status(403).json({ message: "Admin access required" });
    }

    // All good - they're an admin, continue to the route
    next();
  } catch (error) {
    console.log("Admin check error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export default requireAdmin;