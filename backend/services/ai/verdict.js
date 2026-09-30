// services/ai/verdict.service.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Verdict = require("../../models/Verdict");
const Product = require("../../models/Product");
const computeSpecsHash = require("../../utils/specsHash");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const INPUT_COST_PER_TOKEN = 0.30 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 2.50 / 1_000_000;

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `You are a product reviewer for an Indian shopping app.
Given a product's name and its specs/ingredients/nutrition, evaluate it purely on those attributes.

Return ONLY valid JSON in this exact shape, no markdown, no code fences:
{"verdict": "2-4 sentence objective verdict", "pros": ["short point", "short point"], "cons": ["short point", "short point"]}

Rules:
- Do not mention price, discounts, or platforms.
- Do not invent specs that weren't provided.
- 2-4 pros, 1-3 cons.
- Be direct and factual, not promotional.`,
});

function buildPrompt(product) {
  const base = `Product: ${product.name} (${product.brand}).`;

  if (product.category === "skincare") {
    const ingredients = (product.skincareIngredients || [])
      .map(i => `${i.name} (${i.function}${i.isHarmful ? ", flagged harmful" : ""})`)
      .join(", ");
    return `${base} Ingredients: ${ingredients || "none listed"}. Suitable for: ${(product.suitableFor || []).join(", ") || "not specified"}.`;
  }

  if (product.category === "food") {
    const n = product.nutrition || {};
    return `${base} Nutrition per ${n.servingSize || "serving"}: ${n.calories ?? "?"} kcal, ${n.protein ?? "?"}g protein, ${n.carbohydrates ?? "?"}g carbs, ${n.sugar ?? "?"}g sugar, ${n.fiber ?? "?"}g fiber, ${n.fat ?? "?"}g fat, ${n.sodium ?? "?"}mg sodium. Ingredients: ${(product.ingredients || []).join(", ") || "none listed"}.`;
  }

  const specs = product.specs instanceof Map ? Object.fromEntries(product.specs) : (product.specs || {});
  return `${base} Specs: ${JSON.stringify(specs)}.`;
}

async function generateAndSaveVerdict(product) {
  const specsHash = computeSpecsHash(product);

  const existing = await Verdict.findOne({ productId: product._id });
  if (existing && existing.specsHash === specsHash) {
    return existing; // no real change, skip the AI call
  }

  const prompt = buildPrompt(product);

  let parsed, usage;
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 400, responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    });

    const raw = result.response.text().trim();
    usage = result.response.usageMetadata || {};

    if (!raw) {
      console.warn(`[verdictGeneration] Empty response for product ${product._id}. Finish reason:`, result.response.candidates?.[0]?.finishReason);
      return existing || null;
    }
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[verdictGeneration] Gemini call/parse failed for product ${product._id}:`, err.message);
    return existing || null;
  }

  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;
  const tokensUsed = usage.totalTokenCount || (inputTokens + outputTokens);
  const estimatedCostUsd = (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);

  const verdict = await Verdict.findOneAndUpdate(
    { productId: product._id },
    {
      verdictText: parsed.verdict,
      pros: parsed.pros || [],
      cons: parsed.cons || [],
      specsHash,
      modelUsed: "gemini-2.5-flash",
      tokensUsed,
      estimatedCostUsd,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  await Product.findByIdAndUpdate(product._id, { pros: parsed.pros || [], cons: parsed.cons || [] });

  return verdict;
}

module.exports = generateAndSaveVerdict;