const express = require("express");
const router = express.Router();
const { signup, login, getMe, logout } = require("../controllers/auth.controller");
const {protect} = require("../middleware/auth.middleware");

// Public routes — no token needed
router.post("/signup", signup);
router.post("/login", login);

// Protected route — requires valid token
router.get("/me", protect, getMe);

// logout
router.post("/logout", protect, logout);

module.exports = router;