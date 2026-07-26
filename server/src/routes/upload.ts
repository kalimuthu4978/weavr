import express from "express";
import upload, { getFileTypeLabel, MAX_UPLOAD_MB } from "../config/upload";
import {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} from "../config/cloudinary";
import requireAuth from "../middleware/auth";

const router = express.Router();

// POST /api/upload  ->  upload a single file, return its permanent Cloudinary URL
// upload.single("file") means: expect ONE file, sent under the field name "file"
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    // If the file was rejected by the filter, or none was sent, req.file is undefined
    if (!req.file) {
      return res.status(400).json({
        message:
          "No file received. Allowed: images, videos and documents under " +
          MAX_UPLOAD_MB +
          "MB.",
      });
    }

    // Fail loudly (and clearly) if the Cloudinary env vars were never set,
    // rather than throwing a confusing error from inside the SDK.
    if (!isCloudinaryConfigured()) {
      console.log("Upload failed: Cloudinary environment variables are missing");
      return res.status(500).json({
        message: "File storage is not configured on the server",
      });
    }

    // Send the file's bytes to Cloudinary and wait for the hosted URL back
    const uploadResult = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname
    );

    // "image", "video" or "file" - the frontend uses this to decide how to display it
    const fileType = getFileTypeLabel(req.file.mimetype);

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: uploadResult.secureUrl,
      fileName: req.file.originalname,
      fileType: fileType,
    });
  } catch (error) {
    console.log("Upload error:", error);

    // Cloudinary rejects files it can't process (a corrupt video, an image
    // over its size cap) with its own http_code. That's the user's file being
    // wrong, not our server breaking, so pass the reason back as a 400
    // instead of a blank 500.
    const cloudinaryError = error as { http_code?: number; message?: string };
    if (cloudinaryError && cloudinaryError.http_code === 400) {
      return res.status(400).json({
        message: cloudinaryError.message || "That file could not be uploaded",
      });
    }

    res.status(500).json({ message: "Something went wrong during upload" });
  }
});

export default router;
