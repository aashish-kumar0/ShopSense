const mongoose = require("mongoose")
const { type, platform } = require("os")

const priceHistorySchema = new mongoose.Schema({

    // References
    productId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Product",
        required : [true, "Product id is required"],
    },

    platform : {
        type : "String",
        required : [true, "Platform is required"],
        enum : ["amazon", "flipkart", "myntra", "meesho", "bigbasket", "blinkit", "swiggy", "nykaa", "ajio", "zepto"],
        lowercase : true,
    },

    price : {
        type : Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
    },

    originalPrice: {
      type: Number,
      default: null,
    },

    // Time stamp- when this price was recorded
    recordedAt : {
        type : Date,
        required : true,
        default : Date.now,
    },

},
{
    timestamps : {createdAt : true, updatedAt : false},

    toJSON : {
        transform : function (doc, ret){
            delete ret.__v;
            return ret;
        },
    },
},
);

// Indexes

// give all price history for this product
priceHistorySchema.index({productId : 1, recordedAt : -1});

// platform specific chart lines
priceHistorySchema.index({productId : 1, platform : 1, recordedAt : -1});

// for admin analytics- price trend across all products
priceHistorySchema.index({platform : 1, recordedAt : -1});


/*  Static method 
Called by BullMQ worker after every price fetch
Usage: await PriceHistory.recordPrice(productId, "amazon", 189, 245) */

priceHistorySchema.statics.recordPrice = async function (
    productId,
    platform,
    price,
    originalPrice=null
){
  // only record if price changed from last entry
  
  const lastEntry = await this.findOne(
    {productId, platform},
    {},
    {sort : {recordedAt : -1}}
);

if(lastEntry && lastEntry.price === price) return null;

return this.create({
    productId,
    platform,
    price,
    originalPrice,
    recordedAt : new Date(),
});
};

// ─── Static method ────────────────────────────────────────────
// Called by the price history chart on the product page
// Returns last 6 months of data grouped by platform
// Usage: await PriceHistory.getChartData(productId)
priceHistorySchema.statics.getChartData = async function (productId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return this.find({
    productId,
    recordedAt: { $gte: sixMonthsAgo },
  })
    .sort({ recordedAt: 1 })          // oldest first for chart rendering
    .select("platform price recordedAt -_id");
};

module.exports = mongoose.model("PriceHistory", priceHistorySchema);
