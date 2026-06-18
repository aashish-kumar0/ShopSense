const { timeStamp } = require("console")
const mongoose = require("mongoose")
const { type } = require("os")
const { deflateSync } = require("zlib")

/*
One concept before writing — why track alternativeClicked?
When a user searches "Saffola Oats" and then clicks "Quaker Oats" from the alternatives panel, that click tells your RAG pipeline something valuable — users who search Saffola are interested in Quaker. Over time this data trains better recommendations. This is exactly how Amazon's "customers also viewed" works.
*/

const searchHistorySchema = new mongoose.Schema({
    // References
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : [true, "User is required"],
    },

    // Main Product
    productId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "product",
        default : null,
    },

    // Search Query Data
    query : {
        type : String,
        required : [true, "Search Query is required"],
        trim : true,
        lowercase : true,
    },

    // category detected by ai
    category : {
        type : String,
        trim : true,
        lowercase: true,
        default : null, // category detection failed
    },

    // Ids of alternatives shown in the RAG of a searched product

    alternativesShown : {
        type : [mongoose.Schema.Types.ObjectId],
        ref : "product",
        default : [],
    },

    // which alternative the user clicked
    alternativeClicked : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "product",
        default : null,
    },

    // AI verdict tracking
    verdictGenerated : {
        type : Boolean,
        default : false,
    },

    // Performance tracking- how long users spent on the result page

    sessionDuration : {
        type : Number,
        default : 0,
    },

    // Result quality -did the search return results or it was a dead end

    resultFound : {
        type : Boolean,
        default : true,
    },

    resultCount : {
        type : Number,
        default : 0,
    },

    timeStamp : {
        type : Date,
        default : Date.now(),
    },
},
{
    // No updated at as search history is never updated, its only appended

    timestamps:{
        createdAt : true, 
        updatedAt : false,
    },
    toJSON : {
        virtuals : true,
        transform : function (doc,ret){
            delete ret.__v;
            return ret;
        },
    },
},
);

// Indexes

searchHistorySchema.index({userId : 1, timeStamp : -1});

// for admin top searched panel
searchHistorySchema.index({query : 1});

// for category analytics
searchHistorySchema.index({category : 1});

// for product analytics- how many times this product was searched
searchHistorySchema.index({product : 1});

// auto delete search history older than one year

searchHistorySchema.index(
    {timeStamp : 1},
    {expireAfterSeconds : 365 * 24 * 60 * 60},
);

// static methods- called by admin dashboard to get top searched queries

searchHistorySchema.statics.getTopSearches = async function(limit = 5) {
    return this.aggregate([
        {
            $group : {
                _id : "query",
                count : {$sum : 1}
            },
        },
        { $sort : {count : -1}},
        { $limit : limit},
    ]);
}

// Called to compute "Analyses: 247" and "Saved (hours): 14.5" for the user activity panel in image 12
searchHistorySchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        // Convert ms to hours and sum
        totalHoursSaved: {
          $sum: { $divide: ["$sessionDuration", 3600000] },
        },
        verdictCount: {
          $sum: { $cond: ["$verdictGenerated", 1, 0] },
        },
      },
    },
  ]);

  return stats[0] || {
    totalSearches: 0,
    totalHoursSaved: 0,
    verdictCount: 0,
  };
};

// Called by category donut chart in admin dashboard
// Returns breakdown like: food: 42%, electronics: 28%
searchHistorySchema.statics.getCategoryMix = async function () {
  return this.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

module.exports = mongoose.model("SearchHistory", searchHistorySchema);