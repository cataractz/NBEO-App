// Persisted AI Tutor conversation history, via the shared storage helper.
// A "conversation" here is a lightweight summary record (not the full
// message transcript) — enough for the AI Tutor homepage's "Recent
// conversations" list to show what was asked and jump back into context.

import { storageGet, storageSet } from "./storage.js";

const KEY = "tutor-conversations";
const MAX = 20;

export async function getConversations() {
  try {
    const raw = await storageGet(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveConversation({ title, mode, contextLabel }) {
  const prev = await getConversations();
  const entry = { id: `conv-${Date.now()}`, title, mode, contextLabel: contextLabel || null, date: new Date().toISOString() };
  const next = [entry, ...prev].slice(0, MAX);
  try { await storageSet(KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}
