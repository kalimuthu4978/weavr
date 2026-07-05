import { useEffect, useState } from "react";
import socket from "../socket";
import type { StoredUser } from "../auth/session";
import { fetchUsers } from "../api/users";
import type { ContactUser } from "../api/users";

type ChatMessage = {
  _id: string;
  text: string;
  sender: string;
  receiver: string;
  createdAt: string;
};

type ChatScreenProps = {
  currentUser: StoredUser;
  onLogout: () => void;
};

function ChatScreen({ currentUser, onLogout }: ChatScreenProps) {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // The list of people I can chat with
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  // The person I'm currently chatting with (null = none selected yet)
  const [selectedContact, setSelectedContact] = useState<ContactUser | null>(
    null
  );

  // --- Load the contact list once when the chat opens ---
  useEffect(() => {
    async function loadContacts() {
      try {
        const users = await fetchUsers();
        setContacts(users);
      } catch (error) {
        console.log("Could not load contacts:", error);
      }
    }
    loadContacts();
  }, []);

  // --- Socket listeners (connection + incoming messages) ---
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }
    function onLoadMessages(pastMessages: ChatMessage[]) {
      setMessages(pastMessages);
    }
    function onReceiveMessage(newMessage: ChatMessage) {
      // Only add it if it belongs to the conversation I'm currently viewing.
      // (A message could arrive from someone I'm not looking at right now.)
      setSelectedContact((currentlySelected) => {
        if (currentlySelected === null) {
          return currentlySelected;
        }

        const involvesSelected =
          newMessage.sender === currentlySelected._id ||
          newMessage.receiver === currentlySelected._id;

        if (involvesSelected) {
          setMessages((previous) => {
            // If a message with this _id is already in the list, don't add it
            // again. This makes receiving a message idempotent, so even if the
            // same message is delivered twice it only shows once.
            const alreadyExists = previous.some(
              (existing) => existing._id === newMessage._id
            );
            if (alreadyExists) {
              return previous; // skip the duplicate
            }
            return [...previous, newMessage];
          });
        }
        return currentlySelected;
      });
    }

    // Safety: remove any leftover listeners before adding fresh ones,
    // so we never stack duplicates.
    socket.off("receiveMessage");
    socket.off("loadMessages");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("loadMessages", onLoadMessages);
    socket.on("receiveMessage", onReceiveMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("loadMessages", onLoadMessages);
      socket.off("receiveMessage", onReceiveMessage);
    };
  }, []);

  // --- When I pick a contact, load that conversation ---
  function handleSelectContact(contact: ContactUser) {
    setSelectedContact(contact);
    setMessages([]); // clear the old conversation while the new one loads
    socket.emit("getConversation", contact._id);
  }

  // --- Send a message to the selected contact ---
  function handleSendMessage() {
    if (message.trim() === "") {
      return;
    }
    if (selectedContact === null) {
      return; // nobody selected, nothing to do
    }

    socket.emit("sendMessage", {
      text: message,
      receiverId: selectedContact._id,
    });
    setMessage("");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-600 to-blue-500 text-white">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Weavr logo" className="w-9 h-9" />
          <span className="text-xl font-bold">Weavr</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {isConnected ? "● Connected" : "● Offline"}
          </span>
          <span className="text-sm">Hi, {currentUser.username}</span>
          <button
            onClick={onLogout}
            className="bg-white/20 hover:bg-white/30 text-sm font-semibold px-3 py-1 rounded-lg transition"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Main area: contacts on the left, chat on the right */}
      <div className="flex-1 flex gap-4 px-6 pb-6 overflow-hidden">

        {/* Contacts list */}
        <div className="bg-white text-gray-800 rounded-xl w-64 flex flex-col shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
            Contacts
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-4 px-2">
                No other users yet. Sign up a second account to chat.
              </p>
            ) : (
              contacts.map((contact) => {
                const isSelected =
                  selectedContact !== null &&
                  selectedContact._id === contact._id;
                return (
                  <button
                    key={contact._id}
                    onClick={() => handleSelectContact(contact)}
                    className={
                      "w-full text-left px-4 py-3 hover:bg-purple-50 transition " +
                      (isSelected ? "bg-purple-100 font-semibold" : "")
                    }
                  >
                    {contact.username}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation panel */}
        <div className="bg-white text-gray-800 rounded-xl flex-1 flex flex-col shadow-lg overflow-hidden">
          {selectedContact === null ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Pick a contact to start chatting
            </div>
          ) : (
            <>
              {/* Who I'm talking to */}
              <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
                {selectedContact.username}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center mt-4">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((singleMessage) => {
                    // Is this message from me? Then align it right and colour it.
                    const isMine = singleMessage.sender === currentUser.id;
                    return (
                      <div
                        key={singleMessage._id}
                        className={
                          "max-w-[70%] px-3 py-2 rounded-lg " +
                          (isMine
                            ? "bg-purple-600 text-white ml-auto"
                            : "bg-purple-100 text-purple-900")
                        }
                      >
                        {singleMessage.text}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-3 flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                  placeholder={"Message " + selectedContact.username + "..."}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default ChatScreen;
