// AI Tutor service layer: AI Tutor UI -> tutorService (this file) ->
// retrieval (searchService/contentIndex, real platform content) -> mockModel
// (composition) -> [webSearchTool when needed]. Every exported function
// returns { text, sourcesUsed: { platform: [...], web: [...] }, ...mode data }
// so the UI can render an honest "Sources used" panel — never implying
// platform or web origin a response doesn't actually have.
//
// Knowledge-mode routing (the "Auto" default described in the spec):
//   1. Retrieve from the platform content index.
//   2. Strong retrieval -> answer from platform content (knowledgeMode
//      "platform" forces this path and refuses to fall through).
//   3. Weak/no retrieval -> knowledgeMode "web" (or Auto falling through)
//      offers the web-search stub with its own honest "not live" disclaimer;
//      knowledgeMode "platform" instead returns noPlatformAnswer().
// This file never fabricates a confident novel medical claim — see
// mockModel.js's file-level comment for the integrity rule every composer
// here depends on.

import { search } from "./searchService.js";
import { docsForObjective, docsForTopic } from "./contentIndex.js";
import { computeMastery, findDueAndUnseen } from "./analytics.js";
import { searchWeb } from "./webSearchTool.js";
import {
  noPlatformAnswer, formatStudyPageExcerpt, composeTeachSteps,
  composeMisconceptionNote, composeCompareTable, composeSessionIntro,
} from "./mockModel.js";

// Retrieval strength heuristic: "strong" if the top hit clears a real
// title/synonym match threshold, "weak" if there's something but thin,
// "none" if nothing useful came back. Mirrors searchService's own scoring
// scale (see its scoreDoc for the point values these thresholds compare to).
function retrievalStrength(results) {
  const top = results.groups.flatMap(g => g.results)[0];
  if (!top) return "none";
  if (top.score >= 40) return "strong";
  if (top.score >= 15) return "weak";
  return "none";
}

function retrieve(index, query, context, deps) {
  const results = search(index, query, {
    context,
    mistakes: deps.mistakes || [],
    TOPIC_INFO_BY_ID: deps.TOPIC_INFO_BY_ID,
    CONTENT_TOPICS: deps.CONTENT_TOPICS,
    perGroupLimit: 5,
  });
  return { results, strength: retrievalStrength(results) };
}

// --- Explain a topic / general chat -----------------------------------------
export async function explainConcept({ query, context, knowledgeMode = "auto", index, STUDY_PAGES, TOPIC_INFO_BY_ID, CONTENT_TOPICS, mistakes }) {
  const { results, strength } = retrieve(index, query, context, { TOPIC_INFO_BY_ID, CONTENT_TOPICS, mistakes });
  const topObjectiveDoc = results.groups.find(g => g.type === "objective")?.results[0];

  if (knowledgeMode !== "web" && strength !== "none" && topObjectiveDoc) {
    const page = STUDY_PAGES[topObjectiveDoc.objectiveId];
    return {
      mode: "chat",
      text: formatStudyPageExcerpt(page, "student"),
      sourcesUsed: { platform: [page.name], web: [] },
      confidence: strength,
      relatedObjectiveId: topObjectiveDoc.objectiveId,
      relatedTopicId: topObjectiveDoc.topicId,
    };
  }

  if (knowledgeMode === "platform") {
    return { mode: "chat", ...noPlatformAnswer(query), sourcesUsed: { platform: [], web: [] } };
  }

  // Auto (fell through) or explicit Web mode: offer the honest web stub.
  const web = await searchWeb(query);
  return {
    mode: "chat",
    text: `I don't have strong platform coverage for "${query}" yet. ${web.disclaimer}`,
    sourcesUsed: { platform: [], web: web.sources },
    confidence: strength,
  };
}

// --- Teach Me ----------------------------------------------------------------
export function teach({ objectiveId, explanationLevel = "student", STUDY_PAGES }) {
  const page = STUDY_PAGES[objectiveId];
  if (!page) return { mode: "teach", ...noPlatformAnswer(objectiveId), sourcesUsed: { platform: [], web: [] } };
  const steps = composeTeachSteps(page, explanationLevel);
  return {
    mode: "teach",
    text: steps.explanation,
    sourcesUsed: { platform: [page.name], web: [] },
    steps,
  };
}

// --- Quiz Me -------------------------------------------------------------
// Deliberately serves real platform QUESTIONS rather than "generating" new
// ones — the platform's curated questions (with full per-choice explanations)
// are exactly the highest-priority knowledge source the spec asks for.
export function startQuiz({ topicId, objectiveId, area, difficulty, numQuestions = 10, QUESTIONS, CONTENT_TOPICS }) {
  let pool = QUESTIONS;
  if (objectiveId) pool = pool.filter(q => q.objectiveId === objectiveId);
  else if (topicId) {
    const objIds = new Set(CONTENT_TOPICS.find(ct => ct.topicId === topicId)?.objectives.map(o => o.id) || []);
    pool = pool.filter(q => objIds.has(q.objectiveId));
  }
  if (difficulty) pool = pool.filter(q => q.difficulty === difficulty);
  const questions = pool.slice(0, numQuestions);
  return {
    mode: "quiz",
    text: questions.length
      ? `Starting a ${questions.length}-question set${difficulty ? ` (${difficulty})` : ""}. I'll evaluate each answer and explain why, then adapt if you're struggling with a pattern.`
      : "No practice questions match that filter yet — try a broader topic.",
    sourcesUsed: { platform: questions.map(q => q.id), web: [] },
    questions,
  };
}

export function evaluateQuizAnswer({ question, selectedChoiceId }) {
  const correct = selectedChoiceId === question.correct;
  return {
    mode: "quiz",
    correct,
    text: question.explanations?.[selectedChoiceId] || (correct ? "Correct." : "Not quite — see the explanation."),
    correctExplanation: question.explanations?.[question.correct],
    sourcesUsed: { platform: [question.id], web: [] },
  };
}

// --- Explain This Question ----------------------------------------------
export function explainQuestion({ question, selectedChoiceId }) {
  const composed = composeMisconceptionNote({ question, selectedChoiceId, correctChoiceId: question.correct });
  return { mode: "explainQuestion", text: composed.text, sourcesUsed: composed.sourcesUsed };
}

// --- Review My Mistakes ---------------------------------------------------
export function reviewMistakes({ attempts, mistakes, srsState, CONTENT_TOPICS, TOPIC_INFO_BY_ID, FLASHCARDS, STUDY_PAGES }) {
  const mastery = computeMastery({ attempts, mistakes, srsState, CONTENT_TOPICS, TOPIC_INFO_BY_ID, FLASHCARDS, STUDY_PAGES });
  if (mastery.weakestObjectives.length === 0) {
    return {
      mode: "reviewMistakes",
      text: mistakes.length
        ? "You've logged some misses, but not enough repeated attempts on any single objective yet to call out a clear pattern — keep practicing and check back."
        : "No mistakes logged yet — nothing to review. Answer some Practice Questions and I'll start spotting patterns.",
      sourcesUsed: { platform: [], web: [] },
      weakestObjectives: [],
    };
  }
  const worst = mastery.weakestObjectives[0];
  const areaWorst = mastery.areaAccuracy[0];
  const text =
    `Looking at your ${mastery.totalAttempts} logged attempts: your weakest objective is **${worst.name}** ` +
    `(${Math.round(worst.accuracy * 100)}% across ${worst.attempts} attempts${worst.mistakeCount ? `, ${worst.mistakeCount} logged mistakes` : ""}). ` +
    (areaWorst ? `More broadly, **${areaWorst.area}** is your lowest-accuracy area overall (${Math.round(areaWorst.accuracy * 100)}%). ` : "") +
    `I'd recommend a targeted review session on ${mastery.weakestObjectives.slice(0, 3).map(o => o.name).join(", ")} — want me to build one?`;
  return {
    mode: "reviewMistakes",
    text,
    sourcesUsed: { platform: mastery.weakestObjectives.map(o => o.name), web: [] },
    weakestObjectives: mastery.weakestObjectives,
    areaAccuracy: mastery.areaAccuracy,
  };
}

// --- Compare Conditions ----------------------------------------------------
export function compareConditions({ names, index, STUDY_PAGES, CONTENT_TOPICS }) {
  const conditions = names.map(name => {
    const results = search(index, name, { filterType: "objective", perGroupLimit: 1 });
    const doc = results.groups[0]?.results[0];
    // Prefer the resolved platform title over the user's raw typed text
    // (which may be lowercase/abbreviated) so the comparison reads cleanly.
    return { name: doc?.title || name, page: doc ? STUDY_PAGES[doc.objectiveId] : null, objectiveId: doc?.objectiveId };
  });
  const table = composeCompareTable(conditions);
  const missing = conditions.filter(c => !c.page).map(c => c.name);
  return {
    mode: "compare",
    text: table
      ? `Comparing ${conditions.filter(c => c.page).map(c => c.name).join(", ")}${missing.length ? ` (no platform content yet for ${missing.join(", ")})` : ""}.`
      : `I don't have platform content for any of: ${names.join(", ")} yet.`,
    sourcesUsed: { platform: conditions.filter(c => c.page).map(c => c.page.name), web: [] },
    table,
  };
}

// --- Build Me a Study Session ----------------------------------------------
export function buildStudySession({ durationMinutes, attempts, mistakes, srsState, FLASHCARDS, QUESTIONS, CONTENT_TOPICS, TOPIC_INFO_BY_ID, STUDY_PAGES }) {
  const mastery = computeMastery({ attempts, mistakes, srsState, CONTENT_TOPICS, TOPIC_INFO_BY_ID, FLASHCARDS, STUDY_PAGES });
  const { dueFlashcards, unansweredQuestions } = findDueAndUnseen({ FLASHCARDS, QUESTIONS, srsState, attempts });

  const items = [];
  let remaining = durationMinutes;

  const topWeak = mastery.weakestObjectives.slice(0, 2);
  topWeak.forEach(o => {
    if (remaining < 4) return;
    const minutes = Math.min(7, Math.max(4, Math.round(remaining * 0.25)));
    items.push({ label: `Review ${o.name}`, minutes, action: { tab: "learn", target: { objectiveId: o.objectiveId } } });
    remaining -= minutes;
  });

  if (dueFlashcards.length > 0 && remaining >= 3) {
    const count = Math.min(dueFlashcards.length, Math.max(4, Math.round((remaining * 0.3) / 0.6)));
    const minutes = Math.min(remaining, Math.round(count * 0.6));
    items.push({ label: `Complete ${count} due flashcard${count === 1 ? "" : "s"}`, minutes, action: { tab: "flashcards", target: { objectiveId: dueFlashcards[0].objectiveId } } });
    remaining -= minutes;
  }

  if (unansweredQuestions.length > 0 && remaining >= 3) {
    const count = Math.min(unansweredQuestions.length, Math.max(5, Math.round(remaining / 1.2)));
    const minutes = remaining;
    items.push({ label: `Complete ${count} targeted question${count === 1 ? "" : "s"}`, minutes, action: { tab: "questions", target: { filterObjectiveId: topWeak[0]?.objectiveId } } });
    remaining -= minutes;
  } else if (mistakes.length > 0 && remaining >= 3) {
    items.push({ label: `Review ${Math.min(mistakes.length, 5)} previous mistakes`, minutes: remaining, action: { tab: "mistakes", target: null } });
    remaining = 0;
  }

  return {
    mode: "buildSession",
    text: composeSessionIntro(durationMinutes, items.length),
    sourcesUsed: { platform: items.map(i => i.label), web: [] },
    items,
    totalMinutes: durationMinutes,
  };
}
