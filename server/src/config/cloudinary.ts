import { v2 as cloudinary } from "cloudinary";

// Cloudinary is where we store uploaded files (images, videos, documents).
//
// Why not the server's own disk? Render gives our server a temporary disk that
// is wiped every time the app restarts or redeploys. Files saved there would
// disappear. Cloudinary keeps them permanently.
//
// These three values come from the Cloudinary dashboard and are set as
// environment variables (never committed to git).
//
// We apply the config lazily (the first time we actually upload) rather than
// when this file is imported. Imports run before index.ts calls dotenv.config(),
// so at import time process.env would still be empty.
let hasAppliedConfig = false;

function applyConfigOnce() {
  if (hasAppliedConfig) {
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  hasAppliedConfig = true;
}

// A small helper so other files can check whether Cloudinary is set up.
// If the env vars are missing we want a clear error instead of a confusing crash.
export function isCloudinaryConfigured() {
  const hasCloudName = !!process.env.CLOUDINARY_CLOUD_NAME;
  const hasApiKey = !!process.env.CLOUDINARY_API_KEY;
  const hasApiSecret = !!process.env.CLOUDINARY_API_SECRET;

  return hasCloudName && hasApiKey && hasApiSecret;
}

// Uploads a file that is sitting in memory (a Buffer) to Cloudinary.
//
// Cloudinary's upload_stream uses a callback, but the rest of our code uses
// async/await. So we wrap it in a Promise to make it awaitable.
export function uploadBufferToCloudinary(
  fileBuffer: Buffer,
  originalName: string
): Promise<{ secureUrl: string; publicId: string }> {
  applyConfigOnce();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        // "auto" lets Cloudinary work out whether this is an image, a video,
        // or a raw file (like a PDF) and store it the right way.
        resource_type: "auto",
        // Keep everything for this app tidy inside one folder.
        folder: "weavr",
        // Keep the original name visible in the Cloudinary dashboard,
        // but let Cloudinary add a unique suffix so nothing overwrites.
        // (upload_stream has no filename of its own, so we pass it explicitly.)
        filename_override: originalName,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error("Cloudinary returned no result"));
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    // Push the file's bytes into the stream and close it.
    uploadStream.end(fileBuffer);
  });
}

export default cloudinary;
