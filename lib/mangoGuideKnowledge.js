export const AGRICULTURAL_GUIDE_KNOWLEDGE = {
  sources: [
    "mango_varities.pdf",
    "Mango_Handling_and_Ripening_Protocol_Eng.pdf"
  ],
  ripenessRules: [
    "Mango maturity and ripeness exist on a spectrum from immature to mature/unripe to ripe/ready-to-eat.",
    "A mature green mango can be harvest-mature even when skin remains green, so green skin alone should not mean unripe.",
    "During ripening, firmness decreases while sugars increase and flesh color develops from pale yellow toward deep golden yellow.",
    "External skin color changes in some varieties, but not all varieties show strong skin-color change during ripening.",
    "Small wrinkles can appear at full ripeness; heavy wrinkling, soft collapse, shriveling, leakage, or damaged tissue indicates over-ripeness or spoilage."
  ],
  varietyRules: [
    "Alphonso: medium ovate-oblique fruit, orange-yellow color, smooth skin, strong keeping quality.",
    "Kesar: medium oblong fruit, often yellow-orange with red blush on shoulders.",
    "Dasheri: small to medium elongated fruit, yellow fruit color, fiberless flesh.",
    "Langra: medium ovate fruit, lettuce-green skin when ripe, thin skin, very sweet pulp.",
    "Banganapalli: large obliquely oval fruit, golden-yellow color, good keeping quality.",
    "Totapuri: medium-large oblong fruit with a pointed base or beak-like tip, golden-yellow color.",
    "Himsagar: medium ovate fruit, yellow color, smooth table-purpose profile."
  ],
  handlingInsights: [
    "Shape and structural traits are often more reliable than skin color for variety identification.",
    "Maturity should be judged with multiple cues such as flesh color, firmness, soluble solids, dry matter, and shoulder shape.",
    "Natural ripening usually shows coherent maturation and progressive softening rather than abrupt patchy color.",
    "Uneven ripening, poor color development, gray or black lesions, brown scalding, surface pitting, mold, leakage, or stem-end decay are quality warnings.",
    "Artificial or forced ripening can look visually uneven or unnaturally distributed, so flag patchy color patterns when visible."
  ]
};

export const AGRICULTURAL_GUIDE_PROMPT_APPENDIX = `Additional knowledge derived from agricultural mango guides:

- Mango ripening follows internal maturity and external color changes
- Slight green patches can still indicate ripeness
- Shape is often more reliable than color for variety identification
- Over-ripeness includes wrinkling and soft collapse
- Spoilage includes dark patches, mold, and leakage
- Artificial ripening often results in uneven or unnatural coloring

Structured guide rules:
- Ripeness: ${AGRICULTURAL_GUIDE_KNOWLEDGE.ripenessRules.join(" ")}
- Variety identification: ${AGRICULTURAL_GUIDE_KNOWLEDGE.varietyRules.join(" ")}
- Handling insights: ${AGRICULTURAL_GUIDE_KNOWLEDGE.handlingInsights.join(" ")}

Use these principles along with the existing mango classification system.`;
