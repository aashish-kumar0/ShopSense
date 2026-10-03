const { createRedisConnection } = require("../config/redis");

const redisClient = createRedisConnection();

module.exports = redisClient;