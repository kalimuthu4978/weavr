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
    // Live status per user id, e.g. { "6a49f9...": "online" }
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    // How many unread messages per user id, e.g. { "6a49f9...": 3 }
    // Unread message IDs per user id, e.g. { "6a49f9...": ["msgId1", "msgId2"] }
    const [unreadIds, setUnreadIds] = useState<Record<string, string[]>>({});

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

                // Seed the status map with each contact's current status from the DB
                const initialStatus: Record<string, string> = {};
                users.forEach((oneUser) => {
                    initialStatus[oneUser._id] = oneUser.status;
                });
                setStatusMap(initialStatus);
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
        function onUserStatusChanged(data: { userId: string; status: string }) {
            // Update just this one user's status in the map
            setStatusMap((previous) => {
                const updated = { ...previous };
                updated[data.userId] = data.status;
                return updated;
            });
        }
        function onReceiveMessage(newMessage: ChatMessage) {
            setSelectedContact((currentlySelected) => {
                // Figure out who the "other person" in this message is.
                // If I'm the sender, the other person is the receiver, and vice versa.
                const otherPersonId =
                    newMessage.sender === currentUser.id
                        ? newMessage.receiver
                        : newMessage.sender;

                const isForOpenChat =
                    currentlySelected !== null &&
                    currentlySelected._id === otherPersonId;

                if (isForOpenChat) {
                    // I'm looking at this conversation -> just show the message
                    setMessages((previous) => {
                        const alreadyExists = previous.some(
                            (existing) => existing._id === newMessage._id
                        );
                        if (alreadyExists) {
                            return previous;
                        }
                        return [...previous, newMessage];
                    });
                } else {
                    // Message is for a chat I'm NOT viewing -> record it as unread,
                    // but only if we haven't already counted this exact message id.
                    if (newMessage.sender !== currentUser.id) {
                        setUnreadIds((previous) => {
                            const existingIds = previous[otherPersonId] || [];

                            // If this message id is already recorded, do nothing (no double count)
                            if (existingIds.includes(newMessage._id)) {
                                return previous;
                            }

                            const updated = { ...previous };
                            updated[otherPersonId] = [...existingIds, newMessage._id];
                            return updated;
                        });
                    }
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
        socket.on("userStatusChanged", onUserStatusChanged);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("loadMessages", onLoadMessages);
            socket.off("receiveMessage", onReceiveMessage);
            socket.off("userStatusChanged", onUserStatusChanged);
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
                                            "w-full text-left px-4 py-3 hover:bg-purple-50 transition flex items-center gap-2 " +
                                            (isSelected ? "bg-purple-100 font-semibold" : "")
                                        }
                                    >
                                        {/* Online/offline dot */}
                                        <span
                                            className={
                                                "w-2.5 h-2.5 rounded-full " +
                                                (statusMap[contact._id] === "online"
                                                    ? "bg-green-500"
                                                    : "bg-gray-300")
                                            }
                                        ></span>

                                        {/* Username takes the available space */}
                                        <span className="flex-1">{contact.username}</span>

                                        {/* Unread badge - shows the number of unread message ids */}
                                        {unreadIds[contact._id] && unreadIds[contact._id].length > 0 && (
                                            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                                {unreadIds[contact._id].length}
                                            </span>
                                        )}
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
