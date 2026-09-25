const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

/**
 * Generate embedding for a given text using Gemini
 * @param {string} text
 * @returns {Promise<number[]>} - 3072-dim vector
 */

const generateEmbedding = async (text, taskType = "RETRIEVAL_DOCUMENT") => {
    if (!text || typeof text !== "string") {
        throw new Error("Invalid text input for embedding");
    }
    const result = await embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType,
    });
    return result.embedding.values;
};

/**
 * Build a rich text representation of a product for embedding
 * @param {object} product - Mongoose product document
 * @returns {string}
 */
const buildProductText = (product) => {
    const parts = [
        product.name,
        product.brand || "",
        product.category,
        product.description || "",
        product.tags?.join(" ") || "",
    ];

    // Add specs if present (Map → object)
    if (product.specs) {
        const specsObj =
            product.specs instanceof Map
                ? Object.fromEntries(product.specs)
                : product.specs;

        const specsText = Object.entries(specsObj)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");

        parts.push(specsText);
    }

    return parts.filter(Boolean).join(". ");
};

module.exports = { generateEmbedding, buildProductText };