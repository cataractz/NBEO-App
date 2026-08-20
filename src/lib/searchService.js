// Global Search ranking + grouping.
//
// search(index, query, opts) -> { groups: [{ type, label, results, notAvailable }], total }
//
// `index` is the array produced by contentIndex.js's buildContentIndex().
// `opts.mistakes` is the live (user-specific, dynamic) mistake log from
// useCoverage() — mistakes aren't part of the static content index, so they're
// turned into ephemeral search documents at query time instead.
// `opts.context` is { topicId, objectiveId } — the student's current
// location, used as a small ranking boost (requirement: "Relevant content
// from the current topic" ranks above generic results of equal text
// relevance).
//
// Ranking (highest first), per the spec:
//   1. Exact title match
//   2. Exact objective match
//   3. Strong semantic (synonym/abbreviation) match
//   4. Relevant content from the current topic
//   5. Frequently used/high-yield content
//
// This is deliberately a transparent, scored keyword/synonym match rather
// than real semantic search — expandQuery() in synonyms.js is the documented
// seam where a real embedding-similarity lookup can replace the synonym
// table later without this file's callers changing.

import { expandQuery } from "./synonyms.js";

const TYPE_LABELS = {
  topic: "Topics",
  objective: "Knowledge Objectives",
  question: "Questions",
  flashcard: "Flashcards",
  mistake: "Mistakes",
  image: "Images",
  exam: "Exams",
  resource: "Resources",
};

// Categories that exist as concepts in the platform's data model but have no
// real content yet — shown honestly as "not available yet" rather than
// silently omitted or faked with placeholder results.
const NOT_YET_AVAILABLE_TYPES = ["image", "exam", "resource"];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word containment — plain String.includes() would let a short word
// like "red" match inside "covered"/"considered"/"required", flooding
// results with false positives on common query words.
function hasWord(text, word) {
  return new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(text);
}

function scoreDoc(doc, queryLower, synonymTerms, context) {
  const title = doc.title.toLowerCase();
  const text = doc.text.toLowerCase();
  let score = 0;

  if (title === queryLower) score += 100;
  else if (title.startsWith(queryLower)) score += 60;
  else if (title.includes(queryLower)) score += 40;

  if (doc.type === "objective" && text.includes(queryLower)) score += 25;

  if (text.includes(queryLower)) score += 15;

  for (const term of synonymTerms) {
    if (title.includes(term) || text.includes(term)) score += 18;
  }

  // loose per-word overlap so multi-word queries ("pain with eye movement")
  // still surface strong-but-not-exact matches — word-boundary matched so a
  // short query word doesn't match as a mere substring of an unrelated word.
  const words = queryLower.split(/\s+/).filter(w => w.length > 2);
  let wordHits = 0;
  for (const w of words) if (hasWord(text, w)) wordHits++;
  if (words.length > 1) score += Math.round((wordHits / words.length) * 12);

  if (context) {
    if (context.topicId && doc.topicId === context.topicId) score += 10;
    if (context.objectiveId && doc.objectiveId === context.objectiveId) score += 14;
  }
  if (doc.highYield) score += 5;

  return score;
}

function mistakeDocs(mistakes, TOPIC_INFO_BY_ID, CONTENT_TOPICS) {
  return (mistakes || []).map((m, i) => {
    const topicId = CONTENT_TOPICS?.find(ct => ct.objectives.some(o => o.id === m.objectiveId))?.topicId;
    const info = topicId ? TOPIC_INFO_BY_ID?.[topicId] : null;
    return {
      id: `mistake:${i}:${m.questionId || i}`,
      type: "mistake",
      title: m.stem?.slice(0, 90) || "Missed question",
      text: `${m.stem || ""} ${m.yourAnswer || ""} ${m.correctAnswer || ""}`,
      topicId: topicId || null,
      objectiveId: m.objectiveId || null,
      area: info?.area || null,
      discipline: info?.discipline || null,
      highYield: false,
      _raw: m,
    };
  });
}

export function search(index, query, opts = {}) {
  const {
    filterType = "all",       // "all" | "topic" | "objective" | "question" | "flashcard" | "mistake" | "image" | "exam" | "resource"
    area = null,
    difficulty = null,
    highYieldOnly = false,
    context = null,           // { topicId, objectiveId }
    mistakes = [],
    TOPIC_INFO_BY_ID = {},
    CONTENT_TOPICS = [],
    perGroupLimit = 6,
  } = opts;

  const queryLower = (query || "").trim().toLowerCase();
  const synonymTerms = queryLower ? expandQuery(queryLower) : [];

  const allDocs = [...index, ...mistakeDocs(mistakes, TOPIC_INFO_BY_ID, CONTENT_TOPICS)];

  const scored = allDocs
    .filter(doc => filterType === "all" || doc.type === filterType)
    .filter(doc => !area || doc.area === area)
    .filter(doc => !highYieldOnly || doc.highYield)
    .map(doc => ({ doc, score: queryLower ? scoreDoc(doc, queryLower, synonymTerms, context) : (doc.highYield ? 5 : 1) }))
    .filter(r => queryLower ? r.score > 0 : true)
    .sort((a, b) => b.score - a.score);

  const byType = {};
  for (const { doc, score } of scored) {
    if (!byType[doc.type]) byType[doc.type] = [];
    byType[doc.type].push({ ...doc, score });
  }

  const typeOrder = ["topic", "objective", "question", "flashcard", "mistake", "image", "exam", "resource"];
  const groups = typeOrder
    .filter(t => filterType === "all" || filterType === t)
    .map(type => ({
      type,
      label: TYPE_LABELS[type],
      results: (byType[type] || []).slice(0, perGroupLimit),
      count: (byType[type] || []).length,
      notAvailable: NOT_YET_AVAILABLE_TYPES.includes(type),
    }))
    .filter(g => g.results.length > 0 || g.notAvailable);

  const total = scored.length;
  return { groups, total, query };
}

// --- Recent searches -------------------------------------------------------
import { storageGet, storageSet } from "./storage.js";

const RECENT_KEY = "search-recent";
const RECENT_MAX = 10;

export async function getRecentSearches() {
  try {
    const raw = await storageGet(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function addRecentSearch(query) {
  const q = (query || "").trim();
  if (!q) return;
  const prev = await getRecentSearches();
  const next = [q, ...prev.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  try { await storageSet(RECENT_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}
