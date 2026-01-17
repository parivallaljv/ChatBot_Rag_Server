const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const ollama = require("../config/ollama");
const state = require("./state");

module.exports.setupRAGChain = async (customPrompt = null) => {
  const retriever = state.vectorStore.asRetriever({ k: 5 });

  const llm = new ChatOllama({
    model: ollama.chatModel,
    temperature: 0,
    baseUrl: ollama.baseUrl,
  });

  let template = `
You are a helpful assistant.
Use ONLY the context below to answer the question.
If the answer is not present, say "I don't know".

Context:
{context}

Question:
{input}

Answer:
`;

  if (customPrompt?.trim()) {
    template = `
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

  const prompt = ChatPromptTemplate.fromTemplate(template);

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt,
  });

  state.ragChain = await createRetrievalChain({
    retriever,
    combineDocsChain: documentChain,
  });
};
