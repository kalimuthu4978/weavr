import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import path from "path";

import connectToDatabase from "./config/db";
import { setupSocket } from "./socket";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import messageRoutes from "./routes/messages";
import groupRoutes from "./routes/groups";
import uploadRoutes from "./routes/upload";
import adminRoutes from "./routes/admin";

// Load environment variables from .env file
dotenv.config();

// Create the Express application
const app = express();
const port = process.env.PORT || 5000;

// Let the server understand JSON in the request body
app.use(express.json());

// Allow both local development and the live Netlify frontend
const allowedOrigins = [
  "http://localhost:5173",
  "https://weavr-chat.netlify.app",
];
app.use(cors({ origin: allowedOrigins }));

// Connect to MongoDB
connectToDatabase();

// --- HTTP routes ---
app.get("/", (req, res) => {
  res.send("Chat server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);

// Serve uploaded files as static files, so /uploads/abc.png returns the image
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- Socket.io setup ---
// Socket.io needs the raw HTTP server, so we build one from our Express app,
// then hand it to setupSocket which wires up all the real-time handlers.
const httpServer = http.createServer(app);
setupSocket(httpServer, allowedOrigins);

// Listen on httpServer (not app) so both HTTP routes AND sockets share the port.
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
