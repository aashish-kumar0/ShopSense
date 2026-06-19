const mongoose = require("mongoose")

/*
Every time a user compares multiple products, we record which products were compared and what the AI recommended as the winner.
Why store this instead of computing it fresh every time?
Two reasons:
1. Cost — comparing 3 products with AI analysis costs tokens
   If user revisits the same comparison, serve from cache

2. Analytics — 
   Powers admin insights: "users frequently compare Quaker vs Saffola"
   This data could later train better default comparisons
*/

const compareSessionSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    productIds : {
        type : [mongoose.Schema.Types.ObjectId],
        ref : "Product",
        required : true,
        validate : {
            validator : function(arr){
                return arr.length >= 2 && arr.length <=4
            },
            message : "Compare session must have between 2 and 4 products"
        },
    },

    // AI-pick -> which product won
     aiPickProductId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Product",
        required : true,
     },

    // why it won
    aiPickReason: {
      type: String,
      required: [true, "AI pick reason is required"],
      trim: true,
    },

    // Per product labels
    productLabels: {
      type: Map,
      of: String,
      default: () => new Map(),
      // Example: { "productId1": "best_overall", "productId2": "budget_pick" }
    },

    /* Snapshot data
    Comparison metrics ARE the scores/prices at comparison time*/
    comparisonSnapshot: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          price: { type: Number },
          score: { type: Number },
          rating: { type: Number },
          protein: { type: Number },          // for food comparisons
          sugar: { type: Number },
          ingredientSafetyScore: { type: Number },
        },
      ],
      default: [],
      _id: false,
    },

    // ─── User's category context ─────────────────────────────
    // What category was being compared — helps with analytics
    category: {
      type: String,
      trim: true,
      lowercase: true,
    },

     // ─── Validity 
    // Compare sessions go stale after 24 hours since prices update every 4 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
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


// User's compare history — "get all comparisons by this user"
compareSessionSchema.index({ userId: 1, createdAt: -1 });

// TTL index — auto-delete stale comparisons after 24 hours
compareSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// For analytics — "which products are compared together most"
compareSessionSchema.index({ productIds: 1 });

// Category breakdown for admin analytics
compareSessionSchema.index({ category: 1 });


// ─── Virtual fields ───────────────────────────────────────────

// Is this comparison still fresh?
compareSessionSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// How many products in this comparison
compareSessionSchema.virtual("productCount").get(function () {
  return this.productIds.length;
});


// ─── Static methods ───────────────────────────────────────────

// Get compare count for user activity panel
compareSessionSchema.statics.getUserCompareCount = async function (userId) {
  return this.countDocuments({ userId });
};

// Find an existing fresh comparison for the same product set
// Avoids regenerating AI pick reasoning for identical comparisons
compareSessionSchema.statics.findExisting = async function (
  userId,
  productIds
) {
  // Sort IDs so order doesn't matter when matching
  const sortedIds = [...productIds].map(String).sort();

  const sessions = await this.find({
    userId,
    expiresAt: { $gt: new Date() },     // only non-expired
  });

  // Find a session with the exact same product set
  return sessions.find((session) => {
    const sessionIds = session.productIds.map(String).sort();
    return JSON.stringify(sessionIds) === JSON.stringify(sortedIds);
  });
};

// Admin analytics — most frequently compared product pairs
// "users often compare Quaker vs Saffola"
compareSessionSchema.statics.getMostComparedProducts = async function (limit = 10) {
  return this.aggregate([
    { $unwind: "$productIds" },
    {
      $group: {
        _id: "$productIds",
        compareCount: { $sum: 1 },
      },
    },
    { $sort: { compareCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
  ]);
};

module.exports = mongoose.model("CompareSession", compareSessionSchema);