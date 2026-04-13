# Asli Aam Project Context

Last updated: 2026-04-13

## Repository

- Local path: `C:\Users\takia\Desktop\ALTRD\Asli Aam (openAI and LSG)`
- Git remote: `https://github.com/JoeArmageddon/Asliaam.git`
- Deployment: connected to Vercel
- Branch observed before work: `main` tracking `origin/main`

## Product Goal

Asli Aam is a premium AI mango scanner for Indian mango varieties. It should feel like a polished demo-ready product: image input, intelligent variety matching, ripeness and origin display, recipe generation, smooth motion, and a special Shami approval moment for Uttar Pradesh mangoes.

## Current Task

Upgrade and refactor the app into a production-quality React + Tailwind + Framer Motion application backed by Node/serverless OpenRouter vision analysis using OpenAI's `gpt-4o-mini` model through OpenRouter.

## Required Mango Dataset

- Alphonso: Maharashtra
- Kesar: Gujarat
- Dasheri: Uttar Pradesh
- Langra: Uttar Pradesh
- Banganapalli: Andhra Pradesh
- Totapuri: Karnataka
- Himsagar: West Bengal

Each backend result must map to one of these mangoes and expose the associated state as `state`.

## Implementation Progress

- Added `openai`, `tailwindcss`, and `@tailwindcss/vite`.
- Wired Tailwind into `vite.config.js`.
- Replaced OpenRouter/Groq provider fallback with a single OpenRouter analysis path using model `openai/gpt-4o-mini`.
- Added hardcoded mango knowledge and result normalization in `lib/analyzeMango.js`.
- Updated local Express and Vercel serverless API routes to require `OPENROUTER_API_KEY`.
- Rebuilt the React scanner UI around Tailwind utility styling and Framer Motion transitions.
- Added result origin, reasoning, confidence animation, expandable recipes, voice output, mobile bottom navigation, a dedicated local history screen, and Shami Approved UI for Uttar Pradesh mangoes.
- Added Shami SVG assets at `public/assets/badge_shami.svg` and `public/assets/character_shami.svg`.
- Verified `npm run build` succeeds.
- Started local dev server: Vite at `http://localhost:5173/`, Express API at `http://localhost:8787`.
- Local and Vercel API routes use `OPENROUTER_API_KEY`; add it to `.env` locally and to Vercel environment variables for live OpenRouter analysis.
- Tightened backend variety normalization so responses like `Alphonso mango` still map to the hardcoded `Alphonso` dataset entry.
- Removed the direct `openai` SDK dependency. Backend now calls OpenRouter with `fetch`.
- Restarted the local dev server after the OpenRouter switch. Frontend responds at `http://localhost:5173/`; API responds on `http://localhost:8787` and returns `Image payload is required.` for an empty JSON POST.
- Added `mango_types_india.jpeg` as a backend reference image for visual grounding. `lib/analyzeMango.js` reads it once, caches it as a data URL, and sends it alongside the user's mango image in the same OpenRouter request.
- Replaced the prompt with the full mango quality knowledge system covering unripe, semi-ripe, perfect, over-ripe, spoiled, ripening type, strict geography, confidence, reasoning, dishes, and recipes.
- Added a 2800 ms OpenRouter timeout so slow model responses fall back to the default Alphonso result and keep the scanner demo responsive.
- Final mobile sweep: history is persisted in browser localStorage with old-key migration and quota-safe compact fallback, the old fixed history tray was replaced with a smaller bottom nav, mobile text sizing was tightened, and long labels now wrap instead of clipping.
- Added agricultural guide knowledge from `mango_varities.pdf` and `Mango_Handling_and_Ripening_Protocol_Eng.pdf` without changing the API/UI result contract.
- Added `scripts/extractMangoGuideKnowledge.mjs` and `npm run extract:mango-knowledge` to read both PDFs and emit summarized structured rules only, not full PDF text.
- Added `lib/mangoGuideKnowledge.js` as the compact cached rule set appended to the existing system prompt. The prompt remains lightweight and still sends only the user image plus `mango_types_india.jpeg` reference image.
- Final accuracy pass: backend now verifies the selected mango against trait keywords from the model reasoning, corrects state from the canonical dataset, validates ripeness from visual reasoning cues, repairs reasoning so it includes visual comparison, and uses safe spoiled-fruit dish/recipe fallbacks.
- Shami assets now import from root `/assets` PNG files and render responsively with fade, bounce, slide, and scale motion.
- Added advanced ripeness guide and non-mango flow. Backend can return `{ "is_mango": false }` for clearly non-mango inputs; frontend shows a playful retry screen and does not save non-mango scans to local history.
- Extended ripeness validation with color + texture cues for unripe, semi-ripe, perfect, overripe, and spoiled, while keeping a single OpenRouter API call.

## Deployment Notes

- Vercel should continue to use the Vite build and the `api/analyze.js` serverless function.
- Production now needs `OPENROUTER_API_KEY` in Vercel environment variables.
- `.env` is ignored and should not be committed.
