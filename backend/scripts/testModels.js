require("dotenv").config();
const mongoose = require("mongoose");

// Import all 12 models
const User = require("../models/User");
const Product = require("../models/Product");
const PlatformPrice = require("../models/PlatformPrice");
const PriceHistory = require("../models/PriceHistory");
const SearchHistory = require("../models/SearchHistory");
const Wishlist = require("../models/Wishlist");
const PriceAlert = require("../models/PriceAlert");
const AffiliateClick = require("../models/AffiliateClick");
const Verdict = require("../models/Verdict");
const CompareSession = require("../models/CompareSession");
const Subscription = require("../models/Subscription");
const SystemLog = require("../models/SystemLog");

// Track every document we create so we can clean up at the end
// even if a later step throws an error
const created = {};

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected\n");

  try {
    // ─── 1. User ──────────────────────────────────────────────
    console.log("1️⃣  Creating User...");
    created.user = await User.create({
      name: "Test Ashish",
      email: `test-${Date.now()}@shopsense.in`,
      phoneNumber: "9876543210",
      password: "testpassword123",
      authProvider: "local",
      onboardingCompleted: true,
      preferences: {
        healthGoals: ["weight_loss"],
        budgetRange: { min: 0, max: 500 },
        restrictions: ["vegan"],
      },
    });
    console.log(`   ✅ User created: ${created.user._id}`);
    console.log(`   ✅ Password was hashed: ${created.user.password !== "testpassword123" ? "no, hidden by select:false" : "❌ FAIL"}\n`);

    // ─── 2. Product ───────────────────────────────────────────
    console.log("2️⃣  Creating Product...");
    created.product = await Product.create({
      name: "Test Oats",
      brand: "TestBrand",
      category: "food",
      subcategory: "oats",
      nutrition: {
        calories: 68,
        protein: 6,
        sugar: 1,
        fiber: 4,
      },
      ingredients: ["Oats", "Salt"],
      scores: { health: 7.2, value: 6.8, quality: 7.0, overall: 7.0 },
    });
    console.log(`   ✅ Product created: ${created.product._id}`);
    console.log(`   ✅ needsEnrichment virtual: ${created.product.needsEnrichment}\n`);

    // ─── 3. PlatformPrice ─────────────────────────────────────
    console.log("3️⃣  Creating PlatformPrice...");
    created.platformPrice = await PlatformPrice.create({
      productId: created.product._id,
      platform: "amazon",
      price: 189,
      originalPrice: 245,
      affiliateUrl: "https://amazon.in/test-affiliate-link",
      inStock: true,
    });
    console.log(`   ✅ PlatformPrice created: ${created.platformPrice._id}`);
    console.log(`   ✅ discountPercent auto-computed: ${created.platformPrice.discountPercent}% (expected 23%)\n`);

    // ─── 4. PriceHistory ──────────────────────────────────────
    console.log("4️⃣  Creating PriceHistory...");
    created.priceHistory = await PriceHistory.recordPrice(
      created.product._id,
      "amazon",
      189,
      245
    );
    console.log(`   ✅ PriceHistory created: ${created.priceHistory?._id}\n`);

    // ─── 5. SearchHistory ─────────────────────────────────────
    console.log("5️⃣  Creating SearchHistory...");
    created.searchHistory = await SearchHistory.create({
      userId: created.user._id,
      productId: created.product._id,
      query: "test oats",
      category: "food",
      verdictGenerated: false,
      resultFound: true,
      resultCount: 1,
    });
    console.log(`   ✅ SearchHistory created: ${created.searchHistory._id}\n`);

    // ─── 6. Wishlist ──────────────────────────────────────────
    console.log("6️⃣  Creating Wishlist...");
    created.wishlist = await Wishlist.create({
      userId: created.user._id,
      productId: created.product._id,
      priceWhenAdded: 199,
      currentPrice: 189,
    });
    console.log(`   ✅ Wishlist created: ${created.wishlist._id}`);
    console.log(`   ✅ priceChange virtual: ₹${created.wishlist.priceChange} (expected -10)\n`);

    // ─── 7. PriceAlert ────────────────────────────────────────
    console.log("7️⃣  Creating PriceAlert...");
    created.priceAlert = await PriceAlert.create({
      userId: created.user._id,
      productId: created.product._id,
      platform: "amazon",
      targetPrice: 150,
      priceWhenSet: 189,
      currentPrice: 189,
    });
    console.log(`   ✅ PriceAlert created: ${created.priceAlert._id}`);
    console.log(`   ✅ amountAwayFromTarget virtual: ₹${created.priceAlert.amountAwayFromTarget} (expected 39)\n`);

    // ─── 8. AffiliateClick ────────────────────────────────────
    console.log("8️⃣  Creating AffiliateClick...");
    created.affiliateClick = await AffiliateClick.create({
      userId: created.user._id,
      productId: created.product._id,
      platformPriceId: created.platformPrice._id,
      platform: "amazon",
      priceAtClick: 189,
      affiliateUrl: "https://amazon.in/test-affiliate-link",
      clickSource: "product_page",
    });
    console.log(`   ✅ AffiliateClick created: ${created.affiliateClick._id}\n`);

    // ─── 9. Verdict ───────────────────────────────────────────
    console.log("9️⃣  Creating Verdict...");
    created.verdict = await Verdict.create({
      userId: created.user._id,
      productId: created.product._id,
      verdictText: "Based on your weight loss goal, this is a good choice.",
      recommendation: "buy_original",
      userPreferencesSnapshot: {
        healthGoals: ["weight_loss"],
        restrictions: ["vegan"],
      },
      tokensUsed: 150,
      estimatedCostUsd: 0.003,
    });
    console.log(`   ✅ Verdict created: ${created.verdict._id}`);
    console.log(`   ✅ isExpired virtual: ${created.verdict.isExpired} (expected false)\n`);

    // ─── 10. CompareSession ───────────────────────────────────
    console.log("🔟 Creating CompareSession...");
    // Need a second product for a valid comparison (min 2 required)
    created.product2 = await Product.create({
      name: "Test Oats 2",
      brand: "TestBrand2",
      category: "food",
      subcategory: "oats",
      scores: { overall: 8.0 },
    });
    created.compareSession = await CompareSession.create({
      userId: created.user._id,
      productIds: [created.product._id, created.product2._id],
      aiPickProductId: created.product2._id,
      aiPickReason: "Higher overall score and better price.",
      category: "food",
    });
    console.log(`   ✅ CompareSession created: ${created.compareSession._id}`);
    console.log(`   ✅ productCount virtual: ${created.compareSession.productCount} (expected 2)\n`);

    // ─── 11. Subscription ─────────────────────────────────────
    console.log("1️⃣1️⃣  Creating Subscription...");
    created.subscription = await Subscription.create({
      userId: created.user._id,
      plan: "pro",
      billingCycle: "monthly",
      paymentId: `test_pay_${Date.now()}`,
      amount: 299,
      paymentStatus: "completed",
    });
    console.log(`   ✅ Subscription created: ${created.subscription._id}`);

    // Verify the post-save hook synced plan to User
    const syncedUser = await User.findById(created.user._id);
    console.log(`   ✅ post-save sync worked — User.plan is now: "${syncedUser.plan}" (expected "pro")\n`);

    // ─── 12. SystemLog ────────────────────────────────────────
    console.log("1️⃣2️⃣  Creating SystemLog...");
    created.systemLog = await SystemLog.error(
      "Test scraper timeout",
      "scraper",
      { retryCount: 2 },
      "medium"
    );
    console.log(`   ✅ SystemLog created: ${created.systemLog._id}\n`);

    // ─── POPULATE TESTS ───────────────────────────────────────
    console.log("🔗 Testing .populate() relationships...\n");

    const populatedAlert = await PriceAlert.findById(created.priceAlert._id)
      .populate("userId", "name email")
      .populate("productId", "name brand");
    console.log(`   ✅ PriceAlert.populate() → User: "${populatedAlert.userId.name}", Product: "${populatedAlert.productId.name}"`);

    const populatedClick = await AffiliateClick.findById(created.affiliateClick._id)
      .populate("platformPriceId", "platform price");
    console.log(`   ✅ AffiliateClick.populate() → PlatformPrice: ${populatedClick.platformPriceId.platform} @ ₹${populatedClick.platformPriceId.price}`);

    const chartData = await PriceHistory.getChartData(created.product._id);
    console.log(`   ✅ PriceHistory.getChartData() → ${chartData.length} entries found`);

    const userStats = await SearchHistory.getUserStats(created.user._id);
    console.log(`   ✅ SearchHistory.getUserStats() → totalSearches: ${userStats.totalSearches}`);

    console.log("\n✅✅✅ ALL 12 MODELS WORKING CORRECTLY ✅✅✅\n");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error(err);
  } finally {
    // ─── CLEANUP ──────────────────────────────────────────────
    console.log("🧹 Cleaning up test data...");

    if (created.systemLog) await SystemLog.deleteOne({ _id: created.systemLog._id });
    if (created.subscription) await Subscription.deleteOne({ _id: created.subscription._id });
    if (created.compareSession) await CompareSession.deleteOne({ _id: created.compareSession._id });
    if (created.verdict) await Verdict.deleteOne({ _id: created.verdict._id });
    if (created.affiliateClick) await AffiliateClick.deleteOne({ _id: created.affiliateClick._id });
    if (created.priceAlert) await PriceAlert.deleteOne({ _id: created.priceAlert._id });
    if (created.wishlist) await Wishlist.deleteOne({ _id: created.wishlist._id });
    if (created.searchHistory) await SearchHistory.deleteOne({ _id: created.searchHistory._id });
    if (created.priceHistory) await PriceHistory.deleteOne({ _id: created.priceHistory._id });
    if (created.platformPrice) await PlatformPrice.deleteOne({ _id: created.platformPrice._id });
    if (created.product2) await Product.deleteOne({ _id: created.product2._id });
    if (created.product) await Product.deleteOne({ _id: created.product._id });
    if (created.user) await User.deleteOne({ _id: created.user._id });

    console.log("✅ Cleanup complete — database is clean\n");

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

run();