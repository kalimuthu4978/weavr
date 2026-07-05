import { io } from "socket.io-client";
import { getStoredUser } from "./auth/session";

const SERVER_URL = "http://localhost:5000";

// Read the logged-in user (if any) so we can tell the server who we are
const storedUser = getStoredUser();

// Pass the user id along with the connection using "auth"
const socket = io(SERVER_URL, {
  auth: {
    userId: storedUser ? storedUser.id : null,
  },
});

export default socket;