const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { loadDocuments, ingestDocuments } = require("../rag/ingestion");

router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const docs = await loadDocuments(req.files);
    await ingestDocuments(docs, req.body.prompt);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
