import { getToken } from "../auth/session";
import { fetchStats, fetchAllUsers } from "../api/admin";

const ADMIN_URL = "http://localhost:5000/api/admin";

// A small helper so we don't repeat the auth header everywhere
function authHeader() {
  const token = getToken();
  return { Authorization: `Bearer ${token}` };
}

export type AdminStats = {
  users: number;
  groups: number;
  directMessages: number;
  groupMessages: number;
};

export type AdminUser = {
  _id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  status: string;
  createdAt: string;
};

export type AdminGroup = {
  _id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
};

export async function fetchStats(): Promise<AdminStats> {
  const response = await fetch(`${ADMIN_URL}/stats`, { headers: authHeader() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load stats");
  return data;
}

export async function fetchAllUsers(): Promise<AdminUser[]> {
  const response = await fetch(`${ADMIN_URL}/users`, { headers: authHeader() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load users");
  return data;
}

export async function fetchAllGroups(): Promise<AdminGroup[]> {
  const response = await fetch(`${ADMIN_URL}/groups`, { headers: authHeader() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load groups");
  return data;
}

export async function deleteUser(userId: string) {
  const response = await fetch(`${ADMIN_URL}/users/${userId}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to delete user");
  return data;
}