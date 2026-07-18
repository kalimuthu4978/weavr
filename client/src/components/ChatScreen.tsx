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
    fileUrl?: string;
    fileName?: string;
    fileType?: string; // "image" | "file" | ""
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
    onOpenAdmin: () => void;
};

function ChatScreen({ currentUser, onLogout, onProfileUpdated, onOpenAdmin }: ChatScreenProps) {
    const [showProfile, setShowProfile] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [groups, setGroups] = useState<Group[]>([]);
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultMessage[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [groupMessageText, setGroupMessageText] = useState("");
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [unreadIds, setUnreadIds] = useState<Record<string, string[]>>({});
    // Unread group message IDs per group id, e.g. { "6a4b5d...": ["msgId1"] }
    const [groupUnreadIds, setGroupUnreadIds] = useState<Record<string, string[]>>({});
    const [groupSearchTerm, setGroupSearchTerm] = useState("");
    const [pendingFileUrl, setPendingFileUrl] = useState("");
    const [pendingFileName, setPendingFileName] = useState("");
    const [pendingFileType, setPendingFileType] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const [contacts, setContacts] = useState<ContactUser[]>([]);
    const [selectedContact, setSelectedContact] = useState<ContactUser | null>(null);

    const [openFile, setOpenFile] = useState<{
        url: string;
        name: string;
        type: string;
    } | null>(null);

    useEffect(() => {
        async function loadContacts() {
            try {
                const users = await fetchUsers();
                setContacts(users);
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
            setStatusMap((previous) => {
                const updated = { ...previous };
                updated[data.userId] = data.status;
                return updated;
            });
        }
        function onReceiveGroupMessage(newGroupMessage: GroupMessage) {
            setSelectedGroup((currentlyOpenGroup) => {
                const isForOpenGroup =
                    currentlyOpenGroup !== null &&
                    currentlyOpenGroup._id === newGroupMessage.group;

                if (isForOpenGroup) {
                    // I'm viewing this group -> show the message
                    setGroupMessages((previous) => {
                        const alreadyExists = previous.some(
                            (existing) => existing._id === newGroupMessage._id
                        );
                        if (alreadyExists) {
                            return previous;
                        }
                        return [...previous, newGroupMessage];
                    });
                } else {
                    // Message is for a group I'm NOT viewing -> count it as unread.
                    // Don't badge my own messages (they echo back to me).
                    if (newGroupMessage.sender !== currentUser.id) {
                        setGroupUnreadIds((previous) => {
                            const existingIds = previous[newGroupMessage.group] || [];

                            // Same idempotency guard: don't count the same message twice
                            if (existingIds.includes(newGroupMessage._id)) {
                                return previous;
                            }

                            const updated = { ...previous };
                            updated[newGroupMessage.group] = [
                                ...existingIds,
                                newGroupMessage._id,
                            ];
                            return updated;
                        });
                    }
                }

                return currentlyOpenGroup;
            });
        }
        function onReceiveMessage(newMessage: ChatMessage) {
            setSelectedContact((currentlySelected) => {
                const otherPersonId =
                    newMessage.sender === currentUser.id
                        ? newMessage.receiver
                        : newMessage.sender;

                const isForOpenChat =
                    currentlySelected !== null &&
                    currentlySelected._id === otherPersonId;

                if (isForOpenChat) {
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
                    if (newMessage.sender !== currentUser.id) {
                        setUnreadIds((previous) => {
                            const existingIds = previous[otherPersonId] || [];
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

    function handleSelectContact(contact: ContactUser) {
        setSelectedGroup(null);
        setSelectedContact(contact);
        setMessages([]);
        setSearchTerm("");
        setGroupSearchTerm("");
        socket.emit("getConversation", contact._id);

        setUnreadIds((previous) => {
            const updated = { ...previous };
            updated[contact._id] = [];
            return updated;
        });
    }

    async function handleSelectGroup(group: Group) {
        setSelectedContact(null);
        setSelectedGroup(group);
        setGroupMessages([]);
        setSearchTerm("");
        setGroupSearchTerm("");

        // Clear the unread badge for this group - we're reading them now
        setGroupUnreadIds((previous) => {
            const updated = { ...previous };
            updated[group._id] = [];
            return updated;
        });

        try {
            const history = await fetchGroupMessages(group._id);
            setGroupMessages(history);
        } catch (error) {
            console.log("Could not load group messages:", error);
        }
    }
    function handleSendMessage() {
        if (selectedContact === null) {
            return;
        }
        const hasText = message.trim() !== "";
        const hasFile = pendingFileUrl !== "";
        if (!hasText && !hasFile) {
            return;
        }
        socket.emit("sendMessage", {
            text: message,
            receiverId: selectedContact._id,
            fileUrl: pendingFileUrl,
            fileName: pendingFileName,
            fileType: pendingFileType,
        });
        setMessage("");
        setPendingFileUrl("");
        setPendingFileName("");
        setPendingFileType("");
    }

    function handleSendGroupMessage() {
        if (groupMessageText.trim() === "") {
            return;
        }
        if (selectedGroup === null) {
            return;
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
            setHasSearched(false);
            return;
        }
        setHasSearched(true);
        try {
            const results = await searchMessages(term);
            setSearchResults(results);
        } catch (error) {
            console.log("Search error:", error);
            setSearchResults([]);
        }
    }

    function handleOpenSearchResult(result: SearchResultMessage) {
        const otherPersonId =
            result.sender === currentUser.id ? result.receiver : result.sender;
        const matchingContact = contacts.find(
            (oneContact) => oneContact._id === otherPersonId
        );
        if (matchingContact) {
            handleSelectContact(matchingContact);
            setGlobalSearchTerm("");
            setSearchResults([]);
            setHasSearched(false);
        }
    }

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
            console.log("Could not upload file:", error);
        }
        setIsUploading(false);
        event.target.value = "";
    }

    const sortedContacts = [...contacts].sort((firstContact, secondContact) => {
        const firstUnread = unreadIds[firstContact._id]
            ? unreadIds[firstContact._id].length
            : 0;
        const secondUnread = unreadIds[secondContact._id]
            ? unreadIds[secondContact._id].length
            : 0;
        return secondUnread - firstUnread;
    });

    const searchTermLower = searchTerm.trim().toLowerCase();
    const filteredMessages =
        searchTermLower === ""
            ? messages
            : messages.filter((oneMessage) =>
                oneMessage.text.toLowerCase().includes(searchTermLower)
            );
    // Filter the open group conversation by its search term (case-insensitive)
    const groupSearchTermLower = groupSearchTerm.trim().toLowerCase();
    const filteredGroupMessages =
        groupSearchTermLower === ""
            ? groupMessages
            : groupMessages.filter((oneMessage) =>
                oneMessage.text.toLowerCase().includes(groupSearchTermLower)
            );
    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-purple-600 to-blue-500 text-white overflow-hidden">
            {currentUser.isAdmin && (
                <button
                    onClick={onOpenAdmin}
                    className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 text-sm font-semibold px-3 py-1 rounded-lg transition"
                >
                    Admin
                </button>
            )}
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
                        setGroups((previous) => [newGroup, ...previous]);
                        setShowCreateGroup(false);
                        socket.disconnect();
                        socket.connect();
                    }}
                />
            )}

            {openFile !== null && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    onClick={() => setOpenFile(null)}
                >
                    <div
                        className="bg-white text-gray-800 rounded-xl shadow-xl max-w-lg w-full p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold text-purple-700 truncate">
                                {openFile.name}
                            </span>
                            <button
                                onClick={() => setOpenFile(null)}
                                className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                            >
                                ✕
                            </button>
                        </div>

                        {openFile.type === "image" ? (
                            <img
                                src={openFile.url}
                                alt={openFile.name}
                                className="w-full max-h-[60vh] object-contain rounded-lg mb-4"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 mb-4">
                                <span className="text-6xl mb-3">📄</span>
                                <span className="text-sm text-gray-500">{openFile.name}</span>
                            </div>
                        )}

                        <a
                            href={openFile.url}
                            download={openFile.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                        >
                            Download
                        </a>
                    </div>
                </div>
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

            {/* Main area */}
            <div className="flex-1 flex gap-4 px-6 pb-6 overflow-hidden min-h-0">

                {/* Contacts panel */}
                <div className="bg-white text-gray-800 rounded-xl w-72 flex flex-col shadow-lg overflow-hidden">
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
                                    No messages found.
                                </p>
                            ) : (
                                searchResults.map((result) => {
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
                        <>
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
                                    groups.map((oneGroup) => {
                                        const unreadCount = groupUnreadIds[oneGroup._id]
                                            ? groupUnreadIds[oneGroup._id].length
                                            : 0;
                                        return (
                                            <button
                                                key={oneGroup._id}
                                                onClick={() => handleSelectGroup(oneGroup)}
                                                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition flex items-center gap-2"
                                            >
                                                <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-700 text-xs font-bold flex items-center justify-center">
                                                    {oneGroup.name
                                                        ? oneGroup.name.charAt(0).toUpperCase()
                                                        : "?"}
                                                </span>
                                                <span
                                                    className={
                                                        "flex-1 " + (unreadCount > 0 ? "font-bold" : "")
                                                    }
                                                >
                                                    {oneGroup.name || "Unnamed group"}
                                                </span>
                                                {unreadCount > 0 && (
                                                    <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
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
                        <>
                            {/* Group header: info left, search right */}
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
                                <div>
                                    <div className="font-semibold text-purple-700">
                                        {selectedGroup.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {selectedGroup.members.length} members
                                    </div>
                                </div>

                                {/* Search within this group */}
                                <input
                                    type="text"
                                    value={groupSearchTerm}
                                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                                    placeholder="Search messages..."
                                    className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            {/* Group messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {groupMessages.length === 0 ? (
                                    <p className="text-gray-400 text-center mt-4">
                                        No messages yet. Start the conversation!
                                    </p>
                                ) : filteredGroupMessages.length === 0 ? (
                                    <p className="text-gray-400 text-center mt-4">
                                        No messages match "{groupSearchTerm}"
                                    </p>
                                ) : (
                                    filteredGroupMessages.map((oneMessage) => {
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
                    ) : selectedContact !== null ? (
                        <>
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
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

                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search messages..."
                                    className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>

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
                                                        onClick={() =>
                                                            setOpenFile({
                                                                url: singleMessage.fileUrl || "",
                                                                name: singleMessage.fileName || "image",
                                                                type: "image",
                                                            })
                                                        }
                                                        className="rounded-lg max-w-full max-h-64 cursor-pointer"
                                                    />
                                                ) : isFile ? (
                                                    <div
                                                        onClick={() =>
                                                            setOpenFile({
                                                                url: singleMessage.fileUrl || "",
                                                                name: singleMessage.fileName || "File",
                                                                type: "file",
                                                            })
                                                        }
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <span className="text-2xl">📄</span>
                                                        <span className="text-sm underline">
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

                            <div className="border-t border-gray-200 p-3 flex gap-2 items-center">
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
                                    title="Send a file"
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
                                            ? "Uploading file..."
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
                    ) : null}
                </div>

            </div>
        </div>
    );
}

export default ChatScreen;
