import { readFile } from "node:fs/promises";
import { AGRICULTURAL_GUIDE_PROMPT_APPENDIX } from "./mangoGuideKnowledge.js";
import { recipeDishesFromSelection, selectMangoRecipes } from "./mangoRecipeSystem.js";

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
  is_mango: true,
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
  all_recipes: [
    {
      name: "Aamras",
      type: "Dessert",
      steps: [
        "Peel and cube the ripe mango.",
        "Blend with a splash of chilled milk or water.",
        "Add cardamom and a small pinch of saffron.",
        "Serve cold with puri or as a dessert bowl."
      ]
    },
    {
      name: "Mango Shrikhand",
      type: "Dessert",
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
export const ripenessGuide = {
  unripe: {
    visual: [
      "mostly green",
      "no yellow tones",
      "dull skin"
    ],
    texture: "firm and hard",
    notes: "not ready to eat"
  },
  semi_ripe: {
    visual: [
      "green with yellow patches",
      "uneven color distribution"
    ],
    texture: "slightly firm",
    notes: "partially ripened"
  },
  perfect: {
    visual: [
      "golden yellow or yellow-orange",
      "even color with slight natural variation",
      "smooth skin"
    ],
    texture: "slightly soft but not mushy",
    notes: "ideal eating stage"
  },
  overripe: {
    visual: [
      "deep yellow to brownish tones",
      "wrinkled skin",
      "dark spots forming"
    ],
    texture: "very soft",
    notes: "best for desserts"
  },
  spoiled: {
    visual: [
      "black or dark brown patches",
      "leakage or collapse",
      "mold-like appearance"
    ],
    texture: "mushy",
    notes: "not safe to consume"
  }
};
const MANGO_TRAIT_RULES = [
  {
    name: "Alphonso",
    keywords: ["alphonso", "happus", "oval", "ovate", "oblique", "golden", "orange", "saffron", "smooth"]
  },
  {
    name: "Kesar",
    keywords: ["kesar", "yelloworange", "orange", "oblong", "blush", "shoulder", "uneven"]
  },
  {
    name: "Dasheri",
    keywords: ["dasheri", "dashehari", "elongated", "long", "slender", "greenyellow", "yellowgreen", "narrow"]
  },
  {
    name: "Langra",
    keywords: ["langra", "lettucegreen", "greenwhenripe", "green", "ovate", "thin", "matte"]
  },
  {
    name: "Banganapalli",
    keywords: ["banganapalli", "baneshan", "safeda", "large", "oblong", "oval", "golden", "brightyellow", "paleyellow"]
  },
  {
    name: "Totapuri",
    keywords: ["totapuri", "bangalora", "pointed", "beak", "parrot", "elongated", "oblong", "angular"]
  },
  {
    name: "Himsagar",
    keywords: ["himsagar", "medium", "ovate", "rounded", "smooth", "yellow"]
  }
];
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

First determine if the object is a mango.

If it is clearly NOT a mango:
- Return:
  {
    "is_mango": false
  }

If it is a mango:
- Return the full JSON with:
  {
    "is_mango": true,
    ...
  }

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

Advanced ripeness intelligence:
${JSON.stringify(ripenessGuide, null, 2)}

When determining ripeness:
- Do NOT rely only on color
- Combine color + texture indicators
- Slight green patches can still indicate perfect ripeness
- Wrinkling or collapse indicates over-ripeness
- Dark patches or mold indicates spoilage

Always cross-check ripeness with visual reasoning before finalizing.

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
7. Before finalizing, internally verify that the selected mango type matches the visible shape and color. If not, correct it.

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

Do NOT generate dishes or recipes.
The application uses a local mango recipe dataset after your visual analysis.
Return "dishes": [] and "recipes": [] for mango results.

---

SECTION 9: OUTPUT (STRICT JSON)

{
  "is_mango": true,
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

OR

{
  "is_mango": false
}

---

RULES:

- Never say unknown
- Always choose from list
- Be confident
- Before finalizing, internally verify that the selected mango type matches the visible shape and color. If not, correct it.
- No text outside JSON

---

GOAL:

Behave like a trained mango expert using both knowledge and visual comparison.

${AGRICULTURAL_GUIDE_PROMPT_APPENDIX}`;

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

function findDatasetByExactName(name) {
  const normalizedName = normalizeLabel(name);
  return MANGO_DATASET.find((mango) => normalizeLabel(mango.name) === normalizedName);
}

function scoreMangoRule(rule, payload = {}) {
  const text = normalizeLabel(
    `${payload.name || ""} ${payload.reasoning || ""} ${payload.visual_cues || ""}`
  );

  return rule.keywords.reduce((score, keyword) => {
    return text.includes(normalizeLabel(keyword)) ? score + 1 : score;
  }, 0);
}

function chooseVerifiedMango(payload = {}) {
  const selected = findDatasetEntry(payload.name);
  const selectedRule = MANGO_TRAIT_RULES.find((rule) => rule.name === selected.name);
  const selectedScore = selectedRule ? scoreMangoRule(selectedRule, payload) : 0;
  const bestRule = MANGO_TRAIT_RULES.reduce(
    (best, rule) => {
      const score = scoreMangoRule(rule, payload);
      return score > best.score ? { rule, score } : best;
    },
    { rule: selectedRule, score: selectedScore }
  );

  if (bestRule.rule && bestRule.rule.name !== selected.name && bestRule.score >= selectedScore + 2) {
    return findDatasetByExactName(bestRule.rule.name) || selected;
  }

  return selected;
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

function validateRipeness(payloadRipeness, reasoning = "") {
  const normalizedReasoning = normalizeLabel(reasoning);
  const modelRipeness = pickAllowed(payloadRipeness, allowedRipeness, FALLBACK_ANALYSIS.ripeness);

  if (
    normalizedReasoning.includes("darkpatch") ||
    normalizedReasoning.includes("blackpatch") ||
    normalizedReasoning.includes("mold") ||
    normalizedReasoning.includes("leak") ||
    normalizedReasoning.includes("spoiled") ||
    normalizedReasoning.includes("decay")
  ) {
    return "Spoiled";
  }

  if (
    normalizedReasoning.includes("wrinkl") ||
    normalizedReasoning.includes("toosoft") ||
    normalizedReasoning.includes("softcollapse") ||
    normalizedReasoning.includes("collapse") ||
    normalizedReasoning.includes("mushy") ||
    normalizedReasoning.includes("verysoft") ||
    normalizedReasoning.includes("deepyellow") ||
    normalizedReasoning.includes("brownishtone") ||
    normalizedReasoning.includes("darkspot") ||
    normalizedReasoning.includes("overripe")
  ) {
    return "Overripe";
  }

  if (
    normalizedReasoning.includes("goldenyellow") ||
    normalizedReasoning.includes("yelloworange") ||
    normalizedReasoning.includes("slightlysoft") ||
    normalizedReasoning.includes("smoothskin") ||
    normalizedReasoning.includes("ideal") ||
    normalizedReasoning.includes("slightgreen") ||
    normalizedReasoning.includes("greenyellow") ||
    normalizedReasoning.includes("yellowgreen")
  ) {
    return "Perfect";
  }

  if (
    normalizedReasoning.includes("greenwithyellowpatch") ||
    normalizedReasoning.includes("yellowpatch") ||
    normalizedReasoning.includes("unevencolor") ||
    normalizedReasoning.includes("slightlyfirm") ||
    normalizedReasoning.includes("semiripe") ||
    normalizedReasoning.includes("partiallyripened")
  ) {
    return "Semi-ripe";
  }

  if (
    normalizedReasoning.includes("mostlygreen") ||
    normalizedReasoning.includes("noyellow") ||
    normalizedReasoning.includes("dullskin") ||
    normalizedReasoning.includes("firmandhard") ||
    normalizedReasoning.includes("harddull") ||
    normalizedReasoning.includes("unripe")
  ) {
    return "Unripe";
  }

  return modelRipeness;
}

function ensureReasoning(reasoning, datasetEntry) {
  const cleanReasoning = compactText(reasoning, "");
  const normalizedReasoning = normalizeLabel(cleanReasoning);
  const hasVisualCue = [
    "color",
    "shape",
    "green",
    "yellow",
    "golden",
    "oval",
    "oblong",
    "elongated",
    "pointed",
    "smooth",
    "patch",
    "wrinkl"
  ].some((cue) => normalizedReasoning.includes(cue));
  const hasComparison =
    normalizedReasoning.includes(normalizeLabel(datasetEntry.name)) ||
    normalizedReasoning.includes("match") ||
    normalizedReasoning.includes("reference") ||
    normalizedReasoning.includes("closest");

  if (cleanReasoning && hasVisualCue && hasComparison) {
    return cleanReasoning;
  }

  if (cleanReasoning && hasVisualCue) {
    return `${cleanReasoning} Compared with the reference guide, ${datasetEntry.name} is the closest valid mango type.`;
  }

  return `Visible shape and color cues best match ${datasetEntry.name} compared with the reference guide.`;
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
  if (payload?.is_mango === false) {
    return {
      is_mango: false
    };
  }

  const datasetEntry = chooseVerifiedMango(payload);
  const fallback = {
    ...FALLBACK_ANALYSIS,
    state: datasetEntry.state
  };
  const rawReasoning = compactText(payload.reasoning, fallback.reasoning);
  const ripeness = validateRipeness(payload.ripeness, rawReasoning);
  const reasoning = ensureReasoning(rawReasoning, datasetEntry);
  const recipeSelection = selectMangoRecipes({
    ripeness,
    variety: datasetEntry.name
  });
  const recipes = recipeSelection.topRecipes;
  const allRecipes = recipeSelection.allRecipes;
  const dishes = recipeDishesFromSelection(recipes);

  return {
    is_mango: true,
    name: datasetEntry.name,
    state: datasetEntry.state,
    ripeness,
    ripening_type: pickAllowed(
      payload.ripening_type,
      allowedRipeningTypes,
      fallback.ripening_type
    ),
    confidence: parseConfidence(payload.confidence),
    reasoning,
    dishes,
    recipes,
    all_recipes: allRecipes,
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
            "Analyze this mango image using the reference guide and return JSON. First determine if the object is a mango. If it is clearly not a mango, return only { \"is_mango\": false }. If it is a mango, return the full strict JSON with { \"is_mango\": true, ... }. Do not generate dishes or recipes; return empty arrays for those fields because the app fills recipes from a local dataset. You are provided with: 1. The user's mango image 2. A reference image showing Indian mango varieties (mango_types_india). Use the reference image to compare shapes, colors, and features to improve identification accuracy."
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
