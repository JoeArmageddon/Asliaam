import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMangoImage } from "../lib/analyzeMango.js";

const app = express();
const PORT = process.env.PORT || 8787;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

app.use(
  express.json({
    limit: "10mb"
  })
);

app.post("/api/analyze", async (req, res) => {
  const { image } = req.body || {};

  if (!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: "Missing AI API keys. Add OPENROUTER_API_KEY or GROQ_API_KEY before running the app."
    });
  }

  if (!image) {
    return res.status(400).json({
      error: "Image payload is required."
    });
  }

  try {
    return res.json(
      await analyzeMangoImage(image, {
        env: process.env,
        appOrigin: process.env.OPENROUTER_SITE_URL || `http://localhost:${PORT}`,
        appName: process.env.OPENROUTER_APP_NAME || "Asli Aam Mango Scanner"
      })
    );
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
