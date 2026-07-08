import { useEffect, useState } from "react";
import socket from "../socket";
import type { StoredUser } from "../auth/session";
import { fetchUsers } from "../api/users";
import type { ContactUser } from "../api/users";
import ProfilePanel from "./ProfilePanel";
import { searchMessages } from "../api/messages";
import type { SearchResultMessage } from "../api/messages";
import { fetchGroups, fetchGroupMessages } from "../api/groups";
import type { Group } from "../api/groups";
import CreateGroupPanel from "./CreateGroupPanel";
import { uploadFile } from "../api/upload";


type ChatMessage = {
    _id: string;
    text: string;
    sender: string;
    receiver: string;
    fileUrl?: string;    // optional - present only for image messages
    fileName?: string;
    fileType?: string;
    createdAt: string;
};


type GroupMessage = {
    _id: string;
    text: string;
    sender: string;
    group: string;
    createdAt: string;
};
type ChatScreenProps = {
    currentUser: StoredUser;
    onLogout: () => void;
    onProfileUpdated: (updatedUser: StoredUser) => void;
};

function ChatScreen({ currentUser, onLogout, onProfileUpdated }: ChatScreenProps) {
    const [showProfile, setShowProfile] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [groups, setGroups] = useState<Group[]>([]);
    // Global search (across all conversations)
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultMessage[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [groupMessageText, setGroupMessageText] = useState("");
    // Live status per user id, e.g. { "6a49f9...": "online" }
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    // How many unread messages per user id, e.g. { "6a49f9...": 3 }
    // Unread message IDs per user id, e.g. { "6a49f9...": ["msgId1", "msgId2"] }
    const [unreadIds, setUnreadIds] = useState<Record<string, string[]>>({});

    // An image that's been uploaded but not sent yet (staged for sending)
    const [pendingFileUrl, setPendingFileUrl] = useState("");
    const [pendingFileName, setPendingFileName] = useState("");
    const [pendingFileType, setPendingFileType] = useState("");

    const [isUploading, setIsUploading] = useState(false);

    // The list of people I can chat with
    const [contacts, setContacts] = useState<ContactUser[]>([]);
    // The person I'm currently chatting with (null = none selected yet)
    const [selectedContact, setSelectedContact] = useState<ContactUser | null>(
        null
    );
    const selectedContactName = selectedContact?.username ?? "";
    const selectedContactStatusMessage = selectedContact?.statusMessage ?? "";

    // --- Load the contact list once when the chat opens ---
    // --- Load the contact list and groups once when the chat opens ---
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

        async function loadGroups() {
            try {
                const myGroups = await fetchGroups();
                setGroups(myGroups);
            } catch (error) {
                console.log("Could not load groups:", error);
            }
        }

        loadContacts();
        loadGroups();
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
        function onReceiveGroupMessage(newGroupMessage: GroupMessage) {
            // Only show it if it belongs to the group I'm currently viewing.
            setSelectedGroup((currentlyOpenGroup) => {
                if (
                    currentlyOpenGroup !== null &&
                    currentlyOpenGroup._id === newGroupMessage.group
                ) {
                    setGroupMessages((previous) => {
                        // Dedupe by _id (same idempotency guard as 1-on-1 messages)
                        const alreadyExists = previous.some(
                            (existing) => existing._id === newGroupMessage._id
                        );
                        if (alreadyExists) {
                            return previous;
                        }
                        return [...previous, newGroupMessage];
                    });
                }
                return currentlyOpenGroup;
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
        socket.off("receiveGroupMessage");

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("loadMessages", onLoadMessages);
        socket.on("receiveMessage", onReceiveMessage);
        socket.on("userStatusChanged", onUserStatusChanged);
        socket.on("receiveGroupMessage", onReceiveGroupMessage);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("loadMessages", onLoadMessages);
            socket.off("receiveMessage", onReceiveMessage);
            socket.off("userStatusChanged", onUserStatusChanged);
            socket.off("receiveGroupMessage", onReceiveGroupMessage);
        };
    }, []);

    // --- When I pick a contact, load that conversation ---
    function handleSelectContact(contact: ContactUser) {
        setSelectedGroup(null);   // <-- clear group when picking a person
        setSelectedContact(contact);
        setMessages([]);
        setSearchTerm("");
        socket.emit("getConversation", contact._id);

        setUnreadIds((previous) => {
            const updated = { ...previous };
            updated[contact._id] = [];
            return updated;
        });
    }

    // --- When I pick a group, open it and load its history ---
    async function handleSelectGroup(group: Group) {
        // A group and a contact are mutually exclusive - clear the contact
        setSelectedContact(null);
        setSelectedGroup(group);
        setGroupMessages([]); // clear old group messages while loading
        setSearchTerm("");

        try {
            const history = await fetchGroupMessages(group._id);
            setGroupMessages(history);
        } catch (error) {
            console.log("Could not load group messages:", error);
        }
    }

    // --- Send a message to the selected contact ---
    function handleSendMessage() {
        if (selectedContact === null) {
            return;
        }

        const hasText = message.trim() !== "";
        const hasImage = pendingFileUrl !== "";

        // Nothing to send
        if (!hasText && !hasImage) {
            return;
        }

        socket.emit("sendMessage", {
            text: message,
            receiverId: selectedContact._id,
            fileUrl: pendingFileUrl,   // "" if no image staged
            fileName: pendingFileName,
            fileType: pendingFileType,
        });

        // Clear both the text and the staged image
        setMessage("");
        setPendingFileUrl("");
        setPendingFileName("");
        setPendingFileType("");
    }
    // --- Send a message to the currently open group ---
    function handleSendGroupMessage() {
        if (groupMessageText.trim() === "") {
            return;
        }
        if (selectedGroup === null) {
            return; // no group open, nothing to do
        }

        socket.emit("sendGroupMessage", {
            text: groupMessageText,
            groupId: selectedGroup._id,
        });
        setGroupMessageText("");
    }
    async function handleGlobalSearch() {
        const term = globalSearchTerm.trim();

        if (term === "") {
            setSearchResults([]);
            setHasSearched(false);   // <-- empty search exits search mode
            return;
        }

        setHasSearched(true);      // <-- we've now run a search
        setIsSearching(true);
        try {
            const results = await searchMessages(term);
            setSearchResults(results);
        } catch (error) {
            console.log("Search error:", error);
            setSearchResults([]);
        }
        setIsSearching(false);
    }

    function handleOpenSearchResult(result: SearchResultMessage) {
        // Whoever isn't me is the conversation partner
        const otherPersonId =
            result.sender === currentUser.id ? result.receiver : result.sender;

        // Find that contact in our contacts list
        const matchingContact = contacts.find(
            (oneContact) => oneContact._id === otherPersonId
        );

        if (matchingContact) {
            handleSelectContact(matchingContact); // opens that conversation
            // Clear the search after jumping in
            setGlobalSearchTerm("");
            setSearchResults([]);
            setHasSearched(false);
        }
    }
    // Called when the user picks an image file to send
    // Called when the user picks an image: upload it and stage it for sending
    async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }
        const file = files[0];

        setIsUploading(true);
        try {
            const uploadResult = await uploadFile(file);
            setPendingFileUrl(uploadResult.fileUrl);
            setPendingFileName(uploadResult.fileName);
            setPendingFileType(uploadResult.fileType);
        } catch (error) {
            console.log("Could not upload image:", error);
        }
        setIsUploading(false);

        // Reset the input so the same file can be re-picked later
        event.target.value = "";
    }
    // Make a sorted copy of contacts: those with unread messages come first.
    // We copy the array first (with the spread) so we never mutate state directly.
    const sortedContacts = [...contacts].sort((firstContact, secondContact) => {
        const firstUnread = unreadIds[firstContact._id]
            ? unreadIds[firstContact._id].length
            : 0;
        const secondUnread = unreadIds[secondContact._id]
            ? unreadIds[secondContact._id].length
            : 0;

        // Higher unread count should come first (descending order)
        return secondUnread - firstUnread;
    });
    // Filter the open conversation by the search term (case-insensitive).
    // Empty box = show everything.
    const searchTermLower = searchTerm.trim().toLowerCase();
    const filteredMessages =
        searchTermLower === ""
            ? messages
            : messages.filter((oneMessage) =>
                oneMessage.text.toLowerCase().includes(searchTermLower)
            );
    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-purple-600 to-blue-500 text-white overflow-hidden">
            {showProfile && (
                <ProfilePanel
                    currentUser={currentUser}
                    onClose={() => setShowProfile(false)}
                    onProfileUpdated={(updatedUser) => {
                        onProfileUpdated(updatedUser);
                        setShowProfile(false);
                    }}
                />
            )}
            {showCreateGroup && (
                <CreateGroupPanel
                    contacts={contacts}
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={(newGroup) => {
                        // Add the new group to the list right away
                        setGroups((previous) => [newGroup, ...previous]);
                        setShowCreateGroup(false);

                        // Reconnect the socket so it joins the new group's room.
                        // (Rooms are joined on connect; a brand-new group needs a
                        // fresh connect for live messages to reach us.)
                        socket.disconnect();
                        socket.connect();
                    }}
                />
            )}
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
                        onClick={() => setShowProfile(true)}
                        className="bg-white/20 hover:bg-white/30 text-sm font-semibold px-3 py-1 rounded-lg transition"
                    >
                        Profile
                    </button>
                    <button
                        onClick={onLogout}
                        className="bg-white/20 hover:bg-white/30 text-sm font-semibold px-3 py-1 rounded-lg transition"
                    >
                        Log out
                    </button>
                </div>
            </div>

            {/* Main area: contacts on the left, chat on the right */}
            <div className="flex-1 flex gap-4 px-6 pb-6 overflow-hidden min-h-0">

                {/* Contacts list */}
                {/* Contacts panel (also holds search + results) */}
                <div className="bg-white text-gray-800 rounded-xl w-72 flex flex-col shadow-lg overflow-hidden">

                    {/* Search box - pinned at the very top of the panel */}
                    <div className="px-3 py-3 border-b border-gray-200">
                        <input
                            type="text"
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleGlobalSearch();
                                }
                            }}
                            placeholder="Search all chats..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    {hasSearched ? (
                        // --- SEARCH MODE: results replace the contact list ---
                        <div className="flex-1 overflow-y-auto">
                            <div className="px-4 py-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500">
                                    {searchResults.length} result(s)
                                </span>
                                <button
                                    onClick={() => {
                                        setGlobalSearchTerm("");
                                        setSearchResults([]);
                                        setHasSearched(false);
                                    }}
                                    className="text-xs text-purple-600 hover:underline"
                                >
                                    Back to contacts
                                </button>
                            </div>

                            {searchResults.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center mt-4 px-2">
                                    Press Enter to search. No results to show yet.
                                </p>
                            ) : (
                                searchResults.map((result) => {
                                    // Work out who the conversation is with, for a small label
                                    const otherPersonId =
                                        result.sender === currentUser.id
                                            ? result.receiver
                                            : result.sender;
                                    const otherContact = contacts.find(
                                        (c) => c._id === otherPersonId
                                    );
                                    return (
                                        <button
                                            key={result._id}
                                            onClick={() => handleOpenSearchResult(result)}
                                            className="w-full text-left px-4 py-2 hover:bg-purple-50 transition"
                                        >
                                            <div className="text-xs text-purple-600 font-semibold">
                                                {otherContact ? otherContact.username : "Unknown"}
                                            </div>
                                            <div className="text-sm text-gray-800 truncate">
                                                {result.text}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        // --- NORMAL MODE: the contact list ---
                        <>
                            {/* Groups section */}
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <span className="font-semibold text-purple-700">Groups</span>
                                <button
                                    onClick={() => setShowCreateGroup(true)}
                                    className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-1 rounded-lg hover:bg-purple-200 transition"
                                >
                                    + New
                                </button>
                            </div>
                            <div className="border-b border-gray-200">
                                {groups.length === 0 ? (
                                    <p className="text-gray-400 text-sm px-4 py-2">
                                        No groups yet.
                                    </p>
                                ) : (
                                    groups.map((oneGroup) => (
                                        <button
                                            key={oneGroup._id}
                                            onClick={() => handleSelectGroup(oneGroup)}
                                            className="w-full text-left px-4 py-3 hover:bg-purple-50 transition flex items-center gap-2"
                                        >
                                            {/* A simple group icon using initials */}
                                            <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-700 text-xs font-bold flex items-center justify-center">
                                                {oneGroup.name
                                                    ? oneGroup.name.charAt(0).toUpperCase()
                                                    : "?"}
                                            </span>
                                            <span className="flex-1">
                                                {oneGroup.name || "Unnamed group"}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
                                Contacts
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {contacts.length === 0 ? (
                                    <p className="text-gray-400 text-sm text-center mt-4 px-2">
                                        No other users yet. Sign up a second account to chat.
                                    </p>
                                ) : (
                                    sortedContacts.map((contact) => {
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
                                                <span
                                                    className={
                                                        "w-2.5 h-2.5 rounded-full " +
                                                        (statusMap[contact._id] === "online"
                                                            ? "bg-green-500"
                                                            : "bg-gray-300")
                                                    }
                                                ></span>
                                                <span
                                                    className={
                                                        "flex-1 " +
                                                        (unreadIds[contact._id] &&
                                                            unreadIds[contact._id].length > 0
                                                            ? "font-bold"
                                                            : "")
                                                    }
                                                >
                                                    {contact.username}
                                                </span>
                                                {unreadIds[contact._id] &&
                                                    unreadIds[contact._id].length > 0 && (
                                                        <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                                            {unreadIds[contact._id].length}
                                                        </span>
                                                    )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Conversation panel */}
                <div className="bg-white text-gray-800 rounded-xl flex-1 flex flex-col shadow-lg overflow-hidden">
                    {selectedContact === null && selectedGroup === null ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            Pick a contact or group to start chatting
                        </div>
                    ) : selectedGroup !== null ? (
                        // --- GROUP VIEW ---
                        <>
                            {/* Group header */}
                            <div className="px-4 py-3 border-b border-gray-200">
                                <div className="font-semibold text-purple-700">
                                    {selectedGroup.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {selectedGroup.members.length} members
                                </div>
                            </div>

                            {/* Group messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {groupMessages.length === 0 ? (
                                    <p className="text-gray-400 text-center mt-4">
                                        No messages yet. Start the conversation!
                                    </p>
                                ) : (
                                    groupMessages.map((oneMessage) => {
                                        const isMine = oneMessage.sender === currentUser.id;
                                        return (
                                            <div
                                                key={oneMessage._id}
                                                className={
                                                    "max-w-[70%] px-3 py-2 rounded-lg " +
                                                    (isMine
                                                        ? "bg-purple-600 text-white ml-auto"
                                                        : "bg-purple-100 text-purple-900")
                                                }
                                            >
                                                {oneMessage.text}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Group input */}
                            <div className="border-t border-gray-200 p-3 flex gap-2">
                                <input
                                    type="text"
                                    value={groupMessageText}
                                    onChange={(e) => setGroupMessageText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSendGroupMessage();
                                        }
                                    }}
                                    placeholder={"Message " + selectedGroup.name + "..."}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                                />
                                <button
                                    onClick={handleSendGroupMessage}
                                    className="bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                >
                                    Send
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Header row: contact info on the left, search on the right */}
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">

                                {/* Who I'm talking to */}
                                <div>
                                    <div className="font-semibold text-purple-700">
                                        {selectedContact.username}
                                    </div>
                                    {selectedContact.statusMessage &&
                                        selectedContact.statusMessage.trim() !== "" && (
                                            <div className="text-xs text-gray-500">
                                                {selectedContact.statusMessage}
                                            </div>
                                        )}
                                </div>

                                {/* Search within this conversation */}
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search messages..."
                                    className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {messages.length === 0 ? (
                                    <p className="text-gray-400 text-center mt-4">
                                        No messages yet. Say hello!
                                    </p>
                                ) : filteredMessages.length === 0 ? (
                                    <p className="text-gray-400 text-center mt-4">
                                        No messages match "{searchTerm}"
                                    </p>
                                ) : (
                                    filteredMessages.map((singleMessage) => {
                                        const isMine = singleMessage.sender === currentUser.id;
                                        const isImage = singleMessage.fileType === "image";
                                        const isFile =
                                            singleMessage.fileType === "file" &&
                                            singleMessage.fileUrl !== "";
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
                                                {isImage ? (
                                                    <img
                                                        src={singleMessage.fileUrl}
                                                        alt={singleMessage.fileName || "image"}
                                                        className="rounded-lg max-w-full max-h-64 cursor-pointer"
                                                    />
                                                ) : isFile ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl">📄</span>
                                                        <span className="text-sm underline cursor-pointer">
                                                            {singleMessage.fileName || "File"}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    singleMessage.text
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {/* Staged file preview (shows before sending) */}
                            {pendingFileUrl !== "" && (
                                <div className="border-t border-gray-200 px-3 pt-3 flex items-center gap-3">
                                    {pendingFileType === "image" ? (
                                        <img
                                            src={pendingFileUrl}
                                            alt="preview"
                                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-2xl">
                                            📄
                                        </div>
                                    )}
                                    <span className="text-sm text-gray-600 flex-1 truncate">
                                        {pendingFileName}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setPendingFileUrl("");
                                            setPendingFileName("");
                                            setPendingFileType("");
                                        }}
                                        className="text-red-500 text-sm hover:underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                            {/* Input */}
                            <div className="border-t border-gray-200 p-3 flex gap-2 items-center">
                                {/* Hidden file input, triggered by the button below */}
                                <input
                                    type="file"
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    id="imageUpload"
                                    onChange={handleFileSelected}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="imageUpload"
                                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg transition"
                                    title="Send an image"
                                >
                                    📎
                                </label>

                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder={
                                        isUploading
                                            ? "Uploading image..."
                                            : pendingFileUrl !== ""
                                                ? "Add a caption (optional) and hit Send"
                                                : "Message " + selectedContact.username + "..."
                                    }
                                    disabled={isUploading}
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
