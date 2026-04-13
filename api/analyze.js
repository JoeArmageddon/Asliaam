import { analyzeMangoImage, buildFallbackAnalysis } from "../lib/analyzeMango.js";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function resolveRequestOrigin(req) {
  if (process.env.OPENROUTER_SITE_URL) {
    return process.env.OPENROUTER_SITE_URL;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";

  return host ? `${protocol}://${host}` : undefined;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENROUTER_API_KEY in the deployment environment."
    });
  }

  try {
    const { image } = await readJsonBody(req);

    if (!image) {
      return res.status(400).json({
        error: "Image payload is required."
      });
    }

    return res.status(200).json(
      await analyzeMangoImage(image, {
        env: process.env,
        appOrigin: resolveRequestOrigin(req),
        appName: "Asli Aam Mango Scanner"
      })
    );
  } catch (error) {
    return res.status(200).json(
      buildFallbackAnalysis(
        error.message || "Unable to analyze the mango right now. Showing a safe fallback."
      )
    );
  }
}
