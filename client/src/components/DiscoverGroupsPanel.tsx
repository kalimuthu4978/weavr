import { useState, useEffect } from "react";
import type { DiscoverableGroup } from "../api/groups";
import { fetchDiscoverableGroups, joinGroup } from "../api/groups";
import Avatar from "./Avatar";

type DiscoverGroupsPanelProps = {
  onClose: () => void;
  // Called after joining, so the chat screen can reload its group list
  onJoined: () => void;
};

// Lets someone browse public groups and join one themselves, rather than
// waiting for a group admin to add them.
function DiscoverGroupsPanel({ onClose, onJoined }: DiscoverGroupsPanelProps) {
  const [groups, setGroups] = useState<DiscoverableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const openGroups = await fetchDiscoverableGroups();
      setGroups(openGroups);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Could not load public groups");
      }
    }
    setIsLoading(false);
  }

  async function handleJoin(oneGroup: DiscoverableGroup) {
    setFeedback("");
    try {
      await joinGroup(oneGroup._id);
      // Take it out of the list - we're a member now, so it's no longer
      // something to discover
      setGroups((previous) =>
        previous.filter((existing) => existing._id !== oneGroup._id)
      );
      onJoined();
      setFeedback("Joined " + oneGroup.name);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Could not join that group");
      }
    }
  }

  // Narrow the list as the user types
  const searchLower = searchTerm.trim().toLowerCase();
  const visibleGroups =
    searchLower === ""
      ? groups
      : groups.filter((oneGroup) =>
        oneGroup.name.toLowerCase().includes(searchLower)
      );

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-800 rounded-xl w-full max-w-sm p-6 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-purple-700">Discover groups</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Public groups you can join. Private groups need an invite from a
          group admin.
        </p>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search groups..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:border-purple-500"
        />

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading groups...</p>
        ) : visibleGroups.length === 0 ? (
          <p className="text-sm text-gray-400">
            {groups.length === 0
              ? "There are no public groups to join right now."
              : "No groups match that search."}
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {visibleGroups.map((oneGroup) => (
              <div
                key={oneGroup._id}
                className="flex items-center gap-2 px-3 py-2"
              >
                <Avatar
                  imageUrl={oneGroup.groupPicture}
                  name={oneGroup.name}
                  size="small"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{oneGroup.name}</div>
                  <div className="text-xs text-gray-400">
                    {oneGroup.memberCount} members
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(oneGroup)}
                  className="text-xs bg-purple-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-700 transition shrink-0"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}

        {feedback !== "" && (
          <p className="text-center text-sm mt-4 text-gray-700">{feedback}</p>
        )}
      </div>
    </div>
  );
}

export default DiscoverGroupsPanel;
