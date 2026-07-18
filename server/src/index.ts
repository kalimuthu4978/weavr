import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectToDatabase from "./config/db";
import authRoutes from "./routes/auth";
import Message from "./models/Message";
import User from "./models/user";
import cors from "cors";
import userRoutes from "./routes/users";
import messageRoutes from "./routes/messages";
import groupRoutes from "./routes/groups";
import Group from "./models/Group";
import GroupMessage from "./models/GroupMessage";
import uploadRoutes from "./routes/upload";
import path from "path";
import adminRoutes from "./routes/admin";

// Load environment variables from .env file
dotenv.config();

// Create the Express application
const app = express();
const port = process.env.PORT || 5000;

// Let the server understand JSON in the request body
app.use(express.json());

// Allow our React app (port 5173) to make HTTP requests to this server
// Allow both local development and the live Netlify frontend
const allowedOrigins = [
  "http://localhost:5173",
  "https://weavr-chat.netlify.app",
];
app.use(cors({ origin: allowedOrigins }));

app.use("/api/groups", groupRoutes);

app.use("/api/messages", messageRoutes);

app.use("/api/upload", uploadRoutes);

app.use("/api/admin", adminRoutes);

// Serve uploaded files as static files, so /uploads/abc.png returns the image
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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
    origin: allowedOrigins,
  },
});

io.on("connection", async (socket) => {
  const userId = socket.handshake.auth.userId;
  console.log("A user connected:", socket.id, "userId:", userId);

  if (userId) {
    socket.join(userId);

    // Mark this user online in the database, then tell everyone
    try {
      await User.findByIdAndUpdate(userId, { status: "online" });
      // Broadcast to ALL clients: this user is now online
      io.emit("userStatusChanged", { userId: userId, status: "online" });
    } catch (error) {
      console.log("Error setting user online:", error);
    }
  }
  // Join a room for every group this user belongs to,
  // so they receive messages sent to any of their groups.
  if (userId) {
    try {
      const myGroups = await Group.find({ members: userId });
      myGroups.forEach((oneGroup: any) => {
        // Room name = the group's id (as a string)
        socket.join(oneGroup._id.toString());
      });
    } catch (error) {
      console.log("Error joining group rooms:", error);
    }
  }

  // ... your existing getMessages listener, sendMessage, disconnect, etc. stay below
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
  // Send a message to ONE specific user
  socket.on("sendMessage", async (data) => {
    try {
      const text = data.text;
      const receiverId = data.receiverId;
      // These may be undefined for a plain text message - default to empty
      const fileUrl = data.fileUrl || "";
      const fileName = data.fileName || "";
      const fileType = data.fileType || "";

      if (!userId) {
        console.log("Cannot send: this socket has no userId");
        return;
      }

      // A message must have EITHER text OR a file - reject truly empty ones
      const hasText = text && text.trim() !== "";
      const hasFile = fileUrl !== "";
      if (!hasText && !hasFile) {
        console.log("Blocked empty message (no text and no file)");
        return;
      }

      // Save the message with whatever it carries
      const newMessage = new Message({
        text: text || "",
        sender: userId,
        receiver: receiverId,
        fileUrl: fileUrl,
        fileName: fileName,
        fileType: fileType, // <-- add this
      });
      await newMessage.save();

      // Deliver to both people (unchanged from before)
      io.to([receiverId, userId]).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error saving message:", error);
    }
  });
  // A client can ask for the message history at any time
  // Load the conversation between me and one other user
  socket.on("getConversation", async (otherUserId) => {
    try {
      if (!userId) {
        return;
      }

      // Find messages where (I sent to them) OR (they sent to me).
      // $or matches either condition.
      const conversation = await Message.find({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      }).sort({ createdAt: 1 });

      socket.emit("loadMessages", conversation);
    } catch (error) {
      console.log("Error loading conversation:", error);
    }
  });

  // Send a message to a whole group
  socket.on("sendGroupMessage", async (data) => {
    try {
      const text = data.text;
      const groupId = data.groupId;

      if (!userId) {
        console.log("Cannot send group message: no userId on socket");
        return;
      }

      // Safety: confirm the sender is actually a member of this group
      const group = await Group.findById(groupId);
      if (!group) {
        return;
      }
      const isMember = group.members.some(
        (memberId: any) => memberId.toString() === userId,
      );
      if (!isMember) {
        console.log("Blocked: sender is not a member of this group");
        return;
      }

      // Save the group message
      const newGroupMessage = new GroupMessage({
        text: text,
        sender: userId,
        group: groupId,
      });
      await newGroupMessage.save();

      // Emit to the GROUP'S room -> every connected member receives it,
      // including the sender (so their own screen updates).
      io.to(groupId).emit("receiveGroupMessage", newGroupMessage);
    } catch (error) {
      console.log("Error sending group message:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("A user disconnected:", socket.id);

    if (userId) {
      try {
        await User.findByIdAndUpdate(userId, { status: "offline" });
        io.emit("userStatusChanged", { userId: userId, status: "offline" });
      } catch (error) {
        console.log("Error setting user offline:", error);
      }
    }
  });
}); // <-- ADD THIS LINE: closes the io.on("connection", ...) block

// IMPORTANT: we now listen on httpServer (not app), so that both
// normal routes AND real-time sockets work on the same port.
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
