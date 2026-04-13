import { mangoRecipes } from "../mangoRecipes.js";

const TOP_RECIPE_LIMIT = 3;
const RIPENESS_ALIASES = {
  "semi-ripe": "semi_ripe",
  semiripe: "semi_ripe",
  "over-ripe": "overripe"
};

const CATEGORY_LABELS = {
  drink: "Drink",
  dessert: "Dessert",
  savory: "Savory"
};

const SAFE_SPOILED_RECIPES = [
  {
    name: "Fresh Mango Replacement",
    type: "savory",
    suitableFor: ["spoiled"],
    varieties: [],
    steps: [
      "Do not cook with mango that has mold, leakage, or collapsed flesh.",
      "Discard the damaged fruit safely and clean the storage surface.",
      "Pick a fresh mango with intact skin and no dark wet patches.",
      "Scan again before preparing a recipe."
    ]
  },
  {
    name: "Safe Mango Check",
    type: "savory",
    suitableFor: ["spoiled"],
    varieties: [],
    steps: [
      "Separate spoiled mangoes from nearby fruit.",
      "Wash your hands and any surface that touched the fruit.",
      "Choose a replacement mango with firm skin and clean aroma.",
      "Use the replacement only if the scan marks it safe."
    ]
  }
];

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeRipeness = (ripeness) => {
  const loose = String(ripeness || "").trim().toLowerCase();
  return RIPENESS_ALIASES[loose] || normalizeKey(ripeness || "perfect");
};

const inferCategory = (recipe) => {
  const name = normalizeText(recipe.name);
  const declaredType = normalizeKey(recipe.type);

  if (
    name.includes("shake") ||
    name.includes("lassi") ||
    name.includes("smoothie") ||
    name.includes("juice") ||
    name.includes("panha") ||
    name.includes("cooler") ||
    name.includes("mojito") ||
    name.includes("soda") ||
    name.includes("tea") ||
    name.includes("mocktail") ||
    name.includes("punch") ||
    name.includes("spritzer")
  ) {
    return "Drink";
  }

  return CATEGORY_LABELS[declaredType] || "Dessert";
};

const normalizeRecipe = (recipe) => ({
  name: String(recipe.name || "Mango Recipe").trim(),
  type: inferCategory(recipe),
  suitableFor: Array.isArray(recipe.suitableFor) ? recipe.suitableFor : [],
  varieties: Array.isArray(recipe.varieties) ? recipe.varieties : [],
  steps: Array.isArray(recipe.steps)
    ? recipe.steps.map((step) => String(step || "").trim()).filter(Boolean).slice(0, 5)
    : []
});

const getRipenessTargets = (ripenessKey) => {
  if (ripenessKey === "semi_ripe") {
    return ["semi_ripe", "unripe", "perfect"];
  }

  return [ripenessKey];
};

const scoreRecipe = (recipe, ripenessKey, variety) => {
  const recipeRipeness = new Set((recipe.suitableFor || []).map(normalizeRipeness));
  const targets = getRipenessTargets(ripenessKey);
  const exactRipeness = recipeRipeness.has(ripenessKey);
  const nearbyRipeness = targets.some((target) => recipeRipeness.has(target));
  const varietyMatch = (recipe.varieties || []).some(
    (item) => normalizeText(item) === normalizeText(variety)
  );

  if (!nearbyRipeness) {
    return -1;
  }

  return (exactRipeness ? 100 : 70) + (varietyMatch ? 24 : 0);
};

export const selectMangoRecipes = ({ ripeness, variety, limit = TOP_RECIPE_LIMIT } = {}) => {
  const ripenessKey = normalizeRipeness(ripeness);
  const sourceRecipes = ripenessKey === "spoiled" ? SAFE_SPOILED_RECIPES : mangoRecipes;
  const scoredRecipes = sourceRecipes
    .map((recipe, index) => ({
      recipe,
      index,
      score: scoreRecipe(recipe, ripenessKey, variety)
    }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ recipe }) => normalizeRecipe(recipe))
    .filter((recipe) => recipe.name && recipe.steps.length);

  const fallbackRecipes = mangoRecipes
    .map((recipe, index) => ({ recipe, index, score: scoreRecipe(recipe, "perfect", variety) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ recipe }) => normalizeRecipe(recipe));

  const allRecipes = scoredRecipes.length ? scoredRecipes : fallbackRecipes;

  return {
    topRecipes: allRecipes.slice(0, limit),
    allRecipes
  };
};

export const recipeDishesFromSelection = (recipes = []) =>
  recipes.map((recipe) => recipe.name).filter(Boolean).slice(0, 4);
