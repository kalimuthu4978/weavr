import multer from "multer";
import express from "express";

// We keep the uploaded file in memory (as a Buffer) instead of writing it to
// the server's disk. The route handler then forwards that Buffer straight to
// Cloudinary. Render's disk is temporary, so anything written there is lost on
// the next restart or deploy.
const storage = multer.memoryStorage();

// Decides which files we accept. The brief asks for images, videos and documents.
function fileFilter(
  req: express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  const allowedTypes = [
    "image/", // any image (png, jpg, gif, webp, ...)
    "video/", // any video (mp4, webm, quicktime/mov, ...)
    "application/pdf", // PDF
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "text/plain", // .txt
  ];

  // Accept if the file's type starts with or matches any allowed type
  const isAllowed = allowedTypes.some(
    (type) => file.mimetype.startsWith(type) || file.mimetype === type
  );

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(null, false);
  }
}

// Work out a simple label the frontend can switch on when displaying a message.
// The frontend understands "image", "video" and "file".
export function getFileTypeLabel(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
}

// The biggest file we accept. Videos are much larger than images, so this is
// generous compared to the old 10 MB limit.
export const MAX_UPLOAD_MB = 50;

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

export default upload;
