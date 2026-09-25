const User = require("../models/User");

// kept here so that error mesgs are descriptive

const VALID = {
  healthGoals: ["weight_loss", "muscle_gain", "diabetic_management", "general_health"],
  skinType: ["oily", "dry", "combination", "sensitive", "normal", null],
  techUseCase: ["gaming", "photography", "work", "general", null],
  restrictions: ["vegan", "gluten_free", "nut_allergy", "no_parabens", "no_sulphates"],
};


// validates incoming preferences fields

function validatePreferences(data) {
  const { healthGoals, skinType, techUseCase, restrictions, budgetRange } = data;

  if (healthGoals !== undefined) {
    if (!Array.isArray(healthGoals))
      return { valid: false, message: "healthGoals must be an array" };
    const bad = healthGoals.filter((g) => !VALID.healthGoals.includes(g));
    if (bad.length)
      return { valid: false, message: `Invalid healthGoals: ${bad.join(", ")}` };

  }

  if (restrictions !== undefined) {
    if (!Array.isArray(restrictions))
      return { valid: false, message: "restrictions must be an array" };
    const bad = restrictions.filter((r) => !VALID.restrictions.includes(r));
    if (bad.length)
      return { valid: false, message: `Invalid restrictions: ${bad.join(", ")}` };
  }

  if (skinType !== undefined && !VALID.skinType.includes(skinType))
    return { valid: false, message: `Invalid skinType: ${skinType}` };

  if (techUseCase !== undefined && !VALID.techUseCase.includes(techUseCase))
    return { valid: false, message: `Invalid techUseCase: ${techUseCase}` };

  if (budgetRange !== undefined) {
    const { min, max } = budgetRange;
    if (min !== undefined && (typeof min !== "number" || min < 0))
      return { valid: false, message: "budgetRange.min must be a non-negative number" };
    if (max !== undefined && (typeof max !== "number" || max < 0))
      return { valid: false, message: "budgetRange.max must be a non-negative number" };
    if (min !== undefined && max !== undefined && min > max)
      return { valid: false, message: "budgetRange.min cannot exceed budgetRange.max" };
  }

  return { valid: true };

}


// Controllers

// Post -  /api/onboarding
// save preferences for the first time

const saveOnboarding = async (req, res) => {
  try {
    const check = validatePreferences(req.body);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }

    const { healthGoals, budgetRange, skinType, techUseCase, restrictions } = req.body;

    // build the preferences update object

    const prefUpdate = {};
    if (healthGoals !== undefined) prefUpdate["preferences.healthGoals"] = healthGoals;
    if (skinType !== undefined) prefUpdate["preferences.skinType"] = skinType;
    if (techUseCase !== undefined) prefUpdate["preferences.techUseCase"] = techUseCase;
    if (restrictions !== undefined) prefUpdate["preferences.restrictions"] = restrictions;

    if (budgetRange !== undefined) {
      if (budgetRange.min !== undefined) prefUpdate["preferences.budgetRange.min"] = budgetRange.min;
      if (budgetRange.max !== undefined) prefUpdate["preferences.budgetRange.max"] = budgetRange.max;
    }

    prefUpdate["preferences.onboardingCompleted"] = true;

    const user = await User.findByIdAndUpdate(req.user._id,
      {$set : prefUpdate},
      {new : true, runValidators : true}
    ).select(("preferences name email"));

    if(!user){
      return res.status(404).json({success : false, message : "User not found"})
    }

    return res.status(200).json({
      success : true,
      message : "Onboarding Completed",
      data : {preferences : user.preferences}
    })
  }catch(err){
     // Mongoose validation errors (enum mismatches at the DB level)
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join("; ") });
    }
    console.error("[saveOnboarding]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET - /api/onboarding

const getOnboarding = async (req, res)=>{
  try {
    const user = await User.findById(req.user._id).select("preferences name email");
 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    return res.status(200).json({
      success: true,
      data: { preferences: user.preferences },
    });
  } catch (err) {
    console.error("[getOnboarding]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// PATCH - /api/onboarding
// partially update preferences

const updateOnboarding = async (req, res) => {
  try {
    // Reject empty body
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ success: false, message: "No fields provided to update" });
    }
 
    const check = validatePreferences(req.body);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }
 
    const { healthGoals, budgetRange, skinType, techUseCase, restrictions } = req.body;
 
    const prefUpdate = {};
    if (healthGoals !== undefined) prefUpdate["preferences.healthGoals"] = healthGoals;
    if (skinType !== undefined) prefUpdate["preferences.skinType"] = skinType;
    if (techUseCase !== undefined) prefUpdate["preferences.techUseCase"] = techUseCase;
    if (restrictions !== undefined) prefUpdate["preferences.restrictions"] = restrictions;
 
    if (budgetRange !== undefined) {
      if (budgetRange.min !== undefined) prefUpdate["preferences.budgetRange.min"] = budgetRange.min;
      if (budgetRange.max !== undefined) prefUpdate["preferences.budgetRange.max"] = budgetRange.max;
    }
 
    if (!Object.keys(prefUpdate).length) {
      return res.status(400).json({ success: false, message: "No valid preference fields found in request" });
    }
 
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: prefUpdate },
      { new: true, runValidators: true }
    ).select("preferences");
 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    return res.status(200).json({
      success: true,
      message: "Preferences updated",
      data: { preferences: user.preferences },
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join("; ") });
    }
    console.error("[updateOnboarding]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
 
module.exports = { saveOnboarding, getOnboarding, updateOnboarding };