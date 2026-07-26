import { useState, useEffect } from "react";
import type { StoredUser } from "../auth/session";
import type { ContactUser } from "../api/users";
import type { GroupWithMembers } from "../api/groups";
import {
  fetchGroupDetails,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  promoteToGroupAdmin,
  demoteFromGroupAdmin,
  deleteGroup,
} from "../api/groups";
import { uploadFile } from "../api/upload";
import Avatar from "./Avatar";

type GroupSettingsPanelProps = {
  groupId: string;
  currentUser: StoredUser;
  // Every other user in the app, used to offer people to add
  allContacts: ContactUser[];
  onClose: () => void;
  // Called after any change, so the chat screen can reload its group list
  onGroupChanged: () => void;
  // Called when the current user leaves the group, or the group is deleted,
  // so the chat screen can close the conversation
  onLeftGroup: () => void;
};

function GroupSettingsPanel({
  groupId,
  currentUser,
  allContacts,
  onClose,
  onGroupChanged,
  onLeftGroup,
}: GroupSettingsPanelProps) {
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupPicture, setGroupPicture] = useState("");
  // Ids ticked in the "add people" list, waiting to be added
  const [idsToAdd, setIdsToAdd] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Load the group's full details (members with names and pictures) on open
  useEffect(() => {
    async function loadGroup() {
      try {
        const loadedGroup = await fetchGroupDetails(groupId);
        setGroup(loadedGroup);
        setGroupName(loadedGroup.name);
        setGroupPicture(loadedGroup.groupPicture || "");
      } catch (error) {
        if (error instanceof Error) {
          setFeedback(error.message);
        } else {
          setFeedback("Could not load this group");
        }
      }
    }

    loadGroup();
  }, [groupId]);

  // Reload from the server after a change, so what we show always matches
  // what was actually saved.
  async function reloadGroup() {
    try {
      const reloadedGroup = await fetchGroupDetails(groupId);
      setGroup(reloadedGroup);
      setGroupName(reloadedGroup.name);
      setGroupPicture(reloadedGroup.groupPicture || "");
      onGroupChanged();
    } catch (error) {
      console.log("Could not reload group:", error);
    }
  }

  // Is a given user allowed to manage this group?
  // The creator always counts, even for groups saved before groupAdmins existed.
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

  const canManage = group !== null && isGroupAdmin(currentUser.id);

  // People who are NOT already in the group - these are the ones we can add
  const membersNotInGroup = allContacts.filter((oneContact) => {
    if (group === null) {
      return false;
    }
    const isAlreadyMember = group.members.some(
      (oneMember) => oneMember._id === oneContact._id
    );
    return !isAlreadyMember;
  });

  function toggleIdToAdd(userId: string) {
    setIdsToAdd((previous) => {
      if (previous.includes(userId)) {
        // Already ticked -> untick it
        return previous.filter((oneId) => oneId !== userId);
      }
      return [...previous, userId];
    });
  }

  // Wraps an action so every button gets the same error handling
  async function runAction(action: () => Promise<unknown>, successText: string) {
    setFeedback("");
    try {
      await action();
      await reloadGroup();
      setFeedback(successText);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  async function handlePictureSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const chosenFiles = event.target.files;
    if (!chosenFiles || chosenFiles.length === 0) {
      return;
    }
    const chosenFile = chosenFiles[0];

    if (!chosenFile.type.startsWith("image/")) {
      setFeedback("The group picture must be an image");
      return;
    }

    setFeedback("");
    setIsUploading(true);

    try {
      const uploadResult = await uploadFile(chosenFile);
      // Save the new picture immediately, keeping the current name
      await updateGroup(groupId, groupName, uploadResult.fileUrl);
      await reloadGroup();
      setFeedback("Group picture updated");
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Could not upload that picture");
      }
    }

    setIsUploading(false);
    event.target.value = "";
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-800 rounded-xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-purple-700">Group settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {group === null ? (
          <p className="text-gray-500 text-sm">Loading group...</p>
        ) : (
          <>
            {/* --- Picture and name --- */}
            <div className="flex items-center gap-4 mb-5">
              <Avatar
                imageUrl={groupPicture}
                name={group.name}
                size="large"
              />

              {canManage && (
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="groupPictureUpload"
                    onChange={handlePictureSelected}
                    className="hidden"
                  />
                  <label
                    htmlFor="groupPictureUpload"
                    className="cursor-pointer text-center bg-purple-100 text-purple-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-200 transition"
                  >
                    {isUploading ? "Uploading..." : "Change picture"}
                  </label>

                  {groupPicture !== "" && (
                    <button
                      onClick={() =>
                        runAction(
                          () => updateGroup(groupId, groupName, ""),
                          "Group picture removed"
                        )
                      }
                      className="text-sm text-red-500 hover:underline"
                    >
                      Remove picture
                    </button>
                  )}
                </div>
              )}
            </div>

            <label className="block text-sm font-semibold mb-1">
              Group name
            </label>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={!canManage}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 disabled:bg-gray-100"
              />
              {canManage && (
                <button
                  onClick={() =>
                    runAction(
                      () => updateGroup(groupId, groupName, groupPicture),
                      "Group name saved"
                    )
                  }
                  className="bg-purple-600 text-white font-semibold px-4 rounded-lg hover:bg-purple-700 transition"
                >
                  Save
                </button>
              )}
            </div>

            {/* --- Who can join --- */}
            {canManage && (
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-1">
                  Who can join
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={group.isPublic === true}
                    onChange={(e) =>
                      runAction(
                        () =>
                          updateGroup(
                            groupId,
                            groupName,
                            groupPicture,
                            e.target.checked
                          ),
                        e.target.checked
                          ? "Anyone can now find and join this group"
                          : "This group is now invite-only"
                      )
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-600">
                    Public - list this group under "Discover groups" so anyone
                    can join it. Leave unticked to keep it invite-only.
                  </span>
                </label>
              </div>
            )}

            {/* --- Current members --- */}
            <h3 className="font-semibold text-purple-700 mb-2">
              Members ({group.members.length})
            </h3>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6">
              {group.members.map((oneMember) => {
                const memberIsAdmin = isGroupAdmin(oneMember._id);
                const memberIsCreator = group.createdBy === oneMember._id;
                const memberIsMe = oneMember._id === currentUser.id;

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
                        {memberIsMe && (
                          <span className="text-gray-400"> (you)</span>
                        )}
                      </div>
                      {memberIsAdmin && (
                        <div className="text-xs text-purple-600 font-semibold">
                          {memberIsCreator ? "Creator" : "Group admin"}
                        </div>
                      )}
                    </div>

                    {/* Only group admins see the management buttons, and the
                        creator can never be demoted or removed. */}
                    {canManage && !memberIsCreator && (
                      <div className="flex gap-2 shrink-0">
                        {memberIsAdmin ? (
                          <button
                            onClick={() =>
                              runAction(
                                () =>
                                  demoteFromGroupAdmin(groupId, oneMember._id),
                                oneMember.username + " is no longer an admin"
                              )
                            }
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              runAction(
                                () =>
                                  promoteToGroupAdmin(groupId, oneMember._id),
                                oneMember.username + " is now a group admin"
                              )
                            }
                            className="text-xs text-purple-600 hover:underline"
                          >
                            Make admin
                          </button>
                        )}

                        <button
                          onClick={() =>
                            runAction(
                              () => removeGroupMember(groupId, oneMember._id),
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

            {/* --- Add new members --- */}
            {canManage && (
              <>
                <h3 className="font-semibold text-purple-700 mb-2">
                  Add people
                </h3>

                {membersNotInGroup.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-6">
                    Everyone is already in this group.
                  </p>
                ) : (
                  <>
                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto mb-3">
                      {membersNotInGroup.map((oneContact) => (
                        <label
                          key={oneContact._id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={idsToAdd.includes(oneContact._id)}
                            onChange={() => toggleIdToAdd(oneContact._id)}
                          />
                          <Avatar
                            imageUrl={oneContact.profilePicture}
                            name={oneContact.username}
                            size="small"
                          />
                          <span className="text-sm truncate">
                            {oneContact.username}
                          </span>
                        </label>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        runAction(async () => {
                          await addGroupMembers(groupId, idsToAdd);
                          setIdsToAdd([]);
                        }, "Members added")
                      }
                      disabled={idsToAdd.length === 0}
                      className="w-full bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition mb-6 disabled:opacity-50"
                    >
                      Add selected ({idsToAdd.length})
                    </button>
                  </>
                )}
              </>
            )}

            {/* --- Leave the group --- */}
            {/* The creator can't leave, because the group would be left with
                nobody guaranteed to be able to manage it. They delete it
                instead (the option below). */}
            {group.createdBy !== currentUser.id && (
              <button
                onClick={async () => {
                  setFeedback("");
                  try {
                    await removeGroupMember(groupId, currentUser.id);
                    onGroupChanged();
                    onLeftGroup();
                  } catch (error) {
                    if (error instanceof Error) {
                      setFeedback(error.message);
                    } else {
                      setFeedback("Could not leave the group");
                    }
                  }
                }}
                className="w-full border border-red-300 text-red-600 font-semibold px-4 py-2 rounded-lg hover:bg-red-50 transition"
              >
                Leave group
              </button>
            )}

            {/* --- Delete the whole group --- */}
            {/* Only the creator, because this also destroys everyone's
                message history. */}
            {group.createdBy === currentUser.id && (
              <button
                onClick={async () => {
                  const confirmed = window.confirm(
                    'Delete "' +
                      group.name +
                      '" for everyone? All of its messages will be removed too. This cannot be undone.'
                  );
                  if (!confirmed) {
                    return;
                  }

                  setFeedback("");
                  try {
                    await deleteGroup(groupId);
                    onGroupChanged();
                    onLeftGroup();
                  } catch (error) {
                    if (error instanceof Error) {
                      setFeedback(error.message);
                    } else {
                      setFeedback("Could not delete the group");
                    }
                  }
                }}
                className="w-full bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Delete group
              </button>
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

export default GroupSettingsPanel;
