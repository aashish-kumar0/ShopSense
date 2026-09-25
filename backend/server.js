require("dotenv").config();

const express = require("express")
const app=express()
const http=require("http")
const cors=require("cors")
const helmet = require("helmet")
const validateEnv = require("./config/env");
const connectDB = require("./config/db");
const healthRoutes=require("./routes/health.routes")
const rateLimit=require("express-rate-limit")
const onboardingRoutes = require("./routes/onboarding.routes")
const productRoutes = require("./routes/product.routes");
const worker = require("./queues/workers/productIngestion.worker");


// ─── Validate env vars before doing anything else ────────────────────────────
// If MONGODB_URI or JWT_SECRET is missing, the server will exit here.
// This surfaces the problem immediately, not after 10 minutes of confusion.
validateEnv();

// Connection to MongoDB
connectDB();

// Initialize Pinecone
const { initPinecone } = require("./services/rag/pinecone.service");
initPinecone().catch((err) => {
  console.error("❌ Pinecone initialization failed:", err.message);
  process.exit(1);
});

// http.createServer wraps Express so we can attach Socket.io to the same port
// If we used app.listen() directly, Socket.io would need a separate port — which is messy in production.

const server = http.createServer(app);

// Security Middlewares
// helmet sets secure HTTP headers
app.use(helmet());

// cors will only allow requests from our frontend
app.use(
    cors({
    origin:process.env.FRONTEND_URL || "http://localhost:3000",
    credentials:true, // Allows cookies to be sent cross-origin
})
);

// Request Parsing
app.use(express.json({ limit: "10kb" })); // Reject oversized payloads
app.use(express.urlencoded({ extended: true }));
 
// Logging- Morgan logs every request
// if (process.env.NODE_ENV !== "test") {
//   app.use(morgan("dev"));
// }

// Rate Limiting

// 100 requests per 15 minutes per IP — prevents abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests, slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);


// Routes
app.use("/api/health", healthRoutes);

app.use("/api/auth", require("./routes/auth.routes"))

app.use("/api/onboarding", onboardingRoutes);

app.use("/api/products",productRoutes);



// 404 error handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

// Global error handler — MUST be last middleware
const errorHandler = require("./middleware/error.middleware");
app.use(errorHandler);


// ─── Start server 
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ShopSense backend running on port ${PORT}`);
//   console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown — close DB connection cleanly on Ctrl+C
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully");
  server.close(() => process.exit(0));
});
 








