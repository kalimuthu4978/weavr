import express from "express";
import dotenv from "dotenv";
import connectToDatabase from "./config/db";
import authRoutes from "./routes/auth";
import mongoose from "mongoose";
import User from "./models/User";


// Load environment variables from .env file
dotenv.config();

// Create express applicaiton
const app = express();

// The port is door the our server listens on 
const port = 5000;

// Let the server understand JSON in the request body
app.use(express.json());

connectToDatabase();

// A simple test route: when someone visits "/", the server sends back the message
app.get("/", (req, res) => {
    res.send("Chat server is running")
})

// any url startig with /api/auth will be handled by authRoutes
app.use("/api/auth", authRoutes);

// this start listeting to the port and lods message
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})
