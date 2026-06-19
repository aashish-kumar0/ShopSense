const mongoose = require("mongoose");

const systemLogSchema = new mongoose.Schema(
  {
    // ─── Log classification ──────────────────────────────────
    // Determines the icon/color shown in admin panel
    // ⚠ warning  ✓ success  🔔 info  ✕ error
    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      required: [true, "Log type is required"],
    },

    // ─── Message ─────────────────────────────────────────────
    // "High API usage detected — 92% of daily quota used"
    message: {
      type: String,
      required: [true, "Log message is required"],
      trim: true,
      maxlength: [500, "Message too long"],
    },

    // ─── Source ──────────────────────────────────────────────
    // Which part of the system generated this log
    // Helps admin filter: "show me only scraper issues"
    source: {
      type: String,
      enum: [
        "api",            // OpenAI/external API usage
        "scraper",        // Amazon/Flipkart price scrapers
        "queue",          // BullMQ job failures/successes
        "auth",           // login anomalies, suspicious activity
        "payment",        // Razorpay webhook issues
        "database",       // MongoDB connection issues
        "system",         // general server events
      ],
      required: [true, "Source is required"],
    },

    // ─── Additional context ──────────────────────────────────
    // Flexible field for extra debugging data
    // e.g. { productCount: 3200000, duration: "45s" }
    // or   { platform: "flipkart", retryCount: 2, errorCode: "ETIMEOUT" }
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ─── Resolution tracking ─────────────────────────────────
    // Has an admin acknowledged/resolved this alert?
    isResolved: {
      type: Boolean,
      default: false,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",          // assumes admin is also a User with role
      default: null,
    },

    // ─── Severity (for errors specifically) ──────────────────
    // Helps prioritize which errors need immediate attention
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
  },

  {
    // No updatedAt needed beyond resolution tracking
    timestamps: { createdAt: true, updatedAt: false },

    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────

// Most common query: "get recent logs, newest first"
// Powers the System Alerts panel feed
systemLogSchema.index({ createdAt: -1 });

// Filter by type — "show me only errors"
systemLogSchema.index({ type: 1, createdAt: -1 });

// Filter by source — "show me only scraper logs"
systemLogSchema.index({ source: 1, createdAt: -1 });

// Unresolved alerts — powers the "4 new" badge in image 16
systemLogSchema.index({ isResolved: 1, createdAt: -1 });

// TTL index — auto-delete logs older than 30 days
// Keeps the collection from growing forever with routine logs
systemLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// ─── Static methods ───────────────────────────────────────────

// Quick logging helper — called from anywhere in your backend
// Usage: await SystemLog.log("error", "Flipkart scraper timeout", "scraper")
systemLogSchema.statics.log = async function (
  type,
  message,
  source,
  metadata = {},
  severity = "low"
) {
  return this.create({ type, message, source, metadata, severity });
};

// Convenience shortcuts — cleaner than calling .log() every time
systemLogSchema.statics.info = function (message, source, metadata) {
  return this.log("info", message, source, metadata, "low");
};

systemLogSchema.statics.success = function (message, source, metadata) {
  return this.log("success", message, source, metadata, "low");
};

systemLogSchema.statics.warning = function (message, source, metadata) {
  return this.log("warning", message, source, metadata, "medium");
};

systemLogSchema.statics.error = function (message, source, metadata, severity = "high") {
  return this.log("error", message, source, metadata, severity);
};

// Get unresolved count for admin badge
// Powers "4 new" badge next to "System Alerts" in image 16
systemLogSchema.statics.getUnresolvedCount = async function () {
  return this.countDocuments({ isResolved: false, type: { $in: ["warning", "error"] } });
};

// Get recent logs for the admin panel feed
systemLogSchema.statics.getRecent = async function (limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Mark a log as resolved
systemLogSchema.statics.resolve = async function (logId, adminUserId) {
  return this.findByIdAndUpdate(
    logId,
    {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: adminUserId,
    },
    { new: true }
  );
};

module.exports = mongoose.model("SystemLog", systemLogSchema);