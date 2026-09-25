const mongoose=require("mongoose")
const { type } = require("os")
const bcrypt = require("bcryptjs")

const userSchema= new mongoose.Schema({
    name : {
        type : String,
        required:[true, "Name is required"],
        trim:true,
        maxLength : [50, "Name cant exceed 50 characters"],
        default:null,
    },

    email:{
        type:String,
         required: [true, "Email is required"],
        trim:true,
        lowercase : true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },

    password : {
        type : String,
        minLength : [8, "Password must contain 8 characters"],
        select : false,
        // required only when auth provider is local as 0-auth doesnt have a passowrd
        required : function(){
            return this.authProvider === "local"
        },
    },

    phoneNumber : {
        type:String,
        required : [true, "Phone no is required"],
        trim: true,
        match: [/^[6-9]\d{9}$/, "Enter a valid mobile number"],
    },

    location: {
      type: String,
      trim: true,
      default: null,
    },

    // Auth
    authProvider :{
        type : String,
        enum : ["local","google"],
        default:"local",
    },

    googleId : {
        type : String,
        default : null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say", null],
      default: null,
    },

     /* ─── Subscription ──────────────────────────────────────────
     We have a separate Subscription model for billing history,
     but we cache the current plan here to avoid a join on every
     auth check — this is the MongoDB "denormalization" pattern */

     plan : {
        type : String,
        enum : ["free","pro"],
        default : "free",
     },

     planExpiresAt : {
        type : Date,
        default : null,
     },

     //   Activity stats 

    totalHoursSaved: {
      type: Number,
      default: 0,
    },

    //   Account status 
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "deactivated"],
      default: "active",
    },

    onboardingCompleted: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    /*  Soft delete 
     Never hard delete users — legal + audit reasons
     When user clicks "Delete Account", set isDeleted: true */

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    
    //  Preferences (embedded) ─> Embedded because preferences always load with the user

    preferences : {
        healthGoals : {
            type : [String],
            enum : ["weight_loss", "muscle_gain", "diabetic_management", "general_health"],
            default : ["general_health"],
        },

        budgetRange : {
            min : {type : Number, default : 0},
            max : {type : Number, default : 1000},
        },
        skinType : {
            type : String,
             enum: ["oily", "dry", "combination", "sensitive", "normal", null],
             default : null,
        },
        techUseCase : {
            type : String,
            enum: ["gaming", "photography", "work", "general", null],
            default: null,
        },
        restrictions: {
            type: [String],
            enum: ["vegan", "gluten_free", "nut_allergy", "no_parabens", "no_sulphates"],
            default: [],
      },
    },
    },
    {
        timestamps : true,
        toJSON : {
            virtuals : true,
            // remove sensitive fields while converting to json
            transform : function(doc, ret){
                delete ret.password;
                delete ret.__v;
                return ret;
            },
        },
    },
);

// Indexes
//In MongoDB indexes, 1 means ascending order and -1 means descending order.

userSchema.index({plan:1}) // admin filters users by plan

userSchema.index({accountStatus : 1}) // admin filters active/suspended users

userSchema.index({createdAt : -1}) //admin recent users panel

// Pre-Save Hook
// Hashes the password only if it was changed - prevents double hashing

userSchema.pre("save", async function (next) {
    if( !this.isModified("password") || !this.password) return next()
    
    this.password = await bcrypt.hash(this.password, 12);
    next()
})

// Instance Method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword,this.password);
}

// Virtual fields
userSchema.virtual("isProActive").get(function () {
  if (this.plan === "free") return false;
  if (!this.planExpiresAt) return false;
  return this.planExpiresAt > new Date();
});

module.exports = mongoose.model("User", userSchema);