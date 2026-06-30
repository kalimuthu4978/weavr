import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";

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
        const existingUser = await User.findOne({ email : email });
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
        })
        // Save it to the database  <-- this was missing
        await newUser.save();
        // Respond with success message
        res.status(201).json({ 
            message: "User registered successfully", 
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
            }
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

export default router;
