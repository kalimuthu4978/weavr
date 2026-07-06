import { useState } from "react";
import type { StoredUser } from "../auth/session";
import { updateProfile } from "../api/users";
import { updateStoredUser } from "../auth/session";

type ProfilePanelProps = {
  currentUser: StoredUser;
  onClose: () => void;
  onProfileUpdated: (updatedUser: StoredUser) => void;
};

function ProfilePanel({
  currentUser,
  onClose,
  onProfileUpdated,
}: ProfilePanelProps) {
  const [username, setUsername] = useState(currentUser.username);
  const [statusMessage, setStatusMessage] = useState(
    currentUser.statusMessage || ""
  );
  const [feedback, setFeedback] = useState("");

  async function handleSave() {
    setFeedback("");

    if (username.trim() === "") {
      setFeedback("Username cannot be empty");
      return;
    }

    try {
      const data = await updateProfile(username, statusMessage);

      // Build the updated user object to store app-wide
      const updatedUser: StoredUser = {
        id: currentUser.id,
        username: data.user.username,
        email: currentUser.email,
        statusMessage: data.user.statusMessage,
      };

      updateStoredUser(updatedUser);   // save to localStorage
      onProfileUpdated(updatedUser);    // tell App so the header updates
      setFeedback("Profile saved!");
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  return (
    // Full-screen dim overlay; clicking it closes the panel
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* The panel itself. stopPropagation so clicking INSIDE doesn't close it */}
      <div
        className="bg-white text-gray-800 rounded-xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-purple-700 mb-4">My Profile</h2>

        <label className="block text-sm font-semibold mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
        />

        <label className="block text-sm font-semibold mb-1">
          Status message
        </label>
        <input
          type="text"
          value={statusMessage}
          onChange={(e) => setStatusMessage(e.target.value)}
          placeholder="e.g. Working from home"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
        />

        {/* Email shown but not editable (read-only info) */}
        <p className="text-sm text-gray-500 mb-4">
          Email: {currentUser.email}
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>

        {feedback !== "" && (
          <p className="text-center text-sm mt-4 text-gray-700">{feedback}</p>
        )}
      </div>
    </div>
  );
}

export default ProfilePanel;