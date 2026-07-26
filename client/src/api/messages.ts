import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";

// A message returned from the search endpoint
export type SearchResultMessage = {
  _id: string;
  text: string;
  sender: string;
  receiver: string;
  createdAt: string;
  fileName?: string;
  fileType?: string;
};

// The optional filters the user can narrow a search with.
// Any field left as "" simply isn't sent, so the server ignores it.
export type SearchFilters = {
  withUser: string;      // a user id, to search one conversation only
  from: string;          // "YYYY-MM-DD" from a date input
  to: string;            // "YYYY-MM-DD" from a date input
  contentType: string;   // "text" | "image" | "video" | "file"
};

// Search the logged-in user's messages, optionally narrowed by filters
export async function searchMessages(
  term: string,
  filters?: SearchFilters
): Promise<SearchResultMessage[]> {
  const token = getToken();

  // URLSearchParams builds the "?term=...&from=..." part for us and escapes
  // spaces and special characters correctly.
  const queryParts = new URLSearchParams();

  if (term.trim() !== "") {
    queryParts.set("term", term.trim());
  }

  // Only add each filter if the user actually set it
  if (filters) {
    if (filters.withUser !== "") {
      queryParts.set("withUser", filters.withUser);
    }
    if (filters.from !== "") {
      queryParts.set("from", filters.from);
    }
    if (filters.to !== "") {
      queryParts.set("to", filters.to);
    }
    if (filters.contentType !== "") {
      queryParts.set("contentType", filters.contentType);
    }
  }

  const url = `${API_BASE_URL}/api/messages/search?` + queryParts.toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Search failed");
  }

  return data;
}

// Report a message to the admins.
// kind is "direct" for a one-on-one message, or "group" for a group one.
export async function flagMessage(
  kind: "direct" | "group",
  messageId: string,
  reason: string
) {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/api/messages/${kind}/${messageId}/flag`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: reason }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not report this message");
  }

  return data;
}
