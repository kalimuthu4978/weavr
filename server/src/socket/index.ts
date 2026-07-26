import { Server } from "socket.io";
import http from "http";
import { handleUserOnline, registerDisconnect, registerStatusChange } from "./presence";
import { registerMessageHandlers } from "./messageHandlers";
import { registerGroupHandlers } from "./groupHandlers";


// Creates the Socket.io server and wires up the connection handler.
// On each connection it delegates to the specialized handler modules,
// so this file stays a short "table of contents" for the socket layer.
export function setupSocket(httpServer: http.Server, allowedOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
    },
  });

  io.on("connection", async (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log("A user connected:", socket.id, "userId:", userId);

    // Presence + room joining (only if we know who this is)
    if (userId) {
      await handleUserOnline(io, socket, userId);
    }

    // One-on-one message listeners
    registerMessageHandlers(io, socket, userId);

    // Group message listeners
    registerGroupHandlers(io, socket, userId);

    // Presence status change listener
    registerStatusChange(io, socket, userId);

    // Handle this socket disconnecting
    registerDisconnect(io, socket, userId);
  });

  return io;
}
