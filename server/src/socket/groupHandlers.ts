import { Server, Socket } from "socket.io";
import Group from "../models/Group";
import GroupMessage from "../models/GroupMessage";
import { resolveMentionedUserIds } from "../utils/mentions";

// Registers all group message listeners for a connected socket.
export function registerGroupHandlers(io: Server, socket: Socket, userId: string) {
  // Send a message to a whole group
  socket.on("sendGroupMessage", async (data) => {
    try {
      const text = data.text;
      const groupId = data.groupId;
      // These may be undefined for a plain text message - default to empty
      const fileUrl = data.fileUrl || "";
      const fileName = data.fileName || "";
      const fileType = data.fileType || "";

      if (!userId) {
        console.log("Cannot send group message: no userId on socket");
        return;
      }

      // A message must have EITHER text OR a file - reject truly empty ones
      const hasText = text && text.trim() !== "";
      const hasFile = fileUrl !== "";
      if (!hasText && !hasFile) {
        console.log("Blocked empty group message (no text and no file)");
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

      // Work out who was mentioned with @username. Only group members count,
      // so an @ can't be used to ping somebody outside the group.
      const memberIds = group.members.map((oneMemberId: any) =>
        oneMemberId.toString()
      );
      const mentionedIds = await resolveMentionedUserIds(
        text || "",
        userId,
        memberIds
      );

      // Save the group message with whatever it carries
      const newGroupMessage = new GroupMessage({
        text: text || "",
        sender: userId,
        group: groupId,
        fileUrl: fileUrl,
        fileName: fileName,
        fileType: fileType,
        mentions: mentionedIds,
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
