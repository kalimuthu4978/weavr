import { useEffect, useState } from "react";
import socket from "./socket";

function App() {
  // Track whether we're currently connected to the server
  const [isConnected, setIsConnected] = useState(false);

  // useEffect runs once when the component first loads on screen
  useEffect(() => {
    // When the socket connects, update our state to true
    function onConnect() {
      console.log("Connected to server. Socket id:", socket.id);
      setIsConnected(true);
    }

    // When it disconnects, update our state to false
    function onDisconnect() {
      console.log("Disconnected from server");
      setIsConnected(false);
    }

    // Start listening for those two events
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // Cleanup: stop listening when the component is removed,
    // so we don't stack up duplicate listeners
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 text-white px-6">

      <img src="/logo.png" alt="Weavr logo" className="w-24 h-24 mb-6" />

      <h1 className="text-5xl font-bold mb-3">Weavr</h1>

      <p className="text-lg text-purple-100 mb-10">
        Every Conversation Connected
      </p>

      <div className="flex gap-4 mb-10">
        <button className="bg-white text-purple-700 font-semibold px-6 py-3 rounded-lg hover:bg-purple-50 transition">
          Log In
        </button>
        <button className="bg-purple-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-purple-900 transition">
          Sign Up
        </button>
      </div>

      {/* Temporary connection indicator - we'll remove this later */}
      <div className="text-sm">
        {isConnected ? (
          <span className="bg-green-500 px-3 py-1 rounded-full">● Connected to server</span>
        ) : (
          <span className="bg-red-500 px-3 py-1 rounded-full">● Not connected</span>
        )}
      </div>

    </div>
  );
}

export default App;