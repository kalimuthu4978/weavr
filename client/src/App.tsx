import { useEffect, useState } from "react";
import socket from "./socket";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");             // the text being typed
  const [messages, setMessages] = useState<string[]>([]); // all messages received so far

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    // Runs whenever the server sends a message to us
    function onReceiveMessage(newMessage: string) {
      // Add the new message to the end of the existing list.
      // The "previousMessages" form makes sure we always build on the
      // latest list, even if several messages arrive close together.
      setMessages((previousMessages) => [...previousMessages, newMessage]);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receiveMessage", onReceiveMessage);

    // Cleanup: remove listeners when the component goes away
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receiveMessage", onReceiveMessage);
    };
  }, []);

  // Called when the user clicks Send or presses Enter
  function handleSendMessage() {
    // Ignore empty or spaces-only messages
    if (message.trim() === "") {
      return;
    }

    // Send the typed text to the server on the "sendMessage" channel
    socket.emit("sendMessage", message);

    // Clear the input box
    setMessage("");
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-600 to-blue-500 text-white px-6 py-8">

      {/* Compact Weavr header */}
      <div className="flex items-center gap-3 mb-4">
        <img src="/logo.png" alt="Weavr logo" className="w-10 h-10" />
        <span className="text-2xl font-bold">Weavr</span>
      </div>

      {/* Connection status */}
      <div className="text-sm mb-4">
        {isConnected ? (
          <span className="bg-green-500 px-3 py-1 rounded-full">● Connected</span>
        ) : (
          <span className="bg-red-500 px-3 py-1 rounded-full">● Not connected</span>
        )}
      </div>

      {/* Chat panel */}
      <div className="bg-white text-gray-800 rounded-xl w-full max-w-md flex flex-col h-[500px] shadow-lg">

        {/* Message list (scrolls once it fills up) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-center mt-4">
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((singleMessage, index) => (
              <div
                key={index}
                className="bg-purple-100 text-purple-900 px-3 py-2 rounded-lg"
              >
                {singleMessage}
              </div>
            ))
          )}
        </div>

        {/* Input row */}
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              // Send when the Enter key is pressed
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSendMessage}
            className="bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            Send
          </button>
        </div>

      </div>

    </div>
  );
}

export default App;