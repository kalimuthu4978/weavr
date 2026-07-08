import { io } from "socket.io-client";
import { getStoredUser } from "./auth/session";
import { API_BASE_URL } from "./config";

const storedUser = getStoredUser();

const socket = io(API_BASE_URL, {
  autoConnect: false,
  auth: {
    userId: storedUser ? storedUser.id : null,
  },
});

export default socket;