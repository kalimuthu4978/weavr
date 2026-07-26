type OpenFileRequest = {
  url: string;
  name: string;
  type: string;
};

type MessageContentProps = {
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string; // "image" | "video" | "file" | ""
  // True when an admin removed it. The server has already blanked the
  // content, so all we can show is a note.
  isHidden: boolean;
  // Asks the parent to open the full preview modal
  onOpenFile: (file: OpenFileRequest) => void;
};

// The inside of a message bubble: an image, a video, a file link, or plain
// text. Shared by the direct and group conversations so both behave the same.
function MessageContent({
  text,
  fileUrl,
  fileName,
  fileType,
  isHidden,
  onOpenFile,
}: MessageContentProps) {
  if (isHidden) {
    return (
      <span className="italic text-sm opacity-75">
        This message was removed by an admin
      </span>
    );
  }

  const hasFile = fileUrl !== undefined && fileUrl !== "";

  if (hasFile && fileType === "image") {
    return (
      <img
        src={fileUrl}
        alt={fileName || "image"}
        onClick={() =>
          onOpenFile({
            url: fileUrl || "",
            name: fileName || "image",
            type: "image",
          })
        }
        className="rounded-lg max-w-full max-h-64 cursor-pointer"
      />
    );
  }

  if (hasFile && fileType === "video") {
    return (
      <div>
        {/* Play inline. Clicking the video itself must not open the modal,
            or it would fight with the play/pause controls - so the caption
            underneath is the way to open it larger. */}
        <video
          src={fileUrl}
          controls
          preload="metadata"
          className="rounded-lg max-w-full max-h-64"
        />
        <button
          onClick={() =>
            onOpenFile({
              url: fileUrl || "",
              name: fileName || "video",
              type: "video",
            })
          }
          className="mt-1 text-xs underline opacity-80 hover:opacity-100"
        >
          {fileName || "video"}
        </button>
      </div>
    );
  }

  if (hasFile) {
    return (
      <div
        onClick={() =>
          onOpenFile({
            url: fileUrl || "",
            name: fileName || "File",
            type: "file",
          })
        }
        className="flex items-center gap-2 cursor-pointer"
      >
        <span className="text-2xl">📄</span>
        <span className="text-sm underline">{fileName || "File"}</span>
      </div>
    );
  }

  // No attachment - just the words
  return <>{text}</>;
}

export default MessageContent;
