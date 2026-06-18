const mongoose = require("mongoose");
const { platform } = require("node:os");




/*
Product: "Saffola Oats" (_id: abc123)
    ↓
PlatformPrice 1: { productId: abc123, platform: "amazon",    price: 189 }
PlatformPrice 2: { productId: abc123, platform: "flipkart",  price: 199 }
PlatformPrice 3: { productId: abc123, platform: "bigbasket", price: 195 }
PlatformPrice 4: { productId: abc123, platform: "blinkit",   price: 209, inStock: false }
*/

const platformPriceSchema = new mongoose.Schema({
    
    // References
    productId : {
        type : mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required : [true, "Product refrence is required"],
    },

    platformIdentity : {
        type : String,

        required : [true, "Platform is required"],

        enum : ["amazon", "flipkart", "myntra", "meesho", "bigbasket", "blinkit", "swiggy", "nykaa", "ajio", "zepto"],
        
        lowercase : true,
    },
    // Pricing

    price : {
        type : Number,
        required :[true, "Price is required"],
        min : [0, "Price can't be negative"],
        default : null,
    },
    // originalPrice is the MRP — the crossed-out price you see on product pages
    
    originalPrice : {
        type : Number,
        min : [0, "Price can't be negative"],
        default : null,
    },

    // discountPercent = ((originalPrice - price) / originalPrice) * 100
    discountPercent : {
        type : Number,
        min :0,
        max : 100,
        default: 0
    },

    currency : {
        type : String,
        default : "INR",
    },

    // affiliate url
    affiliateUrl: {
      type: String,
      required: [true, "Affiliate URL is required"],
      trim: true,
    },

    // Availability
    inStock: {
      type: Boolean,
      default: true,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
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

// Give all platform prices of a product
platformPriceSchema.index({productId : 1})

// Compound Index : Give amazon price for this product
platformPriceSchema.index({productId : 1, platform : 1}, { unique: true});
// unique: true here means one product can only have ONE price


// For querying cheapest product for a platform
platformPriceSchema.index({platform : 1, price : 1});

// For filtering in-stock products only
platformPriceSchema.index({inStock : 1})


// Virtual Fields

// Tells BullMQ worker if this price  needs refreshing
// Prices older than 4 hours are considered stale

platformPriceSchema.virtual("isStale").get(function() {
  if(!this.lastUpdated) return true;

  const hoursSince = (Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60);

  return hoursSince > 4;
})


// Pre save hook
// Auto compute discount percent before saving

platformPriceSchema.pre("save",function(next){
  if(this.originalPrice && this.originalPrice > this.price){
    this.discountPercent= Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  else{
    this.discountPercent=0;
  }
  next();
})

module.exports = mongoose.model("PlatformPrice", platformPriceSchema);
