const express = require("express");
const { resetState } = require("../rag/state");

const router = express.Router();

router.post("/", (_, res) => {
    resetState();
    res.json({ success: true });
});

module.exports = router;
