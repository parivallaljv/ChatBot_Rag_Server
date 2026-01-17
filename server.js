// server.js
// Express API server for RAG system with Ollama

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { OllamaEmbeddings } = require("@langchain/community/embeddings/ollama");

// -------------------- EXPRESS SETUP --------------------
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// -------------------- RAG STATE --------------------
let vectorStore = null;
let ragChain = null;
let isInitialized = false;
let allDocuments = []; 

// -------------------- OLLAMA CONFIGURATION --------------------
const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  chatModel: process.env.CHAT_MODEL || "qwen2.5-coder:3b",
};

// -------------------- DOCUMENT LOADING --------------------
const loadDocuments = async (files) => {
  const allDocs = [];

  for (const file of files) {
    const fileId = `${Date.now()}-${file.originalname}`;

    const loader = new PDFLoader(file.path);
    const docs = await loader.load();

    docs.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        fileId,
        fileName: file.originalname,
      };
    });

    allDocs.push(...docs);

    await fs.unlink(file.path);
  }

  return allDocs;
};


// -------------------- DOCUMENT INGESTION --------------------
const ingestDocuments = async (docs, customPrompt = null) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splits = await splitter.splitDocuments(docs);

  // 🔥 Persist documents
  allDocuments.push(...splits);

  const embeddings = new OllamaEmbeddings({
    model: OLLAMA_CONFIG.embeddingModel,
    baseUrl: OLLAMA_CONFIG.baseUrl,
  });

  // 🔥 Always rebuild store from registry
  vectorStore = await MemoryVectorStore.fromDocuments(
    allDocuments,
    embeddings
  );

  await setupRAGChain(customPrompt);
  isInitialized = true;
};


const setupRAGChain = async (customPrompt = null) => {
  const retriever = vectorStore.asRetriever({ k: 5 });

  const llm = new ChatOllama({
    model: OLLAMA_CONFIG.chatModel,
    temperature: 0,
    baseUrl: OLLAMA_CONFIG.baseUrl,
  });

  // ✅ Always valid LangChain prompt
  const basePrompt = `
You are a helpful assistant.

Use ONLY the context below to answer the question.
If the answer is not present, say "I don't know".

Context:
{context}

Question:
{input}

Answer:
`;

  let finalPrompt = basePrompt;

  // ✅ User sends instruction-style prompt (plain English)
  if (customPrompt && customPrompt.trim()) {
    finalPrompt = `
You are a helpful assistant.

System Instruction:
${customPrompt}

Use ONLY the context below to answer the question.
If the answer is not present, say "I don't know".

Context:
{context}

Question:
{input}

Answer:
`;
  }

  const prompt = ChatPromptTemplate.fromTemplate(finalPrompt);

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt,
  });

  ragChain = await createRetrievalChain({
    retriever,
    combineDocsChain: documentChain,
  });
};


// -------------------- ANSWER QUESTION --------------------
const askQuestion = async (question) => {
  if (!isInitialized || !ragChain) {
    throw new Error("RAG system not initialized. Please ingest documents first.");
  }
  const response = await ragChain.invoke({ input: question });
  return {
    answer: response.answer,
    sources: response.context?.map((doc, i) => ({
      page: doc.metadata.loc?.pageNumber || "N/A",
      source: path.basename(doc.metadata.source || "Unknown"),
      content: doc.pageContent.substring(0, 200) + "...",
    })) || [],
  };
};

// -------------------- API ROUTES --------------------

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    initialized: isInitialized,
    ollama: OLLAMA_CONFIG,
  });
});

// POST /api/ingest - Upload and ingest documents
app.post("/api/ingest", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files;
    const customPrompt = req.body.prompt;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: "No files uploaded",
      });
    }

    console.log(`Received ${files.length} file(s) for ingestion`);

    // Load documents
    const docs = await loadDocuments(files);

    // Ingest documents
    await ingestDocuments(docs, customPrompt);

    res.json({
      success: true,
      message: `Successfully ingested ${docs.length} document pages`,
      chunks: vectorStore ? "created" : "added",
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({
      error: "Failed to ingest documents",
      details: error.message,
    });
  }
});

app.delete("/api/documents/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const normalize = (v) =>
      decodeURIComponent(String(v)).trim();

    console.log(allDocuments,'all documents 2') 


    allDocuments = allDocuments.filter(
      (doc) =>{
        console.log(doc.metadata.fileName,"doc.metadata.fileName")
        console.log(fileName,'fileName')
        normalize(doc.metadata.fileName) !== normalize(fileName)
  });

    // console.log(allDocuments,'all documents 1')

    // 🔁 Rebuild vector store
    if (allDocuments.length > 0) {
      const embeddings = new OllamaEmbeddings({
        model: OLLAMA_CONFIG.embeddingModel,
        baseUrl: OLLAMA_CONFIG.baseUrl,
      });


      vectorStore = await MemoryVectorStore.fromDocuments(
        allDocuments,
        embeddings
      );

      await setupRAGChain();
      isInitialized = true;
    } else {
      vectorStore = null;
      ragChain = null;
      // isInitialized = false;
    }

    res.json({
      success: true,
      message: "Document vectors removed successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

app.get("/api/status", (req, res) => {
  res.json({
    initialized: isInitialized,
    hasVectorStore: vectorStore !== null,
    hasRagChain: ragChain !== null,
    documentCount: new Set(
      allDocuments.map((d) => d.metadata.fileName)
    ).size,
    config: OLLAMA_CONFIG,
  });
});


// POST /api/chat - Ask a question
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    if (!isInitialized) {
      return res.status(400).json({
        error: "RAG system not initialized. Please ingest documents first.",
      });
    }

    console.log(`Question: ${message}`);

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

// POST /api/update-prompt - Update the system prompt
app.post("/api/update-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    if (!isInitialized) {
      return res.status(400).json({
        error: "RAG system not initialized. Please ingest documents first.",
      });
    }

    await setupRAGChain(prompt);

    res.json({
      success: true,
      message: "Prompt updated successfully",
    });
  } catch (error) {
    console.error("Prompt update error:", error);
    res.status(500).json({
      error: "Failed to update prompt",
      details: error.message,
    });
  }
});

// GET /api/status - Get system status
app.get("/api/status", (req, res) => {
  res.json({
    initialized: isInitialized,
    hasVectorStore: vectorStore !== null,
    hasRagChain: ragChain !== null,
    config: OLLAMA_CONFIG,
  });
});

// POST /api/reset - Reset the vector store
app.post("/api/reset", (req, res) => {
  vectorStore = null;
  ragChain = null;
  isInitialized = false;

  res.json({
    success: true,
    message: "Vector store reset successfully",
  });
});

// -------------------- ERROR HANDLING --------------------
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    error: "Internal server error",
    details: error.message,
  });
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("RAG API Server with Ollama");
  console.log("=".repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("\nEndpoints:");
  console.log(`  POST   /api/ingest       - Upload and ingest PDF files`);
  console.log(`  POST   /api/chat         - Ask questions`);
  console.log(`  POST   /api/update-prompt - Update system prompt`);
  console.log(`  GET    /api/status       - Check system status`);
  console.log(`  POST   /api/reset        - Reset vector store`);
  console.log(`  GET    /health           - Health check`);
  console.log("\nOllama Configuration:");
  console.log(`  Base URL: ${OLLAMA_CONFIG.baseUrl}`);
  console.log(`  Embedding Model: ${OLLAMA_CONFIG.embeddingModel}`);
  console.log(`  Chat Model: ${OLLAMA_CONFIG.chatModel}`);
  console.log("=".repeat(60) + "\n");
});

module.exports = app;