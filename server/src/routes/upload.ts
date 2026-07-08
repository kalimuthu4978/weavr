import express from "express";
import upload from "../config/upload";
import requireAuth from "../middleware/auth";

const router = express.Router();

// POST /api/upload  ->  upload a single image, return its URL
// upload.single("file") means: expect ONE file, sent under the field name "file"
router.post("/", requireAuth, upload.single("file"), (req, res) => {
  try {
    // If the file was rejected (not an image) or missing, req.file is undefined
    if (!req.file) {
      return res
        .status(400)
        .json({
          message: "No image file received (must be an image under 5MB)",
        });
    }

    // Decide a simple type label the frontend can use
    const isImage = req.file.mimetype.startsWith("image/");
    const fileType = isImage ? "image" : "file";

    const fileUrl = "http://localhost:5000/uploads/" + req.file.filename;

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileType: fileType, // "image" or "file"
    });
  } catch (error) {
    console.log("Upload error:", error);
    res.status(500).json({ message: "Something went wrong during upload" });
  }
});

export default router;
