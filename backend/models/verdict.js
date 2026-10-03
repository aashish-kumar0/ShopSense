// models/Verdict.js
const mongoose = require("mongoose");

const verdictSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      unique: true,
    },

    verdictText: {
      type: String,
      required: [true, "Verdict text is required"],
      trim: true,
    },

    // Hash of specs/ingredients/nutrition used to generate this verdict —
    // regenerate only when this changes
    specsHash: {
      type: String,
      required: true,
    },

    // AI metadata
    modelUsed: {
      type: String,
      default: "gemini-2.5-flash",
    },

    tokensUsed: {
      type: Number,
      default: 0,
    },

    estimatedCostUsd: {
      type: Number,
      default: 0,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
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

// Indexes

// for cost analytics on ai model usage
verdictSchema.index({ generatedAt: -1 });

// Statics

// Called on product page load — returns the cached verdict, or null if never generated
verdictSchema.statics.findByProduct = async function (productId) {
  return this.findOne({ productId });
};

// Called by admin to track Gemini costs
verdictSchema.statics.getDailyCost = async function () {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    { $match: { generatedAt: { $gte: startOfDay } } },
    {
      $group: {
        _id: null,
        totalCost: { $sum: "$estimatedCostUsd" },
        totalTokens: { $sum: "$tokensUsed" },
        totalVerdicts: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalCost: 0, totalTokens: 0, totalVerdicts: 0 };
};

module.exports = mongoose.model("Verdict", verdictSchema);