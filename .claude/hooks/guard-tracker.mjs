#!/usr/bin/env node
// PreToolUse: the live write gate (CLAUDE.md, "Live writes"). Exit 2 blocks the tool.
//
// - Google Sheets writes (update_values, append_values, batch_clear_values,
//   update_formulas): allowed on a sheet registered as a practice launch's
//   tracker, or when the call matches, exactly, the next staged operation of an
//   open live transaction on that sheet (which it then marks attempted).
//   Everything else is blocked, including a staged operation aimed at another
//   spreadsheet, and every write when setup/policy.json is missing or malformed.
// - Edit, Write, MultiEdit, NotebookEdit, and Bash: a live tracker CSV changes
//   only through node scripts/tracker-write.mjs <txn>; a practice one
//   (practice/<launch>/launch-tracker.csv, registered with set-mode.mjs) is the
//   agent's to edit, and any other tracker CSV, such as another practice
//   launch's before it is registered, is blocked. The transactions, setup/policy.json, and the gate's own
//   scripts change only through those scripts.
//
// Folder runs only: from a plugin install it does nothing. Any error in the
// hook itself (unreadable input, a broken transaction file, a missing script)
// blocks the call: a guard that crashes never lets a write through.
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

if (process.env.CLAUDE_PLUGIN_ROOT) process.exit(0);
const deny = (why) => {
  console.error(why);
  process.exit(2);
};
const allow = () => process.exit(0);
try {
  await guard();
} catch (err) {
  deny(`Blocked: guard error: ${err?.message ?? err}. The live write gate could not check this call, so it is blocked. A person should look at .claude/hooks/guard-tracker.mjs and scripts/write-gate.mjs.`);
}
allow();

async function guard() {
  const {
    PROTECTED, PROTECTED_DIRS, ROOT, canonicalRange, classify, describeDestination, destinationFrom, expired, loadPolicy,
    normalizeSheetId, openTxns, sameDestination, sameValues, saveTxn,
  } = await import("../../scripts/write-gate.mjs");
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  if (!input || typeof input !== "object") throw new Error("the hook input is not a JSON object");
  const name = String(input.tool_name ?? "");
  const ti = input.tool_input ?? {};

  // ── Google Sheets ───────────────────────────────────────────────────────────
  const sheets = /^mcp__.+__(update_values|append_values|batch_clear_values|update_formulas)$/.exec(name);
  if (sheets) {
    const tool = sheets[1];
    const loaded = loadPolicy();
    if (!loaded.ok) deny(`Blocked: ${loaded.problem}`);
    const policy = loaded.policy;
    const id = normalizeSheetId(ti.spreadsheetId);
    if (!id) deny("Blocked: this Sheets write names no spreadsheet id the gate recognises.");
    const dest = { kind: "sheets", spreadsheetId: id, tab: "Tracker" };
    if (classify(policy, dest) === "practice") allow();
    const txns = openTxns().filter((t) => t.destination?.kind === "sheets" && t.destination.spreadsheetId === id);
    if (!txns.length) {
      deny(`Blocked: ${tool} on spreadsheet ${id}. ${classify(policy, dest) === "live" ? "A live launch's tracker changes only through a staged transaction: write runs/proposed.json, run node scripts/stage-write.mjs <launch>, then make exactly the calls it prints." : "This spreadsheet is neither the live tracker nor a registered practice tracker, and this folder writes no other sheet."}`);
    }
    const txn = txns[0];
    if (!Array.isArray(txn.ops)) throw new Error(`transaction ${txn.id} has no operations list`);
    if (!sameDestination(policy.live_tracker, txn.destination)) deny(`Blocked: setup/policy.json no longer binds the live tracker to ${describeDestination(txn.destination)}. Discard transaction ${txn.id} and stage again.`);
    if (expired(txn)) deny(`Blocked: transaction ${txn.id} expired at ${txn.expires_at}. Run node scripts/reconcile.mjs --status.`);
    const values = tool === "update_formulas" ? ti.formulas : ti.values;
    const range = canonicalRange(ti.range);
    const matches = (op) => op.tool === tool && canonicalRange(op.range) === range && sameValues(op.values, values);
    const repeat = txn.ops.find((op) => op.state !== "authorized" && matches(op));
    if (repeat) deny(`Blocked: operation ${repeat.n} of ${txn.id} was already ${repeat.state === "attempted" ? "attempted" : repeat.state}. Read the Tracker tab back, write it to runs/readback.json, and run node scripts/reconcile.mjs ${txn.id}; it says whether a retry is needed. Never repeat a write blind.`);
    const next = txn.ops.find((op) => op.state === "authorized");
    if (!next) deny(`Blocked: transaction ${txn.id} has nothing left to write. Read back and run node scripts/reconcile.mjs ${txn.id}.`);
    if (!matches(next)) {
      const diff = next.tool !== tool ? `the tool is ${tool}, staged is ${next.tool}` : canonicalRange(next.range) !== range ? `the range is ${ti.range}, staged is ${next.range}` : "the values differ from the staged values";
      deny(`Blocked: this call is not operation ${next.n} of ${txn.id} as staged (${diff}). Make it exactly as stage-write printed: ${next.tool} ${JSON.stringify({ spreadsheetId: next.spreadsheetId, range: next.range, values: next.values })}. To change what is written, discard the transaction and stage again.`);
    }
    next.state = "attempted";
    next.attempted_at = new Date().toISOString();
    txn.log = [...(txn.log ?? []), { at: next.attempted_at, event: `operation ${next.n} attempted` }];
    saveTxn(txn);
    allow();
  }

  // ── files ───────────────────────────────────────────────────────────────────
  const lower = (s) => s.toLowerCase();
  // Through symlinks (macOS /var is /private/var), so a path names one file.
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      const up = dirname(p);
      return up === p ? p : join(real(up), basename(p));
    }
  };
  const rel = (p) => relative(real(ROOT), real(resolve(input.cwd ?? process.cwd(), p))).split(/[\\/]/).join("/");
  const isProtected = (r) => PROTECTED.some((p) => lower(r) === lower(p)) || PROTECTED_DIRS.some((d) => lower(r).startsWith(lower(d)));
  const TRACKER_NAME = /launch-tracker[^/\\\s"'`]*\.csv$/i;

  function trackerVerdict(r) {
    const loaded = loadPolicy();
    if (!loaded.ok) return `Blocked: ${loaded.problem}`;
    const dest = destinationFrom(r);
    const kind = classify(loaded.policy, dest);
    if (kind === "practice") return null;
    if (kind === "live") return `Blocked: ${r} is a live launch's tracker. It changes only through a staged transaction: write runs/proposed.json, run node scripts/stage-write.mjs <launch>, then node scripts/tracker-write.mjs <txn>. Read it with the Read tool.`;
    return `Blocked: ${r} is not registered as any launch's tracker. A practice launch registers its own with node scripts/set-mode.mjs <launch> practice <path> before writing it.`;
  }

  const target = ti.file_path ?? ti.notebook_path;
  if (typeof target === "string" && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) {
    const r = rel(target);
    if (isProtected(r)) deny(`Blocked: ${r} is part of the live write gate. Only its scripts change it (CLAUDE.md, "Live writes").`);
    const loaded = loadPolicy();
    const registered = loaded.ok && classify(loaded.policy, destinationFrom(r)) !== "unknown";
    if (TRACKER_NAME.test(r) || registered) {
      const why = trackerVerdict(r);
      if (why) deny(why);
    }
    allow();
  }

  const command = name === "Bash" ? ti.command : undefined;
  if (typeof command === "string") {
    const cmd = command.trim();
    // The gate's own commands, alone and with plain arguments.
    if (/^node scripts\/(stage-write|tracker-write|reconcile|set-mode|bind-system|launch-calc)\.mjs( [A-Za-z0-9_.:/?=&%#@+,-]+)*$/.test(cmd)) allow();
    // A calculator call followed only by read-only filters (| head, | jq ., ; echo) only reads.
    // "2>&1" just before a pipe sends errors down the pipe too; any other < > ` $ does not pass.
    const piped = cmd.replace(/\s+2>&1(?=\s*\|)/g, "");
    {
      const parts = piped.split(/\s*(?:\|\||&&|\||;)\s*/);
      const calc = /^node scripts\/launch-calc\.mjs( [A-Za-z0-9_.:/?=&%#@+,-]+)*$/;
      const reader = /^(head|tail|jq|wc|sort|uniq|grep|echo)( [A-Za-z0-9_.:/?=&%#@+,'"\[\]{}* -]*)?$/;
      if (parts.length > 1 && !/[<>`$]/.test(piped) && parts.every((p) => calc.test(p) || reader.test(p)) && parts.some((p) => calc.test(p))) allow();
    }
    // Reading a file, the live tracker included, with cat, head, tail, grep, wc,
    // or cut, alone or piped into one another: these only read. Nothing that
    // redirects, substitutes, or chains another command passes here.
    if (!/[<>`$;&()\n\r\\]/.test(piped)) {
      const parts = piped.split(/\s*\|\s*/);
      const reader = /^(cat|head|tail|grep|egrep|wc|cut)( [A-Za-z0-9_.:/=,@+%#'"\[\]{}*^ -]*)?$/;
      if (parts.every((p) => reader.test(p))) allow();
    }
    const l = lower(cmd);
    const writes = /(\d?>(?!&\d|\/dev\/null)|\btee\b|\bsed\s+(-[a-z]*i|--in-place)|\bperl\s+-[a-z]*i|\brm\b|\bmv\b|\bcp\b|\bdd\b|\btruncate\b|\bchmod\b|\bln\b|\btouch\b|\bgit\s+(checkout|restore|clean)\b|\bpython3?\b|\bnode\b(?!\s+(-v|--version)\b)|\bruby\b|\bawk\b)/;
    const names = [...PROTECTED.map((p) => p.split("/").pop()), "runs/txn"].map(lower);
    if (names.some((n) => l.includes(n)) && writes.test(l)) deny(`Blocked: this command would touch the live write gate's files. Only node scripts/stage-write.mjs, tracker-write.mjs, reconcile.mjs, set-mode.mjs, and bind-system.mjs change them, run on their own.`);
    // Any command naming a tracker CSV that is not a registered practice tracker.
    const tokens = [...cmd.matchAll(/[^\s"'`;|&<>()=]*launch-tracker[^\s"'`;|&<>()]*\.csv/gi)].map((m) => m[0]);
    const loaded = loadPolicy();
    if (loaded.ok) {
      const live = loaded.policy.live_tracker;
      if (live?.kind === "csv" && !tokens.length && l.includes(lower(live.path.split("/").pop()))) tokens.push(live.path);
    }
    for (const t of tokens) {
      const why = trackerVerdict(rel(t));
      if (why) deny(`${why} Shell commands that could change it may not name it; to read it, use the Read tool, or cat, head, grep, or wc on their own.`);
    }
    allow();
  }
}
