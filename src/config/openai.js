const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Set it in Lambda environment variables.");
}

module.exports = new OpenAI({
    apiKey,
});
