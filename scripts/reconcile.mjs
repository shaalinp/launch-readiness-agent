#!/usr/bin/env node
// Moves a live write transaction on from a read-back (CLAUDE.md, "Live writes").
//
//   node scripts/reconcile.mjs <txn>             after the Sheets calls: reads runs/readback.json,
//                                                a fresh get_values of the whole Tracker tab; for a CSV
//                                                tracker it reads the file itself
//   node scripts/reconcile.mjs <txn> --discard   closes a transaction nothing was written for
//   node scripts/reconcile.mjs <txn> --abandon   closes a partly written one, only when the launch lead says so;
//                                                no history entry is added
//   node scripts/reconcile.mjs --status          lists open transactions (also run at session start)
//
// Each attempted operation becomes verified (its values are there),
// not-applied (the old values are there; it may be tried again), or conflict
// (neither; the launch lead decides, it is never reset). A conflict is judged
// again from a read made after it was found, and becomes verified if the
// intended values are there after all; otherwise it stays a conflict. When
// every operation is verified, the history entry stored in the transaction is
// added, once, and the transaction closes (and moves to runs/txn/closed/).
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  READBACK_PATH, SETUP, abs, complete, describeDestination, exitIfClosed, expired, fail, iso, listTxns, loadCsvTable, loadPolicy, loadTxn,
  note, openTxns, readCsvTable, readJsonFile, saveTxn, settle, tabRead,
} from "./write-gate.mjs";

const args = process.argv.slice(2);
const usage = "Usage: node scripts/reconcile.mjs <txn> [--discard | --abandon], or node scripts/reconcile.mjs --status";

if (args[0] === "--status" || args[0] === "--session-start") {
  if (args.length !== 1) fail(usage);
  status(args[0] === "--session-start");
  process.exit(0);
}
if (args.length < 1 || args.length > 2 || (args[1] && !["--discard", "--abandon"].includes(args[1]))) fail(usage);
const txn = loadTxn(args[0]);
exitIfClosed(txn);

if (args[1] === "--discard") {
  const touched = txn.ops.filter((o) => o.state !== "authorized");
  if (touched.length) fail(`Not discarded: operation${touched.length === 1 ? "" : "s"} ${touched.map((o) => `${o.n} (${o.state})`).join(", ")} may have been written. Read back and reconcile first; if the tracker is partly changed, the launch lead decides, and --abandon closes it on their word.`);
  txn.status = "discarded";
  txn.closed_at = iso();
  note(txn, "discarded");
  saveTxn(txn);
  console.log(`Transaction ${txn.id} is discarded. Nothing was written to the tracker or to Launch history.`);
  process.exit(0);
}
if (args[1] === "--abandon") {
  txn.status = "abandoned";
  txn.closed_at = iso();
  note(txn, `abandoned with operations ${txn.ops.map((o) => `${o.n} ${o.state}`).join(", ") || "none"}`);
  saveTxn(txn);
  console.log(`Transaction ${txn.id} is abandoned on the launch lead's word. Its history entry was not added. Operations as they stood: ${txn.ops.map((o) => `${o.n} ${o.state}`).join(", ") || "none"}.`);
  process.exit(0);
}

const attempted = txn.ops.filter((o) => o.state === "attempted");
const conflicts = txn.ops.filter((o) => o.state === "conflict");
let changed = 0;
if (attempted.length || conflicts.length) {
  const got = readFor(txn, attempted.length > 0);
  if (got) changed = settle(txn, got.read, got.at);
}
note(txn, `reconciled ${changed} operation${changed === 1 ? "" : "s"}`);
saveTxn(txn);
console.log(summary(txn));
const done = complete(txn);
if (done) console.log(done);
else console.log(nextStep(txn));

/** { read, at } for the transaction's tracker, or null when only conflicts
 *  are waiting and there is no read-back to look at them with. */
function readFor(t, required) {
  if (t.destination.kind === "csv") return { read: readCsvTable(t.destination.path), at: Date.now() };
  if (!existsSync(abs(READBACK_PATH))) {
    if (!required) return null;
    fail(`Read the whole Tracker tab back with get_values and write { "range": ..., "values": ... } to ${READBACK_PATH} first.`);
  }
  let rb;
  try {
    rb = readJsonFile(READBACK_PATH);
  } catch {
    fail(`${READBACK_PATH} is not valid JSON.`);
  }
  if (rb.spreadsheetId !== undefined && rb.spreadsheetId !== t.destination.spreadsheetId) fail(`${READBACK_PATH} is from spreadsheet ${rb.spreadsheetId}, not ${t.destination.spreadsheetId}.`);
  // A read made before the last call cannot show what the call did.
  const last = Math.max(...t.ops.filter((o) => o.state === "attempted").map((o) => Date.parse(o.attempted_at ?? 0) || 0));
  const at = statSync(abs(READBACK_PATH)).mtimeMs;
  if (required && at < last) fail(`${READBACK_PATH} is older than the last staged call. Read the Tracker tab again and write that read there first.`);
  return { read: tabRead(rb, READBACK_PATH), at };
}

function summary(t) {
  return `Transaction ${t.id}: ${t.ops.map((o) => `${o.n} ${o.state}`).join(", ") || "no tracker operations"}.`;
}

function nextStep(t) {
  const conflict = t.ops.filter((o) => o.state === "conflict");
  if (conflict.length) {
    return `Operation${conflict.length === 1 ? "" : "s"} ${conflict.map((o) => o.n).join(", ")} show neither the old values nor the new ones: someone else changed those rows. Show the launch lead what is there and what was intended. They decide; on their word, node scripts/reconcile.mjs ${t.id} --abandon closes it without a history entry. If the rows do hold what was intended, read the Tracker tab again, write it to ${READBACK_PATH}, and run this again: a newer read that shows the intended values verifies them.`;
  }
  const authorized = t.ops.filter((o) => o.state === "authorized");
  if (authorized.length) {
    if (expired(t)) return `It expired at ${t.expires_at} with operations ${authorized.map((o) => o.n).join(", ")} not written. ${t.ops.some((o) => o.state === "verified") ? "Part of it is written: show the launch lead the difference; they decide." : `Discard it (node scripts/reconcile.mjs ${t.id} --discard) and stage again from a fresh read.`}`;
    return t.destination.kind === "csv"
      ? `Run node scripts/tracker-write.mjs ${t.id} to write the rest.`
      : `Make the remaining calls exactly as staged: ${authorized.map((o) => `${o.n}. ${o.tool} ${JSON.stringify({ spreadsheetId: o.spreadsheetId, range: o.range, values: o.values })}`).join(" ")} Then read back and run this again.`;
  }
  return "Read the tracker back and run this again.";
}

function status(atSessionStart) {
  const lines = [];
  const loaded = loadPolicy();
  if (!loaded.ok) {
    let launches = [];
    try {
      launches = Object.keys(JSON.parse(readFileSync(abs("setup/state.json"), "utf8")).launches ?? {});
    } catch {}
    if (launches.length || existsSync(abs("setup/policy.json"))) lines.push(`Live writes: ${loaded.problem}${launches.length ? ` setup/state.json names ${launches.join(", ")}; register each with its mode from there.` : ""}`);
  } else {
    let state = {};
    try {
      state = JSON.parse(readFileSync(abs("setup/state.json"), "utf8"));
    } catch {}
    const unregistered = Object.keys(state.launches ?? {}).filter((l) => !loaded.policy.launches[l]);
    if (unregistered.length) lines.push(`Live writes: ${unregistered.join(", ")} ${unregistered.length === 1 ? "is" : "are"} in setup/state.json but not registered in setup/policy.json, so no tracker write for ${unregistered.length === 1 ? "it" : "them"} is allowed. Register each with node scripts/set-mode.mjs <launch> live|practice, using the mode in setup/state.json.`);
  }
  for (const t of openTxns()) {
    if (t.status === "unreadable") {
      lines.push(`Transaction file runs/txn/${t.id}.json cannot be read. A person should look at it before any live write.`);
      continue;
    }
    // A CSV transaction is reconciled from the file itself.
    if (t.destination.kind === "csv") {
      let read;
      try {
        read = loadCsvTable(t.destination.path);
      } catch (err) {
        lines.push(`Open live write ${t.id} for ${t.launch} on ${t.destination.path}: ${err.message} It cannot be checked until the file is back; a person should look. Do this before any other tracker or Launch history write.`);
        continue;
      }
      settle(t, read, Date.now());
      saveTxn(t);
    }
    const done = complete(t);
    if (done) {
      lines.push(`Recovered: ${done}`);
      continue;
    }
    const who = t.launch === SETUP ? "the header row" : t.launch;
    const any = (s) => t.ops.some((o) => o.state === s);
    const verdict = any("conflict")
      ? "Part of it conflicts with what is in the tracker now: show the launch lead and let them decide."
      : any("attempted")
        ? `Some calls were made and their result is not known. Read the whole Tracker tab back, write it to ${READBACK_PATH}, and run node scripts/reconcile.mjs ${t.id}. Never repeat a call before that.`
        : any("verified")
          ? `It is partly written (${t.ops.filter((o) => o.state === "verified").length} of ${t.ops.length} verified). Show the launch lead the difference and let them choose: finish it${expired(t) ? "" : ` (node scripts/reconcile.mjs ${t.id} lists the remaining calls)`}, or leave the tracker as it is and close it with --abandon.`
          : expired(t)
            ? `Nothing was written and it expired at ${t.expires_at}: discard it with node scripts/reconcile.mjs ${t.id} --discard, then stage again from a fresh read.`
            : `Nothing was written yet: retry it (${t.destination.kind === "csv" ? `node scripts/tracker-write.mjs ${t.id}` : `node scripts/reconcile.mjs ${t.id} lists the calls`}) or discard it with --discard.`;
    lines.push(`Open live write ${t.id} for ${who} on ${describeDestination(t.destination)}: ${t.ops.map((o) => `${o.n} ${o.state}`).join(", ") || "no tracker operations"}. ${verdict} Do this before any other tracker or Launch history write.`);
  }
  if (lines.length) console.log(lines.join("\n"));
  else if (!atSessionStart) console.log(`No open live write transactions (${listTxns(true).length} in all).`);
}
