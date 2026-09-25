const { Pinecone } = require("@pinecone-database/pinecone");

let pineconeIndex = null;

/**
 * Initialize Pinecone client and get index reference
 * Call this once at app startup
 */
const initPinecone = async () => {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME);
  console.log("✅ Pinecone initialized");
};

/**
 * Upsert a product embedding into Pinecone
 * @param {string} productId - MongoDB _id as string
 * @param {number[]} embedding - 768-dim vector
 * @param {string} category - "food" | "electronics" | "skincare"
 * @param {object} metadata - extra fields to store in Pinecone
 */
const upsertProductEmbedding = async (productId, embedding, category, metadata = {}) => {
  if (!pineconeIndex) throw new Error("Pinecone not initialized");

  await pineconeIndex.namespace(category).upsert({
    records: [
      {
        id: productId,
        values: embedding,
        metadata: {
          productId,
          category,
          name: metadata.name || "",
          brand: metadata.brand || "",
        },
      },
    ],
  });
};

/**
 * Query Pinecone for similar products
 * @param {number[]} queryEmbedding - 768-dim vector
 * @param {string} category - namespace to search in
 * @param {number} topK - number of results
 * @returns {Promise<string[]>} - array of MongoDB product IDs
 */
const querySimilarProducts = async (queryEmbedding, category, topK = 10) => {
  if (!pineconeIndex) throw new Error("Pinecone not initialized");

  const results = await pineconeIndex.namespace(category).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return results.matches.map((match) => match.metadata.productId);
};

module.exports = { initPinecone, upsertProductEmbedding, querySimilarProducts };