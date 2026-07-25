import { Server, Socket } from "socket.io";
import Group from "../models/Group";
import GroupMessage from "../models/GroupMessage";

// Registers all group message listeners for a connected socket.
export function registerGroupHandlers(io: Server, socket: Socket, userId: string) {
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
}
