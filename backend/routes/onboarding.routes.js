const express =require("express")
const router = express.Router();
const {protect} = require("../middleware/auth.middleware")

const {
    saveOnboarding,
    getOnboarding,
    updateOnboarding
} = require("../controllers/onboarding.controller")

// all onboarding routes are protected- user must be loggedin

router.use(protect);

router.post("/",saveOnboarding);
router.get("/",getOnboarding);
router.patch("/",updateOnboarding);

module.exports = router