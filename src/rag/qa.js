const state = require("./state");

module.exports.askQuestion = async (question) => {
  if (!state.isInitialized || !state.ragChain) {
    throw new Error("RAG system not initialized.");
  }

  const response = await state.ragChain.invoke({ input: question });

  return {
    answer: response.answer,
    sources:
      response.context?.map((doc) => ({
        page: doc.metadata.loc?.pageNumber || "N/A",
        source: doc.metadata.fileName || "Unknown",
        content: doc.pageContent.substring(0, 200) + "...",
      })) || [],
  };
};
