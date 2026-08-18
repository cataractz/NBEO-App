#!/usr/bin/env python3
"""
Structural coverage audit for nbeo-app.jsx.

Parses the CONTENT_TOPICS_TREE (the `{ area: "...", sections: [...] }` array
near the top of the file) directly out of the source, and cross-references
every leaf topic's implied id (t-{area}-{section}-{topic}, 0-indexed) against
every `*_TOPIC_ID = "t-..."` constant actually declared in the file.

This is the ground-truth check for "what's built vs. not" — trust this over
any prose summary in PROGRESS.md, which can and has drifted from reality.

Usage: python3 audit_coverage.py [path/to/nbeo-app.jsx]
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "nbeo-app.jsx"
src = open(path, encoding="utf-8").read()

# Extract the AREAS array block. It starts at "const CONTENT_TOPICS_TREE = ["
# or similar and each area is `{ area: "...", major: ..., range: [...], sections: [ ... ] }`
# We parse loosely with regex rather than a real JS parser.

area_re = re.compile(r'\{\s*area:\s*"([^"]+)".*?sections:\s*\[(.*?)\]\s*\}\s*,?\s*\n(?=\s*\{ area:|\s*\];)', re.S)
section_re = re.compile(r'\{\s*d:\s*"([^"]+)",\s*topics:\s*\[(.*?)\]\s*\}', re.S)
topic_re = re.compile(r'\{\s*n:\s*"([^"]+)"')

# Find the full tree text: from the first "{ area:" to the closing "];" of that array.
tree_start = src.find('{ area:')
if tree_start == -1:
    print("ERROR: could not find CONTENT_TOPICS_TREE start ('{ area:') in file.")
    sys.exit(1)
tree_end = src.find('\n];', tree_start)
tree_src = src[tree_start:tree_end]

areas = []
for am in re.finditer(r'\{\s*area:\s*"([^"]+)".*?sections:\s*\[(.*?)\n  \]\s*\}', tree_src, re.S):
    area_name = am.group(1)
    sections_src = am.group(2)
    sections = []
    for sm in section_re.finditer(sections_src):
        sec_name = sm.group(1)
        topics_src = sm.group(2)
        topics = [tm.group(1) for tm in topic_re.finditer(topics_src)]
        sections.append((sec_name, topics))
    areas.append((area_name, sections))

if not areas:
    print("ERROR: parsed 0 areas — the regex may not match this file's formatting.")
    print("Fall back to manual audit (see PROJECT_SPEC.md for the last known-good tree).")
    sys.exit(1)

# Built topic ids: every `_TOPIC_ID = "t-X-Y-Z"` constant in the file.
built = set(re.findall(r'_TOPIC_ID\s*=\s*"(t-\d+-\d+-\d+)"', src))

total = 0
built_count = 0
lines = []
for ai, (area_name, sections) in enumerate(areas):
    area_total = 0
    area_built = 0
    missing = []
    for si, (sec_name, topics) in enumerate(sections):
        for ti, topic_name in enumerate(topics):
            tid = f"t-{ai}-{si}-{ti}"
            area_total += 1
            total += 1
            if tid in built:
                area_built += 1
                built_count += 1
            else:
                missing.append(f"    MISSING {tid}  [{sec_name}] {topic_name}")
    status = "COMPLETE" if area_built == area_total else f"{area_built}/{area_total}"
    lines.append(f"=== [{ai}] {area_name}: {status} ===")
    lines.extend(missing)
    lines.append("")

print(f"TOTAL: {built_count}/{total} topics built ({total - built_count} remaining)\n")
print("\n".join(lines))
