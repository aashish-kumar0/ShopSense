const { Queue} = require("bullmq")
const { createRedisConnection } = require("../config/redis")

// one queue instance shared across the app
// only the controller uses this to add jobs

const productIngestionQueue = new Queue("product-ingestion",{
    connection : createRedisConnection(),
    defaultJobOptions : {
        attempts : 3, // retry failed jobs upto 3 times
        backoff : {
            type : "exponential", 
            delay : 2000,  // 2s -> 4s -> 8s b/w retries
        },
        removeOnComplete : 50, // keep last 50 completed jobs in redis (for debugging)
        removeOnFail : 100,    // keep last 10 failed jobs
    }
})

module.exports = productIngestionQueue;