import React, { useState, useEffect, useRef, useMemo } from "react";
import { MessageCircle, X, Send, BookOpen, GraduationCap, Brain, AlertTriangle, GitCompare, Zap, CalendarClock, HelpCircle, ChevronRight, Check, XCircle } from "lucide-react";
import { search } from "../lib/searchService.js";
import * as tutor from "../lib/tutorService.js";
import { getConversations, saveConversation } from "../lib/conversationStore.js";
import { computeMastery } from "../lib/analytics.js";

const KNOWLEDGE_MODES = [
  { id: "auto", label: "🤖 Auto" },
  { id: "platform", label: "📚 Study Material" },
  { id: "web", label: "🌐 Web Search" },
];

const EXPLANATION_LEVELS = ["simple", "student", "board", "clinical"];

const SUGGESTIONS = [
  { id: "explain", label: "Explain a topic", icon: BookOpen },
  { id: "teach", label: "Teach me", icon: GraduationCap },
  { id: "quiz", label: "Quiz me", icon: Brain },
  { id: "reviewMistakes", label: "Review my mistakes", icon: AlertTriangle },
  { id: "compare", label: "Compare conditions", icon: GitCompare },
  { id: "rapid", label: "Rapid review", icon: Zap },
  { id: "buildSession", label: "Build me a study session", icon: CalendarClock },
];

const chip = { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--steel)", background: "#fff", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Sans" };
const smallBtn = { padding: "6px 12px", borderRadius: 7, border: "1px solid var(--steel)", background: "#fff", color: "var(--ink)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Sans" };
const primaryBtn = { padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--teal)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Sans" };

function resolveObjectiveByName(name, index) {
  const r = search(index, name, { filterType: "objective", perGroupLimit: 1 });
  return r.groups[0]?.results[0] || null;
}

function SourcesFooter({ sourcesUsed }) {
  if (!sourcesUsed || (!sourcesUsed.platform?.length && !sourcesUsed.web?.length)) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #e2e2e2", fontSize: 11, color: "var(--steel)" }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>SOURCES USED</div>
      {sourcesUsed.platform?.length > 0 && <div>📚 Platform: {sourcesUsed.platform.slice(0, 4).join(" · ")}</div>}
      {sourcesUsed.web?.length > 0 && <div>🌐 Web (suggested, not live-fetched): {sourcesUsed.web.join(" · ")}</div>}
    </div>
  );
}

function TeachCard({ data, level, onLevelChange, onNavigate }) {
  const s = data.steps;
  if (!s) return <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{data.text}</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {EXPLANATION_LEVELS.map(l => (
          <div key={l} onClick={() => onLevelChange(l)} style={{ ...chip, padding: "4px 10px", fontSize: 11, background: level === l ? "var(--teal)" : "#fff", color: level === l ? "#fff" : "var(--ink)", borderColor: level === l ? "var(--teal)" : "var(--steel)" }}>
            {l[0].toUpperCase() + l.slice(1)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--steel)", marginBottom: 8 }}>{s.levelNote}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap", marginBottom: 12 }}>{s.explanation}</div>
      {s.highYieldPoints?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", marginBottom: 4 }}>HIGH-YIELD COMPONENTS</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {s.highYieldPoints.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {s.nbeoDistinctions?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", marginBottom: 4 }}>NBEO-RELEVANT DISTINCTIONS</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {s.nbeoDistinctions.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      <div style={{ background: "var(--paper)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>QUICK CHECK</div>
        {s.comprehensionQuestions.map((q, i) => <div key={i} style={{ fontSize: 12.5, marginBottom: 3 }}>• {q}</div>)}
      </div>
      <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--steel)" }}>{s.masteryCheckPrompt}</div>
      {data.relatedObjectiveId && (
        <button style={{ ...smallBtn, marginTop: 10 }} onClick={() => onNavigate("learn", { objectiveId: data.relatedObjectiveId })}>Open full study page</button>
      )}
    </div>
  );
}

function QuizCard({ session, onAnswer, onNext, onRestart }) {
  const q = session.questions[session.idx];
  if (!q) {
    return (
      <div>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Set complete — {session.correct}/{session.questions.length} correct.</div>
        {session.strugglingNote && <div style={{ fontSize: 12.5, color: "var(--amber)", marginBottom: 8 }}>{session.strugglingNote}</div>}
        <button style={smallBtn} onClick={onRestart}>New quiz</button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--steel)", marginBottom: 6 }}>Question {session.idx + 1} of {session.questions.length} · {session.correct}/{session.idx + (session.submitted ? 1 : 0)} correct so far</div>
      <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>{q.stem}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q.choices.map(c => {
          const isSelected = session.selected === c.id;
          const isCorrectChoice = c.id === q.correct;
          let bg = "#fff", border = "var(--steel)", icon = null;
          if (session.submitted) {
            if (isCorrectChoice) { bg = "rgba(31,111,107,0.08)"; border = "var(--teal)"; icon = <Check size={14} color="var(--teal)" />; }
            else if (isSelected) { bg = "var(--coral-12)"; border = "var(--coral)"; icon = <XCircle size={14} color="var(--coral)" />; }
          } else if (isSelected) { bg = "var(--teal-10)"; border = "var(--teal)"; }
          return (
            <div key={c.id}>
              <button disabled={session.submitted} onClick={() => onAnswer(c.id)} style={{ width: "100%", textAlign: "left", display: "flex", gap: 8, alignItems: "center", padding: "9px 12px", borderRadius: 7, border: `1px solid ${border}`, background: bg, cursor: session.submitted ? "default" : "pointer", fontSize: 13 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--steel)" }}>{c.id.toUpperCase()}</span>
                <span style={{ flex: 1 }}>{c.text}</span>{icon}
              </button>
              {session.submitted && <div style={{ fontSize: 11.5, color: "var(--steel)", padding: "4px 12px 0" }}>{q.explanations?.[c.id]}</div>}
            </div>
          );
        })}
      </div>
      {session.submitted && <button style={{ ...primaryBtn, marginTop: 10 }} onClick={onNext}>{session.idx + 1 >= session.questions.length ? "Finish" : "Next question"}</button>}
    </div>
  );
}

function CompareTable({ table }) {
  if (!table) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--steel)", color: "var(--steel)", fontSize: 11 }}>FIELD</th>
            {table.columns.map(c => <th key={c} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--steel)" }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(r => (
            <tr key={r.field}>
              <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontWeight: 600, color: "var(--teal)" }}>{r.field}</td>
              {r.values.map((v, i) => <td key={i} style={{ padding: "6px 10px", borderBottom: "1px solid #eee", lineHeight: 1.5 }}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionChecklist({ items, onNavigate }) {
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--paper)", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
          <div style={{ fontSize: 13 }}>{i + 1}. {it.label} <span className="mono" style={{ color: "var(--steel)", fontSize: 11 }}>— {it.minutes} min</span></div>
          <button style={smallBtn} onClick={() => onNavigate(it.action.tab, it.action.target)}>Go</button>
        </div>
      ))}
    </div>
  );
}

function TurnCard({ turn, ui }) {
  if (turn.role === "user") {
    return <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--teal)", color: "#fff", borderRadius: "12px 12px 2px 12px", padding: "9px 14px", fontSize: 13.5 }}>{turn.text}</div>;
  }
  const d = turn.data;
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: "#fff", border: "1px solid #eee", borderRadius: "12px 12px 12px 2px", padding: "14px 16px", boxShadow: "0 1px 4px rgba(20,35,31,0.05)" }}>
      {d.mode === "teach" ? <TeachCard data={d} level={ui.explanationLevel} onLevelChange={ui.setExplanationLevel} onNavigate={ui.navigateTo} />
        : d.mode === "quiz" && d.quizSession ? <QuizCard session={d.quizSession} onAnswer={ui.onQuizAnswer} onNext={ui.onQuizNext} onRestart={ui.onQuizRestart} />
        : d.mode === "compare" ? (<><div style={{ fontSize: 13.5, marginBottom: 10 }}>{d.text}</div><CompareTable table={d.table} /></>)
        : d.mode === "buildSession" ? (<><div style={{ fontSize: 13.5, marginBottom: 10 }}>{d.text}</div><SessionChecklist items={d.items} onNavigate={ui.navigateTo} /></>)
        : d.mode === "reviewMistakes" ? (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 8 }}>{d.text}</div>
            {d.weakestObjectives?.length > 0 && <button style={smallBtn} onClick={() => ui.onSuggestion("buildSession")}>Build me a study session</button>}
          </>
        )
        : <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.text}</div>}
      <SourcesFooter sourcesUsed={d.sourcesUsed} />
    </div>
  );
}

export default function AITutorPage({ tutorContext, setTutorContext, navigateTo, navTarget, coverage, srsState, index, CONTENT_TOPICS, TOPIC_INFO_BY_ID, STUDY_PAGES, FLASHCARDS, QUESTIONS }) {
  const [screen, setScreen] = useState("landing");
  const [input, setInput] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState("auto");
  const [explanationLevel, setExplanationLevel] = useState("student");
  const [transcript, setTranscript] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pendingMode, setPendingMode] = useState(null); // for chips needing a follow-up (compare/session duration)
  const scrollRef = useRef(null);
  const consumedTarget = useRef(null);

  useEffect(() => { getConversations().then(setRecent); }, [screen === "landing"]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [transcript]);

  const deps = { index, CONTENT_TOPICS, TOPIC_INFO_BY_ID, STUDY_PAGES, FLASHCARDS, QUESTIONS, mistakes: coverage.mistakes || [], attempts: coverage.attempts || [], srsState: srsState || {} };

  const pushTurn = (turn) => setTranscript(t => [...t, turn]);

  const startConversation = async (title, mode) => {
    setScreen("conversation");
    await saveConversation({ title, mode, contextLabel: tutorContext?.label });
    getConversations().then(setRecent);
  };

  const runChat = async (text) => {
    pushTurn({ role: "user", text });
    setInput("");
    const res = await tutor.explainConcept({ query: text, context: tutorContext, knowledgeMode, index, STUDY_PAGES, TOPIC_INFO_BY_ID, CONTENT_TOPICS, mistakes: deps.mistakes });
    pushTurn({ role: "assistant", data: res });
  };

  const runTeach = async (objectiveId, label) => {
    pushTurn({ role: "user", text: `Teach me ${label}` });
    const res = tutor.teach({ objectiveId, explanationLevel, STUDY_PAGES });
    pushTurn({ role: "assistant", data: res });
  };

  const buildQuizSession = (questions) => ({ questions, idx: 0, selected: null, submitted: false, correct: 0, missedStreak: 0, strugglingNote: null });

  const runQuiz = async (objectiveId, label) => {
    pushTurn({ role: "user", text: `Quiz me on ${label}` });
    const res = tutor.startQuiz({ objectiveId, numQuestions: 10, QUESTIONS, CONTENT_TOPICS });
    res.quizSession = buildQuizSession(res.questions);
    pushTurn({ role: "assistant", data: res });
  };

  const runRapidReview = async () => {
    pushTurn({ role: "user", text: "Rapid review" });
    const mastery = computeMastery({ attempts: deps.attempts, mistakes: deps.mistakes, srsState: deps.srsState, CONTENT_TOPICS, TOPIC_INFO_BY_ID, FLASHCARDS, STUDY_PAGES });
    const objIds = mastery.weakestObjectives.slice(0, 3).map(o => o.objectiveId);
    const pool = objIds.length ? QUESTIONS.filter(q => objIds.includes(q.objectiveId)) : QUESTIONS.slice(0, 5);
    const res = { mode: "quiz", text: objIds.length ? "Rapid review across your weakest objectives — 5 quick questions." : "No weak-objective data yet, so here's a general rapid review — 5 quick questions.", sourcesUsed: { platform: pool.slice(0, 5).map(q => q.id), web: [] }, questions: pool.slice(0, 5) };
    res.quizSession = buildQuizSession(res.questions);
    pushTurn({ role: "assistant", data: res });
  };

  const runReviewMistakes = async () => {
    pushTurn({ role: "user", text: "Review my mistakes" });
    const res = tutor.reviewMistakes({ attempts: deps.attempts, mistakes: deps.mistakes, srsState: deps.srsState, CONTENT_TOPICS, TOPIC_INFO_BY_ID, FLASHCARDS, STUDY_PAGES });
    pushTurn({ role: "assistant", data: res });
  };

  const runCompare = async (text) => {
    const names = text.split(/,| vs\.?| and /i).map(s => s.trim()).filter(Boolean);
    pushTurn({ role: "user", text: `Compare ${names.join(", ")}` });
    setInput("");
    const res = tutor.compareConditions({ names, index, STUDY_PAGES, CONTENT_TOPICS });
    pushTurn({ role: "assistant", data: res });
  };

  const runBuildSession = async (minutes) => {
    pushTurn({ role: "user", text: `Build me a ${minutes}-minute study session` });
    const res = tutor.buildStudySession({ durationMinutes: minutes, ...deps });
    pushTurn({ role: "assistant", data: res });
  };

  const runExplainQuestion = async (eq) => {
    pushTurn({ role: "user", text: `Explain this question: ${eq.question.stem.slice(0, 80)}…` });
    const res = tutor.explainQuestion({ question: eq.question, selectedChoiceId: eq.selectedChoiceId });
    pushTurn({ role: "assistant", data: res });
  };

  // Handle a suggestion chip click.
  const onSuggestion = (id) => {
    if (screen === "landing") startConversation(SUGGESTIONS.find(s => s.id === id)?.label || id, id);
    if (id === "explain") { setPendingMode(null); return; }
    if (id === "teach") {
      if (tutorContext?.objectiveId) runTeach(tutorContext.objectiveId, tutorContext.label);
      else setPendingMode("teach");
      return;
    }
    if (id === "quiz") {
      if (tutorContext?.objectiveId) runQuiz(tutorContext.objectiveId, tutorContext.label);
      else setPendingMode("quiz");
      return;
    }
    if (id === "reviewMistakes") { runReviewMistakes(); return; }
    if (id === "compare") { setPendingMode("compare"); return; }
    if (id === "rapid") { runRapidReview(); return; }
    if (id === "buildSession") { setPendingMode("buildSession"); return; }
  };

  const onSend = () => {
    const text = input.trim();
    if (!text) return;
    if (pendingMode === "teach") {
      const doc = resolveObjectiveByName(text, index);
      setPendingMode(null); setInput("");
      if (doc) runTeach(doc.objectiveId, doc.title);
      else { pushTurn({ role: "user", text }); pushTurn({ role: "assistant", data: { mode: "chat", text: `No platform objective matched "${text}" — try the exact condition name.`, sourcesUsed: { platform: [], web: [] } } }); }
      return;
    }
    if (pendingMode === "quiz") {
      const doc = resolveObjectiveByName(text, index);
      setPendingMode(null); setInput("");
      if (doc) runQuiz(doc.objectiveId, doc.title);
      else { pushTurn({ role: "user", text }); pushTurn({ role: "assistant", data: { mode: "chat", text: `No platform objective matched "${text}" — try the exact condition name.`, sourcesUsed: { platform: [], web: [] } } }); }
      return;
    }
    if (pendingMode === "compare") { runCompare(text); setPendingMode(null); return; }
    if (screen === "landing") startConversation(text.slice(0, 60), "chat");
    runChat(text);
  };

  const onQuizAnswer = (choiceId) => {
    setTranscript(t => t.map((turn, i) => {
      if (i !== t.length - 1 || turn.role !== "assistant" || !turn.data.quizSession) return turn;
      return { ...turn, data: { ...turn.data, quizSession: { ...turn.data.quizSession, selected: choiceId } } };
    }));
  };
  const onQuizSubmit = () => {
    setTranscript(t => t.map((turn, i) => {
      if (i !== t.length - 1 || turn.role !== "assistant" || !turn.data.quizSession) return turn;
      const s = turn.data.quizSession;
      if (!s.selected || s.submitted) return turn;
      const q = s.questions[s.idx];
      const isCorrect = s.selected === q.correct;
      const missedStreak = isCorrect ? 0 : s.missedStreak + 1;
      return { ...turn, data: { ...turn.data, quizSession: { ...s, submitted: true, correct: s.correct + (isCorrect ? 1 : 0), missedStreak, strugglingNote: missedStreak >= 2 ? "You've missed a couple in a row on this objective — consider Teach Me before continuing." : s.strugglingNote } } };
    }));
  };
  const onQuizNext = () => {
    setTranscript(t => t.map((turn, i) => {
      if (i !== t.length - 1 || turn.role !== "assistant" || !turn.data.quizSession) return turn;
      const s = turn.data.quizSession;
      return { ...turn, data: { ...turn.data, quizSession: { ...s, idx: s.idx + 1, selected: null, submitted: false } } };
    }));
  };
  const onQuizRestart = () => setScreen("landing");

  // Auto-run when arriving with a navTarget (from Search's "Ask AI Tutor",
  // a result card's "Ask AI" action, Mistakes tab, or a future
  // QuestionsTab "Ask AI Tutor" button).
  useEffect(() => {
    if (!navTarget || navTarget === consumedTarget.current) return;
    consumedTarget.current = navTarget;
    if (navTarget.explainQuestion) {
      startConversation("Explain this question", "explainQuestion").then(() => runExplainQuestion(navTarget.explainQuestion));
    } else if (navTarget.objectiveId && navTarget.query) {
      startConversation(navTarget.query, "reviewMistakes").then(() => runReviewMistakes());
    } else if (navTarget.query) {
      startConversation(navTarget.query.slice(0, 60), "chat").then(() => runChat(navTarget.query));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget]);

  const ui = { explanationLevel, setExplanationLevel, navigateTo, onQuizAnswer, onQuizNext, onQuizRestart, onSuggestion };

  if (screen === "landing") {
    return (
      <div style={{ maxWidth: 680, margin: "20px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--teal-10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <MessageCircle size={24} color="var(--teal)" />
          </div>
          <h1 className="disp" style={{ fontSize: 28, margin: "0 0 4px", fontWeight: 600 }}>What are you studying?</h1>
          <p style={{ color: "var(--steel)", fontSize: 14 }}>Your NBEO-specific tutor — grounded in this platform's curated content first.</p>
        </div>

        {tutorContext?.label && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14, fontSize: 12.5 }}>
            <span style={{ color: "var(--steel)" }}>Currently studying:</span>
            <span style={{ fontWeight: 600 }}>{tutorContext.label}</span>
            <button onClick={() => setTutorContext(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--steel)", display: "flex" }} aria-label="Clear context"><X size={13} /></button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "center" }}>
          {KNOWLEDGE_MODES.map(m => (
            <div key={m.id} onClick={() => setKnowledgeMode(m.id)} style={{ ...chip, background: knowledgeMode === m.id ? "var(--teal)" : "#fff", color: knowledgeMode === m.id ? "#fff" : "var(--ink)", borderColor: knowledgeMode === m.id ? "var(--teal)" : "var(--steel)" }}>{m.label}</div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSend()}
            placeholder="Ask about a topic, condition, or drug…"
            style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--steel)", fontSize: 14, fontFamily: "IBM Plex Sans" }}
          />
          <button onClick={onSend} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 6 }}><Send size={14} /> Ask</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 26 }}>
          {SUGGESTIONS.map(s => {
            const Icon = s.icon;
            return <div key={s.id} onClick={() => onSuggestion(s.id)} style={chip}><Icon size={13} /> {s.label}</div>;
          })}
        </div>

        {recent.length > 0 && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--steel)", fontWeight: 600, marginBottom: 8 }}>RECENT CONVERSATIONS</div>
            {recent.map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#fff", border: "1px solid #eee", borderRadius: 9, marginBottom: 6, fontSize: 13 }}>
                <span>{c.title}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--steel)" }}>{c.contextLabel || c.mode}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button style={smallBtn} onClick={() => setScreen("landing")}>← New / Home</button>
        <div style={{ display: "flex", gap: 6 }}>
          {KNOWLEDGE_MODES.map(m => (
            <div key={m.id} onClick={() => setKnowledgeMode(m.id)} style={{ ...chip, padding: "4px 10px", fontSize: 11, background: knowledgeMode === m.id ? "var(--teal)" : "#fff", color: knowledgeMode === m.id ? "#fff" : "var(--ink)" }}>{m.label}</div>
          ))}
        </div>
      </div>

      {tutorContext?.label && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--steel)", marginBottom: 8 }}>
          Currently studying: <strong style={{ color: "var(--ink)" }}>{tutorContext.label}</strong>
          <button onClick={() => setTutorContext(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--steel)", display: "flex" }} aria-label="Clear context"><X size={12} /></button>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 12px" }}>
        {transcript.map((turn, i) => <TurnCard key={i} turn={turn} ui={ui} />)}
      </div>

      {pendingMode === "buildSession" ? (
        <div style={{ display: "flex", gap: 8, padding: "10px 0" }}>
          {[15, 30, 60].map(m => <button key={m} style={smallBtn} onClick={() => { runBuildSession(m); setPendingMode(null); }}>{m} min</button>)}
          <input placeholder="Custom minutes" type="number" style={{ width: 110, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--steel)", fontSize: 12.5 }}
            onKeyDown={e => { if (e.key === "Enter" && e.target.value) { runBuildSession(Number(e.target.value)); setPendingMode(null); } }} />
        </div>
      ) : transcript[transcript.length - 1]?.data?.quizSession && !transcript[transcript.length - 1].data.quizSession.submitted && transcript[transcript.length - 1].data.quizSession.selected ? (
        <div style={{ padding: "8px 0" }}><button style={primaryBtn} onClick={onQuizSubmit}>Submit answer</button></div>
      ) : (
        <div style={{ display: "flex", gap: 8, padding: "10px 0" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSend()}
            placeholder={pendingMode === "teach" ? "Which topic? (e.g. Optic Neuritis)" : pendingMode === "quiz" ? "Quiz me on which topic?" : pendingMode === "compare" ? "e.g. optic neuritis, NAION, AAION" : "Ask a follow-up…"}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: "1px solid var(--steel)", fontSize: 13.5, fontFamily: "IBM Plex Sans" }}
          />
          <button onClick={onSend} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 6 }}><Send size={13} /></button>
        </div>
      )}
    </div>
  );
}
