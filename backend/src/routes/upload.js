const express = require("express");
const multer = require("multer");
const { requireAuthentication } = require("../middleware/auth");
const supabase = require("../services/supabase");
const crypto = require("crypto");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Upload proof file to Supabase Storage
router.post("/", requireAuthentication, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const ext = req.file.originalname.split(".").pop();
    const hash = crypto.randomBytes(8).toString("hex");
    const fileName = `proofs/${Date.now()}_${hash}.${ext}`;

    const { data, error } = await supabase.storage
      .from("taskstaker")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("taskstaker")
      .getPublicUrl(fileName);

    res.json({
      url: urlData.publicUrl,
      path: fileName,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

module.exports = router;
