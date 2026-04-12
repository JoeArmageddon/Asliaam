import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 8787;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

app.use(
  express.json({
    limit: "10mb"
  })
);

function normalizePayload(payload = {}) {
  const rawConfidence = payload.confidence;
  let confidence = rawConfidence || "High confidence";

  if (typeof rawConfidence === "number" && rawConfidence > 0 && rawConfidence <= 1) {
    confidence = Math.round(rawConfidence * 100);
  }

  if (typeof rawConfidence === "string") {
    const parsed = Number(rawConfidence);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 1) {
      confidence = Math.round(parsed * 100);
    }
  }

  return {
    name: payload.name || "Classic mango",
    ripeness: payload.ripeness || "Perfect",
    ripening_type: payload.ripening_type || "Likely natural",
    confidence,
    dishes: Array.isArray(payload.dishes) ? payload.dishes.slice(0, 3) : []
  };
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

function buildMessages(image) {
  return [
    {
      role: "system",
      content:
        "You are a sharp, camera-ready mango expert. Keep answers brief, confident, and realistic."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "You are a mango expert. Analyze this mango image and respond in JSON: { 'name': '', 'ripeness': '', 'ripening_type': '', 'confidence': '', 'dishes': [] } Keep answers short, confident, and realistic. Identify the mango variety if possible, estimate ripeness as Unripe, Perfect, or Overripe, guess whether it looks naturally or artificially ripened even if uncertain, and suggest 2 to 3 dishes that fit the ripeness. Return JSON only."
        },
        {
          type: "image_url",
          image_url: {
            url: image
          }
        }
      ]
    }
  ];
}

function isRetryableProviderError(status, message) {
  if (!status) {
    return true;
  }

  const normalizedMessage = (message || "").toLowerCase();

  if (status >= 500 || status === 429) {
    return true;
  }

  return (
    normalizedMessage.includes("insufficient_quota") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("billing") ||
    normalizedMessage.includes("quota")
  );
}

async function requestVisionAnalysis({ url, apiKey, model, image, maxTokensField }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: "json_object"
      },
      messages: buildMessages(image),
      [maxTokensField]: 250
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || "Model request failed.");
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return normalizePayload(extractJson(content));
}

async function analyzeWithFallback(image) {
  const providers = [
    {
      name: "openai",
      url: OPENAI_URL,
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      maxTokensField: "max_tokens"
    },
    {
      name: "groq",
      url: GROQ_URL,
      apiKey: process.env.GROQ_API_KEY,
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      maxTokensField: "max_completion_tokens"
    }
  ];

  let lastError = null;

  for (const provider of providers) {
    if (!provider.apiKey) {
      continue;
    }

    try {
      return await requestVisionAnalysis({
        url: provider.url,
        apiKey: provider.apiKey,
        model: provider.model,
        image,
        maxTokensField: provider.maxTokensField
      });
    } catch (error) {
      lastError = error;

      if (provider.name === "openai" && isRetryableProviderError(error.status, error.message)) {
        continue;
      }

      if (provider.name === "groq") {
        break;
      }

      throw error;
    }
  }

  throw lastError || new Error("No inference provider is configured.");
}

app.post("/api/analyze", async (req, res) => {
  const { image } = req.body || {};

  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: "Missing AI API keys. Add OPENAI_API_KEY or GROQ_API_KEY before running the app."
    });
  }

  if (!image) {
    return res.status(400).json({
      error: "Image payload is required."
    });
  }

  try {
    return res.json(await analyzeWithFallback(image));
  } catch (error) {
    return res.status(500).json({
      error:
        error.message ||
        "Unable to analyze the mango right now. Please try another photo."
    });
  }
});

app.use(express.static(distDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Asli Aam server running on http://localhost:${PORT}`);
});
