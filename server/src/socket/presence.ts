import { Server, Socket } from "socket.io";
import User from "../models/User";
import Group from "../models/Group";

// Handles a user coming online: mark status, join their personal room,
// and join a room for each group they belong to.
export async function handleUserOnline(io: Server, socket: Socket, userId: string) {
  // Join a room named after the user's own id (used for 1-on-1 delivery)
  socket.join(userId);

  // Mark this user online in the database, then tell everyone
  try {
    await User.findByIdAndUpdate(userId, { status: "online" });
    io.emit("userStatusChanged", { userId: userId, status: "online" });
  } catch (error) {
    console.log("Error setting user online:", error);
  }

  // Join a room for every group this user belongs to,
  // so they receive messages sent to any of their groups.
  try {
    const myGroups = await Group.find({ members: userId });
    myGroups.forEach((oneGroup: any) => {
      socket.join(oneGroup._id.toString());
    });
  } catch (error) {
    console.log("Error joining group rooms:", error);
  }
}

// Handles a user going offline (on disconnect): mark status and tell everyone.
export function registerDisconnect(io: Server, socket: Socket, userId: string) {
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
}
