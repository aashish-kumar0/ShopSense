const requiredVars = [
  "MONGODB_URI",
//   "JWT_SECRET",
//   "OPENAI_API_KEY",
];

// Called once at server startup — crashes early if anything is missing
// This is intentional: a missing env var caught at boot is better than 
// a cryptic error 10 requests deep into production traffic
const validateEnv = () => {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  console.log("✅ Environment variables validated");
};

module.exports = validateEnv;