// The base address of our backend's auth routes
import { API_BASE_URL } from "../config";
const API_URL = `${API_BASE_URL}/api/auth`;

// Sends signup details to the backend to create a new account
export async function registerUser(
  username: string,
  email: string,
  password: string
) {
  // fetch makes an HTTP request to the server
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells the server we're sending JSON
    },
    body: JSON.stringify({
      username: username,
      email: email,
      password: password,
    }),
  });

  // Convert the server's JSON reply into a JavaScript object
  const data = await response.json();

  // response.ok is false for error statuses (like 400).
  // If so, throw the server's message so the form can display it.
  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
}

// Sends login details; returns { message, token, user } on success
export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}