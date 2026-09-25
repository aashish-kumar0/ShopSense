const Redis = require("ioredis");

// shared redis connection used by both bullmq queue and worker
// bullmq requires separate connection instances for queue and worker so we export a factory function instead of creating a single instance

const redisConfig = {
    host : process.env.REDIS_HOST || "localhost",
    port : parseInt(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest : null, // required by bullmq 
};

const createRedisConnection = ()=> new Redis(redisConfig);

if(createRedisConnection) console.log("Redis connected successfully")
module.exports = {createRedisConnection};