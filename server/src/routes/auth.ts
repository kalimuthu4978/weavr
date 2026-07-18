import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import jwt from "jsonwebtoken";
import requireAuth from "../middleware/auth";

const router = express.Router();

// POST /api/auth/register - create a new account
router.post("/register", async (req, res) => {
  try {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    // verify all details are available
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    // Reject if email is already registered
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Hash the password before saving to the database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Build the new user and save it to the database
    const newUser = new User({
      username: username,
      email: email,
      password: hashedPassword,
    });
    // Save it to the database  <-- this was missing
    await newUser.save();
    // Respond with success message
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.log("=== REGISTER ERROR ===");
    console.log(error);
    return res.status(500).json({
      message: "Register failed",
      error: String(error),
    });
  }
});

// POST /api/auth/login  ->  sign in and receive a token
router.post("/login", async (req, res) => {
  try {
    // Accept either an email or a username in one field
    const identifier = req.body.identifier;
    const password = req.body.password;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Please provide your email/username and password" });
    }

    // Find the user by EITHER email OR username.
    // Email is stored lowercase, so lowercase the identifier for the email match.
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Compare the typed password against the stored hash
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 4. Read the secret used to sign tokens
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    // 5. Create the token. It carries the user's id and lasts 7 days.
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    const token = jwt.sign({ userId: user._id }, secret, {
      expiresIn: sevenDaysInSeconds,
    });

    // 6. Send back the token and basic user info
    res.status(200).json({
      message: "Logged in successfully",
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin, // <-- add this
      }
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
});

// GET /api/auth/me  ->  returns the logged-in user's id (protected)
router.get("/me", requireAuth, async (req, res) => {
  // requireAuth already ran and attached userId to the request
  const userId = (req as any).userId;
  res.status(200).json({
    message: "You are authenticated",
    userId: userId,
  });
});

export default router;
