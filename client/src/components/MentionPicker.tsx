import type { ContactUser } from "../api/users";
import Avatar from "./Avatar";

type MentionPickerProps = {
  // What the user has typed after the @ so far, used to filter the list
  filterText: string;
  // People who can be mentioned here (group members, or the other person)
  candidates: ContactUser[];
  onPick: (username: string) => void;
};

// The little list that pops up above the message box when someone types "@".
// Returns null when there is nothing to suggest, so the caller can render it
// unconditionally.
function MentionPicker({
  filterText,
  candidates,
  onPick,
}: MentionPickerProps) {
  const filterLower = filterText.toLowerCase();

  // Show everyone when they've only typed "@", then narrow as they type
  const matches = candidates.filter((oneCandidate) =>
    oneCandidate.username.toLowerCase().startsWith(filterLower)
  );

  if (matches.length === 0) {
    return null;
  }

  // Keep the popup short so it never covers the whole conversation
  const shown = matches.slice(0, 5);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
        Mention someone
      </div>
      {shown.map((oneCandidate) => (
        <button
          key={oneCandidate._id}
          onClick={() => onPick(oneCandidate.username)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 transition text-left"
        >
          <Avatar
            imageUrl={oneCandidate.profilePicture}
            name={oneCandidate.username}
            size="small"
          />
          <span className="text-sm truncate">{oneCandidate.username}</span>
        </button>
      ))}
    </div>
  );
}

export default MentionPicker;
