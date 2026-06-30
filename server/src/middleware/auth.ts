import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// This runs BEFORE a protected route. It checks the token on the request.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. The token is sent in a header like:  Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 2. Split "Bearer <token>" into two parts and take the token half
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ message: "Token format is invalid" });
    }
    const token = parts[1];

    // 3. Read the same secret we signed the token with
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    // 4. Verify the token. If it's fake or expired, this throws.
    const decoded = jwt.verify(token, secret) as { userId: string };

    // 5. Attach the user's id to the request so the route can use it
    (req as any).userId = decoded.userId;

    // 6. All good - let the request continue to the actual route
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export default requireAuth;