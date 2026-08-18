#!/usr/bin/env python3
"""Integrity checker for nbeo-app.jsx content structures.
Regex-based (not a real JS parser) — checks:
  - orphaned objectiveIds in STUDY_PAGES / flashcards / questions (no matching entry
    in any *_OBJECTIVES array referenced by TOPIC_OBJECTIVES)
  - duplicate STUDY_PAGES keys
  - duplicate topic ids across CONTENT_TOPICS
  - duplicate flashcard ids / question ids
  - built:false among topics that appear in CONTENT_TOPICS (started topics should be true)
  - every objectiveId in *_OBJECTIVES arrays has a matching STUDY_PAGES entry
"""
import re, sys, collections

path = sys.argv[1] if len(sys.argv) > 1 else "nbeo-app.jsx"
src = open(path, encoding="utf-8").read()

errors = []
warnings = []

# 1. Collect all objective ids from *_OBJECTIVES = [ ... ]; blocks
obj_block_re = re.compile(r'const (\w+_OBJECTIVES) = \[(.*?)\n\];', re.S)
all_objective_ids = set()
objective_id_to_var = {}
dup_objective_ids = collections.Counter()
for m in obj_block_re.finditer(src):
    varname, body = m.group(1), m.group(2)
    for om in re.finditer(r'\{\s*id:\s*"([^"]+)"[^}]*?\}', body):
        oid = om.group(1)
        dup_objective_ids[oid] += 1
        all_objective_ids.add(oid)
        objective_id_to_var[oid] = varname
    for bm in re.finditer(r'\{\s*id:\s*"([^"]+)"[^}]*?built:\s*(true|false)', body):
        oid, built = bm.group(1), bm.group(2)
        if built == "false":
            warnings.append(f"objective {oid} in {varname} has built:false")

for oid, cnt in dup_objective_ids.items():
    if cnt > 1:
        errors.append(f"DUPLICATE objective id across *_OBJECTIVES arrays: {oid} ({cnt}x)")

# 2. STUDY_PAGES keys
sp_match = re.search(r'const STUDY_PAGES = \{(.*?)\n\};\n', src, re.S)
study_page_keys = []
if sp_match:
    body = sp_match.group(1)
    # top-level keys: lines like  "some-id": {
    for km in re.finditer(r'\n  "([^"]+)":\s*\{', body):
        study_page_keys.append(km.group(1))
dup_sp = [k for k, c in collections.Counter(study_page_keys).items() if c > 1]
if dup_sp:
    errors.append(f"DUPLICATE STUDY_PAGES keys: {dup_sp}")

study_page_key_set = set(study_page_keys)

# objectives missing a study page
missing_study_pages = sorted(all_objective_ids - study_page_key_set)
if missing_study_pages:
    errors.append(f"Objectives with NO STUDY_PAGES entry: {missing_study_pages}")

# study pages with no matching objective (orphaned study page)
orphan_study_pages = sorted(study_page_key_set - all_objective_ids)
if orphan_study_pages:
    errors.append(f"STUDY_PAGES entries with NO matching objective id: {orphan_study_pages}")

# 3. Flashcards
fc_block = re.search(r'const FLASHCARDS = \[(.*?)\n\];\n', src, re.S)
fc_ids = []
fc_orphan_obj = []
if fc_block:
    for fm in re.finditer(r'\{\s*id:\s*"(fc-\d+)",\s*objectiveId:\s*"([^"]+)"', fc_block.group(1)):
        fcid, oid = fm.groups()
        fc_ids.append(fcid)
        if oid not in all_objective_ids:
            fc_orphan_obj.append((fcid, oid))
dup_fc = [k for k, c in collections.Counter(fc_ids).items() if c > 1]
if dup_fc:
    errors.append(f"DUPLICATE flashcard ids: {dup_fc}")
if fc_orphan_obj:
    errors.append(f"Flashcards referencing unknown objectiveId: {fc_orphan_obj}")

# 4. Questions
q_block = re.search(r'const (?:QUESTIONS|PRACTICE_QUESTIONS) = \[(.*?)\n\];\n', src, re.S)
q_ids = []
q_orphan_obj = []
if q_block:
    for qm in re.finditer(r'id:\s*"(q-\d+)",\s*objectiveId:\s*"([^"]+)"', q_block.group(1)):
        qid, oid = qm.groups()
        q_ids.append(qid)
        if oid not in all_objective_ids:
            q_orphan_obj.append((qid, oid))
dup_q = [k for k, c in collections.Counter(q_ids).items() if c > 1]
if dup_q:
    errors.append(f"DUPLICATE question ids: {dup_q}")
if q_orphan_obj:
    errors.append(f"Questions referencing unknown objectiveId: {q_orphan_obj}")

# 5. CONTENT_TOPICS duplicate topic ids
ct_match = re.search(r'const CONTENT_TOPICS = \[(.*?)\n\];\n', src, re.S)
topic_ids = []
if ct_match:
    for tm in re.finditer(r'topicId:\s*(\w+_TOPIC_ID)', ct_match.group(1)):
        topic_ids.append(tm.group(1))
dup_topics = [k for k, c in collections.Counter(topic_ids).items() if c > 1]
if dup_topics:
    errors.append(f"DUPLICATE topic id vars in CONTENT_TOPICS: {dup_topics}")

# each *_TOPIC_ID actual string value duplicate check
topic_id_val_re = re.compile(r'const (\w+_TOPIC_ID) = "([^"]+)"')
topic_id_values = collections.defaultdict(list)
for tm in topic_id_val_re.finditer(src):
    topic_id_values[tm.group(2)].append(tm.group(1))
dup_topic_vals = {k: v for k, v in topic_id_values.items() if len(v) > 1}
if dup_topic_vals:
    errors.append(f"DUPLICATE topic id STRING values: {dup_topic_vals}")

print(f"Objectives found: {len(all_objective_ids)}")
print(f"Study pages found: {len(study_page_keys)}")
print(f"Flashcards found: {len(fc_ids)}")
print(f"Questions found: {len(q_ids)}")
print(f"Content topics found: {len(topic_ids)}")
print()

if warnings:
    print(f"WARNINGS ({len(warnings)}):")
    for w in warnings:
        print("  -", w)
    print()

if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print("  -", e)
    sys.exit(1)
else:
    print("ALL CHECKS PASSED — zero orphans, zero duplicates.")
    sys.exit(0)
