import assert from "node:assert/strict";
import test from "node:test";
import {
  isShamiModeLongPress,
  readShamiMode,
  SHAMI_MODE_LONG_PRESS_MS,
  SHAMI_MODE_STORAGE_KEY,
  writeShamiMode
} from "./shamiMode.js";

const createMemoryStorage = () => {
  const entries = new Map();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value))
  };
};

test("persists shami mode with the hidden storage key", () => {
  const storage = createMemoryStorage();

  assert.equal(readShamiMode(storage), false);
  writeShamiMode(storage, true);
  assert.equal(storage.getItem(SHAMI_MODE_STORAGE_KEY), "true");
  assert.equal(readShamiMode(storage), true);

  writeShamiMode(storage, false);
  assert.equal(storage.getItem(SHAMI_MODE_STORAGE_KEY), "false");
  assert.equal(readShamiMode(storage), false);
});

test("recognizes a two second logo long press", () => {
  assert.equal(isShamiModeLongPress(1000, 1000 + SHAMI_MODE_LONG_PRESS_MS), true);
});

test("ignores short logo presses", () => {
  assert.equal(isShamiModeLongPress(1000, 2999), false);
});
