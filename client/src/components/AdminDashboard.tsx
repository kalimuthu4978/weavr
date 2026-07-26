import { useEffect, useState } from "react";
import type { StoredUser } from "../auth/session";
import {
  fetchStats,
  fetchAllUsers,
  fetchAllGroups,
  fetchFlaggedMessages,
  deleteUser,
  setUserActive,
  adminRenameGroup,
  adminDeleteGroup,
  setMessageHidden,
  clearMessageFlag,
} from "../api/admin";
import type {
  AdminStats,
  AdminUser,
  AdminGroup,
  FlaggedMessage,
} from "../api/admin";
import Avatar from "./Avatar";

type AdminDashboardProps = {
  currentUser: StoredUser;
  onBack: () => void;
};

function AdminDashboard({ currentUser, onBack }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [flagged, setFlagged] = useState<FlaggedMessage[]>([]);
  const [feedback, setFeedback] = useState("");

  // Load everything when the dashboard opens
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [statsData, usersData, groupsData, flaggedData] = await Promise.all([
        fetchStats(),
        fetchAllUsers(),
        fetchAllGroups(),
        fetchFlaggedMessages(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setGroups(groupsData);
      setFlagged(flaggedData);
    } catch (error) {
      console.log("Could not load admin data:", error);
      setFeedback("Failed to load admin data");
    }
  }

  // Wraps every action so they all share the same error handling and refresh
  async function runAction(action: () => Promise<unknown>, successText: string) {
    setFeedback("");
    try {
      await action();
      await loadAll();
      setFeedback(successText);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  function handleDeleteUser(userId: string, username: string) {
    const confirmed = window.confirm(
      'Delete user "' + username + '"? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }
    runAction(() => deleteUser(userId), "Deleted " + username);
  }

  function handleToggleActive(oneUser: AdminUser) {
    // Missing isActive (older accounts) counts as active
    const isCurrentlyActive = oneUser.isActive !== false;
    const wordForAction = isCurrentlyActive ? "Deactivate" : "Activate";

    const confirmed = window.confirm(
      wordForAction + ' the account "' + oneUser.username + '"?'
    );
    if (!confirmed) {
      return;
    }

    runAction(
      () => setUserActive(oneUser._id, !isCurrentlyActive),
      oneUser.username + " was " + wordForAction.toLowerCase() + "d"
    );
  }

  function handleRenameGroup(oneGroup: AdminGroup) {
    const newName = window.prompt("New name for this group:", oneGroup.name);
    // prompt returns null if the user pressed Cancel
    if (newName === null || newName.trim() === "") {
      return;
    }
    runAction(
      () => adminRenameGroup(oneGroup._id, newName),
      "Group renamed to " + newName.trim()
    );
  }

  function handleDeleteGroup(oneGroup: AdminGroup) {
    const confirmed = window.confirm(
      'Delete group "' +
        oneGroup.name +
        '" and all of its messages? This cannot be undone.'
    );
    if (!confirmed) {
      return;
    }
    runAction(
      () => adminDeleteGroup(oneGroup._id),
      "Deleted group " + oneGroup.name
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Weavr logo" className="w-9 h-9" />
          <span className="text-2xl font-bold">Weavr Admin</span>
        </div>
        <button
          onClick={onBack}
          className="bg-white/20 hover:bg-white/30 text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          ← Back to chat
        </button>
      </div>

      {feedback !== "" && (
        <div className="bg-white/20 rounded-lg px-4 py-2 mb-4 text-sm">
          {feedback}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white text-gray-800 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold text-purple-700">
            {stats ? stats.users : "-"}
          </div>
          <div className="text-sm text-gray-500">Users</div>
        </div>
        <div className="bg-white text-gray-800 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold text-purple-700">
            {stats ? stats.groups : "-"}
          </div>
          <div className="text-sm text-gray-500">Groups</div>
        </div>
        <div className="bg-white text-gray-800 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold text-purple-700">
            {stats ? stats.directMessages : "-"}
          </div>
          <div className="text-sm text-gray-500">Direct messages</div>
        </div>
        <div className="bg-white text-gray-800 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold text-purple-700">
            {stats ? stats.groupMessages : "-"}
          </div>
          <div className="text-sm text-gray-500">Group messages</div>
        </div>
        <div className="bg-white text-gray-800 rounded-xl p-4 shadow">
          <div
            className={
              "text-3xl font-bold " +
              (flagged.length > 0 ? "text-red-600" : "text-purple-700")
            }
          >
            {flagged.length}
          </div>
          <div className="text-sm text-gray-500">Reported</div>
        </div>
      </div>

      {/* Two columns: users and groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Users */}
        <div className="bg-white text-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
            All Users ({users.length})
          </div>
          <div className="max-h-96 overflow-y-auto">
            {users.map((oneUser) => {
              const isCurrentlyActive = oneUser.isActive !== false;

              return (
                <div
                  key={oneUser._id}
                  className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
                >
                  <Avatar
                    imageUrl={oneUser.profilePicture}
                    name={oneUser.username}
                    size="small"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {oneUser.username}
                      {oneUser.isAdmin && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          admin
                        </span>
                      )}
                      {!isCurrentlyActive && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          deactivated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {oneUser.email}
                    </div>
                  </div>

                  {/* Don't show these for yourself */}
                  {oneUser._id !== currentUser.id && (
                    <div className="flex gap-3 shrink-0">
                      <button
                        onClick={() => handleToggleActive(oneUser)}
                        className="text-sm text-purple-600 hover:underline"
                      >
                        {isCurrentlyActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteUser(oneUser._id, oneUser.username)
                        }
                        className="text-red-500 text-sm hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Groups */}
        <div className="bg-white text-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
            All Groups ({groups.length})
          </div>
          <div className="max-h-96 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-gray-400 text-sm px-4 py-3">No groups.</p>
            ) : (
              groups.map((oneGroup) => (
                <div
                  key={oneGroup._id}
                  className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
                >
                  <Avatar
                    imageUrl={oneGroup.groupPicture}
                    name={oneGroup.name}
                    size="small"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {oneGroup.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {oneGroup.members.length} members
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => handleRenameGroup(oneGroup)}
                      className="text-sm text-purple-600 hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(oneGroup)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reported messages, full width because each row needs the space */}
      <div className="bg-white text-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
          Reported Messages ({flagged.length})
        </div>
        <div className="max-h-96 overflow-y-auto">
          {flagged.length === 0 ? (
            <p className="text-gray-400 text-sm px-4 py-3">
              Nothing has been reported. 🎉
            </p>
          ) : (
            flagged.map((oneMessage) => (
              <div
                key={oneMessage.kind + oneMessage._id}
                className="px-4 py-3 border-b border-gray-100"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold">
                    {oneMessage.sender ? oneMessage.sender.username : "Unknown"}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {oneMessage.kind === "group"
                      ? "group: " + oneMessage.groupName
                      : "direct message"}
                  </span>
                  {oneMessage.isHidden && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      hidden
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(oneMessage.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-gray-800 mb-1 break-words">
                  {oneMessage.text !== ""
                    ? oneMessage.text
                    : oneMessage.fileName !== ""
                      ? "[" + oneMessage.fileType + "] " + oneMessage.fileName
                      : "(no text)"}
                </p>

                {oneMessage.flagReason !== "" && (
                  <p className="text-xs text-gray-500 mb-2">
                    Reported for: {oneMessage.flagReason}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      runAction(
                        () =>
                          setMessageHidden(
                            oneMessage.kind,
                            oneMessage._id,
                            !oneMessage.isHidden
                          ),
                        oneMessage.isHidden
                          ? "Message restored"
                          : "Message hidden"
                      )
                    }
                    className="text-sm text-purple-600 hover:underline"
                  >
                    {oneMessage.isHidden ? "Restore" : "Hide message"}
                  </button>
                  <button
                    onClick={() =>
                      runAction(
                        () =>
                          clearMessageFlag(oneMessage.kind, oneMessage._id),
                        "Report dismissed"
                      )
                    }
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Dismiss report
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
