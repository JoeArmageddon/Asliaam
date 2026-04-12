import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import logoImage from "./assets/asli-aam-logo.jpg";

const STORAGE_KEY = "asli-aam-scan-history";

const EMPTY_RESULT = {
  name: "",
  ripeness: "",
  ripening_type: "",
  confidence: "",
  dishes: []
};

const SCAN_STEPS = [
  {
    title: "Analyzing mango...",
    detail: "Reading peel tone, gloss, and first ripeness signals."
  },
  {
    title: "Checking texture...",
    detail: "Looking for natural ripening cues and firmness hints."
  },
  {
    title: "Matching variety...",
    detail: "Comparing shape, shoulders, and skin profile for variety clues."
  }
];

const PROFILE_FACTS = [
  {
    icon: "bolt",
    title: "Fast demo mode",
    text: "The experience is tuned for crisp motion and quick product walkthroughs."
  },
  {
    icon: "shield_lock",
    title: "Secure backend",
    text: "Image analysis runs through the server so API credentials stay protected."
  },
  {
    icon: "restaurant",
    title: "Recipe aware",
    text: "Dish suggestions adapt to the exact ripeness read returned by the API."
  }
];

const ERROR_TIPS = [
  {
    icon: "light_mode",
    title: "Use brighter light",
    text: "Natural light helps the scanner read surface color and texture more clearly."
  },
  {
    icon: "center_focus_weak",
    title: "Fill the frame",
    text: "Keep the mango centered and large enough to capture its shape properly."
  },
  {
    icon: "cleaning_services",
    title: "Wipe the lens",
    text: "A quick clean can make the next scan noticeably sharper."
  }
];

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.28,
      ease: "easeInOut"
    }
  }
};

const staggerParent = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

function normalizeResult(payload = {}) {
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
    ripening_type: payload.ripening_type || "Natural",
    confidence,
    dishes: Array.isArray(payload.dishes) ? payload.dishes.slice(0, 3) : []
  };
}

function formatConfidence(confidence) {
  if (!confidence) {
    return "High confidence";
  }

  if (/^\d+$/.test(String(confidence).trim())) {
    return `${confidence}% confidence`;
  }

  if (String(confidence).includes("%")) {
    return `${confidence} confidence`;
  }

  return confidence;
}

function numericConfidence(confidence) {
  const match = String(confidence || "").match(/\d+/);
  if (!match) {
    return 88;
  }

  const value = Number(match[0]);
  return Number.isFinite(value) ? Math.max(10, Math.min(100, value)) : 88;
}

function recipeAccent(label = "") {
  const lower = label.toLowerCase();

  if (lower.includes("lassi") || lower.includes("shake")) {
    return { icon: "local_cafe", note: "Rich and cooling" };
  }

  if (lower.includes("salad") || lower.includes("chaat")) {
    return { icon: "nutrition", note: "Fresh and bright" };
  }

  if (lower.includes("pickle")) {
    return { icon: "soup_kitchen", note: "Bold and tangy" };
  }

  if (lower.includes("smoothie")) {
    return { icon: "blender", note: "Smooth and fruity" };
  }

  if (lower.includes("curry") || lower.includes("salsa")) {
    return { icon: "lunch_dining", note: "Savory and lively" };
  }

  return { icon: "restaurant", note: "Chef recommended" };
}

function screenKey(activeTab, scanPhase) {
  if (activeTab === "scan") {
    return `${activeTab}-${scanPhase}`;
  }

  return activeTab;
}

function Icon({ name, filled = false }) {
  return (
    <span className={`material-symbols-outlined${filled ? " filled" : ""}`} aria-hidden="true">
      {name}
    </span>
  );
}

function ActionButton({
  children,
  className,
  hover = true,
  as = "button",
  transition,
  ...props
}) {
  const Component = m[as];

  return (
    <Component
      whileHover={hover ? { scale: 1.02 } : undefined}
      whileTap={{ scale: 0.96 }}
      transition={transition || { duration: 0.18, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

function FadeImage({ className, alt, src }) {
  return (
    <m.img
      className={className}
      src={src}
      alt={alt}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    />
  );
}

function App() {
  const captureInputId = `${useId()}-capture`;
  const uploadInputId = `${useId()}-upload`;
  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [scanPhase, setScanPhase] = useState("home");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [analysis, setAnalysis] = useState(EMPTY_RESULT);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [scanStepIndex, setScanStepIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scanPhase !== "scanning") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setScanStepIndex((current) => (current + 1) % SCAN_STEPS.length);
    }, 900);

    return () => window.clearInterval(intervalId);
  }, [scanPhase]);

  const currentStep = SCAN_STEPS[scanStepIndex];
  const hasHistory = history.length > 0;
  const recipes = analysis.dishes;
  const confidenceValue = numericConfidence(analysis.confidence);

  function startScanner() {
    setActiveTab("scan");
    setError("");
    setScanPhase(selectedFile ? "preview" : "camera");
  }

  function resetScanner() {
    setSelectedFile(null);
    setSelectedImage("");
    setAnalysis(EMPTY_RESULT);
    setError("");
    setActiveTab("scan");
    setScanPhase("camera");
  }

  function goHome() {
    setActiveTab("home");
    setError("");
  }

  function handleBack() {
    if (activeTab === "history" || activeTab === "profile") {
      setActiveTab("home");
      return;
    }

    if (activeTab === "scan") {
      if (scanPhase === "results" || scanPhase === "error") {
        setScanPhase(selectedFile ? "preview" : "camera");
        setError("");
        return;
      }

      if (scanPhase === "preview" || scanPhase === "camera") {
        setActiveTab("home");
        return;
      }
    }

    setActiveTab("home");
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const dataUrl = await toDataUrl(file);
    setSelectedFile(file);
    setSelectedImage(dataUrl);
    setAnalysis(EMPTY_RESULT);
    setError("");
    setActiveTab("scan");
    setScanPhase("preview");
    event.target.value = "";
  }

  async function analyzeImage() {
    if (!selectedFile) {
      setError("Choose a mango photo first.");
      setActiveTab("scan");
      setScanPhase("error");
      return;
    }

    setError("");
    setScanStepIndex(0);
    setActiveTab("scan");
    setScanPhase("scanning");

    try {
      const image = await toDataUrl(selectedFile);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      const nextResult = normalizeResult(payload);
      const historyEntry = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        image: selectedImage,
        ...nextResult
      };

      setAnalysis(nextResult);
      setHistory((current) => [historyEntry, ...current].slice(0, 12));
      setScanPhase("results");
    } catch (requestError) {
      setError(requestError.message || "We could not analyze this photo.");
      setScanPhase("error");
    }
  }

  function openHistoryItem(item) {
    setSelectedImage(item.image || "");
    setSelectedFile(null);
    setAnalysis(normalizeResult(item));
    setError("");
    setActiveTab("scan");
    setScanPhase("results");
  }

  function speakResult() {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${analysis.name || "This mango"} looks ${analysis.ripeness || "perfect"} and ${
        analysis.ripening_type || "naturally ripened"
      }. Try ${recipes.join(", ")}.`
    );
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function renderHome() {
    return (
      <m.section className="screen home-screen" {...pageTransition}>
        <div className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Hyper-Graphic Editorial</p>
            <h1>Scan your mango like it belongs on a billboard.</h1>
            <p className="hero-text">
              A clean mobile-first scanner for variety guesses, ripeness reads, and exact dish
              suggestions that feel polished enough for a demo reel.
            </p>

            <div className="hero-actions">
              <ActionButton className="primary-pill" type="button" onClick={startScanner}>
                <Icon name="center_focus_strong" filled />
                Scan Now
              </ActionButton>
              <ActionButton
                className="secondary-pill"
                type="button"
                onClick={() => setActiveTab("history")}
              >
                <Icon name="history" />
                View History
              </ActionButton>
            </div>
          </div>

          <div className="hero-art">
            <m.div
              className="logo-orbit"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
            />
            <m.img
              className="hero-logo"
              src={logoImage}
              alt="Asli Aam logo"
              initial={{ opacity: 0, scale: 0.92, rotate: -4 }}
              animate={{ opacity: 1, scale: [0.92, 1.03, 1], rotate: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <m.div
              className="floating-chip chip-top"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              Works in seconds
            </m.div>
            <m.div
              className="floating-chip chip-bottom"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.22 }}
            >
              Real photo analysis
            </m.div>
          </div>
        </div>

        <div className="feature-ribbon">
          <m.article className="feature-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Icon name="image" />
            <strong>Upload or capture</strong>
            <p>Use your camera live on phone or pick from gallery on desktop.</p>
          </m.article>
          <m.article
            className="feature-card feature-card-offset"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <Icon name="neurology" />
            <strong>Smart responses</strong>
            <p>Structured output for mango name, ripeness, and recipe ideas.</p>
          </m.article>
          <m.article className="feature-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Icon name="restaurant" />
            <strong>Recipe ready</strong>
            <p>Dish cards render the exact recipe names returned by the API.</p>
          </m.article>
        </div>
      </m.section>
    );
  }

  function renderCamera() {
    const previewStyle = selectedImage ? { backgroundImage: `url(${selectedImage})` } : undefined;

    return (
      <m.section className="screen camera-screen" {...pageTransition}>
        <div className="camera-stage">
          <div className="camera-background" style={previewStyle}>
            {!selectedImage && (
              <div className="camera-placeholder">
                <m.img
                  className="camera-logo"
                  src={logoImage}
                  alt="Asli Aam sticker logo"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            )}
            <div className="camera-shade" />
          </div>

          <div className="camera-frame">
            <div className="frame-corner top-left" />
            <div className="frame-corner top-right" />
            <div className="frame-corner bottom-left" />
            <div className="frame-corner bottom-right" />
            <div className="scan-beam static" />
          </div>

          <div className="camera-hint">
            {selectedImage ? "Mango locked in frame" : "Center the mango in the frame"}
          </div>
        </div>

        <div className="camera-controls">
          <div className="capture-row">
            <ActionButton className="utility-button" type="button" onClick={goHome}>
              <Icon name="arrow_back" />
            </ActionButton>

            <ActionButton
              className="capture-button"
              type="button"
              onClick={selectedImage ? analyzeImage : () => captureInputRef.current?.click()}
            >
              <span className="capture-button-inner">
                <Icon name={selectedImage ? "center_focus_strong" : "photo_camera"} filled />
              </span>
            </ActionButton>

            <ActionButton className="utility-button" type="button" onClick={resetScanner}>
              <Icon name="refresh" />
            </ActionButton>
          </div>

          <div className="camera-action-row">
            <ActionButton
              className="ghost-pill"
              type="button"
              onClick={() => captureInputRef.current?.click()}
            >
              <Icon name="photo_camera" />
              Capture
            </ActionButton>
            <ActionButton
              className="ghost-pill"
              type="button"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Icon name="image" />
              Upload
            </ActionButton>
          </div>

          {selectedImage && (
            <ActionButton className="analyze-link" type="button" onClick={analyzeImage}>
              Analyze this mango
            </ActionButton>
          )}
        </div>

        <input
          id={captureInputId}
          ref={captureInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelection}
        />
        <input
          id={uploadInputId}
          ref={uploadInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={handleFileSelection}
        />
      </m.section>
    );
  }

  function renderScanning() {
    return (
      <m.section className="screen scanning-screen" {...pageTransition}>
        <div className="scan-glow scan-glow-top" />
        <div className="scan-glow scan-glow-bottom" />

        <div className="scan-photo-shell">
          <m.div
            className="scan-photo"
            animate={{ scale: [1, 1.025, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            style={selectedImage ? { backgroundImage: `url(${selectedImage})` } : undefined}
          >
            {!selectedImage && <img src={logoImage} alt="Asli Aam loader logo" />}
            <m.div
              className="scan-line"
              animate={{ y: ["8%", "90%", "8%"] }}
              transition={{ repeat: Infinity, duration: 2.1, ease: "easeInOut" }}
            />
          </m.div>
        </div>

        <div className="loading-copy">
          <AnimatePresence mode="wait">
            <m.div
              key={currentStep.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <h2>{currentStep.title}</h2>
              <p>{currentStep.detail}</p>
            </m.div>
          </AnimatePresence>
        </div>

        <div className="progress-track">
          <m.div
            className="progress-bar"
            initial={{ width: "28%" }}
            animate={{ width: `${36 + scanStepIndex * 22}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>

        <div className="scan-metrics">
          <m.div className="metric-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Icon name="palette" />
            <span>Chromatics</span>
            <strong>{88 + scanStepIndex}% processed</strong>
          </m.div>
          <m.div className="metric-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Icon name="opacity" />
            <span>Juice Content</span>
            <strong>{scanStepIndex === 2 ? "Locked" : "Calculating..."}</strong>
          </m.div>
        </div>

        <ActionButton className="ghost-pill cancel-pill" type="button" onClick={resetScanner}>
          Cancel Scan
          <Icon name="close" />
        </ActionButton>
      </m.section>
    );
  }

  function renderResults() {
    return (
      <m.section className="screen results-screen" {...pageTransition}>
        <m.div
          className="result-hero"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="result-image-shell">
            {selectedImage ? (
              <FadeImage className="result-image" src={selectedImage} alt={analysis.name || "Scanned mango"} />
            ) : (
              <FadeImage className="result-image" src={logoImage} alt="Asli Aam logo" />
            )}
          </div>

          <m.div
            className="result-summary glass-card"
            variants={staggerParent}
            initial="hidden"
            animate="visible"
          >
            <div className="confetti-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <m.div className="result-summary-header" variants={staggerItem}>
              <div>
                <p className="eyebrow">Identification Result</p>
                <h2>{analysis.name || "Classic mango"}</h2>
              </div>
              <span className="confidence-badge">{formatConfidence(analysis.confidence)}</span>
            </m.div>

            <m.div className="confidence-panel" variants={staggerItem}>
              <div className="confidence-copy">
                <span>Confidence</span>
                <strong>{confidenceValue}%</strong>
              </div>
              <div className="confidence-track">
                <m.div
                  className="confidence-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${confidenceValue}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </m.div>

            <m.div className="detail-grid" variants={staggerItem}>
              <div className="detail-box">
                <p>Ripeness</p>
                <strong>{analysis.ripeness || "Perfect"}</strong>
              </div>
              <div className="detail-box">
                <p>Type</p>
                <strong>{analysis.ripening_type || "Natural"}</strong>
              </div>
            </m.div>

            <m.div className="result-chip-row" variants={staggerItem}>
              <span className="result-chip">Demo ready</span>
              <span className="result-chip">Fast read</span>
            </m.div>
          </m.div>
        </m.div>

        <m.section
          className="recipes-section"
          variants={staggerParent}
          initial="hidden"
          animate="visible"
        >
          <m.div className="section-heading" variants={staggerItem}>
            <div>
              <p className="eyebrow">Exact API Suggestions</p>
              <h3>Recipe ideas</h3>
            </div>
            <ActionButton
              className="text-link"
              type="button"
              hover={false}
              onClick={() => setActiveTab("history")}
            >
              Open history
            </ActionButton>
          </m.div>

          <div className="recipe-grid">
            {recipes.length ? (
              recipes.map((recipe, index) => {
                const accent = recipeAccent(recipe);
                return (
                  <m.article
                    className="recipe-card"
                    key={`${recipe}-${index}`}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="recipe-icon">
                      <Icon name={accent.icon} />
                    </div>
                    <strong>{recipe}</strong>
                    <p>{accent.note}</p>
                  </m.article>
                );
              })
            ) : (
              <m.article className="recipe-card" variants={staggerItem}>
                <div className="recipe-icon">
                  <Icon name="info" />
                </div>
                <strong>No recipes returned</strong>
                <p>The API did not provide dish suggestions for this scan.</p>
              </m.article>
            )}
          </div>
        </m.section>

        <div className="cta-stack">
          <ActionButton className="primary-pill full-width" type="button" onClick={resetScanner}>
            <Icon name="center_focus_strong" filled />
            Scan Another
          </ActionButton>
          <ActionButton className="secondary-pill full-width" type="button" onClick={speakResult}>
            <Icon name="volume_up" />
            Read Result Aloud
          </ActionButton>
        </div>
      </m.section>
    );
  }

  function renderError() {
    return (
      <m.section className="screen error-screen" {...pageTransition}>
        <div className="error-hero">
          <div className="error-sticker">
            <FadeImage src={selectedImage || logoImage} alt="Mango scan error preview" />
            <div className="question-badge">
              <Icon name="question_mark" />
            </div>
            <div className="error-chip left-chip">Lighting issue?</div>
            <div className="error-chip right-chip">Lens smudge?</div>
          </div>

          <div className="error-copy">
            <h2>Couldn't analyze properly</h2>
            <p>
              {error ||
                "Even the best harvesters get confused sometimes. Try a brighter, steadier shot."}
            </p>
          </div>

          <div className="cta-stack">
            <ActionButton className="primary-pill full-width" type="button" onClick={resetScanner}>
              <Icon name="refresh" />
              Try Again
            </ActionButton>
            <ActionButton className="secondary-pill full-width" type="button" onClick={goHome}>
              <Icon name="home" />
              Go Back Home
            </ActionButton>
          </div>
        </div>

        <div className="tips-grid">
          {ERROR_TIPS.map((tip) => (
            <m.article
              className="tip-card"
              key={tip.title}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Icon name={tip.icon} />
              <strong>{tip.title}</strong>
              <p>{tip.text}</p>
            </m.article>
          ))}
        </div>
      </m.section>
    );
  }

  function renderHistory() {
    return (
      <m.section className="screen history-screen" {...pageTransition}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Saved scans</p>
            <h2>History</h2>
          </div>
          <ActionButton className="text-link" type="button" hover={false} onClick={startScanner}>
            New scan
          </ActionButton>
        </div>

        {hasHistory ? (
          <div className="history-list">
            {history.map((item) => (
              <ActionButton
                className="history-card"
                key={item.id}
                type="button"
                onClick={() => openHistoryItem(item)}
              >
                <div className="history-card-image">
                  <FadeImage src={item.image || logoImage} alt={item.name || "Saved mango scan"} />
                </div>
                <div className="history-card-copy">
                  <div className="history-card-top">
                    <strong>{item.name}</strong>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p>
                    {item.ripeness} | {item.ripening_type}
                  </p>
                  <small>
                    {(item.dishes || []).slice(0, 2).join(" | ") || "Tap to reopen scan"}
                  </small>
                </div>
              </ActionButton>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <FadeImage src={logoImage} alt="Asli Aam logo badge" />
            <h3>No scans yet</h3>
            <p>Your recent mango reads will show up here after the first successful analysis.</p>
            <ActionButton className="primary-pill" type="button" onClick={startScanner}>
              <Icon name="photo_camera" />
              Start first scan
            </ActionButton>
          </div>
        )}
      </m.section>
    );
  }

  function renderProfile() {
    return (
      <m.section className="screen profile-screen" {...pageTransition}>
        <div className="profile-hero glass-card">
          <FadeImage className="profile-logo" src={logoImage} alt="Asli Aam logo" />
          <div>
            <p className="eyebrow">Brand Profile</p>
            <h2>Asli Aam</h2>
            <p className="profile-text">
              A playful premium mango scanner designed for smooth motion, beautiful mobile
              presentation, and confident fruit intelligence.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <m.article className="stat-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <span>Scans saved</span>
            <strong>{history.length}</strong>
          </m.article>
          <m.article className="stat-card" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <span>Last result</span>
            <strong>{history[0]?.name || "None yet"}</strong>
          </m.article>
        </div>

        <div className="profile-facts">
          {PROFILE_FACTS.map((fact) => (
            <m.article
              className="fact-card"
              key={fact.title}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Icon name={fact.icon} />
              <div>
                <strong>{fact.title}</strong>
                <p>{fact.text}</p>
              </div>
            </m.article>
          ))}
        </div>
      </m.section>
    );
  }

  function renderMainContent() {
    if (activeTab === "history") {
      return renderHistory();
    }

    if (activeTab === "profile") {
      return renderProfile();
    }

    if (activeTab === "home") {
      return renderHome();
    }

    if (scanPhase === "scanning") {
      return renderScanning();
    }

    if (scanPhase === "results") {
      return renderResults();
    }

    if (scanPhase === "error") {
      return renderError();
    }

    return renderCamera();
  }

  const hideNav = activeTab === "scan" && scanPhase === "scanning";

  return (
    <LazyMotion features={domAnimation}>
      <div className="app-shell">
        <div className="page-noise" aria-hidden="true" />

        {!hideNav && (
          <header className="top-bar">
            <div className="brand-lockup">
              <ActionButton className="icon-pill" type="button" hover={false} onClick={handleBack}>
                <Icon
                  name={activeTab === "home" ? "center_focus_strong" : "arrow_back"}
                  filled={activeTab === "home"}
                />
              </ActionButton>

              <div>
                <p className="eyebrow">Asli Aam</p>
                <h1 className="top-title">
                  {activeTab === "home"
                    ? "Mango Scanner"
                    : activeTab === "history"
                      ? "Scan History"
                      : activeTab === "profile"
                        ? "Profile"
                        : scanPhase === "results"
                          ? "Scan Results"
                          : scanPhase === "error"
                            ? "Try Another Shot"
                            : "Ready to Scan"}
                </h1>
              </div>
            </div>

            <m.div
              className="top-logo"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: [0.92, 1.04, 1] }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <img src={logoImage} alt="Asli Aam logo" />
            </m.div>
          </header>
        )}

        <main className={`main-shell${hideNav ? " no-nav-layout" : ""}`}>
          <AnimatePresence mode="wait" initial={false}>
            <div key={screenKey(activeTab, scanPhase)}>{renderMainContent()}</div>
          </AnimatePresence>
        </main>

        {!hideNav && (
          <nav className="floating-tray" aria-label="Primary">
            <ActionButton
              className={`tray-button${activeTab === "home" ? " active" : ""}`}
              type="button"
              onClick={() => setActiveTab("home")}
            >
              <Icon name="home" filled={activeTab === "home"} />
            </ActionButton>
            <ActionButton
              className={`tray-button${activeTab === "scan" ? " active scan-active" : ""}`}
              type="button"
              onClick={startScanner}
            >
              <Icon name="center_focus_strong" filled={activeTab === "scan"} />
            </ActionButton>
            <ActionButton
              className={`tray-button${activeTab === "history" ? " active" : ""}`}
              type="button"
              onClick={() => setActiveTab("history")}
            >
              <Icon name="history" filled={activeTab === "history"} />
            </ActionButton>
            <ActionButton
              className={`tray-button${activeTab === "profile" ? " active" : ""}`}
              type="button"
              onClick={() => setActiveTab("profile")}
            >
              <Icon name="person" filled={activeTab === "profile"} />
            </ActionButton>
          </nav>
        )}
      </div>
    </LazyMotion>
  );
}

export default App;
