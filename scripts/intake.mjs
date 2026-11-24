#!/usr/bin/env node
// Changes a launch's intake answers in both places they are kept, then reads both back.
//
//   node scripts/intake.mjs set <launch> <field> <value> [<field> <value> ...]
//   node scripts/intake.mjs get <launch> [<field>]
//
// <field> is a key from the list below (pm, ea, exec-sponsor, ...) or the intake
// row's name ("Exec sponsor"). It updates the row that already exists in
// launches/<launch>/intake.md and the matching value in the launch's entry in
// setup/state.json, and refuses an unknown launch, an unknown field, a row the
// intake does not have, or a value that would break the table. It never adds a
// row and never touches another launch. It needs no packages.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const STATE = "setup/state.json";
const MAX_VALUE = 500;
const MAX_PAIRS = 40;

// key: [intake row names (first is the template's), setup/state.json path or null, kind]
// A null path is kept in the intake only.
const FIELDS = {
  product: [["Product name"], ["product"], "text"],
  audience: [["Who it is for, and the problem it solves"], null, "text"],
  tier: [["Tier (1, 2, or 3)", "Tier"], ["tier"], "tier"],
  ea: [["Early access or beta date"], ["ea"], "date"],
  ga: [["General availability date"], ["ga"], "date"],
  goals: [["Launch goals"], null, "text"],
  "success-metric": [["Success metric, baseline, target", "Success metric"], null, "text"],
  "measured-by": [["Measured by"], null, "text"],
  "launch-lead": [["Launch lead"], ["launch_lead"], "text"],
  "exec-sponsor": [["Exec sponsor"], ["exec_sponsor"], "text"],
  "decides-gates": [["Decides the gates"], ["decides", "gate"], "text"],
  "decides-slip": [["Decides a slip"], ["decides", "slip"], "text"],
  pm: [["PM"], ["seats", "pm"], "seat"],
  pmm: [["PMM"], ["seats", "pmm"], "seat"],
  enablement: [["Enablement"], ["seats", "enablement"], "seat"],
  "sales-engineering": [["Sales engineering"], ["seats", "sales_engineering"], "seat"],
  "customer-success": [["Customer success"], ["seats", "customer_success"], "seat"],
  "pricing-and-packaging": [["Pricing and packaging"], ["seats", "pricing_and_packaging"], "seat"],
  legal: [["Legal"], ["seats", "legal"], "seat"],
  "pricing-status": [["Pricing and packaging status"], null, "text"],
  "holiday-rule": [["Holiday rule"], ["holiday_rule"], "text"],
  constraints: [["Known constraints"], null, "text"],
  "analysts-press": [["Analyst firms and press to brief"], null, "text"],
  "meeting-day": [["Weekly meeting day"], null, "text"],
  "steering-committee": [["Steering committee"], null, "text"],
  "report-goes": [["Where the report goes"], null, "text"],
  escalation: [["Escalation beyond the launch team"], null, "text"],
};

// Rows this script will not change, and why.
const REFUSED = {
  "launch short name": "the short name names every file for this launch; set up a new launch instead",
  "live launch or practice": "a launch's mode does not change once set; a practice launch is a new launch (first-run section 1a)",
  "live launch or test run": "a launch's mode does not change once set; a practice launch is a new launch (first-run section 1a)",
  "launch tracker": "a system location is bound with node scripts/bind-system.mjs (first-run section 2)",
  "shared launch folder": "a system location is bound with node scripts/bind-system.mjs (first-run section 2)",
  playbook: "a system location is bound with node scripts/bind-system.mjs (first-run section 2)",
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const usage = "Usage: node scripts/intake.mjs set <launch> <field> <value> [<field> <value> ...]\n       node scripts/intake.mjs get <launch> [<field>]\nFields: " + Object.keys(FIELDS).join(", ");

function fieldKey(name) {
  const wanted = name.trim().toLowerCase();
  if (FIELDS[wanted]) return wanted;
  for (const [key, [labels]] of Object.entries(FIELDS)) if (labels.some((l) => l.toLowerCase() === wanted)) return key;
  if (REFUSED[wanted]) fail(`"${name}" is not changed here: ${REFUSED[wanted]}.`);
  return fail(`Unknown field "${name}". ${usage}`);
}

function checkValue(key, value) {
  const kind = FIELDS[key][2];
  if (typeof value !== "string" || !value.trim()) fail(`${key}: give a value. Use "unowned" for a seat with nobody in it.`);
  if (value.length > MAX_VALUE) fail(`${key}: the value is ${value.length} characters; the limit is ${MAX_VALUE}.`);
  if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${key}: the value has a line break or a control character; an intake answer is one line.`);
  const v = value.trim();
  if (kind === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!m || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) fail(`${key}: "${v}" is not a date as YYYY-MM-DD.`);
  }
  if (kind === "tier" && !/^[123]$/.test(v)) fail(`${key}: the tier is 1, 2, or 3.`);
  return v;
}

/** Splits a markdown table row on the pipes that are not escaped. */
function cells(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((c) => c.trim());
}
const escapeCell = (v) => v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
const unescapeCell = (v) => v.replace(/\\([\\|])/g, "$1");

function readState() {
  if (!existsSync(STATE)) fail(`No ${STATE} here, so no launch is set up yet. Run the first-run setup first.`);
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch (e) {
    return fail(`${STATE} is not valid JSON (${e.message}). Nothing was changed.`);
  }
}

function intakePath(launch, entry) {
  // Forward slashes on every platform: path.normalize on Windows gives backslashes,
  // which never start with "launches/". ".." is checked on the segments as given.
  const given = (typeof entry.intake === "string" && entry.intake ? entry.intake : `launches/${launch}/intake.md`).replace(/\\/g, "/");
  const path = posix.normalize(given);
  if (given.split("/").includes("..") || posix.isAbsolute(path) || /^[A-Za-z]:/.test(path) || !path.startsWith("launches/") || !path.endsWith(".md")) fail(`The intake path for "${launch}" in ${STATE} (${path}) is not a file under launches/.`);
  if (!existsSync(path)) fail(`No intake file at ${path}. Nothing was changed.`);
  return path;
}

/** The index of the one table row for a field, and the column that holds the answer. */
function findRow(lines, key, path) {
  const labels = FIELDS[key][0].map((l) => l.toLowerCase());
  const header = lines.findIndex((l) => l.trim().startsWith("|") && cells(l)[0].toLowerCase() === "field");
  if (header === -1) fail(`${path} has no intake table (a header row starting "| Field |"). Nothing was changed.`);
  const answerCol = cells(lines[header]).findIndex((c) => /answer/i.test(c));
  if (answerCol < 1) fail(`${path}: the intake table has no answer column. Nothing was changed.`);
  const hits = [];
  for (let i = header + 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    if (labels.includes(cells(lines[i])[0].toLowerCase())) hits.push(i);
  }
  if (hits.length === 0) fail(`${path} has no "${FIELDS[key][0][0]}" row. This script changes rows that exist and never adds one. Nothing was changed.`);
  if (hits.length > 1) fail(`${path} has ${hits.length} "${FIELDS[key][0][0]}" rows (lines ${hits.map((h) => h + 1).join(", ")}). Fix the file by hand first. Nothing was changed.`);
  return { index: hits[0], answerCol };
}

function stateValue(entry, path) {
  return path.reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), entry);
}

function setStateValue(entry, path, value) {
  let o = entry;
  for (const k of path.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== "object") o[k] = {};
    o = o[k];
  }
  o[path[path.length - 1]] = value;
}

const writeAtomic = (path, text) => {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
};

function show(launch, keys) {
  const state = readState();
  const entry = state.launches?.[launch];
  const path = intakePath(launch, entry);
  const lines = readFileSync(path, "utf8").split("\n");
  const out = [];
  for (const key of keys) {
    const { index, answerCol } = findRow(lines, key, path);
    const answer = unescapeCell(cells(lines[index])[answerCol] ?? "");
    const mirror = FIELDS[key][1];
    const saved = mirror ? stateValue(entry, mirror) : undefined;
    out.push({ key, row: FIELDS[key][0][0], answer, state: mirror ? { path: `launches.${launch}.${mirror.join(".")}`, value: saved ?? null } : null });
  }
  return { path, out };
}

function print({ path, out }) {
  for (const r of out) {
    console.log(`${r.key}`);
    console.log(`  ${path}, row "${r.row}": ${r.answer === "" ? "(empty)" : r.answer}`);
    console.log(`  ${STATE}, ${r.state ? `${r.state.path}: ${JSON.stringify(r.state.value)}` : "not kept there"}`);
  }
}

const [command, launch, ...rest] = process.argv.slice(2);
if (command !== "set" && command !== "get") fail(usage);
if (!launch || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(launch)) fail(`Give the launch short name (lowercase letters, digits and hyphens). ${usage}`);
const state = readState();
const known = Object.keys(state.launches ?? {});
if (!known.includes(launch)) fail(`Unknown launch "${launch}". ${STATE} has: ${known.join(", ") || "none"}. Nothing was changed.`);

if (command === "get") {
  if (rest.length > 1) fail(usage);
  let keys = rest.length ? [fieldKey(rest[0])] : Object.keys(FIELDS);
  if (!rest.length) {
    // Every field the intake has a row for.
    const lines = readFileSync(intakePath(launch, state.launches[launch]), "utf8").split("\n");
    const rowNames = new Set(lines.filter((l) => l.trim().startsWith("|")).map((l) => cells(l)[0].toLowerCase()));
    keys = keys.filter((k) => FIELDS[k][0].some((l) => rowNames.has(l.toLowerCase())));
  }
  print(show(launch, keys));
  process.exit(0);
}

if (rest.length === 0 || rest.length % 2 !== 0) fail(`Give a field and a value, or several pairs. ${usage}`);
if (rest.length / 2 > MAX_PAIRS) fail(`At most ${MAX_PAIRS} fields at once.`);
const changes = [];
for (let i = 0; i < rest.length; i += 2) {
  const key = fieldKey(rest[i]);
  if (changes.some((c) => c.key === key)) fail(`${key} is given twice. Nothing was changed.`);
  changes.push({ key, value: checkValue(key, rest[i + 1]) });
}

// Every check runs before either file is written.
const entry = state.launches[launch];
const path = intakePath(launch, entry);
const text = readFileSync(path, "utf8");
const lines = text.split("\n");

// Once a plan version is approved, the dates and tier are its anchors: changing one is a re-plan.
const planChanges = changes.filter((c) => ["ea", "ga", "tier"].includes(c.key));
if (entry.plan_approved && planChanges.length) {
  fail(`${planChanges.map((c) => c.key).join(", ")}: plan ${entry.plan_approved} is approved for ${launch}, and after approval a date or tier change is a re-plan. Draft it with draft-replan; the intake follows once the launch lead approves the new plan version. Nothing was changed.`);
}
// Early access comes before general availability, whichever of the two is changed.
if (changes.some((c) => c.key === "ea" || c.key === "ga")) {
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const current = (key) => {
    const given = changes.find((c) => c.key === key);
    if (given) return given.value;
    const saved = stateValue(entry, FIELDS[key][1]);
    if (isDate(saved)) return saved;
    const labels = FIELDS[key][0].map((l) => l.toLowerCase());
    const header = lines.findIndex((l) => l.trim().startsWith("|") && cells(l)[0].toLowerCase() === "field");
    const answerCol = header === -1 ? -1 : cells(lines[header]).findIndex((c) => /answer/i.test(c));
    for (let i = header + 2; header !== -1 && answerCol > 0 && i < lines.length && lines[i].trim().startsWith("|"); i++) {
      const c = cells(lines[i]);
      const answer = unescapeCell(c[answerCol] ?? "").trim();
      if (labels.includes(c[0].toLowerCase()) && isDate(answer)) return answer;
    }
    return null;
  };
  const ea = current("ea");
  const ga = current("ga");
  if (ea && ga && ga <= ea) {
    const which = changes.some((c) => c.key === "ga") ? `GA ${ga} is not after EA ${ea}` : `EA ${ea} is not before GA ${ga}`;
    fail(`${which}: early access comes before general availability. If both move, set ea and ga together. Nothing was changed.`);
  }
}
for (const { key, value } of changes) {
  const { index, answerCol } = findRow(lines, key, path);
  const row = cells(lines[index]);
  row[answerCol] = escapeCell(value);
  lines[index] = `| ${row.join(" | ")} |`;
  const mirror = FIELDS[key][1];
  if (mirror) setStateValue(entry, mirror, FIELDS[key][2] === "tier" ? Number(value) : value);
}
writeAtomic(path, lines.join("\n"));
writeAtomic(STATE, `${JSON.stringify(state, null, 2)}\n`);

// Read both back from disk, and fail loudly if either does not hold what was asked.
const back = show(launch, changes.map((c) => c.key));
print(back);
const wrong = back.out.filter((r, i) => r.answer !== changes[i].value || (r.state && String(r.state.value) !== changes[i].value));
if (wrong.length) fail(`Read-back does not match for: ${wrong.map((r) => r.key).join(", ")}. Check both files.`);
console.log(`Updated ${changes.length} field${changes.length === 1 ? "" : "s"} for ${launch} in ${path} and ${STATE}.`);
