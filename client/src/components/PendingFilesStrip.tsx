type PendingFile = {
  url: string;
  name: string;
  type: string; // "image" | "video" | "file"
};

type PendingFilesStripProps = {
  files: PendingFile[];
  // Called with the position of the file the user wants to unstage
  onRemove: (index: number) => void;
};

// The row of thumbnails shown above the message box for files that have been
// uploaded but not sent yet. Used by both the direct and group conversations.
function PendingFilesStrip({ files, onRemove }: PendingFilesStripProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 px-3 pt-3">
      <div className="text-xs text-gray-500 mb-2">
        {files.length} file{files.length > 1 ? "s" : ""} ready to send
      </div>

      {/* Thumbnails wrap onto more rows when several files are staged */}
      <div className="flex flex-wrap gap-3">
        {files.map((oneFile, index) => (
          <div
            key={oneFile.url + index}
            className="relative w-20 flex flex-col items-center"
          >
            {oneFile.type === "image" ? (
              <img
                src={oneFile.url}
                alt={oneFile.name}
                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
              />
            ) : oneFile.type === "video" ? (
              <video
                src={oneFile.url}
                muted
                preload="metadata"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 bg-black"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-2xl">
                📄
              </div>
            )}

            <span
              className="text-[10px] text-gray-500 mt-1 w-full truncate text-center"
              title={oneFile.name}
            >
              {oneFile.name}
            </span>

            {/* Small x in the corner to unstage just this one file */}
            <button
              onClick={() => onRemove(index)}
              title={"Remove " + oneFile.name}
              className="absolute -top-1.5 -right-0.5 bg-red-500 text-white w-5 h-5 rounded-full text-xs leading-none flex items-center justify-center hover:bg-red-600 transition"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PendingFilesStrip;
