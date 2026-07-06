import { getToken } from "../auth/session";

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

  const response = await fetch("http://localhost:5000/api/groups", {
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