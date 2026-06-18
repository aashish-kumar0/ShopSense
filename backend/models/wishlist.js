const mongoose = require("mongoose")

/*
Key design decision: Each wishlist item is its own document, not an array inside User. Here's why — a user with 50 wishlist items stored as an array means loading all 50 every time you need just one. With separate documents you can query, sort, and paginate efficiently.
*/

const wishListSchema = new mongoose.Schema({
    
    // References
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        requried : [true, "User is required"],
    },

    productId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "product",
        requried : [true, "Product is required"],
    },

    // AI generated hint such as wait for amazon prime day sale,etc
    hint : {
        type : String,
        trim : true,
        default : null,
    },

    // Price snapshot at the time of wishlisting to show how much price has changed
    priceWhenAdded : {
        type : Number,
        default : null,
    },

    // Current Price - updated by bullmq worker

    currentPrice : {
        type : Number,
        default : null,
    },

    // Which platform had the best price when added
    platformWhenAdded : {
        type : String,
        enum : ["amazon", "flipkart", "myntra", "meesho", "bigbasket", "blinkit", "swiggy", "nykaa", "ajio", "zepto", null],
    },

    // Sharing- view this user's wishlist without logging in

    shareToken : {
        type : String,
        default : null,
        unique : true,
        sparse : true, // allows multiple null values on unique fields
    },

    // Timestamp
    addedAt : {
        type : Date,
        default: Date.now,
    },
},
{
    timestamps : {
        createdAt : true, updatedAt : false,
    },
    toJSON : {
        virtuals: true,
        transform : function(doc, ret){
            delete ret.__v;
            return ret;
        },
    },
},
);

// Indexes

// get all wishlist items for this user
wishListSchema.index({userId : 1, addedAt : -1});

// Prevent duplicate wishlist entries
wishListSchema.index({userId : 1, productId : 1}, {unique : true});

// For share link lookup
wishListSchema.index({shareToken : 1});

// BullMQ worker- find all public wishlists to update hints
wishListSchema.index({isPublic : 1});

// Virtual Fields- how much the price changes since wishlisting

wishListSchema.virtual("priceChange").get(function(){
    if(!this.priceWhenAdded || !this.currentPrice) return null;
    return this.currentPrice-this.priceWhenAdded;
});

// Percentage change — for showing "dropped 7%"
wishlistSchema.virtual("priceChangePercent").get(function () {
  if (!this.priceWhenAdded || !this.currentPrice) return null;
  return Math.round(
    ((this.currentPrice - this.priceWhenAdded) / this.priceWhenAdded) * 100
  );
});

// Statics

// Get wishlist stats for user activity panel
wishlistSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        // Count how many items have dropped in price
        priceDrops: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$priceWhenAdded", null] },
                  { $ne: ["$currentPrice", null] },
                  { $lt: ["$currentPrice", "$priceWhenAdded"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return stats[0] || { totalItems: 0, priceDrops: 0 };
};

// Generate a unique share token
// Called when user clicks "Share List" for the first time
wishlistSchema.statics.generateShareToken = function () {
  // crypto is a built-in Node.js module — no install needed
  const crypto = require("crypto");
  return crypto.randomBytes(16).toString("hex"); // 32 char hex string
};

module.exports = mongoose.model("Wishlist", wishlistSchema);