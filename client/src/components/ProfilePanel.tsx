import { useState } from "react";
import type { StoredUser } from "../auth/session";
import { updateProfile } from "../api/users";
import { uploadFile } from "../api/upload";
import { updateStoredUser } from "../auth/session";
import Avatar from "./Avatar";

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
  // The picture currently shown in the panel. Starts as whatever is saved,
  // and changes as soon as a new one finishes uploading.
  const [profilePicture, setProfilePicture] = useState(
    currentUser.profilePicture || ""
  );
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Runs when the user picks an image file for their profile picture.
  // We upload it straight away so they can see the result before saving.
  async function handlePictureSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const chosenFiles = event.target.files;
    if (!chosenFiles || chosenFiles.length === 0) {
      return;
    }
    const chosenFile = chosenFiles[0];

    // A profile picture must be an image - reject videos and documents
    if (!chosenFile.type.startsWith("image/")) {
      setFeedback("Your profile picture must be an image");
      return;
    }

    setFeedback("");
    setIsUploading(true);

    try {
      const uploadResult = await uploadFile(chosenFile);
      setProfilePicture(uploadResult.fileUrl);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Could not upload that picture");
      }
    }

    setIsUploading(false);
    // Clear the input so choosing the SAME file again still triggers a change
    event.target.value = "";
  }

  async function handleSave() {
    setFeedback("");

    if (username.trim() === "") {
      setFeedback("Username cannot be empty");
      return;
    }

    try {
      const data = await updateProfile(username, statusMessage, profilePicture);

      // Build the updated user object to store app-wide.
      // isAdmin must be carried over, otherwise saving the profile would
      // make an admin lose their dashboard button until the next login.
      const updatedUser: StoredUser = {
        id: currentUser.id,
        username: data.user.username,
        email: currentUser.email,
        statusMessage: data.user.statusMessage,
        profilePicture: data.user.profilePicture,
        isAdmin: currentUser.isAdmin,
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
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* The panel itself. stopPropagation so clicking INSIDE doesn't close it */}
      <div
        className="bg-white text-gray-800 rounded-xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-purple-700 mb-4">My Profile</h2>

        {/* Profile picture with its own upload / remove controls */}
        <div className="flex items-center gap-4 mb-5">
          <Avatar imageUrl={profilePicture} name={username} size="large" />

          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              id="profilePictureUpload"
              onChange={handlePictureSelected}
              className="hidden"
            />
            <label
              htmlFor="profilePictureUpload"
              className="cursor-pointer text-center bg-purple-100 text-purple-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-200 transition"
            >
              {isUploading ? "Uploading..." : "Change picture"}
            </label>

            {profilePicture !== "" && (
              <button
                onClick={() => setProfilePicture("")}
                className="text-sm text-red-500 hover:underline"
              >
                Remove picture
              </button>
            )}
          </div>
        </div>

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
            disabled={isUploading}
            className="flex-1 bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
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
