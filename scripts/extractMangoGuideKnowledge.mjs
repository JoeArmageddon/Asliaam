import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const GUIDE_FILES = [
  "mango_varities.pdf",
  "Mango_Handling_and_Ripening_Protocol_Eng.pdf"
];

const TARGET_VARIETIES = [
  "Alphonso",
  "Kesar",
  "Dashehari",
  "Langra",
  "Banganapalli",
  "Bangalora",
  "Totapuri",
  "Himsagar"
];

const RIPENING_TERMS = [
  "maturity",
  "ripeness",
  "ripening",
  "firmness",
  "skin color",
  "flesh color",
  "wrinkles",
  "shriveled",
  "decay",
  "uneven ripening",
  "ethylene"
];

const normalizeText = (text) =>
  text
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();

const extractPdfText = async (path) => {
  const parser = new PDFParse({ data: await readFile(path) });

  try {
    const result = await parser.getText();
    return normalizeText(result.text || "");
  } finally {
    await parser.destroy();
  }
};

const extractVarietySummaries = (text) => {
  const snippets = {};

  for (const variety of TARGET_VARIETIES) {
    const match = text.match(new RegExp(`${variety}[^.]+(?:\\.[^.]+)?`, "i"));
    if (match) {
      snippets[variety] = summarizeVariety(variety, match[0]);
    }
  }

  return snippets;
};

const summarizeVariety = (variety, snippet) => {
  const lower = snippet.toLowerCase();
  const cues = [];

  if (lower.includes("ovate oblique")) cues.push("ovate-oblique shape");
  if (lower.includes("oblong")) cues.push("oblong shape");
  if (lower.includes("elongated")) cues.push("elongated shape");
  if (lower.includes("pointed")) cues.push("pointed base");
  if (lower.includes("lettuce green")) cues.push("lettuce-green ripe skin");
  if (lower.includes("golden yellow")) cues.push("golden-yellow color");
  if (lower.includes("orange yellow")) cues.push("orange-yellow color");
  if (lower.includes("yellow fruit")) cues.push("yellow fruit color");
  if (lower.includes("red blush")) cues.push("red shoulder blush");
  if (lower.includes("large")) cues.push("large fruit");
  if (lower.includes("medium")) cues.push("medium fruit");
  if (lower.includes("thin")) cues.push("thin skin");

  return {
    variety: variety === "Bangalora" ? "Totapuri/Bangalora" : variety,
    visualTraits: [...new Set(cues)].slice(0, 5)
  };
};

const countRelevantSentences = (text, terms) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) =>
      terms.some((term) => sentence.toLowerCase().includes(term.toLowerCase()))
    )
    .filter((sentence) => sentence.length > 40).length;

const buildStructuredKnowledge = async () => {
  const [varietyText, handlingText] = await Promise.all(GUIDE_FILES.map(extractPdfText));

  return {
    sources: GUIDE_FILES,
    extractionSummary: {
      varietyEntriesFound: Object.keys(extractVarietySummaries(varietyText)).length,
      ripeningHandlingSentencesFound: countRelevantSentences(handlingText, RIPENING_TERMS),
      varietyCharacteristics: extractVarietySummaries(varietyText)
    },
    structuredRules: {
      ripenessRules: [
        "Maturity and ripeness are a spectrum; mature green fruit can ripen properly.",
        "Firmness decreases during ripening while sugars increase.",
        "Internal flesh color develops from pale yellow toward deep golden yellow.",
        "External color changes are variety-dependent; some ripe mangos stay green.",
        "Wrinkles can signal full ripeness, while shriveling, soft collapse, lesions, mold, leakage, or decay indicate defects."
      ],
      varietyIdentificationRules: [
        "Use shape first, then color and skin texture.",
        "Totapuri/Bangalora has an oblong body with a pointed base.",
        "Langra can remain green when ripe.",
        "Dasheri is elongated and yellow-green/yellow.",
        "Banganapalli is large, obliquely oval, and golden yellow.",
        "Kesar is medium oblong and can show shoulder blush.",
        "Alphonso is medium ovate-oblique and orange-yellow.",
        "Himsagar is medium ovate and yellow."
      ],
      handlingInsights: [
        "Natural ripening should show coherent maturity progression and softening.",
        "Uneven ripening or unnatural patchy color can indicate artificial or poor ripening.",
        "Quality warnings include dark lesions, stem-end decay, pitting, brown/gray scalding, damaged fruit, and leakage."
      ]
    }
  };
};

const knowledge = await buildStructuredKnowledge();
console.log(JSON.stringify(knowledge, null, 2));
