const { Worker } = require("bullmq")
const mongoose = require("mongoose");
const { createRedisConnection } = require("../../config/redis")
const Product = require("../../models/Product")
const PlatformPrice = require("../../models/PlatformPrice");
const { indexProduct } = require("../../services/rag/rag.service");

/*  Worker
    Listens to the "product-ingestion" queue
    Each job contains an array of normalized prodcuts from OFf
    Worker upserts them into MongoDB silently, after user already got their response
*/

const worker = new Worker(
    "product-ingestion",

    async (job) => {
        const { products } = job.data;

        if (!products || !products.length) {
            console.log(`[Worker] Job ${job.id} had no products - skipping`);
            return;
        }
        console.log(`[Worker] Processing Job ${job.id} - ${products.length} prodcuts`);

        let saved = 0;
        let skipped = 0;

        for (const productData of products) {
            try {
                const { platformPrices, ...productFields } = productData;

                // upsert product - match on name + brand to avoid duplicates
                // new : true -> returns the updated doc so we have the _id

                const product = await Product.findOneAndUpdate(
                    {
                        name: productFields.name,
                        brand: productFields.brand,
                    },
                    {
                        $set: productFields,
                        $setOnInsert: { searchCount: 0 } // only set on first insert
                    },
                    {
                        upsert: true,
                        new: true,
                        runValidators: true,
                    }
                );

                // upsert platform prices if provided

                if (platformPrices && platformPrices.length) {
                    for (const priceData of platformPrices) {
                        await PlatformPrice.findOneAndUpdate(
                            {
                                productId: product._id,
                                platform: priceData.platform,
                            },
                            {
                                $set: {
                                    ...priceData,
                                    productId: product._id,
                                    lastUpdated: new Date(),
                                },
                            },
                            {
                                upsert: true,
                                new: true,
                                runValidators: true,
                            }
                        );
                    }
                }

                // Index product in Pinecone for semantic search
                await indexProduct(product);
                saved++;
            }
            catch (err) {
                console.error(`[Worker] Failed to save product "${productData.name}":`, err.message)
                skipped++;
            }
        }
        console.log(`[Worker] Job ${job.id} done — saved: ${saved}, skipped: ${skipped}`);
    },

    {
        connection: createRedisConnection(),
        concurrency: 2, // process 2 jobs at a time
    }
);



// ─── Worker Events 

worker.on("completed", (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
    console.error(`[Worker] ❌ Job ${job.id} failed:`, err.message);
});

worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err.message);
});

module.exports = worker;