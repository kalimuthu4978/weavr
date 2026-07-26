import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";

// The shape of a user in the contact list
export type ContactUser = {
  _id: string;
  username: string;
  email: string;
  status: string;
  statusMessage?: string;   // optional; may be empty
  profilePicture?: string;  // Cloudinary URL; empty means "no picture"
};

// Fetch every other user (the backend excludes the logged-in one)
export async function fetchUsers(): Promise<ContactUser[]> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api/users`, {
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

// (fetchUsers stays above)

// Update the logged-in user's own profile.
// profilePicture is the Cloudinary URL returned by uploadFile(), or "" to
// remove the current picture.
export async function updateProfile(
  username: string,
  statusMessage: string,
  profilePicture: string
) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: username,
      statusMessage: statusMessage,
      profilePicture: profilePicture,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update profile");
  }

  return data; // { message, user }
}