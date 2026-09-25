/**
 * seedMockProducts.js
 * Run once to populate MongoDB with electronics + skincare products,
 * and index each into Pinecone for semantic search.
 *
 * Usage:
 *   node scripts/seedMockProducts.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const PlatformPrice = require("../models/PlatformPrice");
const { indexProduct } = require("../services/rag/rag.service");
const { initPinecone } = require("../services/rag/pinecone.service");

// ─── Mock Data ─────────────────────────────────────────────────────────────

const electronicsProducts = [
  {
    name: "boAt Airdopes 141",
    brand: "boAt",
    category: "electronics",
    subcategory: "wireless earbuds",
    description: "True wireless earbuds with 42H total playback, ENx technology for clear calls, and IPX4 water resistance.",
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80",
      "https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=400&q=80",
    ],
    specs: new Map([
      ["batteryLife", "6H + 36H case"],
      ["connectivity", "Bluetooth 5.3"],
      ["waterResistance", "IPX4"],
      ["driver", "8mm"],
      ["chargingTime", "1.5 hours"],
      ["weight", "4.8g per earbud"],
    ]),
    certifications: [],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "amazon",   price: 999,  originalPrice: 2990, inStock: true,  productUrl: "https://www.amazon.in/dp/B09XQMJ3P1" },
      { platform: "flipkart", price: 1049, originalPrice: 2990, inStock: true,  productUrl: "https://www.flipkart.com/boat-airdopes-141" },
      { platform: "meesho",   price: 979,  originalPrice: 2990, inStock: false, productUrl: "https://www.meesho.com/boat-airdopes" },
    ],
  },
  {
    name: "OnePlus Nord CE 3 Lite 5G",
    brand: "OnePlus",
    category: "electronics",
    subcategory: "smartphones",
    description: "5G smartphone with 108MP camera, 67W SUPERVOOC charging, and a 5000mAh battery for all-day performance.",
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80",
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&q=80",
    ],
    specs: new Map([
      ["display", "6.72 inch LCD 120Hz"],
      ["processor", "Snapdragon 695"],
      ["ram", "8GB"],
      ["storage", "128GB"],
      ["camera", "108MP + 2MP + 2MP"],
      ["frontCamera", "16MP"],
      ["battery", "5000mAh"],
      ["charging", "67W SUPERVOOC"],
      ["os", "Android 13 / OxygenOS 13.1"],
      ["connectivity", "5G, WiFi 6, Bluetooth 5.2"],
    ]),
    certifications: [],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "amazon",   price: 19999, originalPrice: 25999, inStock: true,  productUrl: "https://www.amazon.in/dp/B0C3C3XVPK" },
      { platform: "flipkart", price: 19499, originalPrice: 25999, inStock: true,  productUrl: "https://www.flipkart.com/oneplus-nord-ce-3-lite-5g" },
    ],
  },
  {
    name: "Samsung 43 inch 4K Ultra HD Smart TV",
    brand: "Samsung",
    category: "electronics",
    subcategory: "televisions",
    description: "Crystal 4K processor, Motion Xcelerator, and a wide colour enhancer for a vivid cinematic experience.",
    images: [
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&q=80",
    ],
    specs: new Map([
      ["displaySize", "43 inch"],
      ["resolution", "3840 x 2160 (4K UHD)"],
      ["refreshRate", "60Hz"],
      ["hdr", "HDR10+"],
      ["smartPlatform", "Tizen OS"],
      ["connectivity", "3x HDMI, 2x USB, WiFi, Bluetooth"],
      ["soundOutput", "20W"],
    ]),
    certifications: ["energy star"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "amazon",   price: 32990, originalPrice: 47900, inStock: true, productUrl: "https://www.amazon.in/dp/B0BSHF7WHR" },
      { platform: "flipkart", price: 31990, originalPrice: 47900, inStock: true, productUrl: "https://www.flipkart.com/samsung-108-cm-43-inch-ultra-hd-4k" },
    ],
  },
  {
    name: "Logitech MX Keys Mini",
    brand: "Logitech",
    category: "electronics",
    subcategory: "keyboards",
    description: "Compact wireless keyboard with backlit keys, smart illumination, and multi-device pairing for up to 3 devices.",
    images: [
      "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&q=80",
    ],
    specs: new Map([
      ["connectivity", "Bluetooth, USB-C receiver"],
      ["batteryLife", "Up to 5 months"],
      ["multiDevice", "Up to 3 devices"],
      ["backlight", "Smart backlit keys"],
      ["layout", "Compact TKL"],
      ["compatibility", "Windows, macOS, Linux, iOS, Android"],
    ]),
    certifications: [],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "amazon",   price: 7495, originalPrice: 8995, inStock: true,  productUrl: "https://www.amazon.in/dp/B09HRDXQJM" },
      { platform: "flipkart", price: 7799, originalPrice: 8995, inStock: false, productUrl: "https://www.flipkart.com/logitech-mx-keys-mini" },
    ],
  },
  {
    name: "HP Pavilion 15 Laptop",
    brand: "HP",
    category: "electronics",
    subcategory: "laptops",
    description: "Intel Core i5 12th Gen laptop with Full HD IPS display, 8GB RAM, and 512GB SSD — built for productivity.",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80",
    ],
    specs: new Map([
      ["processor", "Intel Core i5-1235U 12th Gen"],
      ["ram", "8GB DDR4"],
      ["storage", "512GB SSD NVMe"],
      ["display", "15.6 inch FHD IPS 250 nits"],
      ["graphics", "Intel Iris Xe"],
      ["battery", "41Wh, up to 7.5 hours"],
      ["os", "Windows 11 Home"],
      ["ports", "2x USB-A, 1x USB-C, HDMI, SD Card"],
      ["weight", "1.75 kg"],
    ]),
    certifications: ["energy star"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "amazon",   price: 52990, originalPrice: 67990, inStock: true, productUrl: "https://www.amazon.in/dp/B0BX7G5VBN" },
      { platform: "flipkart", price: 51990, originalPrice: 67990, inStock: true, productUrl: "https://www.flipkart.com/hp-pavilion-15-laptop" },
    ],
  },
];

const skincareProducts = [
  {
    name: "Minimalist 10% Niacinamide Face Serum",
    brand: "Minimalist",
    category: "skincare",
    subcategory: "face serum",
    description: "Clinically proven 10% Niacinamide + 0.3% Zinc formula that reduces sebum, minimises pores, and brightens skin.",
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80",
    ],
    specs: null,
    skincareIngredients: [
      { name: "Niacinamide", ewgScore: 1, function: "Pore minimiser, brightening", isHarmful: false },
      { name: "Zinc PCA",    ewgScore: 1, function: "Sebum control",               isHarmful: false },
      { name: "Glycerin",    ewgScore: 1, function: "Humectant, moisturising",      isHarmful: false },
    ],
    suitableFor: ["oily", "combination", "normal"],
    certifications: ["dermatologist tested", "cruelty free"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "nykaa",    price: 599,  originalPrice: 699,  inStock: true,  productUrl: "https://www.nykaa.com/minimalist-10-niacinamide" },
      { platform: "amazon",   price: 579,  originalPrice: 699,  inStock: true,  productUrl: "https://www.amazon.in/dp/B08P4MWVBQ" },
      { platform: "flipkart", price: 599,  originalPrice: 699,  inStock: false, productUrl: "https://www.flipkart.com/minimalist-niacinamide" },
    ],
  },
  {
    name: "Dot & Key Vitamin C + E Serum",
    brand: "Dot & Key",
    category: "skincare",
    subcategory: "face serum",
    description: "10% Vitamin C + Vitamin E brightening serum with hyaluronic acid for glowing, hydrated skin.",
    images: [
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80",
    ],
    specs: null,
    skincareIngredients: [
      { name: "Ascorbic Acid (Vitamin C)", ewgScore: 1, function: "Brightening, antioxidant", isHarmful: false },
      { name: "Tocopherol (Vitamin E)",    ewgScore: 1, function: "Antioxidant, moisturising", isHarmful: false },
      { name: "Hyaluronic Acid",           ewgScore: 1, function: "Deep hydration",            isHarmful: false },
    ],
    suitableFor: ["dry", "normal", "combination"],
    certifications: ["dermatologist tested", "cruelty free", "vegan"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "nykaa",  price: 795, originalPrice: 995, inStock: true, productUrl: "https://www.nykaa.com/dot-and-key-vitamin-c-serum" },
      { platform: "amazon", price: 779, originalPrice: 995, inStock: true, productUrl: "https://www.amazon.in/dp/B08CXGT6WF" },
    ],
  },
  {
    name: "Mamaearth Ubtan Face Wash",
    brand: "Mamaearth",
    category: "skincare",
    subcategory: "face wash",
    description: "Natural face wash with turmeric and saffron that gently cleanses, removes tan, and gives a natural glow.",
    images: [
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80",
    ],
    specs: null,
    skincareIngredients: [
      { name: "Turmeric Extract", ewgScore: 1, function: "Anti-inflammatory, brightening", isHarmful: false },
      { name: "Saffron Extract",  ewgScore: 1, function: "Skin brightening",               isHarmful: false },
      { name: "Glycerin",         ewgScore: 1, function: "Moisturising",                   isHarmful: false },
    ],
    suitableFor: ["oily", "combination", "normal", "dry"],
    certifications: ["made safe certified", "cruelty free", "dermatologist tested"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "nykaa",    price: 249, originalPrice: 299, inStock: true, productUrl: "https://www.nykaa.com/mamaearth-ubtan-face-wash" },
      { platform: "amazon",   price: 239, originalPrice: 299, inStock: true, productUrl: "https://www.amazon.in/dp/B07CQWP9TW" },
      { platform: "flipkart", price: 249, originalPrice: 299, inStock: true, productUrl: "https://www.flipkart.com/mamaearth-ubtan-face-wash" },
    ],
  },
  {
    name: "The Derma Co 2% Salicylic Acid Face Serum",
    brand: "The Derma Co",
    category: "skincare",
    subcategory: "face serum",
    description: "2% Salicylic Acid serum with LHA and Zinc that deeply unclogs pores and controls acne breakouts.",
    images: [
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80",
    ],
    specs: null,
    skincareIngredients: [
      { name: "Salicylic Acid", ewgScore: 3, function: "Exfoliant, anti-acne",  isHarmful: false },
      { name: "LHA",            ewgScore: 2, function: "Pore clearing",          isHarmful: false },
      { name: "Zinc PCA",       ewgScore: 1, function: "Sebum control",          isHarmful: false },
    ],
    suitableFor: ["oily", "combination"],
    certifications: ["dermatologist tested"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "nykaa",  price: 449, originalPrice: 549, inStock: true, productUrl: "https://www.nykaa.com/the-derma-co-salicylic-acid-serum" },
      { platform: "amazon", price: 429, originalPrice: 549, inStock: true, productUrl: "https://www.amazon.in/dp/B09BDFYNJM" },
    ],
  },
  {
    name: "Cetaphil Moisturising Cream",
    brand: "Cetaphil",
    category: "skincare",
    subcategory: "moisturiser",
    description: "Gentle, non-greasy moisturising cream for sensitive and dry skin. Dermatologist recommended for daily use.",
    images: [
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80",
    ],
    specs: null,
    skincareIngredients: [
      { name: "Glycerin",          ewgScore: 1, function: "Humectant",             isHarmful: false },
      { name: "Sweet Almond Oil",  ewgScore: 1, function: "Emollient, nourishing", isHarmful: false },
      { name: "Tocopherol",        ewgScore: 1, function: "Antioxidant",           isHarmful: false },
      { name: "Dimethicone",       ewgScore: 3, function: "Skin protectant",       isHarmful: false },
    ],
    suitableFor: ["dry", "sensitive", "normal"],
    certifications: ["dermatologist recommended", "hypoallergenic"],
    source: "manual",
    lastEnriched: new Date(),
    platformPrices: [
      { platform: "nykaa",    price: 399, originalPrice: 499, inStock: true, productUrl: "https://www.nykaa.com/cetaphil-moisturising-cream" },
      { platform: "amazon",   price: 379, originalPrice: 499, inStock: true, productUrl: "https://www.amazon.in/dp/B00J4LPWSA" },
      { platform: "flipkart", price: 389, originalPrice: 499, inStock: true, productUrl: "https://www.flipkart.com/cetaphil-moisturising-cream" },
    ],
  },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

const seedProducts = async (products) => {
  let inserted = 0;
  let skipped = 0;

  for (const productData of products) {
    const { platformPrices, ...productFields } = productData;

    // Convert specs plain object to Map if needed
    if (productFields.specs && !(productFields.specs instanceof Map)) {
      productFields.specs = new Map(Object.entries(productFields.specs));
    }

    try {
      const product = await Product.findOneAndUpdate(
        { name: productFields.name, brand: productFields.brand },
        { $set: productFields },
        { upsert: true, new: true, runValidators: true }
      );

      // Seed platform prices
      for (const priceData of platformPrices) {
        await PlatformPrice.findOneAndUpdate(
          { productId: product._id, platform: priceData.platform },
          { $set: { ...priceData, productId: product._id, lastUpdated: new Date() } },
          { upsert: true, new: true }
        );
      }

      // Index in Pinecone for semantic search
      await indexProduct(product);

      console.log(`✅ Seeded: ${productFields.name}`);
      inserted++;
    } catch (err) {
      console.error(`❌ Failed: ${productFields.name} — ${err.message}`);
      skipped++;
    }
  }

  return { inserted, skipped };
};

// ─── Main ──────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected\n");

    // Must initialize Pinecone here — this script runs standalone,
    // outside server.js, so initPinecone() never ran otherwise.
    await initPinecone();
    console.log("✅ Pinecone initialized\n");

    console.log("── Seeding Electronics ──────────────────");
    const eResult = await seedProducts(electronicsProducts);

    console.log("\n── Seeding Skincare ─────────────────────");
    const sResult = await seedProducts(skincareProducts);

    console.log("\n── Done ─────────────────────────────────");
    console.log(`Electronics: ${eResult.inserted} inserted, ${eResult.skipped} skipped`);
    console.log(`Skincare:    ${sResult.inserted} inserted, ${sResult.skipped} skipped`);

  } catch (err) {
    console.error("Seed failed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

main();