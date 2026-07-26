import { useEffect, useState, useRef } from "react";
import socket from "../socket";
import type { StoredUser } from "../auth/session";
import { fetchUsers } from "../api/users";
import type { ContactUser } from "../api/users";
import ProfilePanel from "./ProfilePanel";
import { searchMessages, flagMessage } from "../api/messages";
import type { SearchResultMessage, SearchFilters } from "../api/messages";
import { fetchGroups, fetchGroupMessages } from "../api/groups";
import type { Group } from "../api/groups";
import CreateGroupPanel from "./CreateGroupPanel";
import GroupSettingsPanel from "./GroupSettingsPanel";
import PendingFilesStrip from "./PendingFilesStrip";
import MessageContent from "./MessageContent";
import MentionPicker from "./MentionPicker";
import UserProfilePanel from "./UserProfilePanel";
import { getMentionBeingTyped, completeMention } from "../utils/mentions";
import Avatar from "./Avatar";
import { uploadManyFiles } from "../api/upload";
import {
    requestNotificationPermission,
    showMessageNotification,
    buildMessagePreview,
} from "../utils/notifications";

type ChatMessage = {
    _id: string;
    text: string;
    sender: string;
    receiver: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string; // "image" | "video" | "file" | ""
    createdAt: string;
    // Ids of users this message mentions with @username
    mentions?: string[];
    // True when an admin has hidden this message. The server blanks out the
    // content, so all we can do is show a placeholder.
    isHidden?: boolean;
};

type GroupMessage = {
    _id: string;
    text: string;
    sender: string;
    group: string;
    createdAt: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string; // "image" | "video" | "file" | ""
    mentions?: string[];
    isHidden?: boolean;
};

// A file that has been uploaded and is staged, waiting to be sent
type PendingAttachment = {
    url: string;
    name: string;
    type: string; // "image" | "video" | "file"
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
    // Extra filters for the global search. Empty strings mean "don't filter".
    const [searchFilters, setSearchFilters] = useState<SearchFilters>({
        withUser: "",
        from: "",
        to: "",
        contentType: "",
    });
    const [showSearchFilters, setShowSearchFilters] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    // Whose profile to show, or null for none
    const [profileUserId, setProfileUserId] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [groupMessageText, setGroupMessageText] = useState("");
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [unreadIds, setUnreadIds] = useState<Record<string, string[]>>({});
    // Unread group message IDs per group id, e.g. { "6a4b5d...": ["msgId1"] }
    const [groupUnreadIds, setGroupUnreadIds] = useState<Record<string, string[]>>({});
    const [groupSearchTerm, setGroupSearchTerm] = useState("");
    // Files that have been uploaded and are waiting to be sent. Several can be
    // staged at once, and each becomes its own message when Send is pressed.
    const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
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

    // Ask once for permission to show desktop notifications. The browser only
    // prompts the first time; after that it remembers the answer.
    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // The socket listeners below are registered once and never re-created, so
    // they would only ever see the EMPTY contacts array from the first render.
    // Keeping a ref in step with the state gives them a way to read the
    // current contacts when a message arrives.
    const contactsRef = useRef<ContactUser[]>([]);
    const groupsRef = useRef<Group[]>([]);

    useEffect(() => {
        contactsRef.current = contacts;
    }, [contacts]);

    useEffect(() => {
        groupsRef.current = groups;
    }, [groups]);

    // Look up who sent a message, so the notification can name them
    function findSenderName(senderId: string) {
        const matchingContact = contactsRef.current.find(
            (oneContact) => oneContact._id === senderId
        );
        return matchingContact ? matchingContact.username : "Someone";
    }

    // Detect user inactivity and set "away" / "online" status accordingly.
    // Two things can make us "away":
    //   1. No mouse/keyboard activity for IDLE_MS
    //   2. Switching to another browser tab (the tab becomes hidden)
    useEffect(() => {
        let idleTimer: ReturnType<typeof setTimeout> | undefined = undefined;
        let isAway = false;

        // How long with no activity before we count as "away" (2 minutes)
        const IDLE_MS = 2 * 60 * 1000;

        // Send a status to the server, but only when it actually changed.
        // This stops us spamming the server on every mouse move.
        function sendStatus(newStatus: string) {
            const wantsAway = newStatus === "away";
            if (wantsAway === isAway) {
                return;
            }
            isAway = wantsAway;
            console.log("Presence: emitting setStatus ->", newStatus);
            socket.emit("setStatus", newStatus);
        }

        function goAway() {
            sendStatus("away");
        }

        function resetIdleTimer() {
            // Any activity: make sure we're marked online, then restart the countdown
            sendStatus("online");
            clearTimeout(idleTimer);
            idleTimer = setTimeout(goAway, IDLE_MS);
        }

        // Tab switching: hidden means the user is looking at something else
        function handleVisibilityChange() {
            if (document.hidden) {
                clearTimeout(idleTimer);
                goAway();
            } else {
                resetIdleTimer();
            }
        }

        // Activity events that count as "the user is here"
        window.addEventListener("mousemove", resetIdleTimer);
        window.addEventListener("keydown", resetIdleTimer);
        window.addEventListener("click", resetIdleTimer);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Start the countdown immediately
        clearTimeout(idleTimer);
        idleTimer = setTimeout(goAway, IDLE_MS);

        return () => {
            clearTimeout(idleTimer);
            window.removeEventListener("mousemove", resetIdleTimer);
            window.removeEventListener("keydown", resetIdleTimer);
            window.removeEventListener("click", resetIdleTimer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
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
            // Desktop notification for other people's messages. This only
            // actually pops up when the tab is in the background.
            if (newGroupMessage.sender !== currentUser.id) {
                const matchingGroup = groupsRef.current.find(
                    (oneGroup) => oneGroup._id === newGroupMessage.group
                );
                const groupName = matchingGroup ? matchingGroup.name : "a group";
                const senderName = findSenderName(newGroupMessage.sender);

                // A mention gets its own wording so it stands out from the
                // ordinary "new message" notifications.
                const mentionsMe =
                    newGroupMessage.mentions !== undefined &&
                    newGroupMessage.mentions.includes(currentUser.id);
                const notificationTitle = mentionsMe
                    ? senderName + " mentioned you in " + groupName
                    : senderName + " in " + groupName;

                showMessageNotification(
                    notificationTitle,
                    buildMessagePreview(
                        newGroupMessage.text,
                        newGroupMessage.fileType || "",
                        newGroupMessage.fileName || ""
                    )
                );
            }

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
            // Desktop notification for other people's messages. This only
            // actually pops up when the tab is in the background.
            if (newMessage.sender !== currentUser.id) {
                const senderName = findSenderName(newMessage.sender);
                const mentionsMe =
                    newMessage.mentions !== undefined &&
                    newMessage.mentions.includes(currentUser.id);

                showMessageNotification(
                    mentionsMe ? senderName + " mentioned you" : senderName,
                    buildMessagePreview(
                        newMessage.text,
                        newMessage.fileType || "",
                        newMessage.fileName || ""
                    )
                );
            }

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
        // Drop anything staged, so a file picked for one chat can't be sent
        // into a different one by accident
        setPendingFiles([]);
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
        setPendingFiles([]);

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
        const hasFiles = pendingFiles.length > 0;
        if (!hasText && !hasFiles) {
            return;
        }

        if (!hasFiles) {
            // Just a plain text message
            socket.emit("sendMessage", {
                text: message,
                receiverId: selectedContact._id,
                fileUrl: "",
                fileName: "",
                fileType: "",
            });
        } else {
            // One message per attachment. Any typed text rides along with the
            // FIRST one, so it reads as a caption rather than repeating.
            pendingFiles.forEach((oneFile, index) => {
                socket.emit("sendMessage", {
                    text: index === 0 ? message : "",
                    receiverId: selectedContact._id,
                    fileUrl: oneFile.url,
                    fileName: oneFile.name,
                    fileType: oneFile.type,
                });
            });
        }

        setMessage("");
        setPendingFiles([]);
    }

    function handleSendGroupMessage() {
        if (selectedGroup === null) {
            return;
        }
        const hasText = groupMessageText.trim() !== "";
        const hasFiles = pendingFiles.length > 0;
        if (!hasText && !hasFiles) {
            return;
        }

        if (!hasFiles) {
            socket.emit("sendGroupMessage", {
                text: groupMessageText,
                groupId: selectedGroup._id,
                fileUrl: "",
                fileName: "",
                fileType: "",
            });
        } else {
            // Same rule as direct messages: one message per attachment,
            // with the typed text attached to the first.
            pendingFiles.forEach((oneFile, index) => {
                socket.emit("sendGroupMessage", {
                    text: index === 0 ? groupMessageText : "",
                    groupId: selectedGroup._id,
                    fileUrl: oneFile.url,
                    fileName: oneFile.name,
                    fileType: oneFile.type,
                });
            });
        }

        setGroupMessageText("");
        setPendingFiles([]);
    }

    // True when at least one filter is set. Used to allow a filter-only search
    // (e.g. "every image I sent in March") with no keyword typed.
    function hasAnyFilter() {
        return (
            searchFilters.withUser !== "" ||
            searchFilters.from !== "" ||
            searchFilters.to !== "" ||
            searchFilters.contentType !== ""
        );
    }

    async function handleGlobalSearch() {
        const term = globalSearchTerm.trim();

        // Nothing typed AND nothing filtered -> there's nothing to search for
        if (term === "" && !hasAnyFilter()) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }

        setHasSearched(true);
        try {
            const results = await searchMessages(term, searchFilters);
            setSearchResults(results);
        } catch (error) {
            console.log("Search error:", error);
            setSearchResults([]);
        }
    }

    // Change one filter without disturbing the others
    function updateSearchFilter(fieldName: keyof SearchFilters, value: string) {
        setSearchFilters((previous) => {
            const updated = { ...previous };
            updated[fieldName] = value;
            return updated;
        });
    }

    function clearSearch() {
        setGlobalSearchTerm("");
        setSearchResults([]);
        setHasSearched(false);
        setSearchFilters({
            withUser: "",
            from: "",
            to: "",
            contentType: "",
        });
    }

    // Report a message to the admins, asking for a reason first
    async function handleFlagMessage(
        kind: "direct" | "group",
        messageId: string
    ) {
        const reason = window.prompt(
            "Why are you reporting this message? (optional)"
        );
        // prompt returns null when the user presses Cancel
        if (reason === null) {
            return;
        }

        try {
            await flagMessage(kind, messageId, reason);
            window.alert("Thanks - an admin will review this message.");
        } catch (error) {
            if (error instanceof Error) {
                window.alert(error.message);
            } else {
                window.alert("Could not report this message");
            }
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

        // event.target.files is a FileList, not a real array, so convert it
        // before we can loop over it comfortably.
        const chosenFiles = Array.from(files);

        setIsUploading(true);
        try {
            const result = await uploadManyFiles(chosenFiles);

            // Add whatever succeeded to the ones already staged
            if (result.uploaded.length > 0) {
                const newAttachments = result.uploaded.map((oneUpload) => ({
                    url: oneUpload.fileUrl,
                    name: oneUpload.fileName,
                    type: oneUpload.fileType,
                }));
                setPendingFiles((previous) => [...previous, ...newAttachments]);
            }

            // Tell the user about any that didn't make it, rather than
            // silently dropping them
            if (result.failures.length > 0) {
                window.alert(
                    "These files could not be uploaded:\n\n" +
                    result.failures.join("\n")
                );
            }
        } catch (error) {
            console.log("Could not upload files:", error);
        }
        setIsUploading(false);
        // Clear the input so picking the SAME file again still fires a change
        event.target.value = "";
    }

    // Take one staged file back out before sending
    function removePendingFile(indexToRemove: number) {
        setPendingFiles((previous) =>
            previous.filter((_, index) => index !== indexToRemove)
        );
    }

    // --- @mentions ---

    // Who can be mentioned in whatever conversation is open.
    // In a group that's its members; in a direct chat it's the other person.
    const mentionCandidates = selectedGroup !== null
        ? contacts.filter((oneContact) =>
            selectedGroup.members.includes(oneContact._id)
        )
        : selectedContact !== null
            ? contacts.filter(
                (oneContact) => oneContact._id === selectedContact._id
            )
            : [];

    // What's been typed after an "@", or null when not mid-mention.
    // Each composer has its own text, so they're worked out separately.
    const directMentionText = getMentionBeingTyped(message);
    const groupMentionText = getMentionBeingTyped(groupMessageText);

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

            {profileUserId !== null && (
                <UserProfilePanel
                    userId={profileUserId}
                    onClose={() => setProfileUserId(null)}
                />
            )}

            {showGroupSettings && selectedGroup !== null && (
                <GroupSettingsPanel
                    groupId={selectedGroup._id}
                    currentUser={currentUser}
                    allContacts={contacts}
                    onClose={() => setShowGroupSettings(false)}
                    onGroupChanged={async () => {
                        // Reload the group list so a new name, picture or member
                        // count shows up straight away
                        try {
                            const refreshedGroups = await fetchGroups();
                            setGroups(refreshedGroups);

                            // Keep the open conversation's header in step too
                            const stillOpen = refreshedGroups.find(
                                (oneGroup) => oneGroup._id === selectedGroup._id
                            );
                            if (stillOpen) {
                                setSelectedGroup(stillOpen);
                            }
                        } catch (error) {
                            console.log("Could not refresh groups:", error);
                        }
                    }}
                    onLeftGroup={() => {
                        // We're no longer a member, so close everything about it
                        setShowGroupSettings(false);
                        setSelectedGroup(null);
                        setGroupMessages([]);
                        // Reconnect so the server stops sending us this group's
                        // messages (socket rooms are joined on connect)
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
                        ) : openFile.type === "video" ? (
                            <video
                                src={openFile.url}
                                controls
                                autoPlay
                                className="w-full max-h-[60vh] rounded-lg mb-4 bg-black"
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
                    <span
                        className={
                            "text-sm " +
                            (isConnected ? "text-green-200" : "text-red-200")
                        }
                    >
                        {isConnected ? "● Connected" : "● Offline"}
                    </span>

                    <Avatar
                        imageUrl={currentUser.profilePicture}
                        name={currentUser.username}
                        size="small"
                    />
                    <span className="text-sm">Hi, {currentUser.username}</span>

                    {currentUser.isAdmin && (
                        <button
                            onClick={onOpenAdmin}
                            className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 text-sm font-semibold px-3 py-1 rounded-lg transition"
                        >
                            Admin
                        </button>
                    )}

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

                        <button
                            onClick={() => setShowSearchFilters(!showSearchFilters)}
                            className="mt-2 text-xs text-purple-600 hover:underline"
                        >
                            {showSearchFilters ? "Hide filters" : "Filters"}
                            {hasAnyFilter() && !showSearchFilters ? " (on)" : ""}
                        </button>

                        {showSearchFilters && (
                            <div className="mt-2 space-y-2">
                                {/* Filter by who the conversation is with */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">
                                        With
                                    </label>
                                    <select
                                        value={searchFilters.withUser}
                                        onChange={(e) =>
                                            updateSearchFilter("withUser", e.target.value)
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">Anyone</option>
                                        {contacts.map((oneContact) => (
                                            <option key={oneContact._id} value={oneContact._id}>
                                                {oneContact.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filter by the kind of content */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">
                                        Type
                                    </label>
                                    <select
                                        value={searchFilters.contentType}
                                        onChange={(e) =>
                                            updateSearchFilter("contentType", e.target.value)
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">Anything</option>
                                        <option value="text">Text only</option>
                                        <option value="image">Images</option>
                                        <option value="video">Videos</option>
                                        <option value="file">Documents</option>
                                    </select>
                                </div>

                                {/* Filter by date range */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                            From
                                        </label>
                                        <input
                                            type="date"
                                            value={searchFilters.from}
                                            onChange={(e) =>
                                                updateSearchFilter("from", e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                            To
                                        </label>
                                        <input
                                            type="date"
                                            value={searchFilters.to}
                                            onChange={(e) =>
                                                updateSearchFilter("to", e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleGlobalSearch}
                                        className="flex-1 bg-purple-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-700 transition"
                                    >
                                        Search
                                    </button>
                                    <button
                                        onClick={clearSearch}
                                        className="flex-1 bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-300 transition"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {hasSearched ? (
                        <div className="flex-1 overflow-y-auto">
                            <div className="px-4 py-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500">
                                    {searchResults.length} result(s)
                                </span>
                                <button
                                    onClick={clearSearch}
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
                                                <Avatar
                                                    imageUrl={oneGroup.groupPicture}
                                                    name={oneGroup.name || "?"}
                                                    size="small"
                                                />
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
                                                {/* Avatar with the status dot sitting on its corner */}
                                                <span className="relative shrink-0">
                                                    <Avatar
                                                        imageUrl={contact.profilePicture}
                                                        name={contact.username}
                                                        size="small"
                                                    />
                                                    <span
                                                        className={
                                                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white " +
                                                            (statusMap[contact._id] === "online"
                                                                ? "bg-green-500"
                                                                : statusMap[contact._id] === "away"
                                                                    ? "bg-yellow-400"
                                                                    : "bg-gray-300")
                                                        }
                                                    ></span>
                                                </span>
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
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar
                                        imageUrl={selectedGroup.groupPicture}
                                        name={selectedGroup.name}
                                    />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-purple-700 truncate">
                                            {selectedGroup.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {selectedGroup.members.length} members
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowGroupSettings(true)}
                                        title="Group settings"
                                        className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-1 rounded-lg hover:bg-purple-200 transition shrink-0"
                                    >
                                        ⚙ Settings
                                    </button>
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
                                        const isHidden = oneMessage.isHidden === true;
                                        // Messages that @mention me get a ring, so they're
                                        // easy to spot when scrolling back through a group
                                        const mentionsMe =
                                            oneMessage.mentions !== undefined &&
                                            oneMessage.mentions.includes(currentUser.id);

                                        // In a group you need to know WHO said it.
                                        // Look the sender up in the contact list.
                                        const senderContact = contacts.find(
                                            (oneContact) => oneContact._id === oneMessage.sender
                                        );
                                        const senderName = senderContact
                                            ? senderContact.username
                                            : "Someone";

                                        return (
                                            <div
                                                key={oneMessage._id}
                                                className={
                                                    "max-w-[70%] px-3 py-2 rounded-lg " +
                                                    (isMine
                                                        ? "bg-purple-600 text-white ml-auto"
                                                        : "bg-purple-100 text-purple-900") +
                                                    (mentionsMe
                                                        ? " ring-2 ring-yellow-400"
                                                        : "")
                                                }
                                            >
                                                {/* Only label other people's messages -
                                                    my own are already on the right. */}
                                                {!isMine && (
                                                    <button
                                                        onClick={() =>
                                                            setProfileUserId(oneMessage.sender)
                                                        }
                                                        title={"View " + senderName + "'s profile"}
                                                        className="flex items-center gap-1.5 mb-1 hover:opacity-80 transition"
                                                    >
                                                        <Avatar
                                                            imageUrl={senderContact?.profilePicture}
                                                            name={senderName}
                                                            size="small"
                                                        />
                                                        <span className="text-xs font-semibold text-purple-700">
                                                            {senderName}
                                                        </span>
                                                    </button>
                                                )}

                                                <MessageContent
                                                    text={oneMessage.text}
                                                    fileUrl={oneMessage.fileUrl}
                                                    fileName={oneMessage.fileName}
                                                    fileType={oneMessage.fileType}
                                                    isHidden={isHidden}
                                                    onOpenFile={setOpenFile}
                                                />

                                                {!isMine && !isHidden && (
                                                    <button
                                                        onClick={() =>
                                                            handleFlagMessage("group", oneMessage._id)
                                                        }
                                                        title="Report this message"
                                                        className="block mt-1 text-[10px] opacity-50 hover:opacity-100 hover:underline"
                                                    >
                                                        Report
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <PendingFilesStrip
                                files={pendingFiles}
                                onRemove={removePendingFile}
                            />

                            <div className="border-t border-gray-200 p-3 flex gap-2 items-center">
                                <input
                                    type="file"
                                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    id="groupFileUpload"
                                    multiple
                                    onChange={handleFileSelected}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="groupFileUpload"
                                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg transition"
                                    title="Send a file"
                                >
                                    📎
                                </label>

                                {/* relative so the mention picker can sit above it */}
                                <div className="flex-1 relative">
                                    {groupMentionText !== null && (
                                        <MentionPicker
                                            filterText={groupMentionText}
                                            candidates={mentionCandidates}
                                            onPick={(username) =>
                                                setGroupMessageText(
                                                    completeMention(groupMessageText, username)
                                                )
                                            }
                                        />
                                    )}
                                    <input
                                        type="text"
                                        value={groupMessageText}
                                        onChange={(e) => setGroupMessageText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleSendGroupMessage();
                                            }
                                        }}
                                        placeholder={
                                            isUploading
                                                ? "Uploading files..."
                                                : pendingFiles.length > 0
                                                    ? "Add a caption (optional) and hit Send"
                                                    : "Message " + selectedGroup.name + "... (@ to mention)"
                                        }
                                        disabled={isUploading}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
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
                                {/* The whole block opens this person's profile */}
                                <button
                                    onClick={() => setProfileUserId(selectedContact._id)}
                                    title="View profile"
                                    className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition"
                                >
                                    <Avatar
                                        imageUrl={selectedContact.profilePicture}
                                        name={selectedContact.username}
                                    />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-purple-700 truncate">
                                            {selectedContact.username}
                                        </div>
                                        {selectedContact.statusMessage &&
                                            selectedContact.statusMessage.trim() !== "" && (
                                                <div className="text-xs text-gray-500 truncate">
                                                    {selectedContact.statusMessage}
                                                </div>
                                            )}
                                    </div>
                                </button>

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
                                        // An admin removed this one. The server already
                                        // stripped the content, so only a note remains.
                                        const isHidden = singleMessage.isHidden === true;
                                        const mentionsMe =
                                            singleMessage.mentions !== undefined &&
                                            singleMessage.mentions.includes(currentUser.id);
                                        return (
                                            <div
                                                key={singleMessage._id}
                                                className={
                                                    "max-w-[70%] px-3 py-2 rounded-lg " +
                                                    (isMine
                                                        ? "bg-purple-600 text-white ml-auto"
                                                        : "bg-purple-100 text-purple-900") +
                                                    (mentionsMe
                                                        ? " ring-2 ring-yellow-400"
                                                        : "")
                                                }
                                            >
                                                <MessageContent
                                                    text={singleMessage.text}
                                                    fileUrl={singleMessage.fileUrl}
                                                    fileName={singleMessage.fileName}
                                                    fileType={singleMessage.fileType}
                                                    isHidden={isHidden}
                                                    onOpenFile={setOpenFile}
                                                />

                                                {/* You can report someone else's message
                                                    to the admins, but not your own. */}
                                                {!isMine && !isHidden && (
                                                    <button
                                                        onClick={() =>
                                                            handleFlagMessage(
                                                                "direct",
                                                                singleMessage._id
                                                            )
                                                        }
                                                        title="Report this message"
                                                        className="block mt-1 text-[10px] opacity-50 hover:opacity-100 hover:underline"
                                                    >
                                                        Report
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <PendingFilesStrip
                                files={pendingFiles}
                                onRemove={removePendingFile}
                            />

                            <div className="border-t border-gray-200 p-3 flex gap-2 items-center">
                                <input
                                    type="file"
                                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    id="imageUpload"
                                    multiple
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

                                {/* relative so the mention picker can sit above it */}
                                <div className="flex-1 relative">
                                    {directMentionText !== null && (
                                        <MentionPicker
                                            filterText={directMentionText}
                                            candidates={mentionCandidates}
                                            onPick={(username) =>
                                                setMessage(completeMention(message, username))
                                            }
                                        />
                                    )}
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
                                                ? "Uploading files..."
                                                : pendingFiles.length > 0
                                                    ? "Add a caption (optional) and hit Send"
                                                    : "Message " + selectedContact.username + "..."
                                        }
                                        disabled={isUploading}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
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
