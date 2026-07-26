import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";
const ADMIN_URL = `${API_BASE_URL}/api/admin`;

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
  profilePicture?: string;
  // Accounts created before this field existed have it missing,
  // which we treat as active.
  isActive?: boolean;
};

export type AdminGroup = {
  _id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  groupPicture?: string;
};

// Everything behind the Analytics & Reporting section
export type AnalyticsReport = {
  rangeInDays: number;
  messagesPerDay: {
    date: string; // "YYYY-MM-DD"
    direct: number;
    group: number;
    total: number;
  }[];
  topUsers: {
    userId: string;
    username: string;
    profilePicture: string;
    messageCount: number;
  }[];
  topGroups: {
    groupId: string;
    name: string;
    groupPicture: string;
    memberCount: number;
    messageCount: number;
  }[];
  userActivity: {
    totalUsers: number;
    deactivatedUsers: number;
    newThisWeek: number;
    onlineNow: number;
    activeToday: number;
    activeThisWeek: number;
  };
  engagement: {
    totalMessages: number;
    averageMessagesPerUser: number;
    weeklyActivePercent: number;
    attachmentPercent: number;
    groupSharePercent: number;
  };
  system: {
    uptimeMinutes: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    databaseLatencyMs: number;
    nodeVersion: string;
  };
};

// One message waiting for an admin to review it
export type FlaggedMessage = {
  _id: string;
  kind: "direct" | "group";
  text: string;
  fileName: string;
  fileType: string;
  sender: { _id: string; username: string; email: string } | null;
  groupName: string;
  flagReason: string;
  isHidden: boolean;
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

// The reporting section. days controls how far the volume chart looks back.
export async function fetchAnalytics(days: number): Promise<AnalyticsReport> {
  const response = await fetch(`${ADMIN_URL}/analytics?days=${days}`, {
    headers: authHeader(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load analytics");
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

// A helper for the routes that send JSON, so they don't all repeat the setup
async function sendAdminJson(path: string, method: string, body?: object) {
  const response = await fetch(`${ADMIN_URL}${path}`, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

// --- Account activation ---

// Turn an account on or off. A deactivated user keeps their data but
// cannot log in.
export async function setUserActive(userId: string, isActive: boolean) {
  return await sendAdminJson(`/users/${userId}/active`, "PATCH", {
    isActive: isActive,
  });
}

// --- Group management ---

export async function adminCreateGroup(name: string, memberIds: string[]) {
  return await sendAdminJson("/groups", "POST", {
    name: name,
    memberIds: memberIds,
  });
}

export async function adminRenameGroup(groupId: string, name: string) {
  return await sendAdminJson(`/groups/${groupId}`, "PUT", { name: name });
}

export async function adminDeleteGroup(groupId: string) {
  return await sendAdminJson(`/groups/${groupId}`, "DELETE");
}

// One group with its members' details filled in, for the management panel
export type AdminGroupDetail = {
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
};

export async function adminFetchGroupDetail(
  groupId: string
): Promise<AdminGroupDetail> {
  const response = await fetch(`${ADMIN_URL}/groups/${groupId}`, {
    headers: authHeader(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load group");
  return data;
}

export async function adminAddGroupMembers(
  groupId: string,
  memberIds: string[]
) {
  return await sendAdminJson(`/groups/${groupId}/members`, "POST", {
    memberIds: memberIds,
  });
}

export async function adminRemoveGroupMember(
  groupId: string,
  memberId: string
) {
  return await sendAdminJson(
    `/groups/${groupId}/members/${memberId}`,
    "DELETE"
  );
}

// Grant or revoke group-admin rights for one member
export async function adminSetGroupPermission(
  groupId: string,
  memberId: string,
  isGroupAdmin: boolean
) {
  return await sendAdminJson(
    `/groups/${groupId}/permissions/${memberId}`,
    "PATCH",
    { isGroupAdmin: isGroupAdmin }
  );
}

// --- Content moderation ---

// Every message a user has reported, newest first
export async function fetchFlaggedMessages(): Promise<FlaggedMessage[]> {
  const response = await fetch(`${ADMIN_URL}/flagged`, {
    headers: authHeader(),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Failed to load flagged messages");
  return data;
}

// Hide (or unhide) a reported message. Hidden messages stay in the database
// but their content is no longer sent to other users.
export async function setMessageHidden(
  kind: "direct" | "group",
  messageId: string,
  isHidden: boolean
) {
  return await sendAdminJson(`/messages/${kind}/${messageId}`, "PATCH", {
    isHidden: isHidden,
  });
}

// Dismiss the report and leave the message visible
export async function clearMessageFlag(
  kind: "direct" | "group",
  messageId: string
) {
  return await sendAdminJson(`/messages/${kind}/${messageId}`, "PATCH", {
    clearFlag: true,
  });
}