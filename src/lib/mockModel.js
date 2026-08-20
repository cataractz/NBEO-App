// The "AI model" layer — currently a deterministic, template-driven composer
// over real retrieved platform content, standing in for a live LLM call.
// This is a static, client-only site (GitHub Pages) with no backend and no
// API keys, so a real model call isn't possible today; callLanguageModel()
// below is the single, clearly-marked seam where a future backend proxy
// (e.g. a small server forwarding to the Claude API) would plug in.
//
// Integrity rule this whole file follows: every composer either (a) quotes/
// paraphrases real retrieved STUDY_PAGES/QUESTIONS content — safe, since it's
// the platform's own curated, verified material — or (b) is a pure
// computation over real student data (attempts/mistakes/srs state) — also
// safe, since it's just arithmetic. Nothing in this file invents a novel
// medical fact. When there isn't enough retrieved content to answer
// something, callers must use noPlatformAnswer() rather than let a composer
// guess.

// --- The real-model seam ----------------------------------------------------
// A real integration would look roughly like:
//   const res = await fetch("/api/tutor", { method: "POST", body: JSON.stringify({ prompt, context }) });
//   return await res.json();
// Until a backend exists, this intentionally returns null so callers fall
// back to the honest, template-grounded composers instead of pretending to
// have live model output.
export async function callLanguageModel(_prompt, _context) {
  return null;
}

const LEVEL_NOTE = {
  simple: "Simplified — core idea only.",
  student: "Student-level — standard depth.",
  board: "Board-level — high-yield distinctions emphasized.",
  clinical: "Clinical — applied/vignette framing included.",
};

export function noPlatformAnswer(query) {
  return {
    text: `I don't have enough curated platform content to answer "${query}" confidently. I don't want to guess at medical information and present it as verified — that's not something this build does. You can rephrase using platform terminology (try the exact condition/drug name), or search the web for an authoritative source.`,
    confidence: "none",
  };
}

// Builds a short, readable excerpt from a study page's learnIt sections,
// trimmed differently by explanation level (a real per-level *rewrite* would
// need a live model; this is an honest depth/section-count adjustment over
// the one canonical version of the text that exists).
export function formatStudyPageExcerpt(page, level = "student") {
  if (!page) return "";
  const sections = page.learnIt || [];
  const take = level === "simple" ? 2 : level === "board" ? sections.length : level === "clinical" ? sections.length : Math.min(4, sections.length);
  const chosen = sections.slice(0, take);
  let text = chosen.map(s => `**${s.h}:** ${s.t}`).join("\n\n");
  if (level === "clinical" && page.applyIt?.length) {
    text += `\n\n**Applied:** ${page.applyIt[0]}`;
  }
  if (level === "board" && page.memorizeIt?.length) {
    text += `\n\n**High-yield:** ${page.memorizeIt.slice(0, 4).join(" · ")}`;
  }
  return text;
}

export function composeTeachSteps(page, level = "student") {
  if (!page) return null;
  const excerpt = formatStudyPageExcerpt(page, level);
  const highYield = (page.memorizeIt || []).slice(0, 5);
  const distinctions = (page.learnIt || [])
    .filter(s => /distinct|differen|contrast|vs\.?|classic/i.test(s.h + " " + s.t))
    .slice(0, 3)
    .map(s => s.t);
  return {
    levelNote: LEVEL_NOTE[level] || LEVEL_NOTE.student,
    explanation: excerpt,
    highYieldPoints: highYield,
    nbeoDistinctions: distinctions.length ? distinctions : highYield.slice(0, 2),
    comprehensionQuestions: [
      `In your own words, what's the single most testable fact about ${page.name}?`,
      highYield[0] ? `Why does "${highYield[0].split(" — ")[0] || highYield[0].slice(0, 40)}" matter on boards?` : `What would make you suspect ${page.name} in a vignette?`,
    ],
    masteryCheckPrompt: `One-sentence summary check: explain ${page.name} back as if teaching a classmate. Compare it against the Classic NBEO Association above — did you include it?`,
  };
}

export function composeMisconceptionNote({ question, selectedChoiceId, correctChoiceId }) {
  const selectedText = question.choices.find(c => c.id === selectedChoiceId)?.text;
  const selectedExplanation = question.explanations?.[selectedChoiceId];
  const correctExplanation = question.explanations?.[correctChoiceId];
  const correctText = question.choices.find(c => c.id === correctChoiceId)?.text;
  return {
    text:
      `You selected **${selectedText}**. ${selectedExplanation || "That choice doesn't fit the stem — see the correct-answer rationale below."}\n\n` +
      `**Correct answer:** ${correctText}. ${correctExplanation || ""}\n\n` +
      `Likely misconception: this pattern usually means the distinguishing detail in the stem (the specific finding that rules the other choices out) got weighted the same as the more generic, shared features across all the choices. Re-read the stem looking only for the one detail that's unique to the correct answer.`,
    sourcesUsed: { platform: [`Question ${question.id}`, question.objectiveId], web: [] },
  };
}

export function composeCompareTable(conditions) {
  // conditions: [{ name, page }]
  const withPages = conditions.filter(c => c.page);
  if (withPages.length === 0) return null;
  // Use headings common across the compared conditions' learnIt sections as
  // table rows so the comparison is grounded in what's actually written for
  // each, rather than an invented universal template.
  const headingSets = withPages.map(c => new Set((c.page.learnIt || []).map(s => s.h)));
  const commonHeadings = [...headingSets[0]].filter(h => headingSets.every(set => set.has(h)));
  const rows = (commonHeadings.length ? commonHeadings : ["Classic NBEO Association"])
    .map(h => ({
      field: h,
      values: withPages.map(c => (c.page.learnIt || []).find(s => s.h === h)?.t || "—"),
    }));
  return {
    columns: withPages.map(c => c.name),
    rows,
    missing: conditions.filter(c => !c.page).map(c => c.name),
  };
}

export function composeSessionIntro(durationMinutes, itemCount) {
  return `Here's a ${durationMinutes}-minute session built from your actual weak objectives, due flashcards, unanswered questions, and mistake log — ${itemCount} item${itemCount === 1 ? "" : "s"}, ordered by priority.`;
}
