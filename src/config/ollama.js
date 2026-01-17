module.exports = {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
    chatModel: process.env.CHAT_MODEL || "qwen2.5-coder:3b",
  };
  