import { Server, Socket } from "socket.io";
import Message from "../models/Message";
import { stripHiddenMessages } from "../utils/moderation";

// Registers all one-on-one message listeners for a connected socket.
export function registerMessageHandlers(io: Server, socket: Socket, userId: string) {
  // When a client connects, load past messages and send them to that client.
  loadInitialMessages(socket);

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
        fileType: fileType,
      });
      await newMessage.save();

      // Deliver to both people
      io.to([receiverId, userId]).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error saving message:", error);
    }
  });

  // Load the conversation between me and one other user
  socket.on("getConversation", async (otherUserId) => {
    try {
      if (!userId) {
        return;
      }

      // Find messages where (I sent to them) OR (they sent to me).
      const conversation = await Message.find({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      }).sort({ createdAt: 1 });

      socket.emit("loadMessages", stripHiddenMessages(conversation));
    } catch (error) {
      console.log("Error loading conversation:", error);
    }
  });
}

// Sends all past messages to a newly connected client.
async function loadInitialMessages(socket: Socket) {
  try {
    const pastMessages = await Message.find().sort({ createdAt: 1 });
    socket.emit("loadMessages", stripHiddenMessages(pastMessages));
  } catch (error) {
    console.log("Error loading past messages:", error);
  }
}
