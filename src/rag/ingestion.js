const fs = require("fs").promises;
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OllamaEmbeddings } = require("@langchain/community/embeddings/ollama");

const ollama = require("../config/ollama");
const state = require("./state");
const { setupRAGChain } = require("./chain");

module.exports.loadDocuments = async (files) => {
  const docs = [];

  for (const file of files) {
    const fileId = `${Date.now()}-${file.originalname}`;
    const loader = new PDFLoader(file.path);
    const loaded = await loader.load();

    loaded.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        fileId,
        fileName: file.originalname,
      };
    });

    docs.push(...loaded);
    await fs.unlink(file.path);
  }

  return docs;
};

module.exports.ingestDocuments = async (docs, customPrompt) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splits = await splitter.splitDocuments(docs);
  state.allDocuments.push(...splits);

  const embeddings = new OllamaEmbeddings({
    model: ollama.embeddingModel,
    baseUrl: ollama.baseUrl,
  });

  state.vectorStore = await MemoryVectorStore.fromDocuments(
    state.allDocuments,
    embeddings
  );

  await setupRAGChain(customPrompt);
  state.isInitialized = true;
};
