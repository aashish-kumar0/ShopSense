const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Pass system instruction separately — this is the correct Gemini pattern
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `You are a product category classifier for an Indian shopping app.
Given a user's search query, return EXACTLY one word — the product category.

Rules:
- Return "food" for any food, beverage, grocery, snack, drink, or FMCG edible product
- Return "electronics" for any gadget, device, phone, laptop, earphone, TV, or tech product
- Return "skincare" for any serum, moisturiser, face wash, sunscreen, toner, cleanser, 
  cream, lotion, beauty product, haircare product, or any product containing skincare 
  ingredients like niacinamide, retinol, vitamin C, salicylic acid, hyaluronic acid
- Return "unknown" if the query doesn't fit any of the above three categories

Examples:
- "mango juice" → food
- "boat airdopes" → electronics  
- "niacinamide serum" → skincare
- "vitamin c face serum" → skincare
- "cetaphil moisturiser" → skincare
- "nike shoes" → unknown

Respond with ONLY the single word. No explanation. No punctuation.`,
});
const VALID_CATEGORIES = ["food", "electronics", "skincare"];

const detectCategory = async (query) => {
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: query }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 200,
      },

      // Disable safety filters — we're just doing category classification
      // these filters block skincare ingredient names like niacinamide, retinol etc.
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    });

    const raw = result.response.text().trim().toLowerCase().replace(/[^a-z]/g, "");

    // If empty, likely a safety filter block — log the feedback
    if (!raw) {
      console.warn("[categoryDetection] Empty response — possible safety filter block for query:", query);
      console.warn("[categoryDetection] Finish reason:", result.response.candidates?.[0]?.finishReason);
      return "unknown";
    }

    if (VALID_CATEGORIES.includes(raw)) return raw;

    console.warn(`[categoryDetection] Unexpected response: "${raw}" for query: "${query}"`);
    return "unknown";

  } catch (err) {
    console.error("[categoryDetection] Gemini call failed:", err.message);
    return "unknown";
  }
};

module.exports = { detectCategory };