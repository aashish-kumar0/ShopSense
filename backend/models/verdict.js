const mongoose = require("mongoose");

const verdictSchema = new mongoose.Schema({

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

    // Verdict Text
    verdictText: {
      type: String,
      required: [true, "Verdict text is required"],
      trim: true,
    },

    // Final recommendation — extracted from verdict
    recommendation: {
      type: String,
      enum: [
        "buy_original",        // stick with searched product
        "buy_alternative",     // switch to an alternative
        "either_works",        // both are good choices
      ],
      required: true,
    },

     // Which product is recommended if recommendation is "buy_alternative"
    recommendedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // Context Snapshot
    alternativeIds : {
        type : [mongoose.Schema.Types.ObjectId],
        ref : "Product",
        default : [],
    },

      // Snapshot of user preferences AT THE TIME of generation
      userPreferenceSnapshot : {
        healthGoals: { type: [String], default: [] },
      budgetRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 1000 },
      },
      skinType: { type: String, default: null },
      techUseCase: { type: String, default: null },
      restrictions: { type: [String], default: [] },
      },

      // ai-meta data
    modelUsed: {
      type: String,
      default: "gemini-3.5",
    },

    // How many tokens this verdict cost
    tokensUsed: {
      type: Number,
      default: 0,
    },

    estimatedCostUsd: {
      type: Number,
      default: 0,
    },

    // When was this verdict generated
    generatedAt: {
      type: Date,
      default: Date.now,
    },

    // Verdicts expire after 7 days
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
},
{
    timestamps :{createdAt : true, updatedAt : false},

    toJSON : {
        virtuals : true,
        transform : function(doc,ret){
            delete ret.__v;
            return ret;
        },
    },
},
);

// Indexes

// Primary lookup — "does a fresh verdict exist for this
verdictSchema.index({userId : 1, productId :1},{unique : true});

// MongoDB auto deletes expired verdicts after 7 days
verdictSchema.index(
    {expiresAt : 1},
    {expireAfterSeconds : 0}
);

// for cost analytics on ai-model
verdictSchema.index({generatedAt : -1});

// Virtual fields


// is this verdict fields
verdictSchema.virtual("isExpired").get(function(){
    return new Date() > this.expiresAt;
})

// Did users preferences change since this verdict was generated ?
verdictSchema.virtual("isStaleForUser").get(function(currentPreferences){
    if(!currentPreferences) return false;

    //check if health goals changed
    const goalsChanged = 
    JSON.stringify(this.userPreferenceSnapshot.healthGoals.sort() !== 
    JSON.stringify(this.currentPreferences.healthGoals.sort()));

    const skinChanged = 
    this.userPreferenceSnapshot.skinType !== this.currentPreferences.skinType;

    // check if restrictions changed
    const restrictionsChanged = 
    JSON.stringify(this.userPreferenceSnapshot.restrictions.sort() !==
    JSON.stringify(this.currentPreferences.restrictions.sort()));

    return goalsChanged || skinChanged || restrictionsChanged;
})

// Static methods

// called on every product page load - returns valid verdict
verdictSchema.statics.findValid = async function (userId, productId) {
    const verdict = await this.findOne({userId, productId});

    if(!verdict) return null;   // never generated
    if(verdict.isExpired) return null; // verdict expired
    
    return verdict;
}

// Called by admin to track Gemini costs

verdictSchema.statics.getDailyCost = async function () {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        generatedAt: { $gte: startOfDay },
      },
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: "$estimatedCostUsd" },
        totalTokens: { $sum: "$tokensUsed" },
        totalVerdicts: { $sum: 1 },
      },
    },
  ]);

  return result[0] || {
    totalCost: 0,
    totalTokens: 0,
    totalVerdicts: 0,
  };
};

module.exports = mongoose.model("Verdict",verdictSchema);
