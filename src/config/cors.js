const cors = require("cors");

module.exports = cors({
  origin: [
    "http://localhost:3000",
    "http://rag-test-chatbot.s3-website-us-east-1.amazonaws.com",
  ],
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
