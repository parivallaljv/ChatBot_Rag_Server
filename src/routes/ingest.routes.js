const express = require("express");
const multer = require("multer");
const { ingestDocuments, loadDocuments } = require("../rag/ingestion");
const state = require('../rag/state')

const router = express.Router();
const upload = multer({
  dest: process.env.AWS_LAMBDA_FUNCTION_NAME ? "/tmp" : "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files;
    const customPrompt = req.body?.prompt || null;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const docs = await loadDocuments(files);
    await ingestDocuments(docs, customPrompt);
    state.isInitialized = true;
    res.json({
      success: true,
      message: `Successfully ingested ${docs.length} pages`,
    });
  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({
      error: "Ingestion failed",
      details: err.message,
    });
  }
});

module.exports = router;
