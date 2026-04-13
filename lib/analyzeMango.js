const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function normalizePayload(payload = {}) {
  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  const rawConfidence = payload.confidence;
  let confidence = rawConfidence || "High confidence";
  const name = rawName || "Likely table mango";

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
    name,
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
            "You are a mango expert. Analyze this mango image and respond in JSON: { 'name': '', 'ripeness': '', 'ripening_type': '', 'confidence': '', 'dishes': [] } Keep answers short, confident, and realistic. Always provide a best-guess mango type in 'name' and never leave it blank. If uncertain, still return your most likely type label such as 'Likely Alphonso-type mango', 'Likely Kesar-type mango', or 'Likely table mango'. Estimate ripeness as Unripe, Perfect, or Overripe, guess whether it looks naturally or artificially ripened even if uncertain, and suggest 2 to 3 dishes that fit the ripeness. Return JSON only."
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

function resolveAppOrigin(env = {}, appOrigin) {
  if (appOrigin) {
    return appOrigin;
  }

  if (env.OPENROUTER_SITE_URL) {
    return env.OPENROUTER_SITE_URL;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  return "http://localhost:8787";
}

async function requestVisionAnalysis({ url, apiKey, model, image, maxTokensField, appOrigin, appName }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(url === OPENROUTER_URL
        ? {
            "HTTP-Referer": appOrigin,
            "X-OpenRouter-Title": appName
          }
        : {})
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

export async function analyzeMangoImage(image, options = {}) {
  const env = options.env || process.env;
  const appOrigin = resolveAppOrigin(env, options.appOrigin);
  const appName = options.appName || env.OPENROUTER_APP_NAME || "Asli Aam Mango Scanner";

  const providers = [
    {
      name: "openrouter",
      url: OPENROUTER_URL,
      apiKey: env.OPENROUTER_API_KEY,
      model: "openai/gpt-4o-mini",
      maxTokensField: "max_tokens"
    },
    {
      name: "groq",
      url: GROQ_URL,
      apiKey: env.GROQ_API_KEY,
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
        maxTokensField: provider.maxTokensField,
        appOrigin,
        appName
      });
    } catch (error) {
      lastError = error;

      if (provider.name === "openrouter" && isRetryableProviderError(error.status, error.message)) {
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
