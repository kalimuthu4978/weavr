import { getToken } from "../auth/session";

const API_URL = "http://localhost:5000/api/users";

// The shape of a user in the contact list
export type ContactUser = {
  _id: string;
  username: string;
  email: string;
  status: string;   // <-- add this
};

// Fetch every other user (the backend excludes the logged-in one)
export async function fetchUsers(): Promise<ContactUser[]> {
  const token = getToken();

  const response = await fetch(API_URL, {
    method: "GET",
    headers: {
      // Send the token so the protected route lets us in.
      // Format must be "Bearer <token>" - same as you used in Thunder Client.
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load users");
  }

  return data;
}