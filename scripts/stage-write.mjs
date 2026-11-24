#!/usr/bin/env node
// Stages one live tracker change, and the Launch history entry that goes with
// it, as a transaction (CLAUDE.md, "Live writes"):
//
//   1. Write the proposed change to runs/proposed.json with your file tools.
//   2. node scripts/stage-write.mjs <launch>     (or: node scripts/stage-write.mjs setup, for the header row)
//
// It checks the proposal, refuses made-up answers on a live launch, records
// the rows as they stand now, and writes runs/txn/<id>.json, which is the only
// thing the guard hook and the other scripts trust from then on. Editing the
// proposal afterwards changes nothing.
//
// runs/proposed.json:
//   {
//     "launch": "<launch>",
//     "history": { ...one Launch history entry, without txn } | null,
//     "source": "owner | relayed",          (when there is no history entry)
//     "ops": [
//       { "set": { "Task ID": "T04" }, "changes": { "Due": "2027-01-15", "Notes": "..." } },
//       { "add": { "Launch": "<launch>", "Task ID": "C01", "Task": "...", ... } }
//     ],
//     "snapshot": { "range": "Tracker!A1:V200", "values": [[...]] }   (Google Sheets: a fresh read of the whole Tracker tab)
//   }
// For the header row at setup: { "launch": "setup", "kind": "header", "snapshot": { ... the empty Tracker tab ... } }
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  DATE_COLUMNS, EXPIRY_HOURS, HEADER_SOURCE, LAUNCH_RE, LIVE_HISTORY, PROPOSED_PATH, SETUP, TRACKER_TAB,
  abs, cell, classify, colName, complete, describeDestination, fail, findRows, iso, isoDate, keyIndexes, loadPolicy,
  madeUpPaths, newTxnId, now, openTxns, pad, parseCsv, readCsvTable, readJsonFile, sameCell, sameRow, saveTxn, sheetsText, tabRead,
  valueProblem,
} from "./write-gate.mjs";

const args = process.argv.slice(2);
const launch = args[0];
if (args.length !== 1 || !(launch === SETUP || LAUNCH_RE.test(launch ?? ""))) {
  fail("Usage: node scripts/stage-write.mjs <launch>   (the launch's short name, or setup for the header row). Nothing was staged.");
}
const refuse = (why) => fail(`Not staged: ${why} Nothing was written.`);

const loaded = loadPolicy();
if (!loaded.ok) refuse(loaded.problem);
const policy = loaded.policy;

if (!existsSync(abs(PROPOSED_PATH))) refuse(`write the proposed change to ${PROPOSED_PATH} first.`);
let proposal;
try {
  proposal = readJsonFile(PROPOSED_PATH);
} catch {
  refuse(`${PROPOSED_PATH} is not valid JSON.`);
}
if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) refuse(`${PROPOSED_PATH} is not one JSON object.`);
if (proposal.launch !== launch) refuse(`${PROPOSED_PATH} is for launch ${JSON.stringify(proposal.launch)}, not ${launch}.`);

// Made-up answers never reach a live tracker or Launch history, at any depth.
const madeUp = madeUpPaths(proposal);
if (madeUp.length) {
  refuse(`${madeUp.join(", ")} ${madeUp.length === 1 ? "is" : "are"} "made-up". A live launch's tracker and Launch history take only what owners and deciders actually said. Ask them, or run the scenario as a practice launch.`);
}

const open = openTxns(launch);
if (open.length) refuse(`transaction ${open[0].id} is still open for ${launch}. Finish it first: read the rows back and run node scripts/reconcile.mjs ${open[0].id} (or discard it there, if nothing was written).`);

const dest = policy.live_tracker;
if (!dest) refuse("the live tracker is not bound to a sheet or file with a location. Bind it with node scripts/bind-system.mjs sys-tracker <connector> <location>.");
if (classify(policy, dest) !== "live") refuse(`${describeDestination(dest)} is registered as a practice tracker too; a person should look at ${"setup/policy.json"}.`);

const created = now();
const txn = {
  id: newTxnId(launch),
  launch,
  status: "open",
  created_at: created.toISOString(),
  expires_at: iso(new Date(created.getTime() + EXPIRY_HOURS * 3600 * 1000)),
  mode: "live",
  destination: dest,
  source: null,
  history: null,
  ops: [],
  log: [{ at: iso(created), event: "staged" }],
};

// ── the header row, at setup ────────────────────────────────────────────────
if (launch === SETUP) {
  if (proposal.kind !== "header") refuse(`a setup transaction only writes the header row: set "kind": "header".`);
  if (proposal.history || (proposal.ops ?? []).length) refuse("a setup transaction has no history entry and no row operations.");
  if (dest.kind !== "sheets") refuse(`${describeDestination(dest)} is a file that already has its header row.`);
  const values = tabRead(proposal.snapshot, `${PROPOSED_PATH} snapshot`);
  if (values.some((row) => row.some((v) => v !== ""))) refuse(`the ${TRACKER_TAB} tab is not empty. The header is written only into an empty tab; read its header and compare it with tracker/README.md instead.`);
  const header = parseCsv(readFileSync(abs(HEADER_SOURCE), "utf8"))[0];
  if (!header?.length) refuse(`${HEADER_SOURCE} has no header row.`);
  txn.kind = "header";
  txn.source = "owner";
  txn.ops = [{ n: 1, state: "authorized", tool: "update_values", spreadsheetId: dest.spreadsheetId, range: `${TRACKER_TAB}!A1:${colName(header.length)}1`, values: [header], before: [pad([], header.length)] }];
  saveTxn(txn);
  printCalls(txn);
  process.exit(0);
}

// ── a launch's change ───────────────────────────────────────────────────────
const registered = policy.launches[launch];
if (!registered) refuse(`launch ${launch} is not registered in setup/policy.json. Register it with node scripts/set-mode.mjs ${launch} live (or practice).`);
if (registered.mode !== "live") refuse(`${launch} is a practice launch. Practice writes go straight to its own tracker and to Practice history; there is nothing to stage.`);

// The history entry: checked against Launch history's contract now, so a
// tracker write never happens for an entry history would refuse.
const history = proposal.history ?? null;
if (history !== null) {
  if (typeof history !== "object" || Array.isArray(history)) refuse("history must be one Launch history entry, or null.");
  if (history.launch !== launch) refuse(`the history entry is for launch ${JSON.stringify(history.launch)}, not ${launch}.`);
  if ("txn" in history || "staged_as" in history) refuse("leave txn and staged_as out of the history entry; the transaction sets them.");
  const { CONTRACTS, FIELDS, validateEntry } = await import("./entry-contracts.mjs");
  const missing = (FIELDS?.[LIVE_HISTORY] ?? []).filter((f) => !(f in history));
  const problems = [...missing.map((f) => `${f} is missing`), ...validateEntry(CONTRACTS[LIVE_HISTORY], history)];
  if (problems.length) refuse(`Launch history would not take the entry: ${problems.join("; ")}.`);
}
const source = history?.source ?? proposal.source;
if (!["owner", "relayed"].includes(source)) refuse(`say where the change came from: "source": "owner" or "relayed" (on the history entry, or at the top when there is none).`);
txn.source = source;
txn.history = history;

const ops = proposal.ops ?? [];
if (!Array.isArray(ops)) refuse("ops must be a list.");
if (!ops.length && !history && !proposal.calc_effects) refuse("there is nothing to stage: no tracker operations and no history entry.");
for (const [i, op] of ops.entries()) {
  if (op?.source !== undefined && !["owner", "relayed"].includes(op.source)) refuse(`ops[${i}].source must be owner or relayed.`);
  const forms = ["set", "add"].filter((k) => k in (op ?? {}));
  if (forms.length !== 1) refuse(`ops[${i}] must be either { "set": { "Task ID": ... }, "changes": { ... } } or { "add": { ...row } }.`);
}

const FIXED = ["Launch", "Task ID", "Original due"];
let rawRows = [];
const table = dest.kind === "csv" ? readCsvTable(dest.path) : sheetsTable();
const { header, rows } = table;
const [li, ti] = keyIndexes(header, describeDestination(dest));
const hadRows = rows.some((r) => cell(r[li]) === launch);

// An approved re-plan's row changes come from the launch calculator, not from
// the agent's own arithmetic: "calc_effects": { "rules", "option", "as_of" }
// runs node scripts/launch-calc.mjs effects on the tracker as it stands now,
// and its row_changes and new_rows become operations here. The agent's own
// ops (Notes with the old dates, say) are merged in; a column both set
// differently is refused.
if (proposal.calc_effects !== undefined) {
  const ce = proposal.calc_effects;
  const CALC_PATH = /^(launches|practice|tracker|playbook)\/[A-Za-z0-9._\/-]+\.json$/;
  if (!ce || typeof ce !== "object") refuse(`calc_effects must be { "rules": "launches/<launch>/rules-v<n>.json", "option": "launches/<launch>/option-v<n>[-<A>].json", "as_of": "YYYY-MM-DD" }.`);
  for (const k of ["rules", "option"]) if (typeof ce[k] !== "string" || !CALC_PATH.test(ce[k]) || ce[k].includes("..")) refuse(`calc_effects.${k} must be a .json path under launches/, practice/, tracker/, or playbook/.`);
  if (typeof ce.as_of !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ce.as_of)) refuse("calc_effects.as_of must be a date, YYYY-MM-DD.");
  if (!existsSync(abs("scripts/launch-calc.mjs"))) refuse("scripts/launch-calc.mjs is not in this folder.");
  // The calculator reads the rows from the launch's own folder, whatever the
  // tracker is: a Sheets read, or a CSV bound anywhere in this folder.
  const rowsPath = `launches/${launch}/tracker-read.json`;
  mkdirSync(abs(`launches/${launch}`), { recursive: true });
  writeFileSync(abs(rowsPath), JSON.stringify([header, ...rows]));
  const calc = spawnSync(process.execPath, [abs("scripts/launch-calc.mjs"), "effects", "--rules", ce.rules, "--rows", rowsPath, "--option", ce.option, "--as-of", ce.as_of], { cwd: abs("."), encoding: "utf8" });
  let out;
  try {
    out = JSON.parse(calc.stdout);
  } catch {
    refuse(`the launch calculator did not answer: ${(calc.stderr || calc.stdout).trim()}`);
  }
  if (!out.ok) refuse(`the launch calculator refused: ${out.refused ?? (out.errors ?? []).join("; ")}`);
  if (out.launch !== launch) refuse(`the calculator's rules are for launch ${out.launch}, not ${launch}.`);
  const byTask = new Map();
  for (const c of out.row_changes ?? []) {
    if (c.launch !== launch) refuse(`the calculator changes a row of launch ${c.launch}.`);
    const found = findRows(rows, header, launch, c.task, describeDestination(dest));
    if (found.length === 1 && header.includes(c.column) && !sameCell(found[0].r[header.indexOf(c.column)], c.old, c.column)) {
      refuse(`${c.task}'s ${c.column} is ${JSON.stringify(cell(found[0].r[header.indexOf(c.column)]))} in the tracker, but the calculator worked from ${JSON.stringify(cell(c.old))}. Read the tracker again and rerun.`);
    }
    if (!header.includes(c.column)) continue;
    const changes = byTask.get(c.task) ?? {};
    changes[c.column] = cell(c.new);
    byTask.set(c.task, changes);
  }
  for (const op of ops) {
    const task = op.set ? cell(op.set["Task ID"]) : null;
    if (!task || !byTask.has(task)) continue;
    const calcChanges = byTask.get(task);
    for (const [col, v] of Object.entries(op.changes ?? {})) {
      if (col in calcChanges && cell(v) !== calcChanges[col]) refuse(`${task}'s ${col}: your change says ${JSON.stringify(cell(v))}, the calculator says ${JSON.stringify(calcChanges[col])}. Take the calculator's.`);
    }
    op.changes = { ...op.changes, ...calcChanges };
    byTask.delete(task);
  }
  for (const [task, changes] of byTask) ops.push({ set: { "Task ID": task }, changes });
  for (const r of out.new_rows ?? []) {
    if (!ops.some((op) => op.add && cell(op.add["Task ID"]) === cell(r["Task ID"]))) ops.push({ add: Object.fromEntries(Object.entries(r).filter(([k]) => header.includes(k))) });
  }
  txn.calc = { rules: ce.rules, option: ce.option, as_of: ce.as_of, proposes: out.proposes ?? null };
}
const seen = new Set();
const adds = [];
for (const [i, op] of ops.entries()) {
  if (op.set) {
    const task = cell(op.set["Task ID"]);
    if (!task) refuse(`ops[${i}].set needs the row's "Task ID".`);
    const found = findRows(rows, header, launch, task, describeDestination(dest));
    if (found.length !== 1) refuse(`ops[${i}]: ${found.length ? "more than one row" : "no row"} has Launch ${launch} and Task ID ${task}.`);
    if (!op.changes || typeof op.changes !== "object" || !Object.keys(op.changes).length) refuse(`ops[${i}] has no changes.`);
    const changes = {};
    for (const [col, value] of Object.entries(op.changes)) {
      if (!header.includes(col)) refuse(`ops[${i}]: the tracker has no column ${JSON.stringify(col)}.`);
      if (FIXED.includes(col)) refuse(`ops[${i}]: ${col} never changes after the load.`);
      if (value !== null && typeof value === "object") refuse(`ops[${i}].changes.${col} must be text.`);
      const problem = valueProblem(col, value);
      if (problem) refuse(`ops[${i}] (${task}): ${problem}.`);
      changes[col] = { old: cell(found[0].r[header.indexOf(col)]), new: cell(value) };
    }
    if (seen.has(task)) refuse(`ops[${i}]: Task ID ${task} is changed twice; put both changes in one op.`);
    seen.add(task);
    txn.ops.push({ n: txn.ops.length + 1, state: "authorized", kind: "set", key: { launch, task }, changes, row: found[0].i, ...(op.source ? { source: op.source } : {}) });
  } else {
    const row = op.add;
    if (!row || typeof row !== "object" || Array.isArray(row)) refuse(`ops[${i}].add must be one row, by column name.`);
    for (const col of Object.keys(row)) if (!header.includes(col)) refuse(`ops[${i}]: the tracker has no column ${JSON.stringify(col)}.`);
    for (const [col, value] of Object.entries(row)) {
      if (value !== null && typeof value === "object") refuse(`ops[${i}].add.${col} must be text.`);
      const problem = valueProblem(col, value);
      if (problem) refuse(`ops[${i}] (${cell(row["Task ID"]) || "a new row"}): ${problem}.`);
    }
    if (cell(row.Launch ?? launch) !== launch) refuse(`ops[${i}]: Launch must be ${launch}.`);
    const task = cell(row["Task ID"]);
    if (!task) refuse(`ops[${i}].add needs a Task ID.`);
    if (seen.has(task)) refuse(`ops[${i}]: Task ID ${task} appears twice in this change.`);
    seen.add(task);
    const full = header.map((h) => (h === "Launch" ? launch : cell(row[h])));
    const existing = findRows(rows, header, launch, task, describeDestination(dest));
    if (existing.length) {
      // Appends are idempotent by Launch + Task ID: a row already there as
      // intended is skipped; one that differs is a change, not an add.
      if (existing.length === 1 && sameRow(existing[0].r, full, header.length, header)) continue;
      refuse(`ops[${i}]: a row with Launch ${launch} and Task ID ${task} already exists and differs. Change it with a set operation instead.`);
    }
    adds.push({ task, full, source: op.source });
  }
}

// The initial load needs the plan approval the launch lead gave by name.
if (!hadRows && adds.length) {
  const named = history && history.type === "decision" && /\bplan-v(\d+)\b/.exec(String(history.decision ?? ""));
  if (!named || !cell(history.decided_by) || !cell(history.words)) {
    refuse(`this is ${launch}'s first load into the tracker, and it needs the plan approval the launch lead gave by name as its history entry: type "decision", decision naming the version ("plan-v1"), decided_by, and their exact words. With no named approval there is no load.`);
  }
  if (!existsSync(abs(`launches/${launch}/plan-v${named[1]}.md`))) refuse(`launches/${launch}/plan-v${named[1]}.md does not exist, so plan-v${named[1]} cannot have been approved.`);
  txn.kind = "load";
} else txn.kind = txn.ops.length || adds.length ? "update" : "history";

if (adds.length) {
  if (dest.kind === "csv") {
    for (const a of adds) txn.ops.push({ n: txn.ops.length + 1, state: "authorized", kind: "add", key: { launch, task: a.task }, row: a.full, ...(a.source ? { source: a.source } : {}) });
  } else {
    txn.ops.push({ n: txn.ops.length + 1, state: "authorized", tool: "append_values", spreadsheetId: dest.spreadsheetId, range: `${TRACKER_TAB}!A1`, values: adds.map((a) => forSheets(a.full)), keys: adds.map((a) => [launch, a.task]) });
  }
}
if (dest.kind === "sheets") {
  // Each changed row is written whole, from the row as it stands now.
  for (const op of txn.ops.filter((o) => o.kind === "set")) {
    const r = op.row + 2;
    const after = pad(rows[op.row], header.length).slice(0, header.length);
    for (const [col, ch] of Object.entries(op.changes)) after[header.indexOf(col)] = ch.new;
    // The before-image is the row as the read gave it; the row written is whole, in canonical form.
    const before = pad(rawRows[op.row], header.length).slice(0, header.length);
    Object.assign(op, { tool: "update_values", spreadsheetId: dest.spreadsheetId, range: `${TRACKER_TAB}!A${r}:${colName(header.length)}${r}`, values: [forSheets(after)], before: [before] });
  }
}
txn.ops.forEach((op, i) => (op.n = i + 1));
if (!txn.ops.length && !history) refuse("every row is already as proposed; there is nothing to stage.");
saveTxn(txn);

if (!txn.ops.length) {
  console.log(complete(txn));
  process.exit(0);
}
printCalls(txn);

function sheetsTable() {
  const values = tabRead(proposal.snapshot, `${PROPOSED_PATH} snapshot`);
  if (!values.length) refuse(`the ${TRACKER_TAB} tab has no header row. Write it first with a setup transaction.`);
  const head = values[0];
  rawRows = values.slice(1);
  // A Sheets read gives dates back as serial numbers or M/D/YYYY when the
  // cells are formatted that way; the rows here hold them as YYYY-MM-DD.
  return { header: head, rows: rawRows.map((r) => r.map((v, i) => (DATE_COLUMNS.includes(head[i]) ? (isoDate(v) ?? v) : v))) };
}

/** A row as written to a Sheet (USER_ENTERED): dates as YYYY-MM-DD, and text
 *  Sheets would reinterpret (007, 1/2, =x) kept as text with an apostrophe. */
function forSheets(row) {
  return row.map((v, i) => (DATE_COLUMNS.includes(header[i]) ? (isoDate(v) ?? cell(v)) : sheetsText(v)));
}

function printCalls(t) {
  console.log(`Staged transaction ${t.id} for ${t.launch === SETUP ? "the tracker's header row" : t.launch} (${t.kind}, source ${t.source}), ${t.ops.length} operation${t.ops.length === 1 ? "" : "s"} on ${describeDestination(t.destination)}. It expires ${t.expires_at}.`);
  if (t.destination.kind === "csv") {
    console.log(`Next: node scripts/tracker-write.mjs ${t.id}`);
    return;
  }
  console.log("Make these Google Sheets calls, in this order, with exactly these arguments. Any other write is blocked:");
  for (const op of t.ops) console.log(`${op.n}. ${op.tool} ${JSON.stringify({ spreadsheetId: op.spreadsheetId, range: op.range, values: op.values })}`);
  if (t.ops.some((op) => op.values.some((r) => r.some((v) => String(v).startsWith("'"))))) {
    console.log("A value starting with an apostrophe (') keeps it as text, so Sheets does not turn it into a number or a date; send it exactly as shown. The read-back shows it without the apostrophe.");
  }
  console.log(`Then read the whole ${TRACKER_TAB} tab back with get_values, write { "range": ..., "values": ... } from that read to runs/readback.json, and run node scripts/reconcile.mjs ${t.id}.${t.history ? " The history entry is added when every operation is verified." : ""}`);
}
