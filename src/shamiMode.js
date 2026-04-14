export const SHAMI_MODE_STORAGE_KEY = "shamiMode";

export const readShamiMode = (storage) => {
  try {
    return storage?.getItem(SHAMI_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeShamiMode = (storage, enabled) => {
  try {
    storage?.setItem(SHAMI_MODE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Hidden demo mode should never interrupt the scanner flow.
  }
};

export const resolveSecretTap = (tapTimes = [], tapTime = Date.now(), windowMs = 2000) => {
  const recentTapTimes = [...tapTimes, tapTime].filter((time) => tapTime - time <= windowMs);
  const shouldToggle = recentTapTimes.length >= 3;

  return {
    shouldToggle,
    tapTimes: shouldToggle ? [] : recentTapTimes
  };
};
