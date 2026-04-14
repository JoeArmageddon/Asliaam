export const SHAMI_MODE_STORAGE_KEY = "shamiMode";
export const SHAMI_MODE_LONG_PRESS_MS = 2000;

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

export const isShamiModeLongPress = (startTime, endTime, thresholdMs = SHAMI_MODE_LONG_PRESS_MS) =>
  endTime - startTime >= thresholdMs;
