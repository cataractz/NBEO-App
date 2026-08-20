// Shared persistence helper.
//
// `window.storage` is a Claude-artifact-only API (available when this app is
// previewed inside a Claude artifact). It does NOT exist on the real deployed
// GitHub Pages site, so calls to it there throw and get silently swallowed by
// the try/catch blocks that originally called it directly — meaning nothing
// actually persisted in production. This helper tries `window.storage` first
// (to keep artifact-preview behavior identical) and falls back to real
// `localStorage` otherwise, so persistence actually works once deployed.
//
// Keeps the same async-shaped { value } / undefined contract as
// `window.storage.get`/`.set` so existing call sites barely change.

const hasWindowStorage = () =>
  typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

export async function storageGet(key) {
  if (hasWindowStorage()) {
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value !== undefined) return res.value;
    } catch (e) {
      // fall through to localStorage
    }
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : raw;
  } catch (e) {
    return undefined;
  }
}

export async function storageSet(key, value) {
  if (hasWindowStorage()) {
    try {
      await window.storage.set(key, value, false);
      return;
    } catch (e) {
      // fall through to localStorage
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    // storage unavailable (private browsing, quota, etc.) — no-op
  }
}
