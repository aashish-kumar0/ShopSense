const mongoose = require("mongoose")
const { platform } = require("os")

const priceAlertSchema = new mongoose.Schema({

    // references
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

    // Alert configuration- alert fires when any platform drops below target
    platform : {
        type : String,
        enum : ["amazon", "flipkart", "myntra", "meesho", "bigbasket", "blinkit", "swiggy", "nykaa", "ajio", "zepto"],
        default : "any",
    },

    // Alert fires when price drops below or equal to this value
    targetPrice : {
        type : Number,
        required: [true, "Target price is required"],
        min: [0, "Target price cannot be negative"],
    },

    // Price at the time alert was created
    priceWhenSet: {
      type: Number,
      required: [true, "Price when set is required"],
      min: [0, "Price cannot be negative"],
    },

    // Most recent price- updated by BullMQ worker
    currentPrice: {
      type: Number,
      default: null,
    },

    // Alert status
    isActive: {
      type: Boolean,
      default: true,
      // Set to false when:
      // 1. Alert is triggered
      // 2. User manually deletes the alert
      // 3. Product goes out of stock on all platforms
    },

    // ─── Trigger data -> Filled in when alert fires
    triggeredAt: {
      type: Date,
      default: null,
    },

    // Which platform triggered the alert
    triggeredOnPlatform: {
      type: String,
      default: null,
    },

    // What was the price when it triggered
    triggeredAtPrice: {
      type: Number,
      default: null,
    },

    // ─── Notification tracking ─> Was the WebSocket notification sent?
    notificationSent: {
      type: Boolean,
      default: false,
    },

    // Was the email fallback sent?
    emailSent: {
      type: Boolean,
      default: false,
    },
},
 {
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

// Indexes

// BullMQ worker queries this every 4 hours to find all alerts that needs checking
priceAlertSchema.index({isActive : 1})

// User's alert list — "get all alerts for this user"
priceAlertSchema.index({ userId: 1, isActive: 1 });

// Product alert lookup — "how many users watching this product"
priceAlertSchema.index({ productId: 1, isActive: 1 });

// to avoid duplicate alerts
priceAlertSchema.index(
  { userId: 1, productId: 1, platform: 1 },
  { unique: true }
);

// Virtual fields

//How much does the price needs to drop ?
priceAlertSchema.virtual("amountAwayFromTarget").get(function(){
    if(!this.currentPrice) return null;
    const diff= this.currentPrice - this.targetPrice;
    return diff > 0 ? diff : 0;
})

// Has the target already been reached?
priceAlertSchema.virtual("isTargetReached").get(function () {
  if (!this.currentPrice) return false;
  return this.currentPrice <= this.targetPrice;
});

// Static methods

/* Called by BullMQ worker every 4 hours Returns all active alerts — the worker then checks each one against current PlatformPrice documents */
priceAlertSchema.statics.getActiveAlerts = async function(){
    return this.find({ isActive : true})
    .populate("productId", "name brand images")
    .populate("userId", "name email phoneNumber");
}   

// Called when BullMQ worker detects a price drop
// Updates the alert and marks it as triggered
priceAlertSchema.statics.triggerAlert = async function (
  alertId,
  platform,
  triggeredAtPrice
) {
  return this.findByIdAndUpdate(
    alertId,
    {
      isActive: false,
      triggeredAt: new Date(),
      triggeredOnPlatform: platform,
      triggeredAtPrice,
      notificationSent: true,
    },
    { new: true }               // return updated document
  );
};

// Get alert count for wishlist page stats
priceAlertSchema.statics.getActiveCountForUser = async function (userId) {
  return this.countDocuments({ userId, isActive: true });
};

module.exports = mongoose.model("PriceAlert", priceAlertSchema);