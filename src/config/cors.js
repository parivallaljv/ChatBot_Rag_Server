const cors = require("cors");

module.exports = cors({
  origin: [
    "http://rag-test-chatbot.s3-website-us-east-1.amazonaws.com",
    "https://rag-test-chatbot.s3-website-us-east-1.amazonaws.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false, // set true ONLY if you use cookies
});

