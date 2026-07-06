import { getToken } from "../auth/session";

// A message returned from the search endpoint
export type SearchResultMessage = {
  _id: string;
  text: string;
  sender: string;
  receiver: string;
  createdAt: string;
};

// Search all of the logged-in user's messages for a term
export async function searchMessages(
  term: string
): Promise<SearchResultMessage[]> {
  const token = getToken();

  // encodeURIComponent makes the term safe to put in a URL
  // (handles spaces and special characters correctly)
  const url =
    "http://localhost:5000/api/messages/search?term=" +
    encodeURIComponent(term);

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