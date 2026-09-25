const { generateEmbedding, buildProductText } = require("./embedding.service");
const { upsertProductEmbedding, querySimilarProducts } = require("./pinecone.service");
const Product = require("../../models/Product");

/**
 * Embed a product and upsert into Pinecone
 * Called after a product is saved to MongoDB
 * @param {object} product - Mongoose product document
 */
const indexProduct = async (product) => {
  try {
    const text = buildProductText(product);
    const embedding = await generateEmbedding(text, "RETRIEVAL_DOCUMENT");
    console.log(`[indexProduct] embedding length: ${embedding?.length}, category: ${product.category}, id: ${product._id}`);
    await upsertProductEmbedding(
      product._id.toString(),
      embedding,
      product.category,
      {
        name: product.name,
        brand: product.brand,
      }
    );

    console.log(`✅ Indexed product in Pinecone: ${product.name}`);
  } catch (err) {
    // Don't crash the worker if indexing fails — just log it
    console.error(`❌ Failed to index product ${product._id}:`, err.message);
  }
};

/**
 * Semantic search — embed query → Pinecone → fetch from MongoDB
 * @param {string} queryText - raw user search query
 * @param {string} category - "food" | "electronics" | "skincare"
 * @param {number} topK
 * @returns {Promise<object[]>} - array of Product documents
 */
const semanticSearch = async (queryText, category, topK = 10) => {
  // Step 1: Embed the query
  const queryEmbedding = await generateEmbedding(queryText,"RETRIEVAL_QUERY");

  // Step 2: Search Pinecone for similar product IDs
  const productIds = await querySimilarProducts(queryEmbedding, category, topK);

  if (!productIds.length) return [];

  // Step 3: Fetch full product docs from MongoDB
  const products = await Product.find({ _id: { $in: productIds } })
    .populate("platformPrices")
    .lean();

  // Step 4: Reorder results to match Pinecone's similarity ranking
  const idOrder = productIds;
  products.sort(
    (a, b) =>
      idOrder.indexOf(a._id.toString()) - idOrder.indexOf(b._id.toString())
  );

  return products;
};

module.exports = { indexProduct, semanticSearch };