const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    // ─── References ──────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // ─── Plan details ────────────────────────────────────────
    plan: {
      type: String,
      enum: ["free", "pro"],
      required: [true, "Plan is required"],
    },

    // Billing cycle — monthly or yearly
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },

    // ─── Duration ────────────────────────────────────────────
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },

    // ─── Payment details ─────────────────────────────────────
    // Razorpay payment ID — links to the actual transaction
    // This is what you'd already be familiar with from EMR's
    // Razorpay integration at your internship
    paymentId: {
      type: String,
      required: [true, "Payment ID is required"],
      trim: true,
    },

    // Razorpay order ID — created before payment, confirmed after
    orderId: {
      type: String,
      trim: true,
      default: null,
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },

    currency: {
      type: String,
      default: "INR",
    },

    // ─── Status ──────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },

    isActive: {
      type: Boolean,
      default: true,
      // false when: plan expires, user cancels, or payment fails
    },

    // ─── Cancellation tracking ───────────────────────────────
    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Does this subscription auto-renew?
    autoRenew: {
      type: Boolean,
      default: true,
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
  }
);

// ─── Indexes ──────────────────────────────────────────────────

// User's billing history — "get all subscriptions for this user"
subscriptionSchema.index({ userId: 1, createdAt: -1 });

// Find current active subscription for a user
subscriptionSchema.index({ userId: 1, isActive: 1 });

// For cron job — find subscriptions expiring soon (renewal reminders)
subscriptionSchema.index({ expiresAt: 1, isActive: 1 });

// For admin revenue analytics
subscriptionSchema.index({ paymentStatus: 1, createdAt: -1 });

// Razorpay payment lookup — for webhook processing
subscriptionSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

// ─── Virtual fields ───────────────────────────────────────────

// Is this subscription currently valid?
subscriptionSchema.virtual("isCurrentlyValid").get(function () {
  return this.isActive && this.expiresAt > new Date();
});

// Days remaining until expiry
subscriptionSchema.virtual("daysRemaining").get(function () {
  if (!this.isActive) return 0;
  const diff = this.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// ─── Pre-save hook ────────────────────────────────────────────
// Auto-compute expiresAt based on billing cycle if not provided
subscriptionSchema.pre("save", function (next) {
  if (!this.expiresAt && this.startDate) {
    const expiry = new Date(this.startDate);
    if (this.billingCycle === "yearly") {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }
    this.expiresAt = expiry;
  }
  next();
});

// ─── Post-save hook ───────────────────────────────────────────
// Sync the plan status back to User document
// This is the denormalization sync — keeps User.plan accurate
subscriptionSchema.post("save", async function (doc) {
  if (doc.paymentStatus === "completed" && doc.isActive) {
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(doc.userId, {
      plan: doc.plan,
      planExpiresAt: doc.expiresAt,
    });
  }
});

// ─── Static methods ───────────────────────────────────────────

// Called by cron job to find subscriptions expiring in next 3 days
// Used to send renewal reminder emails
subscriptionSchema.statics.getExpiringSoon = async function () {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  return this.find({
    isActive: true,
    expiresAt: { $lte: threeDaysFromNow, $gte: new Date() },
    autoRenew: true,
  }).populate("userId", "name email");
};

// Called by cron job daily — downgrade expired subscriptions
subscriptionSchema.statics.deactivateExpired = async function () {
  const expired = await this.find({
    isActive: true,
    expiresAt: { $lt: new Date() },
  });

  for (const sub of expired) {
    sub.isActive = false;
    await sub.save();

    // Downgrade user back to free plan
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(sub.userId, {
      plan: "free",
      planExpiresAt: null,
    });
  }

  return expired.length;
};

// Admin revenue analytics — total revenue from subscriptions
subscriptionSchema.statics.getTotalRevenue = async function () {
  const result = await this.aggregate([
    { $match: { paymentStatus: "completed" } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalSubscriptions: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalRevenue: 0, totalSubscriptions: 0 };
};

module.exports = mongoose.model("Subscription", subscriptionSchema);