// Handles storing and reading the logged-in user's token and info.

// The "names" we store each value under in localStorage
const TOKEN_KEY = "weavr_token";
const USER_KEY = "weavr_user";

// The shape of the user info we keep on hand
export type StoredUser = {
  id: string;
  username: string;
  email: string;
  statusMessage?: string;
  isAdmin?: boolean;
  // Cloudinary URL of the user's picture. Empty/missing means "no picture",
  // and the UI falls back to the first letter of their username.
  profilePicture?: string;
};
// Save token + user after a successful login
export function saveSession(token: string, user: StoredUser) {
  localStorage.setItem(TOKEN_KEY, token);
  // localStorage can only store text, so convert the user object to a string
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Read the token back (null if not logged in)
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Read the user back as an object (null if not logged in)
export function getStoredUser(): StoredUser | null {
  const userText = localStorage.getItem(USER_KEY);
  if (userText === null) {
    return null;
  }
  const user = JSON.parse(userText);
  return user;
}

// Clear everything (used for logout)
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Update just the stored user info (keeps the existing token)
export function updateStoredUser(user: StoredUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}