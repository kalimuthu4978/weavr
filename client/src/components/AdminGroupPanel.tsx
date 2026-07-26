import { useState, useEffect } from "react";
import type { AdminGroupDetail, AdminUser } from "../api/admin";
import {
  adminFetchGroupDetail,
  adminAddGroupMembers,
  adminRemoveGroupMember,
  adminSetGroupPermission,
} from "../api/admin";
import Avatar from "./Avatar";

type AdminGroupPanelProps = {
  groupId: string;
  // Every user on the platform, so the admin can add anyone
  allUsers: AdminUser[];
  onClose: () => void;
  // Called after a change so the dashboard can refresh its lists
  onGroupChanged: () => void;
};

// Lets an admin manage any group's membership and permissions, without
// needing to be a member of it themselves.
function AdminGroupPanel({
  groupId,
  allUsers,
  onClose,
  onGroupChanged,
}: AdminGroupPanelProps) {
  const [group, setGroup] = useState<AdminGroupDetail | null>(null);
  const [idsToAdd, setIdsToAdd] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  async function loadGroup() {
    try {
      const loadedGroup = await adminFetchGroupDetail(groupId);
      setGroup(loadedGroup);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Could not load this group");
      }
    }
  }

  // Shared error handling and refresh for every button here
  async function runAction(action: () => Promise<unknown>, successText: string) {
    setFeedback("");
    try {
      await action();
      await loadGroup();
      onGroupChanged();
      setFeedback(successText);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  function isGroupAdmin(userId: string) {
    if (group === null) {
      return false;
    }
    if (group.createdBy === userId) {
      return true;
    }
    if (!group.groupAdmins) {
      return false;
    }
    return group.groupAdmins.includes(userId);
  }

  // People not already in this group
  const usersNotInGroup = allUsers.filter((oneUser) => {
    if (group === null) {
      return false;
    }
    return !group.members.some((oneMember) => oneMember._id === oneUser._id);
  });

  function toggleIdToAdd(userId: string) {
    setIdsToAdd((previous) => {
      if (previous.includes(userId)) {
        return previous.filter((oneId) => oneId !== userId);
      }
      return [...previous, userId];
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-800 rounded-xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-purple-700">
            Manage group
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {group === null ? (
          <p className="text-sm text-gray-400">Loading group...</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <Avatar
                imageUrl={group.groupPicture}
                name={group.name}
                size="large"
              />
              <div className="min-w-0">
                <div className="font-semibold text-lg truncate">
                  {group.name}
                </div>
                <div className="text-sm text-gray-500">
                  {group.members.length} members
                </div>
              </div>
            </div>

            {/* --- Members and their permissions --- */}
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Members and permissions
            </h3>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-5">
              {group.members.map((oneMember) => {
                const memberIsAdmin = isGroupAdmin(oneMember._id);
                const memberIsCreator = group.createdBy === oneMember._id;

                return (
                  <div
                    key={oneMember._id}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <Avatar
                      imageUrl={oneMember.profilePicture}
                      name={oneMember.username}
                      size="small"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {oneMember.username}
                      </div>
                      {memberIsAdmin && (
                        <div className="text-xs text-purple-600 font-semibold">
                          {memberIsCreator ? "Creator" : "Group admin"}
                        </div>
                      )}
                    </div>

                    {/* The creator's rights and membership are fixed */}
                    {!memberIsCreator && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() =>
                            runAction(
                              () =>
                                adminSetGroupPermission(
                                  groupId,
                                  oneMember._id,
                                  !memberIsAdmin
                                ),
                              memberIsAdmin
                                ? oneMember.username + " is no longer an admin"
                                : oneMember.username + " is now a group admin"
                            )
                          }
                          className="text-xs text-purple-600 hover:underline"
                        >
                          {memberIsAdmin ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          onClick={() =>
                            runAction(
                              () =>
                                adminRemoveGroupMember(groupId, oneMember._id),
                              oneMember.username + " was removed"
                            )
                          }
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* --- Add members --- */}
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Add members
            </h3>
            {usersNotInGroup.length === 0 ? (
              <p className="text-sm text-gray-400">
                Everyone is already in this group.
              </p>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto mb-3">
                  {usersNotInGroup.map((oneUser) => (
                    <label
                      key={oneUser._id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={idsToAdd.includes(oneUser._id)}
                        onChange={() => toggleIdToAdd(oneUser._id)}
                      />
                      <Avatar
                        imageUrl={oneUser.profilePicture}
                        name={oneUser.username}
                        size="small"
                      />
                      <span className="text-sm truncate">
                        {oneUser.username}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={() =>
                    runAction(async () => {
                      await adminAddGroupMembers(groupId, idsToAdd);
                      setIdsToAdd([]);
                    }, "Members added")
                  }
                  disabled={idsToAdd.length === 0}
                  className="w-full bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Add selected ({idsToAdd.length})
                </button>
              </>
            )}

            {feedback !== "" && (
              <p className="text-center text-sm mt-4 text-gray-700">
                {feedback}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminGroupPanel;
