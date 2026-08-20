// Builds a flat, searchable "document" index out of the platform's static
// content graph (Blueprint -> Topic -> Objective -> Study Page/Flashcards/
// Questions). This is a pure function — it takes the data in and returns
// plain data out, with no React/DOM dependency — so it can be called once
// (the content is static within a session) and reused by both
// searchService.js and tutorService.js's retrieval step, and so it can later
// be swapped for a real embedding/vector index without either caller
// changing: only the shape of the returned array is the contract.
//
// Document shape:
//   {
//     id: string,            unique within the index
//     type: "topic" | "objective" | "flashcard" | "question",
//     title: string,         short display title
//     text: string,          searchable body text (concatenated content)
//     topicId: string | null,
//     objectiveId: string | null,
//     area: string | null,   NBEO major condition area (or "Drug Reference
//                             (Supplemental)" for non-outline content)
//     discipline: string | null,
//     highYield: boolean,    true when the underlying content is tagged MUST
//                             priority — used for search ranking
//   }

function studyPageText(page) {
  if (!page) return "";
  const parts = [page.name || ""];
  (page.learnIt || []).forEach(s => parts.push(s.h, s.t));
  (page.memorizeIt || []).forEach(s => parts.push(typeof s === "string" ? s : ""));
  (page.applyIt || []).forEach(s => parts.push(typeof s === "string" ? s : ""));
  return parts.filter(Boolean).join(" ");
}

export function buildContentIndex({
  CURRICULUM,
  ALL_TOPICS,
  TOPIC_INFO_BY_ID,
  CONTENT_TOPICS,
  TOPIC_OBJECTIVES,
  STUDY_PAGES,
  FLASHCARDS,
  QUESTIONS,
}) {
  const docs = [];

  CONTENT_TOPICS.forEach(ct => {
    const info = TOPIC_INFO_BY_ID[ct.topicId];
    const area = info ? info.area : "Drug Reference (Supplemental)";
    const discipline = info ? info.discipline : ct.name;

    docs.push({
      id: `topic:${ct.topicId}`,
      type: "topic",
      title: ct.name,
      text: ct.name,
      topicId: ct.topicId,
      objectiveId: null,
      area,
      discipline,
      highYield: false,
    });

    ct.objectives.forEach(o => {
      if (!o.built) return;
      const page = STUDY_PAGES[o.id];
      docs.push({
        id: `objective:${o.id}`,
        type: "objective",
        title: page?.name || o.name,
        text: [o.name, studyPageText(page)].filter(Boolean).join(" "),
        topicId: ct.topicId,
        objectiveId: o.id,
        area,
        discipline,
        highYield: page?.priority === "MUST",
      });
    });
  });

  FLASHCARDS.forEach(card => {
    const info = TOPIC_INFO_BY_ID[
      // objectiveId doesn't carry its topicId directly — recover it via
      // CONTENT_TOPICS the same way LearnTab does.
      CONTENT_TOPICS.find(ct => ct.objectives.some(o => o.id === card.objectiveId))?.topicId
    ];
    docs.push({
      id: `flashcard:${card.id}`,
      type: "flashcard",
      title: card.front,
      text: `${card.front} ${card.back}`,
      topicId: null,
      objectiveId: card.objectiveId,
      area: info?.area || null,
      discipline: info?.discipline || null,
      highYield: false,
    });
  });

  QUESTIONS.forEach(q => {
    const info = TOPIC_INFO_BY_ID[
      CONTENT_TOPICS.find(ct => ct.objectives.some(o => o.id === q.objectiveId))?.topicId
    ];
    docs.push({
      id: `question:${q.id}`,
      type: "question",
      title: q.stem.slice(0, 90),
      text: [q.stem, ...q.choices.map(c => c.text)].join(" "),
      topicId: null,
      objectiveId: q.objectiveId,
      area: info?.area || null,
      discipline: info?.discipline || null,
      highYield: q.difficulty === "Hard",
    });
  });

  return docs;
}

// Convenience: group documents belonging to one objective/topic — used by
// result cards (e.g. "12 Questions · 18 Flashcards · 4 Images") and by
// tutorService.js's retrieval step to gather everything about a concept.
export function docsForObjective(index, objectiveId) {
  return index.filter(d => d.objectiveId === objectiveId);
}

export function docsForTopic(index, topicId) {
  return index.filter(d => d.topicId === topicId);
}
