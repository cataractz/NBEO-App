# CLAUDE.md

This project is an NBEO Part I ABS (optometry board exam) study platform —
a single-file React artifact, `nbeo-app.jsx`, aiming for 100% coverage of
the official NBEO Part I content outline (266 leaf topics).

**Before doing anything else, read `PROJECT_SPEC.md` in full.** It explains
the file's internal structure, the three content shapes to choose between,
the validation workflow, and the recommended way to pick up work each
session. It is not optional context — the file structure has specific
conventions (topic id numbering, cross-referencing style, etc.) that aren't
obvious from the code alone.

Then read `PROGRESS.md` for the session-by-session log of what's been done
and what's next.

Then run:
```bash
python3 audit_coverage.py nbeo-app.jsx
```
to get the actual, ground-truth current coverage state. Trust this script's
output over anything in PROGRESS.md's prose — the prose has drifted from
reality multiple times before.

## Quick facts
- Priority is **complete coverage** of every topic in the outline, not
  novelty — redundant content across topics is explicitly fine per the user.
- Every new topic needs: topic constants → `TOPIC_OBJECTIVES` entry →
  `CONTENT_TOPICS` entry → `STUDY_PAGES` entries → flashcards → questions.
- Run `integrity_check.py nbeo-app.jsx` after every completed topic.
- Run a real syntax check (build/lint/compile) after every individual file
  edit, not just at the end of a topic — corruption from a misplaced brace
  won't show up in the integrity script, which is regex-based, not a real
  parser.
- Every calculation-based practice question's answer key must be
  independently verified with actual arithmetic before being committed.
- Commit to git frequently (ideally after each completed topic) so mistakes
  are cheap to revert.
- Update PROGRESS.md accurately at the end of each session — don't let it
  drift from what `audit_coverage.py` actually reports.
