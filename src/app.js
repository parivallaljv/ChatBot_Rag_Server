const express = require("express");
const corsConfig = require("./config/cors");

const ingestRoutes = require("./routes/ingest.routes");
const chatRoutes = require("./routes/chat.routes");
const statusRoutes = require("./routes/status.routes");
const resetRoutes = require("./routes/reset.routes");

const app = express();

app.use(corsConfig);
app.use(express.json());

app.use("/api/ingest", ingestRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/reset", resetRoutes);

module.exports = app;
