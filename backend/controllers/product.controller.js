const Product = require("../models/Product");
const PlatformPrice = require("../models/PlatformPrice");
const { detectCategory } = require("../services/ai/categoryDetection.service");
const { searchOpenFoodFacts } = require("../services/product/openFoodFacts.service");
const productIngestionQueue = require("../queues/productIngestion.queue");
const { semanticSearch } = require("../services/rag/rag.service");

// Helper function to increment search counts asynchronously
const incrementSearchCounts = async (productIds) => {
    try {
        if (!productIds || productIds.length === 0) return;
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $inc: { searchCount: 1 } }
        );
    } catch (err) {
        console.error("[incrementSearchCounts]", err);
    }
};

const searchProducts = async (req, res) => {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Search query is required."
            });
        }

        // ── Step 1: Category Detection ─────────────────────────────────────
        const category = await detectCategory(query);

        if (category === "unknown") {
            return res.status(200).json({
                success: true,
                category: "unknown",
                message: "We currently support food, electronics, and skincare products.",
                data: [],
            });
        }

        // ── Step 2: Semantic search via Pinecone ───────────────────────────
        // Embed query → find similar products in Pinecone → fetch from MongoDB
        const cachedProducts = await semanticSearch(query, category, 10);

        if (cachedProducts.length > 0) {
            // increment searchCount async
            incrementSearchCounts(cachedProducts.map((p) => p._id));

            return res.status(200).json({
                success: true,
                source: "cache",
                category,
                count: cachedProducts.length,
                data: cachedProducts,
            });
        }

        // ── Step 3: Cache miss ─────────────────────────────────────────────
        if (category === "electronics" || category === "skincare") {
            return res.status(200).json({
                success: true,
                source: "cache",
                category,
                count: 0,
                message: `No ${category} products found matching "${query}". Try a different search term.`,
                data: [],
            });
        }

        // For food: fetch live from Open Food Facts
        const freshProducts = await searchOpenFoodFacts(query, 10);

        if (!freshProducts.length) {
            return res.status(200).json({
                success: true,
                source: "open_food_facts",
                category,
                count: 0,
                message: `No products found for "${query}". Try a different search term.`,
                data: [],
            });
        }

        // ── Step 4: Return results immediately ─────────────────────────────
        res.status(200).json({
            success: true,
            source: "open_food_facts",
            category,
            count: freshProducts.length,
            data: freshProducts,
        });

        // ── Step 5: Fire-and-forget ingestion job ──────────────────────────
        // Worker upserts to MongoDB + indexes to Pinecone
        await productIngestionQueue.add(
            "ingest-products",
            { products: freshProducts },
            { jobId: `ingest-${query.replace(/\s+/g, "-")}-${Date.now()}` }
        );

    } catch (err) {
        console.error("[searchProducts]", err);
        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
        });
    }
};

module.exports = { searchProducts };