import { readFile } from "node:fs/promises";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_TIMEOUT_MS = 2800;
const REFERENCE_IMAGE_URL = new URL("../mango_types_india.jpeg", import.meta.url);

export const MANGO_DATASET = [
  {
    name: "Alphonso",
    state: "Maharashtra",
    traits: "Golden yellow to saffron skin, compact oval shape, smooth peel, slight red blush near the shoulder."
  },
  {
    name: "Kesar",
    state: "Gujarat",
    traits: "Bright yellow-orange skin, rounded shoulders, medium oval body, aromatic and lightly speckled peel."
  },
  {
    name: "Dasheri",
    state: "Uttar Pradesh",
    traits: "Long slender shape, green-yellow skin when ripe, smooth surface, narrow tapering beak."
  },
  {
    name: "Langra",
    state: "Uttar Pradesh",
    traits: "Green skin even when ripe, oval to round body, matte peel, subtle yellow undertone near maturity."
  },
  {
    name: "Banganapalli",
    state: "Andhra Pradesh",
    traits: "Large oblong body, pale golden yellow skin, smooth surface, broad shoulders and minimal blush."
  },
  {
    name: "Totapuri",
    state: "Karnataka",
    traits: "Distinct parrot-beak tip, elongated shape, yellow-green skin, firm texture and angular shoulders."
  },
  {
    name: "Himsagar",
    state: "West Bengal",
    traits: "Medium rounded shape, deep yellow skin at peak, soft smooth peel, gentle shoulder curve."
  }
];

const FALLBACK_ANALYSIS = {
  name: "Alphonso",
  state: "Maharashtra",
  ripeness: "Perfect",
  ripening_type: "Natural",
  confidence: 88,
  reasoning: "Golden tone, smooth peel, and oval shoulders match the closest known profile.",
  dishes: ["Aamras", "Mango shrikhand", "Mango lassi"],
  recipes: [
    {
      name: "Aamras",
      steps: [
        "Peel and cube the ripe mango.",
        "Blend with a splash of chilled milk or water.",
        "Add cardamom and a small pinch of saffron.",
        "Serve cold with puri or as a dessert bowl."
      ]
    },
    {
      name: "Mango Shrikhand",
      steps: [
        "Whisk hung curd until smooth.",
        "Fold in mango pulp and powdered sugar.",
        "Add cardamom and chopped pistachios.",
        "Chill for 30 minutes before serving."
      ]
    }
  ],
  source: "fallback",
  failureReason: ""
};

const allowedRipeness = ["Unripe", "Semi-ripe", "Perfect", "Overripe", "Spoiled"];
const allowedRipeningTypes = ["Natural", "Artificial"];
let referenceImageDataUrl = null;

function datasetPrompt() {
  return MANGO_DATASET.map(
    (mango) => `- ${mango.name} (${mango.state}): ${mango.traits}`
  ).join("\n");
}

export const MANGO_SYSTEM_PROMPT = `You are a highly specialized AI trained in identifying Indian mango varieties and analyzing fruit quality from images.

You are given:
- A mango image from the user
- A reference image of Indian mango varieties

You MUST use visual comparison between the two.

You rely ONLY on visual cues:
- Color
- Shape
- Skin texture
- Spots
- Uniformity

---

SECTION 1: RIPENESS CLASSIFICATION

UNRIPE:
- Mostly green, hard, dull

SEMI-RIPE:
- Green with yellow patches

PERFECT:
- Golden yellow, smooth, slightly soft

OVER-RIPE:
- Deep yellow, soft, slight wrinkles

SPOILED:
- Dark patches, mushy, damaged

---

SECTION 2: RIPENING TYPE

NATURAL:
- Even coloring

ARTIFICIAL:
- Uneven patches, unnatural color distribution

---

SECTION 3: INDIAN MANGO VARIETIES (STRICT)

Choose ONLY from:

Alphonso (Maharashtra) - golden, oval, smooth
Kesar (Gujarat) - yellow-orange, slightly uneven
Dasheri (Uttar Pradesh) - elongated, green-yellow
Langra (Uttar Pradesh) - green when ripe
Banganapalli (Andhra Pradesh) - large, bright yellow
Totapuri (Karnataka) - pointed beak shape
Himsagar (West Bengal) - medium, smooth, yellow

Full dataset notes:
${datasetPrompt()}

---

SECTION 4: GEOGRAPHY

Map correctly:
- Alphonso -> Maharashtra
- Kesar -> Gujarat
- Dasheri -> Uttar Pradesh
- Langra -> Uttar Pradesh
- Banganapalli -> Andhra Pradesh
- Totapuri -> Karnataka
- Himsagar -> West Bengal

---

SECTION 5: DECISION LOGIC

1. Compare user image with reference image
2. Match shape + color to closest variety
3. Determine ripeness
4. Detect ripening type
5. Detect spoilage
6. Always pick closest valid mango (never unknown)

---

SECTION 6: CONFIDENCE

90-100 -> strong
70-89 -> moderate
50-69 -> uncertain but best guess

---

SECTION 7: REASONING

- 1-2 lines
- Must reference visual cues AND comparison to reference image

---

SECTION 8: DISHES & RECIPES

UNRIPE -> Pickle, Chutney
PERFECT -> Shake, Aamras, Smoothie
OVER-RIPE -> Cake, Jam, Dessert

Generate 2 recipes:
- 3-5 steps
- Simple Indian style

---

SECTION 9: OUTPUT (STRICT JSON)

{
  "name": "",
  "state": "",
  "ripeness": "",
  "ripening_type": "",
  "confidence": "",
  "reasoning": "",
  "dishes": [],
  "recipes": [
    { "name": "", "steps": [] }
  ]
}

---

RULES:

- Never say unknown
- Always choose from list
- Be confident
- No text outside JSON

---

GOAL:

Behave like a trained mango expert using both knowledge and visual comparison.`;

function findDatasetEntry(name) {
  const normalizedName = String(name || "").toLowerCase();
  return (
    MANGO_DATASET.find((mango) => {
      const datasetName = mango.name.toLowerCase();
      return normalizedName === datasetName || normalizedName.includes(datasetName);
    }) ||
    FALLBACK_ANALYSIS
  );
}

function parseConfidence(value) {
  if (typeof value === "number") {
    return Math.max(1, Math.min(100, Math.round(value)));
  }

  const match = String(value || "").match(/\d+/);
  if (!match) {
    return FALLBACK_ANALYSIS.confidence;
  }

  return Math.max(1, Math.min(100, Number(match[0])));
}

function pickAllowed(value, allowed, fallback) {
  const normalizedValue = normalizeLabel(value);
  return allowed.find((item) => normalizeLabel(item) === normalizedValue) || fallback;
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function compactText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return items.length ? items : fallback;
}

function normalizeRecipes(value, fallbackRecipes) {
  if (!Array.isArray(value)) {
    return fallbackRecipes;
  }

  const recipes = value
    .map((recipe, index) => {
      const fallbackRecipe = fallbackRecipes[index] || fallbackRecipes[0];
      const name = compactText(recipe?.name, fallbackRecipe.name);
      const steps = normalizeList(recipe?.steps, fallbackRecipe.steps).slice(0, 5);

      return {
        name,
        steps: steps.length >= 3 ? steps : fallbackRecipe.steps
      };
    })
    .filter((recipe) => recipe.name && recipe.steps.length)
    .slice(0, 2);

  return recipes.length ? recipes : fallbackRecipes;
}

function extractJson(text = "") {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Model response was not valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

export function normalizeMangoAnalysis(payload = {}, options = {}) {
  const datasetEntry = findDatasetEntry(payload.name);
  const fallback = {
    ...FALLBACK_ANALYSIS,
    state: datasetEntry.state
  };

  return {
    name: datasetEntry.name,
    state: datasetEntry.state,
    ripeness: pickAllowed(payload.ripeness, allowedRipeness, fallback.ripeness),
    ripening_type: pickAllowed(
      payload.ripening_type,
      allowedRipeningTypes,
      fallback.ripening_type
    ),
    confidence: parseConfidence(payload.confidence),
    reasoning: compactText(payload.reasoning, fallback.reasoning),
    dishes: normalizeList(payload.dishes, fallback.dishes).slice(0, 4),
    recipes: normalizeRecipes(payload.recipes, fallback.recipes),
    source: options.source || "live",
    failureReason: options.failureReason || ""
  };
}

async function loadReferenceImageDataUrl() {
  if (referenceImageDataUrl) {
    return referenceImageDataUrl;
  }

  const image = await readFile(REFERENCE_IMAGE_URL);
  referenceImageDataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
  return referenceImageDataUrl;
}

async function buildMessages(image) {
  const mangoTypesReferenceImage = await loadReferenceImageDataUrl();

  return [
    {
      role: "system",
      content: MANGO_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "Analyze this mango image using the reference guide and return JSON. You are provided with: 1. The user's mango image 2. A reference image showing Indian mango varieties (mango_types_india). Use the reference image to compare shapes, colors, and features to improve identification accuracy."
        },
        {
          type: "image_url",
          image_url: {
            url: image,
            detail: "low"
          }
        },
        {
          type: "image_url",
          image_url: {
            url: mangoTypesReferenceImage,
            detail: "low"
          }
        }
      ]
    }
  ];
}

export function buildFallbackAnalysis(failureReason = "") {
  return normalizeMangoAnalysis(FALLBACK_ANALYSIS, {
    source: "fallback",
    failureReason
  });
}

export async function analyzeMangoImage(image, options = {}) {
  const env = options.env || process.env;
  const appOrigin =
    options.appOrigin ||
    env.OPENROUTER_SITE_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:8787");
  const appName = options.appName || env.OPENROUTER_APP_NAME || "Asli Aam Mango Scanner";

  if (!env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), OPENROUTER_TIMEOUT_MS);

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": appOrigin,
        "X-OpenRouter-Title": appName
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: await buildMessages(image),
        response_format: {
          type: "json_object"
        },
        max_tokens: 900,
        temperature: 0.25
      }),
      signal: abortController.signal
    }
  ).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OpenRouter model request failed.");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  try {
    return normalizeMangoAnalysis(extractJson(content));
  } catch (error) {
    return buildFallbackAnalysis(error.message || "Unable to parse OpenRouter JSON response.");
  }
}
