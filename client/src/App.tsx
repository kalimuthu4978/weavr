import { useState } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatScreen from "./components/ChatScreen";
import { getStoredUser, clearSession } from "./auth/session";
import type { StoredUser } from "./auth/session";

function App() {
  // Start logged in if a user was already saved from a previous session.
  // This is why a refresh keeps you logged in.
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(
    getStoredUser()
  );

  // Called by the login form after a successful login
  function handleAuthSuccess(user: StoredUser) {
    setCurrentUser(user);
  }

  // Called by the Log out button in the chat header
  function handleLogout() {
    clearSession();      // remove token + user from localStorage
    setCurrentUser(null); // switch back to the auth screen
  }

  // Not logged in -> auth screen. Logged in -> chat.
  if (currentUser === null) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return <ChatScreen currentUser={currentUser} onLogout={handleLogout} />;
}

export default App;