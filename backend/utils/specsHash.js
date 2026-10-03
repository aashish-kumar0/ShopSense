const crypto = require("crypto");

function computeSpecsHash(product) {
  let source;
  if (product.category === "skincare") {
    source = product.skincareIngredients || [];
  } else if (product.category === "food") {
    source = {
      nutrition: product.nutrition || null,
      ingredients: product.ingredients || [],
    };
  } else {
    source = product.specs instanceof Map ? Object.fromEntries(product.specs) : (product.specs || {});
  }
  return crypto.createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

module.exports = computeSpecsHash;