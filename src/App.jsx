import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import logoImage from "./assets/asli-aam-logo.jpg";
import { readShamiMode, resolveSecretTap, writeShamiMode } from "./shamiMode.js";

const STORAGE_KEY = "asli-aam-scan-history-v2";
const LEGACY_STORAGE_KEY = "asli-aam-scan-history";
const HISTORY_LIMIT = 8;
const SHAMI_BADGE_IMAGE = "/assets/badge_shami.svg";
const SHAMI_CHARACTER_IMAGE = "/assets/character_shami.svg";

const FALLBACK_RESULT = {
  is_mango: true,
  name: "Alphonso",
  state: "Maharashtra",
  ripeness: "Perfect",
  ripening_type: "Natural",
  confidence: 88,
  reasoning: "Golden skin, smooth peel, and oval shoulders match the closest trained profile.",
  dishes: ["Aamras", "Mango shrikhand", "Mango lassi"],
  recipes: [
    {
      name: "Aamras",
      type: "Dessert",
      steps: [
        "Peel and cube the ripe mango.",
        "Blend with chilled milk or water until silky.",
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
  all_recipes: [
    {
      name: "Aamras",
      type: "Dessert",
      steps: [
        "Peel and cube the ripe mango.",
        "Blend with chilled milk or water until silky.",
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
  failureReason: "Live analysis was unavailable, so a safe fallback result was used."
};

const EMPTY_RESULT = {
  is_mango: true,
  name: "",
  state: "",
  ripeness: "",
  ripening_type: "",
  confidence: 0,
  reasoning: "",
  dishes: [],
  recipes: [],
  all_recipes: [],
  source: "live",
  failureReason: ""
};

const VARIETIES = [
  ["Alphonso", "Maharashtra", "Golden oval, satin peel"],
  ["Kesar", "Gujarat", "Orange-yellow, rounded shoulders"],
  ["Dasheri", "Uttar Pradesh", "Long, slim, green-yellow"],
  ["Langra", "Uttar Pradesh", "Green ripe skin, matte peel"],
  ["Banganapalli", "Andhra Pradesh", "Large oblong, pale gold"],
  ["Totapuri", "Karnataka", "Parrot-beak tip, angular"],
  ["Himsagar", "West Bengal", "Round, deep yellow, soft peel"]
];

const SCAN_STEPS = [
  "Reading peel color and gloss",
  "Matching silhouette to Indian varieties",
  "Checking natural ripening cues",
  "Building recipe suggestions"
];

const pageTransition = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -14, transition: { duration: 0.25, ease: "easeInOut" } }
};

const rise = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } }
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } }
};

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });

const clampConfidence = (value) => {
  if (typeof value === "number") {
    return Math.max(1, Math.min(100, Math.round(value)));
  }

  const match = String(value || "").match(/\d+/);
  return match ? Math.max(1, Math.min(100, Number(match[0]))) : 88;
};

const normalizeList = (value, fallback) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value.map((item) => String(item || "").trim()).filter(Boolean);
  return items.length ? items : fallback;
};

const normalizeRecipes = (value, fallbackRecipes, limit = 3) => {
  if (!Array.isArray(value)) {
    return fallbackRecipes;
  }

  const recipes = value
    .map((recipe, index) => {
      const fallback = fallbackRecipes[index] || fallbackRecipes[0];
      const name = String(recipe?.name || fallback.name).trim();
      const type = String(recipe?.type || fallback.type || "Dessert").trim();
      const steps = normalizeList(recipe?.steps, fallback.steps).slice(0, 5);
      return { name, type, steps: steps.length >= 3 ? steps : fallback.steps };
    })
    .filter((recipe) => recipe.name && recipe.steps.length)
    .slice(0, limit);

  return recipes.length ? recipes : fallbackRecipes;
};

const normalizeAllRecipes = (payloadRecipes, topRecipes) => {
  const allRecipes = normalizeRecipes(payloadRecipes, topRecipes, Number.POSITIVE_INFINITY);
  const topNames = new Set(topRecipes.map((recipe) => recipe.name));
  const missingTopRecipes = topRecipes.filter((recipe) => !allRecipes.some((item) => item.name === recipe.name));

  return [...missingTopRecipes, ...allRecipes].sort((a, b) => {
    const aTop = topNames.has(a.name) ? 0 : 1;
    const bTop = topNames.has(b.name) ? 0 : 1;
    return aTop - bTop;
  });
};

const normalizeResult = (payload = {}) => {
  const recipes = normalizeRecipes(payload.recipes, FALLBACK_RESULT.recipes);

  return {
    is_mango: payload.is_mango !== false,
    name: String(payload.name || FALLBACK_RESULT.name).trim(),
    state: String(payload.state || FALLBACK_RESULT.state).trim(),
    ripeness: String(payload.ripeness || FALLBACK_RESULT.ripeness).trim(),
    ripening_type: String(payload.ripening_type || FALLBACK_RESULT.ripening_type).trim(),
    confidence: clampConfidence(payload.confidence),
    reasoning: String(payload.reasoning || FALLBACK_RESULT.reasoning).trim(),
    dishes: normalizeList(payload.dishes, recipes.map((recipe) => recipe.name)).slice(0, 4),
    recipes,
    all_recipes: normalizeAllRecipes(payload.all_recipes, recipes),
    source: payload.source || "live",
    failureReason: payload.failureReason || ""
  };
};

const buildFallbackResult = (message) =>
  normalizeResult({
    ...FALLBACK_RESULT,
    failureReason: message || FALLBACK_RESULT.failureReason
  });

const readStoredHistory = () => {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        id: item.id || Date.now(),
        createdAt: item.createdAt || new Date().toISOString(),
        image: item.image || "",
        ...normalizeResult(item)
      }))
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
};

const writeStoredHistory = (items) => {
  const trimmed = items.slice(0, HISTORY_LIMIT);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    const compact = trimmed.map(({ image, ...item }) => item);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
};

const stopMediaStream = (stream) => {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
};

function Icon({ name, filled = false, className = "" }) {
  return (
    <span className={`material-symbols-outlined ${filled ? "filled" : ""} ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function MotionButton({ children, className = "", ...props }) {
  return (
    <m.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </m.button>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <strong className="mt-2 block break-words font-display text-lg leading-tight md:text-xl">{value}</strong>
    </div>
  );
}

function RecipeAccordion({ recipe, isOpen, onToggle }) {
  const category = recipe.type || "Dessert";

  return (
    <m.article
      className="overflow-hidden rounded-2xl border border-black/10 bg-[#f6f8ef]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-4 text-left font-black"
      >
        <span className="min-w-0">
          <span className="block break-words">{recipe.name}</span>
          <span className="mt-2 inline-flex rounded-lg bg-zinc-950 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#f2c94c]">
            {category}
          </span>
        </span>
        <Icon name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <ol className="grid gap-3 px-4 pb-4">
              {recipe.steps.map((step, index) => (
                <li key={`${recipe.name}-${step}`} className="flex gap-3 rounded-xl bg-white/75 p-3 text-sm leading-6 text-zinc-700">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-950 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </m.div>
        )}
      </AnimatePresence>
    </m.article>
  );
}

function ShamiBadge() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 block sm:right-4 sm:top-4">
      <m.img
        src={SHAMI_BADGE_IMAGE}
        alt="Shami Approved badge"
        className="h-16 w-16 rounded-full object-contain drop-shadow-xl sm:h-24 sm:w-24"
        initial={{ opacity: 0, scale: 0.82, y: -16 }}
        animate={{ opacity: 1, scale: [0.82, 1.1, 1], y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <m.img
        src={SHAMI_CHARACTER_IMAGE}
        alt="Shami character"
        className="absolute -right-2 top-11 h-16 w-16 object-contain drop-shadow-xl sm:-right-3 sm:top-16 sm:h-28 sm:w-28"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0, scale: [0.96, 1.04, 1] }}
        transition={{ delay: 0.12, duration: 0.38, ease: "easeOut" }}
      />
      <m.div
        className="absolute right-14 top-14 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-3 py-2 text-sm font-black text-white sm:right-20 sm:top-20 sm:block"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3 }}
      >
        <span className="inline-flex items-center gap-1">
          Shami Approved
          <span aria-hidden="true">✅</span>
          <Icon name="check_circle" filled className="text-[#f2c94c]" />
        </span>
      </m.div>
    </div>
  );
}

function NavButton({ active, featured = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[0.68rem] font-black uppercase tracking-[0.08em] transition-colors ${
        active
          ? featured
            ? "bg-[#f2c94c] text-zinc-950"
            : "bg-white text-zinc-950"
          : "text-white/64"
      }`}
    >
      <Icon name={icon} filled={active || featured} className={featured && !active ? "text-[#f2c94c]" : ""} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function App() {
  const uploadInputId = `${useId()}-upload`;
  const uploadInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const historyLoadedRef = useRef(false);
  const secretTapTimesRef = useRef([]);
  const shamiToastTimeoutRef = useRef(null);

  const [screen, setScreen] = useState("home");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [analysis, setAnalysis] = useState(EMPTY_RESULT);
  const [history, setHistory] = useState([]);
  const [shamiMode, setShamiMode] = useState(false);
  const [shamiToast, setShamiToast] = useState("");
  const [error, setError] = useState("");
  const [cameraStatus, setCameraStatus] = useState("idle");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [openRecipe, setOpenRecipe] = useState("");
  const [showAllRecipes, setShowAllRecipes] = useState(false);

  useEffect(() => {
    setHistory(readStoredHistory());
    setShamiMode(readShamiMode(window.localStorage));
    historyLoadedRef.current = true;

    return () => {
      if (shamiToastTimeoutRef.current) {
        window.clearTimeout(shamiToastTimeoutRef.current);
      }
    };
  }, []);

  const showShamiModeToast = useCallback((enabled) => {
    if (shamiToastTimeoutRef.current) {
      window.clearTimeout(shamiToastTimeoutRef.current);
    }

    setShamiToast(enabled ? "Shami Mode Activated" : "Shami Mode Disabled");
    shamiToastTimeoutRef.current = window.setTimeout(() => {
      setShamiToast("");
    }, 1500);
  }, []);

  const toggleShamiMode = useCallback(() => {
    setShamiMode((current) => {
      const next = !current;
      writeShamiMode(window.localStorage, next);
      showShamiModeToast(next);
      return next;
    });
  }, [showShamiModeToast]);

  useEffect(() => {
    const handleSecretCornerTap = (event) => {
      const isBottomRightCorner =
        event.clientX >= window.innerWidth - 72 && event.clientY >= window.innerHeight - 72;

      if (!isBottomRightCorner) {
        return;
      }

      const secretTap = resolveSecretTap(secretTapTimesRef.current, Date.now());
      secretTapTimesRef.current = secretTap.tapTimes;

      if (secretTap.shouldToggle) {
        toggleShamiMode();
      }
    };

    window.addEventListener("pointerup", handleSecretCornerTap, { passive: true });

    return () => {
      window.removeEventListener("pointerup", handleSecretCornerTap);
    };
  }, [toggleShamiMode]);

  useEffect(() => {
    if (!historyLoadedRef.current) {
      return;
    }

    writeStoredHistory(history);
  }, [history]);

  useEffect(() => {
    if (screen !== "scanning") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setScanStepIndex((current) => (current + 1) % SCAN_STEPS.length);
    }, 760);

    return () => window.clearInterval(intervalId);
  }, [screen]);

  useEffect(() => {
    if (screen !== "scan") {
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      setCameraStatus("idle");
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return undefined;
    }

    if (selectedImage) {
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      return undefined;
    }

    let cancelled = false;

    const openCamera = async () => {
      setCameraStatus("requesting");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setCameraStatus("ready");
      } catch {
        setCameraStatus("blocked");
      }
    };

    openCamera();

    return () => {
      cancelled = true;
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [screen, selectedImage, cameraAttempt]);

  const recentVariety = useMemo(() => history[0]?.name || "No scans yet", [history]);
  const scanStep = SCAN_STEPS[scanStepIndex];
  const showShamiApproval = analysis.state === "Uttar Pradesh" && shamiMode;
  const showFallbackNote = analysis.source === "fallback" && analysis.failureReason;

  const goToScan = () => {
    setError("");
    setScreen("scan");
  };

  const resetScanner = () => {
    setSelectedFile(null);
    setSelectedImage("");
    setAnalysis(EMPTY_RESULT);
    setError("");
    setOpenRecipe("");
    setShowAllRecipes(false);
    setScreen("scan");
    setCameraAttempt((current) => current + 1);
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      setSelectedFile(file);
      setSelectedImage(dataUrl);
      setAnalysis(EMPTY_RESULT);
      setError("");
      setShowAllRecipes(false);
      setScreen("scan");
    } catch (readError) {
      setError(readError.message);
      setScreen("error");
    } finally {
      event.target.value = "";
    }
  };

  const captureFromCamera = async () => {
    if (cameraStatus === "blocked" || cameraStatus === "unsupported") {
      setError(
        cameraStatus === "blocked"
          ? "Camera permission is blocked. Allow camera access or upload a photo."
          : "This browser cannot open an in-app camera preview. Upload a photo instead."
      );
      return;
    }

    if (cameraStatus !== "ready" || !videoRef.current || !canvasRef.current) {
      setError("Camera is still warming up. You can upload a gallery photo right away.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1440;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to capture this frame. Try uploading a photo.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));

    if (!blob) {
      setError("Unable to save this frame. Try uploading a photo.");
      return;
    }

    setSelectedFile(new File([blob], `asli-aam-${Date.now()}.jpg`, { type: "image/jpeg" }));
    setSelectedImage(dataUrl);
    setError("");
    setShowAllRecipes(false);
  };

  const saveResult = (nextResult) => {
    setHistory((current) => [
      {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        image: selectedImage,
        ...nextResult
      },
      ...current
    ].slice(0, HISTORY_LIMIT));
  };

  const speakResult = (result = analysis, force = true) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    if (!force && result.source === "fallback") {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${result.ripeness} ${result.name} mango detected from ${result.state}.`
    );
    utterance.rate = 1;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  };

  const analyzeImage = async () => {
    if (!selectedFile) {
      setError("Choose or capture a mango photo first.");
      setScreen("error");
      return;
    }

    setScanStepIndex(0);
    setOpenRecipe("");
    setShowAllRecipes(false);
    setError("");
    setScreen("scanning");

    try {
      const image = await toDataUrl(selectedFile);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      if (payload?.is_mango === false) {
        setAnalysis({ ...EMPTY_RESULT, is_mango: false });
        setScreen("not-mango");
        return;
      }

      const nextResult = normalizeResult(payload);
      setAnalysis(nextResult);
      saveResult(nextResult);
      setScreen("result");
      speakResult(nextResult, false);
    } catch (requestError) {
      const nextResult = buildFallbackResult(requestError.message || "Live analysis was unavailable.");
      setAnalysis(nextResult);
      saveResult(nextResult);
      setScreen("result");
    }
  };

  const openHistoryItem = (item) => {
    setSelectedImage(item.image || "");
    setSelectedFile(null);
    setAnalysis(normalizeResult(item));
    setOpenRecipe("");
    setShowAllRecipes(false);
    setScreen("result");
  };

  const clearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  };

  const hiddenUpload = (
    <>
      <input
        id={uploadInputId}
        ref={uploadInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={handleFileSelection}
      />
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true" />
    </>
  );

  const renderHome = () => (
    <m.section className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-6xl content-center gap-5 px-4 py-5 md:gap-8 md:px-8 md:py-8" {...pageTransition}>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <m.div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_30px_80px_rgba(16,24,20,0.12)] backdrop-blur md:p-10" variants={stagger} initial="hidden" animate="visible">
          <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#f2c94c,#11998e,#ef476f)]" />
          <m.p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-emerald-700" variants={rise}>Indian mango intelligence</m.p>
          <m.h1 className="max-w-3xl break-words font-display text-[2.7rem] font-black leading-[0.92] text-zinc-950 md:text-7xl" variants={rise}>Scan the aam. Know the story.</m.h1>
          <m.p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700" variants={rise}>
            Identify variety, origin, ripeness, ripening style, and recipes from a single mango photo.
          </m.p>
          <m.div className="mt-8 flex flex-col gap-3 sm:flex-row" variants={rise}>
            <MotionButton type="button" onClick={goToScan} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-zinc-950 px-6 font-black text-white shadow-[0_14px_0_#f2c94c]">
              <Icon name="center_focus_strong" filled /> Scan Now
            </MotionButton>
            <MotionButton type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-zinc-950 bg-[#f2c94c] px-6 font-black text-zinc-950">
              <Icon name="upload" /> Upload Photo
            </MotionButton>
          </m.div>
        </m.div>
        <m.div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-5 text-white shadow-[0_30px_80px_rgba(16,24,20,0.18)]" initial={{ opacity: 0, scale: 0.96, rotate: -1 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
          <m.img src={logoImage} alt="Asli Aam logo" className="aspect-square w-full rounded-2xl object-cover" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/10 p-4"><p className="text-xs uppercase tracking-[0.18em] text-white/60">Saved</p><strong className="mt-2 block text-3xl">{history.length}</strong></div>
            <div className="rounded-lg bg-white/10 p-4"><p className="text-xs uppercase tracking-[0.18em] text-white/60">Latest</p><strong className="mt-2 block truncate text-lg">{recentVariety}</strong></div>
          </div>
        </m.div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {VARIETIES.map(([name, state, traits], index) => (
          <m.article key={name} className="rounded-lg border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.3 }} whileHover={{ scale: 1.02 }}>
            <strong className="block font-display text-base">{name}</strong>
            <span className="mt-1 block text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{state}</span>
            <p className="mt-3 text-sm leading-5 text-zinc-600">{traits}</p>
          </m.article>
        ))}
      </div>
      {hiddenUpload}
    </m.section>
  );

  const renderScan = () => {
    const hasLiveCamera = !selectedImage && cameraStatus === "ready";
    const previewStyle = selectedImage ? { backgroundImage: `url(${selectedImage})` } : undefined;

    return (
      <m.section className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-6xl gap-4 px-4 py-5 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-5 md:px-8 md:py-6" {...pageTransition}>
        <div className="relative min-h-[52dvh] overflow-hidden rounded-[2rem] bg-zinc-950 shadow-[0_34px_100px_rgba(16,24,20,0.22)] md:min-h-[58dvh]">
          <div className="absolute inset-0 bg-cover bg-center" style={previewStyle}>
            {!selectedImage && (
              <video ref={videoRef} className={`h-full w-full object-cover ${hasLiveCamera ? "opacity-100" : "opacity-0"}`} autoPlay playsInline muted />
            )}
          </div>
          {!selectedImage && !hasLiveCamera && (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,#f2c94c,#11998e_46%,#101814)] p-6 text-center text-white">
              <div className="max-w-sm rounded-2xl bg-black/30 p-5 backdrop-blur">
                <img src={logoImage} alt="Asli Aam logo" className="mx-auto h-28 w-28 rounded-2xl object-cover" />
                <strong className="mt-4 block text-xl">
                  {cameraStatus === "requesting" ? "Opening camera" : cameraStatus === "blocked" ? "Camera blocked" : cameraStatus === "unsupported" ? "Camera unavailable" : "Ready for a mango"}
                </strong>
                <p className="mt-2 text-sm leading-6 text-white/75">Use camera on HTTPS or upload a photo from the gallery.</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
          <div className="absolute inset-x-8 bottom-24 top-8 rounded-[1.6rem] border-2 border-dashed border-[#f2c94c] shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
          <div className="absolute bottom-8 left-1/2 w-[calc(100%-3rem)] -translate-x-1/2 rounded-lg bg-white/90 px-4 py-3 text-center font-black text-zinc-950 backdrop-blur">
            {selectedImage ? "Preview locked. Run the AI scan." : "Center one mango inside the frame."}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-[0_30px_80px_rgba(16,24,20,0.12)] backdrop-blur md:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Scan input</p>
              <h2 className="mt-2 font-display text-3xl font-black leading-none text-zinc-950 md:text-4xl">Camera or upload</h2>
            </div>
            <MotionButton type="button" onClick={() => setScreen("home")} className="grid h-12 w-12 place-items-center rounded-lg bg-zinc-100 text-zinc-950" aria-label="Back home">
              <Icon name="close" />
            </MotionButton>
          </div>
          <div className="mt-6 grid gap-3">
            <MotionButton type="button" onClick={selectedImage ? analyzeImage : captureFromCamera} className="inline-flex min-h-16 items-center justify-center gap-3 rounded-lg bg-zinc-950 px-6 font-black text-white shadow-[0_12px_0_#11998e]">
              <Icon name={selectedImage ? "auto_awesome" : "photo_camera"} filled /> {selectedImage ? "Analyze Mango" : "Capture Frame"}
            </MotionButton>
            <MotionButton type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-zinc-950 bg-[#f2c94c] px-6 font-black text-zinc-950">
              <Icon name="image" /> Upload Gallery Photo
            </MotionButton>
            <MotionButton type="button" onClick={resetScanner} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-zinc-100 px-6 font-black text-zinc-950">
              <Icon name="refresh" /> Reset Scanner
            </MotionButton>
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            The image is sent to the protected backend route. API keys never reach the browser.
          </div>
        </div>
        {hiddenUpload}
      </m.section>
    );
  };

  const renderScanning = () => (
    <m.section className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-zinc-950 px-5 py-8 text-white" {...pageTransition}>
      <div className="absolute inset-0 bg-cover bg-center opacity-45" style={selectedImage ? { backgroundImage: `url(${selectedImage})` } : undefined} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f2c94c55,transparent_34%),linear-gradient(180deg,rgba(16,24,20,0.25),#101814)]" />
      <div className="relative grid w-full max-w-xl justify-items-center gap-6 text-center">
        <m.div className="relative aspect-[0.82] w-72 overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.36)]" animate={{ scale: [1, 1.025, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} style={selectedImage ? { backgroundImage: `url(${selectedImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <m.div className="absolute left-4 right-4 h-1 rounded-full bg-[#f2c94c] shadow-[0_0_30px_#f2c94c]" animate={{ y: [20, 330, 20] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        </m.div>
        <AnimatePresence mode="wait">
          <m.div key={scanStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2c94c]">AI vision scan</p>
            <h2 className="mt-3 font-display text-4xl font-black">{scanStep}</h2>
          </m.div>
        </AnimatePresence>
      </div>
    </m.section>
  );

  const renderResult = () => {
    const visibleRecipes = showAllRecipes ? analysis.all_recipes : analysis.recipes;
    const hasMoreRecipes = analysis.all_recipes.length > analysis.recipes.length;

    return (
    <m.section className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-6xl gap-5 px-4 py-5 md:px-8 md:py-6" {...pageTransition}>
      <div className="flex items-center justify-between gap-4">
        <MotionButton type="button" onClick={() => setScreen("home")} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-4 font-black text-zinc-950 shadow-sm">
          <Icon name="arrow_back" /> Home
        </MotionButton>
        <MotionButton type="button" onClick={resetScanner} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-zinc-950 px-4 font-black text-white">
          <Icon name="center_focus_strong" filled /> Scan Again
        </MotionButton>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <m.div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-4 shadow-[0_34px_100px_rgba(16,24,20,0.18)]" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <img src={selectedImage || logoImage} alt={`${analysis.name || "Mango"} scan`} className="aspect-[0.86] w-full rounded-2xl object-cover" />
          <div className="absolute left-7 top-7 rounded-lg bg-white/90 px-4 py-2 text-sm font-black text-zinc-950 backdrop-blur">
            {analysis.source === "fallback" ? "Fallback read" : "AI vision read"}
          </div>
          {analysis.source !== "fallback" && (
            <m.div className="pointer-events-none absolute inset-x-8 top-10 h-1 rounded-full bg-[#f2c94c] shadow-[0_0_24px_#f2c94c]" initial={{ y: 0, opacity: 0 }} animate={{ y: [0, 420], opacity: [0, 1, 0] }} transition={{ duration: 1.5, ease: "easeInOut" }} />
          )}
        </m.div>

        <m.div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 p-5 shadow-[0_34px_100px_rgba(16,24,20,0.14)] backdrop-blur md:p-7" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}>
          {showShamiApproval && <ShamiBadge />}
          <m.div variants={stagger} initial="hidden" animate="visible">
            <m.p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700" variants={rise}>Identification result</m.p>
            <m.h1 className="mt-3 break-words font-display text-4xl font-black leading-none text-zinc-950 md:text-6xl" variants={rise}>{analysis.name}</m.h1>
            <m.p className="mt-4 text-lg font-bold text-zinc-700" variants={rise}>Origin: <span className="text-zinc-950">{analysis.state}</span></m.p>
            {showShamiApproval && (
              <m.div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-black text-white sm:hidden" variants={rise}>
                Shami Approved
                <span aria-hidden="true">✅</span>
                <Icon name="check_circle" filled className="text-[#f2c94c]" />
              </m.div>
            )}
            <m.div className="mt-6 grid gap-3 sm:grid-cols-3" variants={rise}>
              <InfoTile label="Ripeness" value={analysis.ripeness} />
              <InfoTile label="Ripening" value={analysis.ripening_type} />
              <InfoTile label="Confidence" value={`${analysis.confidence}%`} />
            </m.div>
            <m.div className="mt-6" variants={rise}>
              <div className="mb-2 flex items-center justify-between text-sm font-black"><span>Confidence bar</span><span>{analysis.confidence}%</span></div>
              <div className="h-4 overflow-hidden rounded-full bg-zinc-100">
                <m.div className="h-full rounded-full bg-[linear-gradient(90deg,#11998e,#f2c94c,#ef476f)]" initial={{ width: 0 }} animate={{ width: `${analysis.confidence}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
              </div>
            </m.div>
            <m.div className="mt-6 rounded-2xl bg-[#f6f8ef] p-4" variants={rise}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Visual reasoning</p>
              <p className="mt-2 leading-7 text-zinc-700">{analysis.reasoning}</p>
            </m.div>
            {showFallbackNote && <m.p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800" variants={rise}>{analysis.failureReason}</m.p>}
          </m.div>
        </m.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[2rem] bg-zinc-950 p-5 text-white md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f2c94c]">Dish ideas</p>
          <div className="mt-5 grid gap-3">
            {analysis.dishes.map((dish, index) => (
              <m.button key={dish} type="button" onClick={() => setOpenRecipe(analysis.recipes[index % analysis.recipes.length]?.name || "")} className="rounded-lg bg-white/10 p-4 text-left font-black transition-colors hover:bg-white/15" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                {dish}
              </m.button>
            ))}
          </div>
        </section>
        <section className="rounded-[2rem] border border-black/10 bg-white/90 p-5 shadow-[0_28px_80px_rgba(16,24,20,0.1)] md:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Full recipes</p>
              <h2 className="mt-2 font-display text-2xl font-black text-zinc-950">
                {showAllRecipes ? "Recipe library" : "Top matches"}
              </h2>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
              Local dataset
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            <AnimatePresence initial={false}>
            {visibleRecipes.map((recipe, index) => (
              <RecipeAccordion key={recipe.name} recipe={recipe} isOpen={openRecipe ? openRecipe === recipe.name : index === 0} onToggle={() => setOpenRecipe((current) => (current === recipe.name ? "" : recipe.name))} />
            ))}
            </AnimatePresence>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {hasMoreRecipes && (
              <MotionButton
                type="button"
                onClick={() => {
                  setShowAllRecipes((current) => !current);
                  setOpenRecipe("");
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 font-black text-white"
              >
                <Icon name={showAllRecipes ? "unfold_less" : "restaurant_menu"} />
                {showAllRecipes ? "Show Top Recipes" : "Explore More Recipes"}
              </MotionButton>
            )}
            <MotionButton type="button" onClick={() => speakResult(analysis)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f2c94c] px-4 font-black text-zinc-950">
              <Icon name="volume_up" /> Read Result Aloud
            </MotionButton>
          </div>
        </section>
      </div>
    </m.section>
    );
  };

  const renderError = () => (
    <m.section className="grid min-h-[100dvh] place-items-center px-5 py-8" {...pageTransition}>
      <div className="max-w-lg rounded-[2rem] border border-black/10 bg-white/90 p-7 text-center shadow-[0_34px_100px_rgba(16,24,20,0.14)]">
        <img src={logoImage} alt="Asli Aam logo" className="mx-auto h-32 w-32 rounded-2xl object-cover" />
        <h1 className="mt-6 font-display text-4xl font-black text-zinc-950">Try another shot</h1>
        <p className="mt-3 leading-7 text-zinc-700">{error || "The scanner needs a brighter, steadier mango photo."}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MotionButton type="button" onClick={resetScanner} className="min-h-13 rounded-lg bg-zinc-950 px-5 font-black text-white">Retry</MotionButton>
          <MotionButton type="button" onClick={() => uploadInputRef.current?.click()} className="min-h-13 rounded-lg bg-[#f2c94c] px-5 font-black text-zinc-950">Upload</MotionButton>
        </div>
      </div>
      {hiddenUpload}
    </m.section>
  );

  const renderNotMango = () => (
    <m.section className="grid min-h-[calc(100dvh-7rem)] place-items-center px-4 py-6" {...pageTransition}>
      <m.div
        className="relative max-w-lg overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 p-7 text-center shadow-[0_34px_100px_rgba(16,24,20,0.14)] backdrop-blur"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#ef476f,#f2c94c,#11998e)]" />
        <m.div
          className="mx-auto grid h-24 w-24 place-items-center rounded-[1.5rem] bg-[#f2c94c] text-zinc-950 shadow-[0_12px_0_#101814]"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="cancel" filled className="text-5xl" />
        </m.div>
        <h1 className="mt-7 font-display text-4xl font-black leading-none text-zinc-950">
          Uh oh... that's not a mango
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg leading-8 text-zinc-700">
          Try scanning a real mango!
        </p>
        <MotionButton
          type="button"
          onClick={resetScanner}
          className="mt-7 inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-zinc-950 px-6 font-black text-white shadow-[0_12px_0_#f2c94c]"
        >
          <Icon name="center_focus_strong" filled />
          Scan Again
        </MotionButton>
      </m.div>
      {hiddenUpload}
    </m.section>
  );

  const renderHistory = () => (
    <m.section className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-5xl content-start gap-5 px-4 py-6 md:px-8" {...pageTransition}>
      <div className="rounded-[2rem] border border-black/10 bg-white/85 p-5 shadow-[0_28px_80px_rgba(16,24,20,0.12)] backdrop-blur md:p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Local browser data</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black leading-none text-zinc-950 md:text-5xl">Scan history</h1>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-700">
              Saved only in this browser. Recent scans stay available even after refresh.
            </p>
          </div>
          {history.length > 0 && (
            <MotionButton
              type="button"
              onClick={clearHistory}
              className="min-h-11 rounded-lg bg-zinc-100 px-4 text-sm font-black text-zinc-950"
            >
              Clear history
            </MotionButton>
          )}
        </div>
      </div>

      {history.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {history.map((item) => (
            <m.button
              key={item.id}
              type="button"
              onClick={() => openHistoryItem(item)}
              className="grid grid-cols-[5rem_1fr] gap-3 rounded-2xl border border-black/10 bg-white/85 p-3 text-left shadow-sm backdrop-blur"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <img src={item.image || logoImage} alt={item.name} className="h-20 w-20 rounded-xl object-cover" />
              <span className="min-w-0">
                <strong className="block break-words font-display text-lg leading-tight">{item.name}</strong>
                <span className="mt-1 block text-sm font-bold text-emerald-700">{item.state}</span>
                <span className="mt-2 block text-sm text-zinc-600">
                  {item.ripeness} | {item.ripening_type} | {item.confidence}%
                </span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </span>
            </m.button>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-7 text-center shadow-sm backdrop-blur">
          <img src={logoImage} alt="Asli Aam logo" className="mx-auto h-28 w-28 rounded-2xl object-cover" />
          <h2 className="mt-5 font-display text-3xl font-black">No scans saved yet</h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-zinc-700">
            Scan or upload a mango and the result will be stored here on this device.
          </p>
          <MotionButton
            type="button"
            onClick={goToScan}
            className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 font-black text-white"
          >
            <Icon name="center_focus_strong" filled />
            Start scan
          </MotionButton>
        </div>
      )}
      {hiddenUpload}
    </m.section>
  );

  const bottomNav = () => {
    if (screen === "scanning") {
      return null;
    }

    return (
      <m.nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 text-white shadow-[0_18px_50px_rgba(16,24,20,0.22)] backdrop-blur">
          <NavButton active={screen === "home"} icon="home" label="Home" onClick={() => setScreen("home")} />
          <NavButton active={screen === "scan"} icon="center_focus_strong" label="Scan" onClick={resetScanner} featured />
          <NavButton active={screen === "history"} icon="history" label={`History ${history.length ? history.length : ""}`} onClick={() => setScreen("history")} />
        </div>
      </m.nav>
    );
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-dvh bg-[#f7f8ef] text-zinc-950">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(242,201,76,0.34),transparent_24%),radial-gradient(circle_at_90%_15%,rgba(17,153,142,0.24),transparent_22%),linear-gradient(180deg,#f7f8ef,#f4fff9_48%,#fff7f0)]" />
        <div className="pointer-events-none fixed inset-0 opacity-[0.12] [background-image:linear-gradient(#101814_1px,transparent_1px),linear-gradient(90deg,#101814_1px,transparent_1px)] [background-size:34px_34px]" />
        <AnimatePresence mode="wait" initial={false}>
          <div key={screen} className="relative z-10 pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {screen === "home" && renderHome()}
            {screen === "scan" && renderScan()}
            {screen === "scanning" && renderScanning()}
            {screen === "result" && renderResult()}
            {screen === "not-mango" && renderNotMango()}
            {screen === "history" && renderHistory()}
            {screen === "error" && renderError()}
          </div>
        </AnimatePresence>
        <AnimatePresence>
          {shamiToast && (
            <m.div
              className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-lg bg-zinc-950/90 px-4 py-2 text-sm font-black text-white shadow-[0_14px_40px_rgba(16,24,20,0.22)] backdrop-blur"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {shamiToast}
            </m.div>
          )}
        </AnimatePresence>
        {bottomNav()}
      </div>
    </LazyMotion>
  );
}

export default App;
