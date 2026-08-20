// Pure functions computing mastery/accuracy/trend data from the platform's
// live user-state (attempt log, mistake log, flashcard SRS state) plus the
// static content graph. No React/DOM dependency, so both AnalyticsTab.jsx
// and (in Phase 3) tutorService.js's "what should I study tonight" /
// "what are my weakest areas" features can share this exact logic instead of
// each re-deriving their own notion of "mastery."

function objectiveToTopicInfo(objectiveId, CONTENT_TOPICS, TOPIC_INFO_BY_ID) {
  const topicId = CONTENT_TOPICS.find(ct => ct.objectives.some(o => o.id === objectiveId))?.topicId;
  if (!topicId) return { topicId: null, area: null, discipline: null };
  const info = TOPIC_INFO_BY_ID[topicId];
  return { topicId, area: info?.area || "Drug Reference (Supplemental)", discipline: info?.discipline || null };
}

// Minimum attempts before an objective's accuracy is considered meaningful
// enough to call out as a "weak" area — otherwise one unlucky miss on a
// never-before-seen objective would dominate the list.
const MIN_ATTEMPTS_FOR_WEAKNESS = 2;

export function computeMastery({ attempts = [], mistakes = [], srsState = {}, CONTENT_TOPICS = [], TOPIC_INFO_BY_ID = {}, FLASHCARDS = [], STUDY_PAGES = {} }) {
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter(a => a.correct).length;
  const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : null;

  // Per-objective aggregation
  const byObjective = {};
  attempts.forEach(a => {
    if (!a.objectiveId) return;
    if (!byObjective[a.objectiveId]) byObjective[a.objectiveId] = { attempts: 0, correct: 0 };
    byObjective[a.objectiveId].attempts++;
    if (a.correct) byObjective[a.objectiveId].correct++;
  });
  const mistakeCountByObjective = {};
  mistakes.forEach(m => { if (m.objectiveId) mistakeCountByObjective[m.objectiveId] = (mistakeCountByObjective[m.objectiveId] || 0) + 1; });

  const weakestObjectives = Object.entries(byObjective)
    .map(([objectiveId, s]) => ({
      objectiveId,
      name: STUDY_PAGES[objectiveId]?.name || objectiveId,
      accuracy: s.correct / s.attempts,
      attempts: s.attempts,
      mistakeCount: mistakeCountByObjective[objectiveId] || 0,
      ...objectiveToTopicInfo(objectiveId, CONTENT_TOPICS, TOPIC_INFO_BY_ID),
    }))
    .filter(o => o.attempts >= MIN_ATTEMPTS_FOR_WEAKNESS)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  // Per-area aggregation
  const byArea = {};
  attempts.forEach(a => {
    if (!a.objectiveId) return;
    const { area } = objectiveToTopicInfo(a.objectiveId, CONTENT_TOPICS, TOPIC_INFO_BY_ID);
    if (!area) return;
    if (!byArea[area]) byArea[area] = { attempts: 0, correct: 0 };
    byArea[area].attempts++;
    if (a.correct) byArea[area].correct++;
  });
  const areaAccuracy = Object.entries(byArea)
    .map(([area, s]) => ({ area, accuracy: s.correct / s.attempts, attempts: s.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Flashcard box distribution — same bucketing FlashcardsTab already uses.
  const flashcardBoxCounts = { new: 0, learning: 0, review: 0, mature: 0 };
  FLASHCARDS.forEach(c => {
    const b = srsState[c.id]?.box;
    if (b === undefined) flashcardBoxCounts.new++;
    else if (b <= 1) flashcardBoxCounts.learning++;
    else if (b <= 3) flashcardBoxCounts.review++;
    else flashcardBoxCounts.mature++;
  });

  // Mistake trend — last 14 days, oldest first.
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const countByDay = {};
  mistakes.forEach(m => {
    const day = (m.date || "").slice(0, 10);
    if (day) countByDay[day] = (countByDay[day] || 0) + 1;
  });
  const mistakeTrend = days.map(date => ({ date, count: countByDay[date] || 0 }));

  return {
    overallAccuracy, totalAttempts, totalCorrect,
    areaAccuracy, weakestObjectives, flashcardBoxCounts, mistakeTrend,
    mistakeCountByObjective,
  };
}

// Objectives that have due/unreviewed flashcards or unanswered questions —
// used by Phase 3's "Build Me a Study Session" to assemble a real, actionable
// plan instead of a generic one.
export function findDueAndUnseen({ FLASHCARDS = [], QUESTIONS = [], srsState = {}, attempts = [] }) {
  const dueFlashcards = FLASHCARDS.filter(c => {
    const s = srsState[c.id];
    if (!s) return true; // never reviewed
    const dayMs = 24 * 60 * 60 * 1000;
    const intervalDays = [0, 1, 3, 7, 14, 30][Math.min(s.box, 5)] ?? 30;
    return Date.now() - s.last >= intervalDays * dayMs;
  });
  const answeredQuestionIds = new Set(attempts.map(a => a.questionId));
  const unansweredQuestions = QUESTIONS.filter(q => !answeredQuestionIds.has(q.id));
  return { dueFlashcards, unansweredQuestions };
}
