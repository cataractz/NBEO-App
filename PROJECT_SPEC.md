# PROJECT_SPEC.md — NBEO Part I ABS Study Platform

## What this is

A single-file React artifact (`nbeo-app.jsx`) implementing a study platform
for the NBEO Part I ABS exam (the national board exam for optometry
licensure in the US). It covers **every topic in the official NBEO Part I
content outline** — 266 leaf topics across 16 major condition areas, spanning
Major Category A (Ametropia, Optics, Contact Lenses, Low Vision,
Accommodation/Vergence, Amblyopia/Strabismus, Perceptual Function, Visual
Development) and Major Category B (Lids/Lacrimal, Cornea, Lens/Cataract,
Uvea/Sclera, Retina/Vitreous, Optic Nerve, Glaucoma, and the large Systemic
Health area covering general medicine/anatomy/physiology/pharmacology
relevant to ocular disease).

For each topic that has been "built," the platform provides:
- **Study pages** (Learn It / Memorize It / Apply It sections)
- **Flashcards** (front/back, tagged to a specific objective)
- **Practice questions** (4-choice, with a full explanation for every choice,
  not just the correct one)

**The goal is 100% coverage** — every leaf topic in the NBEO outline should
eventually have real content. The user has explicitly said redundant content
across topics is fine; the priority is complete coverage, not novelty.

## Where things stand

Read `PROGRESS.md` for the detailed, session-by-session log. Read the output
of `python3 audit_coverage.py nbeo-app.jsx` for the *authoritative* current
coverage state — trust that script's output over any number in PROGRESS.md's
prose, since those have drifted from reality multiple times in the past.

As of the last session: **138/266 topics built**. The single largest
remaining gap is Anatomy (Gross + Developmental) and Pharmacology sections
across the seven Major Category B "single-system" areas (Lids, Cornea, Lens,
Uvea, Retina, Optic Nerve, Glaucoma) — roughly 90+ topics concentrated there.

## File structure (all in `nbeo-app.jsx`)

The file is organized as a sequence of these blocks, in this order:

1. **`CURRICULUM`** (near the top) — the full official curriculum outline,
   as an array of
   `{ area: "...", major: AREA_A|AREA_B, range: [min,max], sections: [{ d: "discipline name", topics: [{ n: "topic name", o: objectiveCount, objs: ["objective text", ...] }] }] }`.
   **This array is the ground truth for what topics *should* exist.** Do not
   edit topic names/structure here casually — it mirrors the official NBEO
   outline. If you ever add area/section/topic entries here, immediately
   re-run the audit script.
   `objs` holds the actual text of each numbered knowledge objective under
   that topic, verbatim (or lightly joined) from the official "Part I ABS
   Exam Content Outline – Discipline-Based" PDF the user uploaded — see the
   "Known open questions" entry below for how it was parsed and
   cross-checked. `objs.length` should always equal `o` except for topics
   whose single implicit objective has no numbered breakdown in the source
   (`o: 1`, `objs: []`) — the Blueprint page treats those as
   non-expandable. If you add a new topic to `CURRICULUM` by hand, add its
   `objs` array too (or leave it `[]` and flag it) rather than leaving the
   field off — the Blueprint UI assumes every topic has an `objs` key.

2. **Per-topic constant blocks**, each looking like:
   ```js
   const FOOBAR_TOPIC_ID = "t-{area}-{section}-{topic}"; // Area(area) > Discipline(section) > Topic Name(topic)
   // One or two sentences: what this covers, and what existing content it
   // cross-references / ties into.
   const FOOBAR_OBJECTIVES = [
     { id: "foobar-subtopic-one", name: "Human-Readable Name", built: true },
     { id: "foobar-subtopic-two", name: "Human-Readable Name", built: true },
   ];
   ```
   The `t-{area}-{section}-{topic}` id is **0-indexed** against the
   `CONTENT_TOPICS_TREE` array positions (area index, then section index
   within that area's `sections` array, then topic index within that
   section's `topics` array). Get this wrong and the topic won't map to the
   right place in the UI.

3. **`TOPIC_OBJECTIVES`** — a big object mapping every `*_TOPIC_ID` to its
   `*_OBJECTIVES` array. Every new topic constant must be added here.

4. **`CONTENT_TOPICS`** — an array of
   `{ topicId: FOOBAR_TOPIC_ID, name: "Display Name", objectives: FOOBAR_OBJECTIVES }`.
   Every new topic must be added here too.

5. **`STUDY_PAGES`** — a big object keyed by objective id (e.g.
   `"foobar-subtopic-one"`), each value having `name`, `priority`
   (`MUST`/`SHOULD`), `verification` (leave as `"UNDER REVIEW"` for new
   content — this is a hook for a future fact-check pass, not something to
   resolve now), `sources` (array of strings, generic like `"Standard
   [discipline] references"`), `learnIt` (array of `{ h: "heading", t: "body
   text" }`), `memorizeIt` (array of short strings), `applyIt` (array of
   1-2 longer strings connecting this content to *other already-built*
   content elsewhere on the platform).

6. **`FLASHCARDS`** — a flat array of
   `{ id: "fc-N", objectiveId: "foobar-subtopic-one", front: "...", back: "..." }`.
   IDs are sequential integers across the whole file — find the highest
   existing `fc-N` and continue from there. ~3-4 flashcards per objective.

7. **`QUESTIONS`** — a flat array of
   `{ id: "q-N", objectiveId: "...", type: "...", difficulty: "Easy"|"Medium"|"Hard", stem: "...", choices: [{id:"a",text:"..."},...], correct: "a", explanations: {a:"...",b:"...",c:"...",d:"..."} }`.
   Every choice gets a real explanation, not just the correct one. IDs
   sequential (`q-N`), continue from the highest existing. ~1-2 questions
   per topic (not necessarily per objective — 1:1 isn't required, the
   integrity script doesn't enforce it).

## Content shape — three flavors, pick based on subject matter

This matters a lot for content quality. Over many sessions we settled on
three distinct content shapes:

1. **Disease-mechanism shape** (most common — used for most Systemic Health
   pathology, ocular disease topics). `learnIt` explains the pathophysiology
   mechanistically; `applyIt` explicitly connects to *other already-built*
   disease/mechanism content elsewhere on the platform (name the specific
   existing topic).

2. **Structural/localization shape** (used for Anatomy topics — brainstem,
   cranial nerves, etc.). `learnIt` describes structure/location/
   connections; `applyIt` focuses on "what deficit results if this specific
   structure is damaged" — lesion localization, not disease mechanism per
   se. This shape worked very well for Neuroanatomy and should be the
   default for the remaining Gross Anatomy topics (cornea, lens, uvea,
   retina, optic nerve, lids, etc.) — describe the structure, then connect
   it to a clinical finding or existing pathology topic that depends on that
   structure.

3. **Calculation-based shape** (used for all of Ametropia's Optics
   sections). `learnIt` includes a worked numerical example with real
   numbers, not just the formula in the abstract. Flashcards include
   calculation prompts. At least one practice question per topic should be
   a full calculation with numeric answer choices.
   **Critical: every calculation answer key MUST be independently verified
   with a quick Python arithmetic check before being written into the
   file.** This session caught and fixed a real arithmetic error this way —
   don't skip this step.

Cross-referencing is the platform's signature feature: almost every
`applyIt` section explicitly names another topic already built elsewhere
("already covered under X") and explains the connection. When you build a
new topic, actively look for 1-2 existing topics it should reference, and
also consider whether *existing* topics' `applyIt` sections should be
updated to reference the new one (optional, lower priority — don't go back
and retrofit every old topic, just do it opportunistically when it's a
natural, strong connection).

## Validation — non-negotiable, every single time

Two scripts, both included in this handoff:

- **`integrity_check.py nbeo-app.jsx`** — regex-based (not a real JS
  parser). Checks: every objective in every `*_OBJECTIVES` array has a
  matching `STUDY_PAGES` entry (and vice versa — no orphans either
  direction), no duplicate flashcard/question ids, no duplicate topic id
  string values. **Run this after every topic you complete, before moving
  to the next one.**
- **`audit_coverage.py nbeo-app.jsx`** — the ground-truth coverage audit
  described above. Run this at the start of a session to know what's
  actually missing, and periodically to sanity-check PROGRESS.md's claims.

Additionally, **run a JS syntax check after every individual edit**, not
just at the end of a topic — a misplaced brace or dropped object key will
not show up in `integrity_check.py` (which is regex-based, not a real
parser) but will break the file. In the old environment this was:

```bash
npm install -g @babel/core @babel/preset-react @babel/cli   # once
node -e "
const babel = require('@babel/core');
try {
  babel.transformFileSync('nbeo-app.jsx', { presets: ['@babel/preset-react'] });
  console.log('SYNTAX OK');
} catch(e) { console.log('SYNTAX ERROR:', e.message); }
"
```
In Claude Code, if a proper Node/npm environment is available, prefer
running the actual dev server / bundler (Vite, CRA, whatever this project
uses) and watching for compile errors, or use a real linter (`eslint`) — a
real parser is strictly better than the babel-string-check hack above,
which was only necessary because the old sandbox didn't have a persistent
project setup. **This is exactly the kind of thing that should be a real
automated test / pre-commit hook now**, rather than a manually-invoked
one-off command.

## Recommended workflow going forward

1. Set up git in the project directory immediately, if not already done.
   Commit the current clean state as a baseline before making any changes.
2. Run `audit_coverage.py` to see what's missing.
3. Pick a topic (or a few related ones in the same condition area — natural
   batching since they often share cross-reference targets).
4. Add the topic constants, `TOPIC_OBJECTIVES` entry, `CONTENT_TOPICS` entry.
5. Write the `STUDY_PAGES` entries (pick the right content shape per above).
6. Write flashcards and questions.
7. Run `integrity_check.py` and a syntax check.
8. Commit.
9. Update `PROGRESS.md` with what was done (keep it accurate — this file
   has drifted from reality before; don't let it happen again).
10. Repeat.

Given git is now available, commit frequently (e.g., after each topic) so
mistakes are cheap to revert, rather than needing to manually diff/detect
corruption the way we did in the chat-based sandbox.

## Known open questions (unresolved, use judgment)

- **Emergencies/Trauma**: the NBEO outline apparently treats this as
  "embedded" across other topics rather than a standalone section — no
  dedicated topic has been built for it and no tagging strategy has been
  decided. Worth deciding on an approach (a dedicated topic vs. weaving
  trauma content into relevant existing topics) before the exam-coverage
  claim can be called fully complete.
- Some curriculum subtopics have been **deliberately merged** into a single
  built topic rather than getting their own topic slot (e.g., under
  Systemic Health Pathology, "Inflammation and repair" and "Cellular
  disease" were merged into the "Host Defenses" topic since their content
  overlapped substantially). This means the audit script's "MISSING" list
  will include a few false positives — subtopics whose *content* is already
  covered elsewhere under a different topic id. When the audit flags a
  subtopic as missing, do a quick content search before assuming it's a
  true gap (see PROGRESS.md's notes on this pattern for examples).
- **RESOLVED (2026-08-18): the official source document has been uploaded
  and merged.** The user provided the real "Part I ABS Exam Content
  Outline – Discipline-Based" PDF (44 pages). Every topic in `CURRICULUM`
  was cross-checked against it by (area, discipline) pairing — all 60
  sections and 266 topics matched positionally, with only cosmetic name
  differences (punctuation/wording) and zero real count mismatches. Each
  topic in `CURRICULUM` now carries an `objs: [...]` array with the actual
  text of its numbered knowledge objectives as printed in the outline
  (deeper lettered/roman-numeral sub-bullets are folded into the parent
  numbered objective's string, since those aren't separately counted in
  the outline's own `o:` numbering). The Blueprint page's topic bullets
  are now expandable — clicking a bullet with `objs.length > 0` reveals
  the real objective list; bullets with a single implicit objective (no
  numbered breakdown in the source, `o: 1`) stay as plain non-interactive
  rows. See PROGRESS.md for parsing/verification details if this needs
  redoing after a future CURRICULUM edit.
