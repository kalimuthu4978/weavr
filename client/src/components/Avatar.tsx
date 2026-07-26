type AvatarProps = {
  // The Cloudinary URL of the picture. Empty or missing is fine.
  imageUrl?: string;
  // Used for the fallback letter and the alt text
  name: string;
  // Roughly how big the circle should be
  size?: "small" | "medium" | "large";
};

// A round profile picture that falls back to the first letter of the name
// when the person (or group) hasn't set a picture.
//
// Used for users AND groups, so it deliberately knows nothing about either -
// it just takes a URL and a name.
function Avatar({ imageUrl, name, size = "medium" }: AvatarProps) {
  // Pick the Tailwind classes for the chosen size
  let sizeClasses = "w-9 h-9 text-sm";
  if (size === "small") {
    sizeClasses = "w-7 h-7 text-xs";
  }
  if (size === "large") {
    sizeClasses = "w-20 h-20 text-2xl";
  }

  const hasPicture = imageUrl !== undefined && imageUrl !== "";

  if (hasPicture) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={
          sizeClasses +
          " rounded-full object-cover border border-purple-200 shrink-0"
        }
      />
    );
  }

  // No picture: show the first letter on a purple circle.
  // "?" covers the case where the name is somehow empty.
  const firstLetter = name.trim() === "" ? "?" : name.trim().charAt(0);

  return (
    <div
      className={
        sizeClasses +
        " rounded-full bg-purple-200 text-purple-800 font-semibold " +
        "flex items-center justify-center uppercase shrink-0"
      }
      title={name}
    >
      {firstLetter}
    </div>
  );
}

export default Avatar;
