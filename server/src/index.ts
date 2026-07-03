import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectToDatabase from "./config/db";
import authRoutes from "./routes/auth";

// Load environment variables from .env file
dotenv.config();

// Create the Express application
const app = express();
const port = 5000;

// Let the server understand JSON in the request body
app.use(express.json());

// Connect to MongoDB
connectToDatabase();

// --- Normal HTTP routes ---

app.get("/", (req, res) => {
  res.send("Chat server is running");
});

app.use("/api/auth", authRoutes);

// --- Socket.io setup ---

// Socket.io needs the raw HTTP server, so we build one from our Express app
const httpServer = http.createServer(app);

// Attach Socket.io to that server. The "cors" setting will let our
// React client (which will run on port 5173) connect to us later.
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

// This block runs every time a client connects in real time
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // This runs when that same client disconnects
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// IMPORTANT: we now listen on httpServer (not app), so that both
// normal routes AND real-time sockets work on the same port.
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});