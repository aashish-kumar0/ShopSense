const mongoose = require("mongoose")

/*
When a user clicks it, two things happen simultaneously:
1. AffiliateClick document created  ← revenue record
2. User redirected to platform      ← actual purchase happens there
*/

const affiliateClickSchema = new mongoose.Schema({
     // ─── References 
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },

    // Reference to the exact PlatformPrice document
    platformPriceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformPrice",
      required: [true, "PlatformPrice reference is required"],
    },

     // ─── Click data ──────────────────────────────────────────
    platform: {
      type: String,
      required: [true, "Platform is required"],
      enum: ["amazon", "flipkart", "myntra", "meesho", "bigbasket", "blinkit", "swiggy", "nykaa", "ajio", "zepto"],
    },

    // Price snapshot at click time
    priceAtClick: {
      type: Number,
      required: [true, "Price at click is required"],
      min: [0, "Price cannot be negative"],
    },

    // The exact affiliate URL the user was sent to
    affiliateUrl: {
      type: String,
      required: [true, "Affiliate URL is required"],
      trim: true,
    },

    // ─── Revenue tracking ─>  Did this click result in a purchase?
    converted: {
      type: Boolean,
      default: false,
    },

    convertedAt: {
      type: Date,
      default: null,             // filled when conversion webhook fires
    },

    // Estimated commission earned from this click
    commissionEarned: {
      type: Number,
      default: 0,                // in INR
    },

    // ─── Click context ─> Where on the page did the user click from?
    clickSource: {
      type: String,
      enum: [
        "product_page",          // "View" button on product detail page
        "search_results",        // platform badge on search results
        "wishlist",              // external link icon in wishlist (image 10)
        "compare_page",          // platform pricing breakdown (image 7)
        "price_alert",           // click from price drop notification
      ],
      required: true,
    },

    clickedAt: {
      type: Date,
      default: Date.now,
    },
},

    {
    // Clicks are never updated except for conversion webhook
    // So updatedAt is only needed for that case
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ─── Indexes ──────────────────────────────────────────────────

// Revenue dashboard: "show me all clicks this month"
affiliateClickSchema.index({ clickedAt: -1 });

// Per-user click history
affiliateClickSchema.index({ userId: 1, clickedAt: -1 });

// Per-product click analytics
affiliateClickSchema.index({ productId: 1, clickedAt: -1 });

// Per-platform revenue breakdown
// "Amazon vs Flipkart — which earns more?"
affiliateClickSchema.index({ platform: 1, clickedAt: -1 });

// Conversion funnel — filter converted clicks only
affiliateClickSchema.index({ converted: 1 });

// "which page placement drives most revenue?"
affiliateClickSchema.index({ clickSource: 1 });


// ─── Static methods ───────────────────────────────────────────

// Powers "Revenue (MTD)
affiliateClickSchema.statics.getMonthlyRevenue = async function () {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        clickedAt: { $gte: startOfMonth },
        converted: true,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$commissionEarned" },
        totalClicks: { $sum: 1 },
        totalConversions: {
          $sum: { $cond: ["$converted", 1, 0] },
        },
      },
    },
  ]);
   return result[0] || {
    totalRevenue: 0,
    totalClicks: 0,
    totalConversions: 0,
  };
};

// Powers "Revenue & Affiliate Earnings" bar chart
affiliateClickSchema.statics.getYearlyBreakdown = async function () {
  return this.aggregate([
    {
      $match: {
        clickedAt: {
          $gte: new Date(new Date().getFullYear(), 0, 1), // Jan 1 of current year
        },
      },
    },
    {
      $group: {
        _id: { $month: "$clickedAt" },      // group by month number
        totalRevenue: { $sum: "$commissionEarned" },
        affiliateRevenue: {
          $sum: {
            $cond: ["$converted", "$commissionEarned", 0],
          },
        },
        clicks: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },                 // sort by month ascending
  ]);
};

// Platform breakdown — "Amazon vs Flipkart earnings"
affiliateClickSchema.statics.getPlatformBreakdown = async function () {
  return this.aggregate([
    {
      $group: {
        _id: "$platform",
        totalClicks: { $sum: 1 },
        totalRevenue: { $sum: "$commissionEarned" },
        conversions: {
          $sum: { $cond: ["$converted", 1, 0] },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

module.exports = mongoose.model("AffiliateClick", affiliateClickSchema);