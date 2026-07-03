import { io } from "socket.io-client";

// The address of our backend server (where Socket.io is running)
const SERVER_URL = "http://localhost:5000";

// Create ONE socket connection that the whole app will share
const socket = io(SERVER_URL);

export default socket;