const axios = require("axios")

const OFf_BASE_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OFf_TIMEOUT = 8000; // 8 seconds

/**
 * Search Open Food Facts and return normalized products
 * ready to be inserted into your Product schema.
 *
 * @param {string} query - raw user search string e.g. "mango juice"
 * @param {number} limit - max products to return (default 10)
 * @returns {Array} normalized product objects
 */

const searchOpenFoodFacts = async (query, limit = 10) => {
    try {
        const response = await axios.get(OFf_BASE_URL, {
            timeout: OFf_TIMEOUT,
            params: {
                search_terms: query,
                search_simple: 1,
                action: "process",
                json: 1,
                page_size: limit,
                fields: [
                    "product_name",
                    "product_name_en",
                    "brands",
                    "categories_tags",
                    "image_front_url",
                    "image_url",
                    "nutriments",
                    "ingredients_text",
                    "allergens_tags",
                    "labels_tags",
                    "quantity",
                    "serving_size",
                    "nutriscore_grade",
                    "ecoscore_grade",
                    "code",                // barcode — useful as external ID
                ].join(","),
            },
        });

        const products = response.data?.products;
        if(!products || products.length === 0) return [];

        // normalize each product
        const normalized = products
        .map(normalizedOFfProduct)
        .filter((p) => p !== null);
        return normalized;

    } catch (err) {
        console.error("[openFoodFacts] API call failed: ", err.message);
        return [];
    }
};

// Normalizer
// Translates a OFf product object into our product schema shape

const normalizedOFfProduct = (raw) => {

    const name = raw.product_name_en?.trim() || raw.product_name?.trim();
    if(!name) return null;

    const brand = raw.brands?.split(",")[0]?.trim() || "Unknown Brand";
 
  // ─── Nutrition ───────────────────────────────────────────────
  const n = raw.nutriments || {};
 
  const nutrition = {
    servingSize: raw.serving_size || raw.quantity || null,
    calories:    safeNum(n["energy-kcal_100g"] ?? n["energy-kcal"]),
    protein:     safeNum(n["proteins_100g"]    ?? n["proteins"]),
    carbohydrates: safeNum(n["carbohydrates_100g"] ?? n["carbohydrates"]),
    sugar:       safeNum(n["sugars_100g"]      ?? n["sugars"]),
    fiber:       safeNum(n["fiber_100g"]       ?? n["fiber"]),
    fat:         safeNum(n["fat_100g"]         ?? n["fat"]),
    sodium:      safeNum(n["sodium_100g"]      ?? n["sodium"]),
  };


  // ─── Ingredients ─────────────────────────────────────────────
  const ingredients = raw.ingredients_text
    ? raw.ingredients_text
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean)
        .slice(0, 30) // cap at 30 ingredients
    : [];
 
  // ─── Certifications from labels ──────────────────────────────
  // OFf labels_tags look like: ["en:organic", "en:fair-trade"]
  const certifications = (raw.labels_tags || [])
    .map((tag) => tag.replace(/^[a-z]+:/, "").replace(/-/g, " "))
    .slice(0, 5);
 
  // ─── Subcategory from categories_tags ────────────────────────
  // e.g. ["en:beverages", "en:juices"] → "juices"
  const subcategory = extractSubcategory(raw.categories_tags);
 
  // ─── Images ──────────────────────────────────────────────────
  const images = [];
  if (raw.image_front_url) images.push(raw.image_front_url);
  if (raw.image_url && raw.image_url !== raw.image_front_url)
    images.push(raw.image_url);
 
  // ─── Description ─────────────────────────────────────────────
  const descriptionParts = [];
  if (raw.nutriscore_grade)
    descriptionParts.push(`Nutri-Score: ${raw.nutriscore_grade.toUpperCase()}`);
  if (raw.ecoscore_grade)
    descriptionParts.push(`Eco-Score: ${raw.ecoscore_grade.toUpperCase()}`);
  if (raw.quantity)
    descriptionParts.push(`Quantity: ${raw.quantity}`);

   return {
    // ── Core fields ──────────────────────────────────────────
    name,
    brand,
    category: "food",
    subcategory: subcategory || "general",
    description: descriptionParts.join(" | ") || null,
    images,
    certifications,
 
    // ── Food-specific ─────────────────────────────────────────
    nutrition,
    ingredients,
 
    // ── Non-food fields not applicable ────────────────────────
    specs: null,
    skincareIngredients: [],
    suitableFor: [],
 
    // ── Source tracking ───────────────────────────────────────
    source: "open_food_facts",
    lastEnriched: new Date(),
 
    // ── Platform prices: OFf doesn't have prices
    //    but we seed BigBasket + Blinkit with estimated prices
    //    so the app always shows something ─────────────────────
    platformPrices: generateFoodPlatformPrices(),
  };
};


// ─── Helpers ───────────────────────────────────────────────────────────────
 
/** Safely parse a number — return null if undefined/NaN */
const safeNum = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? null : Math.round(n * 100) / 100; // round to 2 decimal places
};
 
/** Extract most specific subcategory from OFf categories_tags array */
const extractSubcategory = (tags) => {
  if (!tags || !tags.length) return "general";
 
  // OFf tags are like "en:beverages", "en:fruit-juices"
  // Take the last tag (most specific), strip language prefix, humanize
  const last = tags[tags.length - 1];
  return last
    .replace(/^[a-z]+:/, "")   // remove "en:"
    .replace(/-/g, " ")         // "fruit-juices" → "fruit juices"
    .trim();
};

/**
 * OFf has no pricing data.
 * We generate estimated platform prices so the UI always shows
 * a price comparison table — realistic enough for a portfolio.
 *
 * In production this would be replaced by real scraper data.
 */
const generateFoodPlatformPrices = () => {
  // Base price between ₹50–₹300 (random but seeded)
  const base = Math.floor(Math.random() * 250) + 50;
 
  return [
    {
      platform: "bigbasket",
      price: base,
      originalPrice: Math.round(base * 1.1),
      inStock: true,
      productUrl: "https://www.bigbasket.com",
    },
    {
      platform: "blinkit",
      price: Math.round(base * 1.05),
      originalPrice: Math.round(base * 1.15),
      inStock: Math.random() > 0.2, // 80% chance in stock
      productUrl: "https://www.blinkit.com",
    },
    {
      platform: "swiggy",
      price: Math.round(base * 1.08),
      originalPrice: Math.round(base * 1.2),
      inStock: Math.random() > 0.3,
      productUrl: "https://www.swiggy.com/instamart",
    },
  ];
};
 
module.exports = { searchOpenFoodFacts };