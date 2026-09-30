const mongoose = require("mongoose")

// Sub-schemas

const nutritionSchema = new mongoose.Schema({
    servingSize: { type: String },           // "40g"
    calories: { type: Number },           // kcal
    protein: { type: Number },           // grams
    carbohydrates: { type: Number },
    sugar: { type: Number },
    fiber: { type: Number },
    fat: { type: Number },
    sodium: { type: Number },
},
{_id : false} // prevents mongodb from generating unncecssary ids for embedded objects
)

const skincareIngredientSchema = new mongoose.Schema({
  name:      { type: String, required: true },  // "Niacinamide"
  ewgScore:  { type: Number, min: 1, max: 10 }, // 1=safest, 10=most harmful
  function:  { type: String },                  // "Brightening agent"
  isHarmful: { type: Boolean, default: false },
  reason:    { type: String },                  // why it's harmful if isHarmful:true
}, { _id: false });

const scoreSchema = new mongoose.Schema({
  health:  { type: Number, min: 0, max: 10, default: 0 },
  value:   { type: Number, min: 0, max: 10, default: 0 },
  quality: { type: Number, min: 0, max: 10, default: 0 },
  overall: { type: Number, min: 0, max: 10, default: 0 },
}, { _id: false });


// Main Product Schema

const productSchema = new mongoose.Schema({

    name : {
        type: String,
        required : [true, "Product name is required"],
        trim : true,
        maxLength : [200, "Product name too long"],
    },

    brand : {
         type: String,
      required: [true, "Brand is required"],
      trim: true,
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
    },

    subcategory: {
      type: String,
      required: [true, "Subcategory is required"],
      trim: true,
      lowercase: true,
    },

    images: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description too long"],
    },

    certifications: {
      type: [String],
      default: [],
    },

    // AI Generated pros & cons

    pros: {
      type: [String],
      default: [],
    },

    cons: {
      type: [String],
      default: [],
    },

    // Food only - fixed schema becz nutrition facts are standardized

    nutrition: {
      type: nutritionSchema,
      default: null,
    },

    ingredients: {
      type: [String],
      default: [],
    },

    // ALL non-food categories — dynamic Map
    // Each category stores whatever keys it needs:
    // Electronics: { ram: "8GB", battery: "5000mAh" }
    // Appliances:  { capacity: "7kg", energyRating: "5 Star" }
    // Kitchenware: { material: "Stainless Steel", volume: "3L" }

    specs: {
      type: Map,
      of: String,
      default: null,
    },

    // Skincare only

    skincareIngredients: {
      type: [skincareIngredientSchema],
      default: [],
    },

    suitableFor: {
      type: [String],
      enum: ["oily", "dry", "combination", "sensitive", "normal"],
      default: [],
    },

    // AI Computed Scores

    scores : {
        type : scoreSchema,
        default : ()=>({})
    },

    // External references 
    vectorId: {
      type: String,
      default: null,
    },

    source: {
      type: String,
      enum: ["open_food_facts", "amazon_pa", "manual", "scraper"],
      default: "manual",
    },

    // Analytics
    searchCount: {
      type: Number,
      default: 0,
    },

    lastEnriched: {
      type: Date,
      default: null,
    },

    // Soft Delete

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

},
{
    timestamps:true,
    toJSON : {
        virtuals : true,
        transform : function(doc, ret){
            delete ret.__v;
            delete ret._id;
            return ret;
        },
    },
}
)

// Indexes
productSchema.index({ category: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ "scores.overall": -1 });
productSchema.index({ searchCount: -1 });
productSchema.index({ isDeleted: 1 });
productSchema.index({ name: "text", brand: "text", description: "text" });


// ─── Virtuals ─────────────────────────────────────────────────

// in Product model, after schema definition:
productSchema.virtual("platformPrices", {
  ref: "PlatformPrice",
  localField: "_id",
  foreignField: "productId",
});

productSchema.virtual("needsEnrichment").get(function () {
  if (!this.lastEnriched) return true;
  const hoursSince =
    (Date.now() - this.lastEnriched.getTime()) / (1000 * 60 * 60);
  return hoursSince > 24;
});

productSchema.virtual("isFood").get(function () {
  return this.category === "food";
});

productSchema.virtual("isElectronics").get(function () {
  return this.category === "electronics";
});

productSchema.virtual("isSkincare").get(function () {
  return this.category === "skincare";
});

// models/Product.js — add just before module.exports = mongoose.model("Product", productSchema);
productSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return;
  const generateAndSaveVerdict = require("../services/ai/verdict.service");
  generateAndSaveVerdict(doc).catch(err =>
    console.error(`[verdictGeneration] Failed for product ${doc._id}:`, err.message)
  );
});

module.exports = mongoose.model("Product", productSchema);