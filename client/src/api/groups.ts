import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";

// The shape of a group from the backend
export type Group = {
  _id: string;
  name: string;
  members: string[];
  createdBy: string;
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
};

// Load the message history for one group
export async function fetchGroupMessages(
  groupId: string,
): Promise<GroupMessageData[]> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/api/groups/` + groupId + "/messages",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load group messages");
  }

  return data;
}

// Create a new group with a name and a list of member ids
export async function createGroup(
  name: string,
  memberIds: string[],
): Promise<Group> {
  const token = getToken();

  const response = await fetch("http://localhost:5000/api/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: name,
      memberIds: memberIds,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create group");
  }

  return data.group;
}
