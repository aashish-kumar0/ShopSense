const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { searchProducts, getProductById } = require("../controllers/product.controller");

// Search is protected — user must be logged in
// This lets us personalize results using req.user.preferences in Step 6
router.get("/search", protect, searchProducts);
router.get("/:id", protect, getProductById)

module.exports = router;