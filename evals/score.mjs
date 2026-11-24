#!/usr/bin/env node
// Score a finished run against the checks on the board.
//
//   node evals/score.mjs <transcript.json>
//
// A check is a sentence, not an assertion, so this does not pretend to judge
// wording -- it asks Claude to. What it does deterministically is make sure no
// check is silently skipped and that an enforced failure is fatal.
//
// Exits 1 if any enforced check fails, so a scheduled run can stop on it.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cases = readdirSync(here)
  .filter((f) => f.endsWith(".cases.json"))
  .flatMap((f) => {
    const file = JSON.parse(readFileSync(join(here, f), "utf8"));
    return file.cases.map((c) => ({ ...c, skill: file.skill }));
  });

const transcriptPath = process.argv[2];
if (!transcriptPath) {
  console.error("Usage: node evals/score.mjs <transcript.json>");
  console.error(`${cases.length} checks across ${new Set(cases.map((c) => c.skill)).size} skills.`);
  process.exit(1);
}
const transcript = readFileSync(transcriptPath, "utf8");

// Marks the run leaves behind: CHECK <id> pass|fail [note]
const marks = new Map();
for (const line of transcript.split("\n")) {
  const m = line.match(/CHECK\s+([\w-]+)\s+(pass|fail|n\/a)\s*(.*)/i);
  if (m) marks.set(m[1], { result: m[2].toLowerCase(), note: m[3].trim() });
}

let failed = 0;
let unscored = 0;
const lines = [];
for (const c of cases) {
  const mark = marks.get(c.id);
  if (!mark) {
    unscored += 1;
    lines.push(`  ?  ${c.id} — not scored`);
    continue;
  }
  if (mark.result === "n/a") {
    unscored += 1;
    lines.push(`  –  ${c.id} — did not arise${mark.note ? `: ${mark.note}` : ""}`);
    continue;
  }
  if (mark.result === "fail") {
    failed += 1;
    lines.push(`  ✗  ${c.id}${c.enforced ? " (enforced)" : ""} — ${mark.note || c.expect[0]}`);
  } else {
    lines.push(`  ✓  ${c.id}`);
  }
}

const enforcedFailures = cases.filter(
  (c) => c.enforced && marks.get(c.id)?.result === "fail",
);
const passed = cases.length - failed - unscored;
console.log(lines.join("\n"));
console.log(`\n${passed}/${cases.length} passed, ${failed} failed, ${unscored} not scored.`);
if (enforcedFailures.length) {
  console.log(`Enforced check failed: ${enforcedFailures.map((c) => c.id).join(", ")}.`);
  process.exit(1);
}
