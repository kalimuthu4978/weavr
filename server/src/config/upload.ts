import multer from "multer";
import path from "path";
import express from "express";

// Tell multer WHERE to save files and HOW to name them
const storage = multer.diskStorage({
  // The folder to save uploads into
  destination: function (req, file, callback) {
    callback(null, "uploads");
  },
  // The filename to save as. We make it unique so two files with the
  // same name don't overwrite each other.
  filename: function (req, file, callback) {
    // e.g. 1720000000000-987654321.png
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Keep the original file extension (.png, .jpg, etc.)
    const fileExtension = path.extname(file.originalname);
    callback(null, uniqueSuffix + fileExtension);
  },
});

// Only allow image files for now (we can widen this later for documents)
function fileFilter(
  req: express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  if (file.mimetype.startsWith("image/")) {
    callback(null, true); // accept it
  } else {
    callback(null, false); // reject it (not an image)
  }
}

// Create the multer uploader with a 5 MB size limit
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

export default upload;