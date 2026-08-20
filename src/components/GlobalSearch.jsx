import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ArrowRight, MessageCircle } from "lucide-react";
import { search, getRecentSearches, addRecentSearch } from "../lib/searchService.js";
import { docsForTopic, docsForObjective } from "../lib/contentIndex.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "topic", label: "Topics" },
  { id: "objective", label: "Objectives" },
  { id: "question", label: "Questions" },
  { id: "flashcard", label: "Flashcards" },
  { id: "mistake", label: "Mistakes" },
  { id: "image", label: "Images" },
  { id: "exam", label: "Exams" },
  { id: "resource", label: "Resources" },
];

function chip(active) {
  return {
    padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? "var(--teal)" : "var(--steel)"}`,
    background: active ? "var(--teal)" : "#fff", color: active ? "#fff" : "var(--ink)",
    fontFamily: "IBM Plex Sans", whiteSpace: "nowrap",
  };
}

const actionBtn = {
  padding: "5px 10px", borderRadius: 6, border: "1px solid var(--steel)", background: "#fff",
  color: "var(--ink)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Sans",
};

function ResultCard({ doc, onAction, TOPIC_INFO_BY_ID, index, mistakeCountByObjective }) {
  const subtitle = doc.discipline || doc.area || "";
  const qCount = doc.objectiveId ? docsForObjective(index, doc.objectiveId).filter(d => d.type === "question").length
    : doc.topicId ? docsForTopic(index, doc.topicId).filter(d => d.type === "question").length : 0;
  const fCount = doc.objectiveId ? docsForObjective(index, doc.objectiveId).filter(d => d.type === "flashcard").length
    : doc.topicId ? docsForTopic(index, doc.topicId).filter(d => d.type === "flashcard").length : 0;
  const misses = doc.objectiveId ? (mistakeCountByObjective[doc.objectiveId] || 0) : 0;

  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #eee", marginBottom: 6, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: "var(--steel)", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {doc.highYield && <span className="mono" style={{ fontSize: 9.5, background: "var(--amber-15)", color: "var(--amber)", padding: "2px 6px", borderRadius: 5, flexShrink: 0 }}>HIGH-YIELD</span>}
      </div>
      {(doc.type === "topic" || doc.type === "objective") && (
        <div style={{ fontSize: 11.5, color: "var(--steel)", marginTop: 4 }}>
          {qCount} Question{qCount === 1 ? "" : "s"} · {fCount} Flashcard{fCount === 1 ? "" : "s"}
          {misses > 0 && <> · {misses} mistake{misses === 1 ? "" : "s"} logged</>}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {(doc.type === "topic" || doc.type === "objective") && (
          <>
            <button style={actionBtn} onClick={() => onAction("study", doc)}>Study</button>
            <button style={actionBtn} onClick={() => onAction("quiz", doc)}>Quiz</button>
            <button style={actionBtn} onClick={() => onAction("flashcards", doc)}>Flashcards</button>
          </>
        )}
        {doc.type === "question" && <button style={actionBtn} onClick={() => onAction("quiz", doc)}>Open question</button>}
        {doc.type === "flashcard" && <button style={actionBtn} onClick={() => onAction("flashcards", doc)}>Open card</button>}
        {doc.type === "mistake" && <button style={actionBtn} onClick={() => onAction("quiz", doc)}>Retry</button>}
        <button style={{ ...actionBtn, borderColor: "var(--teal)", color: "var(--teal)" }} onClick={() => onAction("ask-ai", doc)}>Ask AI</button>
      </div>
    </div>
  );
}

export default function GlobalSearch({ open, onOpenChange, index, coverage, tutorContext, navigateTo, onAskAI, TOPIC_INFO_BY_ID, CONTENT_TOPICS }) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      getRecentSearches().then(setRecent);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setFilterType("all");
    }
  }, [open]);

  const mistakeCountByObjective = useMemo(() => {
    const m = {};
    (coverage?.mistakes || []).forEach(x => { if (x.objectiveId) m[x.objectiveId] = (m[x.objectiveId] || 0) + 1; });
    return m;
  }, [coverage?.mistakes]);

  const results = useMemo(() => search(index, query, {
    filterType,
    context: tutorContext ? { topicId: tutorContext.topicId, objectiveId: tutorContext.objectiveId } : null,
    mistakes: coverage?.mistakes || [],
    TOPIC_INFO_BY_ID,
    CONTENT_TOPICS,
  }), [index, query, filterType, tutorContext, coverage?.mistakes, TOPIC_INFO_BY_ID, CONTENT_TOPICS]);

  if (!open) return null;

  const runRecent = (q) => setQuery(q);

  const close = () => onOpenChange(false);

  const handleAction = (action, doc) => {
    if (query.trim()) addRecentSearch(query.trim());
    if (action === "study") navigateTo("learn", { objectiveId: doc.objectiveId || undefined, topicId: doc.topicId || undefined });
    else if (action === "quiz") navigateTo("questions", doc.type === "question"
      ? { questionId: doc.id.replace(/^question:/, "") }
      : { filterObjectiveId: doc.objectiveId || undefined });
    else if (action === "flashcards") navigateTo("flashcards", doc.type === "flashcard"
      ? { flashcardId: doc.id.replace(/^flashcard:/, "") }
      : { objectiveId: doc.objectiveId || undefined });
    else if (action === "ask-ai") navigateTo("tutor", { objectiveId: doc.objectiveId || undefined, topicId: doc.topicId || undefined, query: doc.title });
    close();
  };

  const askAIAboutQuery = () => {
    if (query.trim()) addRecentSearch(query.trim());
    onAskAI(query);
    close();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,35,31,0.45)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "9vh 16px 40px" }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 620, maxHeight: "78vh", background: "#fff", borderRadius: 14, boxShadow: "0 12px 48px rgba(20,35,31,0.32)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #eee" }}>
          <Search size={18} color="var(--steel)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search topics, objectives, questions, flashcards…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15.5, fontFamily: "IBM Plex Sans", color: "var(--ink)" }}
          />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--steel)", border: "1px solid #ddd", borderRadius: 5, padding: "2px 6px" }}>ESC</span>
          <button aria-label="Close search" onClick={close} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--steel)", padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid #f2f2f2" }}>
          {FILTERS.map(f => (
            <div key={f.id} style={chip(filterType === f.id)} onClick={() => setFilterType(f.id)}>{f.label}</div>
          ))}
        </div>

        <div style={{ overflowY: "auto", padding: "12px 16px", flex: 1 }}>
          {!query.trim() && (
            <>
              {tutorContext?.label && (
                <div style={{ fontSize: 12, color: "var(--steel)", marginBottom: 10 }}>
                  Currently studying: <strong style={{ color: "var(--ink)" }}>{tutorContext.label}</strong>
                </div>
              )}
              {recent.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--steel)", fontWeight: 600, marginBottom: 8 }}>RECENT SEARCHES</div>
                  {recent.map((r, i) => (
                    <div key={i} onClick={() => runRecent(r)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                      <Search size={14} color="var(--steel)" /> {r}
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: "var(--steel)", fontSize: 13.5, padding: "20px 4px" }}>
                  Start typing to search across topics, objectives, questions, flashcards, and your mistake log.
                </div>
              )}
            </>
          )}

          {query.trim() && results.groups.length === 0 && (
            <div style={{ color: "var(--steel)", fontSize: 13.5, padding: "20px 4px" }}>No matches for "{query}".</div>
          )}

          {query.trim() && results.groups.map(g => (
            <div key={g.type} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--steel)", fontWeight: 600, marginBottom: 6 }}>
                {g.label.toUpperCase()}{g.count > g.results.length ? ` · showing ${g.results.length} of ${g.count}` : ""}
              </div>
              {g.notAvailable && g.results.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--steel)", fontStyle: "italic", padding: "4px 2px 2px" }}>Not available yet on this platform.</div>
              ) : (
                g.results.map(doc => (
                  <ResultCard key={doc.id} doc={doc} onAction={handleAction} TOPIC_INFO_BY_ID={TOPIC_INFO_BY_ID} index={index} mistakeCountByObjective={mistakeCountByObjective} />
                ))
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #eee", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--paper)" }}>
          <span style={{ fontSize: 12.5, color: "var(--steel)" }}>Didn't find what you're looking for?</span>
          <button
            onClick={askAIAboutQuery}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--teal)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Sans" }}
          >
            <MessageCircle size={13} /> Ask AI Tutor{query.trim() ? ` about "${query.trim()}"` : ""} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
