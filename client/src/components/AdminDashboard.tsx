import { useEffect, useState } from "react";
import type { StoredUser } from "../auth/session";
import {
  fetchStats,
  fetchAllUsers,
  fetchAllGroups,
  deleteUser,
} from "../api/admin";
import type { AdminStats, AdminUser, AdminGroup } from "../api/admin";

type AdminDashboardProps = {
  currentUser: StoredUser;
  onBack: () => void;
};

function AdminDashboard({ currentUser, onBack }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [feedback, setFeedback] = useState("");

  // Load everything when the dashboard opens
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [statsData, usersData, groupsData] = await Promise.all([
        fetchStats(),
        fetchAllUsers(),
        fetchAllGroups(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setGroups(groupsData);
    } catch (error) {
      console.log("Could not load admin data:", error);
      setFeedback("Failed to load admin data");
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    // Simple confirmation before a destructive action
    const confirmed = window.confirm(
      "Delete user \"" + username + "\"? This cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(userId);
      setFeedback("Deleted " + username);
      // Refresh the lists so the deleted user disappears
      loadAll();
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Delete failed");
      }
    }
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
      </div>

      {/* Two columns: users and groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Users */}
        <div className="bg-white text-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-purple-700">
            All Users ({users.length})
          </div>
          <div className="max-h-96 overflow-y-auto">
            {users.map((oneUser) => (
              <div
                key={oneUser._id}
                className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {oneUser.username}
                    {oneUser.isAdmin && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{oneUser.email}</div>
                </div>
                {/* Don't show delete for yourself */}
                {oneUser._id !== currentUser.id && (
                  <button
                    onClick={() => handleDeleteUser(oneUser._id, oneUser.username)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
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
                  className="px-4 py-3 border-b border-gray-100"
                >
                  <div className="font-semibold">{oneGroup.name}</div>
                  <div className="text-xs text-gray-500">
                    {oneGroup.members.length} members
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;