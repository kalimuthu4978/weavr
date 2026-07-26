import { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatScreen from "./components/ChatScreen";
import { getStoredUser, clearSession } from "./auth/session";
import type { StoredUser } from "./auth/session";
import socket from "./socket";
import AdminDashboard from "./components/AdminDashboard";

function App() {
  // Start logged in if a user was already saved from a previous session.
  // This is why a refresh keeps you logged in.
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(
    getStoredUser()
  );

  const [showAdmin, setShowAdmin] = useState(false);

  // On first load, if we're already logged in, connect the socket.
  useEffect(() => {
    if (currentUser !== null) {
      socket.auth = { userId: currentUser.id };
      socket.connect();
    }
  }, []);

  // Called by the login form after a successful login
  function handleAuthSuccess(user: StoredUser) {
    setCurrentUser(user);

    // Update the socket's auth with THIS user's id, then connect.
    // Without this, after logout->login as a different user, the socket
    // would still be using the previous user's id.
    socket.auth = { userId: user.id };
    socket.connect();
  }

  function handleProfileUpdated(updatedUser: StoredUser) {
    setCurrentUser(updatedUser);
  }

  function handleLogout() {
    // Tell the server we're leaving so our status goes offline
    socket.disconnect();

    clearSession();
    setCurrentUser(null);
  }

  // Not logged in -> auth screen. Logged in -> chat.
  if (currentUser === null) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Admins can open the dashboard
  if (showAdmin && currentUser.isAdmin) {
    return (
      <AdminDashboard
        currentUser={currentUser}
        onBack={() => setShowAdmin(false)}
      />
    );
  }

  return (
    <ChatScreen
      currentUser={currentUser}
      onLogout={handleLogout}
      onProfileUpdated={handleProfileUpdated}
      onOpenAdmin={() => setShowAdmin(true)}
    />
  );

}
export default App;