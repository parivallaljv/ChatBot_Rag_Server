const express = require("express");
const { askQuestion } = require("../rag/qa");

const router = express.Router();
router.post("/", async (req, res) => {
    try {
        const { message } = req.body;

        // ---------- Validation ----------
        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: "Message is required",
            });
        }
        console.log(`Question: ${message}`);
        // ---------- RAG Answer ----------
        const result = await askQuestion(message);

        res.json({
            answer: result.answer,
            sources: result.sources,
        });
    } catch (error) {
        console.error("Chat error:", error);

        res.status(500).json({
            error: "Failed to process question",
            details: error.message,
        });
    }
});

module.exports = router;
