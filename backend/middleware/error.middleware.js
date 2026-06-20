// This middleware signature has 4 params — Express identifies error handlers
// by the (err, req, res, next) signature specifically. Don't remove `next`
// even if it's unused, or Express won't treat this as an error handler.
const errorHandler = (err, req, res, next) => {
  // Log the full error internally — never expose stack traces to clients
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Mongoose validation error — e.g. required field missing
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(", ") });
  }

  // Mongoose duplicate key — e.g. email already registered
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired" });
  }

  // Fallback — unknown server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    // Only include stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;