import { useState, useEffect } from "react";
import type { PublicProfile } from "../api/users";
import { fetchUserProfile } from "../api/users";
import Avatar from "./Avatar";

type UserProfilePanelProps = {
  userId: string;
  onClose: () => void;
};

// Turns a stored date into something readable, e.g. "26 Jul 2026"
function toReadableDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Describes how long ago something happened in plain words.
// Nicer to read than a raw timestamp for "last active".
function toTimeAgo(isoDate: string) {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const secondsAgo = Math.floor((now - then) / 1000);

  if (secondsAgo < 60) {
    return "just now";
  }

  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) {
    return minutesAgo + (minutesAgo === 1 ? " minute ago" : " minutes ago");
  }

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) {
    return hoursAgo + (hoursAgo === 1 ? " hour ago" : " hours ago");
  }

  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 30) {
    return daysAgo + (daysAgo === 1 ? " day ago" : " days ago");
  }

  // Beyond a month, an actual date is more useful than "63 days ago"
  return "on " + toReadableDate(isoDate);
}

// Puts the status into words with a matching coloured dot
function describeStatus(status: string) {
  if (status === "online") {
    return { label: "Online", dotClass: "bg-green-500" };
  }
  if (status === "away") {
    return { label: "Away", dotClass: "bg-yellow-400" };
  }
  return { label: "Offline", dotClass: "bg-gray-300" };
}

// Shows another person's profile: who they are, their status, and a summary
// of their recent activity. Opened by clicking a name in the chat.
function UserProfilePanel({ userId, onClose }: UserProfilePanelProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const loadedProfile = await fetchUserProfile(userId);
        setProfile(loadedProfile);
      } catch (error) {
        if (error instanceof Error) {
          setErrorText(error.message);
        } else {
          setErrorText("Could not load this profile");
        }
      }
    }

    loadProfile();
  }, [userId]);

  return (
    <div
      className="modal-backdrop fixed inset-0 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="panel-in modal-card bg-white text-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-purple-700">Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {errorText !== "" ? (
          <p className="text-sm text-red-600">{errorText}</p>
        ) : profile === null ? (
          <p className="text-sm text-gray-400">Loading profile...</p>
        ) : (
          <>
            {/* Who they are */}
            <div className="flex items-center gap-4 mb-5">
              <Avatar
                imageUrl={profile.profilePicture}
                name={profile.username}
                size="large"
              />
              <div className="min-w-0">
                <div className="font-semibold text-lg truncate">
                  {profile.username}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span
                    className={
                      "w-2.5 h-2.5 rounded-full " +
                      describeStatus(profile.status).dotClass
                    }
                  ></span>
                  {describeStatus(profile.status).label}
                </div>

                {profile.statusMessage !== "" && (
                  <div className="text-sm text-gray-500 italic mt-0.5 break-words">
                    "{profile.statusMessage}"
                  </div>
                )}
              </div>
            </div>

            {/* Recent activity */}
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Recent activity
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {profile.recentActivity.messagesSent}
                </div>
                <div className="text-xs text-gray-500">Messages sent</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {profile.recentActivity.groupsJoined}
                </div>
                <div className="text-xs text-gray-500">Groups joined</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <div>
                <span className="text-gray-400">Last active: </span>
                {profile.recentActivity.lastMessageAt === null
                  ? "Has not sent a message yet"
                  : toTimeAgo(profile.recentActivity.lastMessageAt)}
              </div>
              <div>
                <span className="text-gray-400">Joined: </span>
                {toReadableDate(profile.joinedAt)}
              </div>
              <div className="truncate">
                <span className="text-gray-400">Email: </span>
                {profile.email}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default UserProfilePanel;
