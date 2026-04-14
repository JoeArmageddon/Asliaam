import assert from "node:assert/strict";
import test from "node:test";
import {
  readShamiMode,
  resolveSecretTap,
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

test("toggles only after three secret taps within two seconds", () => {
  const firstTap = resolveSecretTap([], 1000);
  assert.equal(firstTap.shouldToggle, false);

  const secondTap = resolveSecretTap(firstTap.tapTimes, 2100);
  assert.equal(secondTap.shouldToggle, false);

  const thirdTap = resolveSecretTap(secondTap.tapTimes, 2900);
  assert.equal(thirdTap.shouldToggle, true);
  assert.deepEqual(thirdTap.tapTimes, []);
});

test("does not toggle when the three taps are too far apart", () => {
  const firstTap = resolveSecretTap([], 1000);
  const secondTap = resolveSecretTap(firstTap.tapTimes, 2500);
  const thirdTap = resolveSecretTap(secondTap.tapTimes, 3201);

  assert.equal(thirdTap.shouldToggle, false);
  assert.deepEqual(thirdTap.tapTimes, [2500, 3201]);
});
