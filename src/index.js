// Load .env ONLY for local development
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

if (!isLambda) {
    require("dotenv").config();
}

const serverless = require("serverless-http");
const app = require("./app");

// ---- Local development server ----
if (!isLambda) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Local server running at http://localhost:${PORT}`);
    });
}

// ---- Lambda handler ----
module.exports.handler = serverless(app);
