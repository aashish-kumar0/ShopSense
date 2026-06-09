const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// GET /api/health
// Used by Railway, Vercel, and your own sanity checks to confirm the server + database are both alive
router.get("/", (req, res) => {
  const dbState = mongoose.connection.readyState;

  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatus = dbState === 1 ? "connected" : "disconnected";

  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? "ok" : "degraded",
    db: dbStatus,
    uptime: Math.floor(process.uptime()) + "s",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;