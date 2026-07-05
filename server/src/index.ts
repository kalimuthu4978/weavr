import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectToDatabase from "./config/db";
import authRoutes from "./routes/auth";
import Message from "./models/Message";
import cors from "cors";
import userRoutes from "./routes/users";

// Load environment variables from .env file
dotenv.config();

// Create the Express application
const app = express();
const port = 5000;

// Let the server understand JSON in the request body
app.use(express.json());

// Allow our React app (port 5173) to make HTTP requests to this server
app.use(cors({ origin: "http://localhost:5173" }));

// Connect to MongoDB
connectToDatabase();

// --- Normal HTTP routes ---

app.get("/", (req, res) => {
  res.send("Chat server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
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

io.on("connection", async (socket) => {
  console.log("A user connected:", socket.id);

  // 1. When a client connects, load past messages and send them just to that client
  try {
    // Find all messages, sorted oldest first (createdAt: 1 = ascending)
    const pastMessages = await Message.find().sort({ createdAt: 1 });
    // socket.emit (not io.emit) = send only to THIS newly connected client
    socket.emit("loadMessages", pastMessages);
  } catch (error) {
    console.log("Error loading past messages:", error);
  }

  // 2. When a client sends a message: save it, then broadcast it
  socket.on("sendMessage", async (messageText) => {
    try {
      // Save the message to MongoDB
      const newMessage = new Message({ text: messageText });
      await newMessage.save();

      // Broadcast the SAVED message (it now has _id and createdAt) to everyone
      io.emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error saving message:", error);
    }
  });
  // A client can ask for the message history at any time
  socket.on("getMessages", async () => {
    try {
      const pastMessages = await Message.find().sort({ createdAt: 1 });
      socket.emit("loadMessages", pastMessages);
    } catch (error) {
      console.log("Error loading messages:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// IMPORTANT: we now listen on httpServer (not app), so that both
// normal routes AND real-time sockets work on the same port.
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
