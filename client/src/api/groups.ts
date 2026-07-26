import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";

// The shape of a group from the backend
export type Group = {
  _id: string;
  name: string;
  members: string[];
  createdBy: string;
  // Members allowed to manage the group. Older groups saved before this
  // field existed may not have it, so it's optional.
  groupAdmins?: string[];
  groupPicture?: string;
  // Public groups can be found and joined by anyone
  isPublic?: boolean;
};

// The same group, but from GET /api/groups/:groupId where the member ids
// have been swapped for the full user details.
export type GroupWithMembers = {
  _id: string;
  name: string;
  members: {
    _id: string;
    username: string;
    email: string;
    profilePicture?: string;
    status?: string;
  }[];
  createdBy: string;
  groupAdmins?: string[];
  groupPicture?: string;
  isPublic?: boolean;
};

// Fetch all groups the logged-in user belongs to
export async function fetchGroups(): Promise<Group[]> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api/groups`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load groups");
  }

  return data;
}

// A message that belongs to a group
export type GroupMessageData = {
  _id: string;
  text: string;
  sender: string;
  group: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string; // "image" | "video" | "file" | ""
  isHidden?: boolean;
};

// Load the message history for one group
export async function fetchGroupMessages(
  groupId: string
): Promise<GroupMessageData[]> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/api/groups/${groupId}/messages`,   // <-- full path
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load group messages");
  return data;
}

// Create a new group with a name and a list of member ids
export async function createGroup(
  name: string,
  memberIds: string[]
): Promise<Group> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api/groups`, {   // <-- full path
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: name, memberIds: memberIds }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to create group");
  return data.group;
}

// --- Group management (group admins only, enforced on the server) ---

// A small helper so the functions below don't all repeat the same fetch setup.
async function sendGroupRequest(
  path: string,
  method: string,
  body?: object
): Promise<any> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api/groups${path}`, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    // Only send a body when there is one (GET and DELETE usually have none)
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

// Load one group with its members' names and pictures filled in
export async function fetchGroupDetails(
  groupId: string
): Promise<GroupWithMembers> {
  return await sendGroupRequest(`/${groupId}`, "GET");
}

// Rename a group, change its picture, and/or set whether it's public.
// isPublic is optional - leave it out to keep the current setting.
export async function updateGroup(
  groupId: string,
  name: string,
  groupPicture: string,
  isPublic?: boolean
): Promise<Group> {
  const data = await sendGroupRequest(`/${groupId}`, "PUT", {
    name: name,
    groupPicture: groupPicture,
    isPublic: isPublic,
  });
  return data.group;
}

// A public group shown in the browse list
export type DiscoverableGroup = {
  _id: string;
  name: string;
  groupPicture?: string;
  memberCount: number;
};

// Public groups the logged-in user isn't in yet
export async function fetchDiscoverableGroups(): Promise<DiscoverableGroup[]> {
  return await sendGroupRequest("/discover", "GET");
}

// Join a public group yourself
export async function joinGroup(groupId: string): Promise<Group> {
  const data = await sendGroupRequest(`/${groupId}/join`, "POST");
  return data.group;
}

// Add one or more people to a group
export async function addGroupMembers(
  groupId: string,
  memberIds: string[]
): Promise<Group> {
  const data = await sendGroupRequest(`/${groupId}/members`, "POST", {
    memberIds: memberIds,
  });
  return data.group;
}

// Remove one person from a group (or leave it yourself)
export async function removeGroupMember(
  groupId: string,
  memberId: string
): Promise<Group> {
  const data = await sendGroupRequest(
    `/${groupId}/members/${memberId}`,
    "DELETE"
  );
  return data.group;
}

// Make an existing member a group admin
export async function promoteToGroupAdmin(
  groupId: string,
  memberId: string
): Promise<Group> {
  const data = await sendGroupRequest(`/${groupId}/admins/${memberId}`, "POST");
  return data.group;
}

// Delete a whole group and its messages. Only the creator may do this.
export async function deleteGroup(groupId: string) {
  return await sendGroupRequest(`/${groupId}`, "DELETE");
}

// Take group admin rights away again
export async function demoteFromGroupAdmin(
  groupId: string,
  memberId: string
): Promise<Group> {
  const data = await sendGroupRequest(
    `/${groupId}/admins/${memberId}`,
    "DELETE"
  );
  return data.group;
}
