// Shared code for the live write gate: the policy file, transactions, the
// tracker CSV, and Sheets ranges. Used by stage-write.mjs, tracker-write.mjs,
// reconcile.mjs, set-mode.mjs, bind-system.mjs, and the guard-tracker hook.
// Claude's file tools are denied on this file (CLAUDE.md, "Live writes").
//
// The gate's job: a live launch's tracker changes only by one exact,
// staged change at a time, and never with made-up answers. It is written for an
// agent following its skills; it does not try to stop one working around it.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const POLICY_PATH = "setup/policy.json";
export const TXN_DIR = "runs/txn";
/** Closed, discarded, and abandoned transactions move here, still guarded. */
export const CLOSED_DIR = "runs/txn/closed";
export const PROPOSED_PATH = "runs/proposed.json";
export const READBACK_PATH = "runs/readback.json";
export const LIVE_HISTORY = "launch-history";
export const LIVE_HISTORY_PATH = "history/launch-history.jsonl";
export const TRACKER_TAB = "Tracker";
export const HEADER_SOURCE = "tracker/launch-tracker.csv";
export const EXPIRY_HOURS = 24;
export const SETUP = "setup";
export const LAUNCH_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const TXN_RE = /^[a-z0-9][a-z0-9-]{5,120}$/;
export const SOURCES = ["owner", "relayed", "made-up"];
export const KEY_COLUMNS = ["Launch", "Task ID"];
/** The tracker's date columns (tracker/README.md): YYYY-MM-DD when staged; a
 *  Sheets read may give them back as serial numbers or M/D/YYYY. */
export const DATE_COLUMNS = ["Original due", "Due", "Forecast", "Done date", "Last update"];
/** Columns with a fixed list of values (tracker/README.md); empty is allowed. */
export const ALLOWED_VALUES = { Status: ["Not started", "In progress", "Done", "Waived"], Risk: ["Red", "Amber", "Green"] };
/** Files only these scripts change. */
export const PROTECTED = [
  "setup/policy.json",
  "scripts/write-gate.mjs",
  "scripts/stage-write.mjs",
  "scripts/tracker-write.mjs",
  "scripts/reconcile.mjs",
  "scripts/set-mode.mjs",
  "scripts/bind-system.mjs",
  "scripts/launch-calc.mjs",
  ".claude/hooks/guard-tracker.mjs",
];
export const PROTECTED_DIRS = ["runs/txn/"];

export const abs = (rel) => join(ROOT, rel);
export const now = () => new Date();
export const iso = (d = now()) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function readJsonFile(rel) {
  return JSON.parse(readFileSync(abs(rel), "utf8"));
}

/** Written whole under a private name, then renamed into place. */
export function writeJsonAtomic(rel, value) {
  const target = abs(rel);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${randomBytes(3).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, target);
}

// ── destinations ────────────────────────────────────────────────────────────

/** A Google Sheet's id, from its link or the id itself; null when neither. */
export function normalizeSheetId(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})/.exec(v);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(v) ? v : null;
}

/** A path in this folder, as posix and relative, or null when it leaves the folder. */
export function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const full = resolve(ROOT, value.trim());
  const rel = relative(ROOT, full).split(/[\\/]/).join("/");
  if (!rel || rel.startsWith("..") || posix.isAbsolute(rel)) return null;
  return rel;
}

/** A tracker location as given (a sheet link or id, or a CSV path) as a destination. */
export function destinationFrom(location) {
  if (typeof location !== "string" || !location.trim()) return null;
  if (/^https?:\/\//i.test(location.trim()) || (!/[./\\]/.test(location.trim()) && normalizeSheetId(location))) {
    const id = normalizeSheetId(location);
    return id ? { kind: "sheets", spreadsheetId: id, tab: TRACKER_TAB } : null;
  }
  const path = normalizePath(location);
  return path && /\.csv$/i.test(path) ? { kind: "csv", path } : null;
}

export function sameDestination(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "sheets" ? a.spreadsheetId === b.spreadsheetId : a.path.toLowerCase() === b.path.toLowerCase();
}

export function describeDestination(d) {
  if (!d) return "no tracker";
  return d.kind === "sheets" ? `the Google Sheet ${d.spreadsheetId} (${d.tab} tab)` : d.path;
}

/** The live tracker as connections.json binds it, or null. */
export function liveDestinationFromConnections() {
  try {
    const file = readJsonFile("connections.json");
    const sys = (file.systems ?? []).find((s) => s.systemId === "sys-tracker");
    if (!sys || sys.status !== "bound" || !sys.location) return null;
    if (sys.connector === "local-file") return destinationFrom(sys.location);
    if (sys.connector === "google-sheets") {
      const id = normalizeSheetId(sys.location);
      return id ? { kind: "sheets", spreadsheetId: id, tab: TRACKER_TAB } : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── policy ──────────────────────────────────────────────────────────────────

function validDestination(d) {
  if (d === null) return true;
  if (!d || typeof d !== "object") return false;
  if (d.kind === "sheets") return typeof d.spreadsheetId === "string" && !!normalizeSheetId(d.spreadsheetId) && typeof d.tab === "string";
  if (d.kind === "csv") return typeof d.path === "string" && normalizePath(d.path) === d.path;
  return false;
}

/** { ok: true, policy } or { ok: false, problem }. Missing or malformed fails closed. */
export function loadPolicy() {
  if (!existsSync(abs(POLICY_PATH))) return { ok: false, problem: `${POLICY_PATH} does not exist, so no tracker write is allowed. Register each launch with node scripts/set-mode.mjs <launch> live|practice first.` };
  let policy;
  try {
    policy = readJsonFile(POLICY_PATH);
  } catch {
    return { ok: false, problem: `${POLICY_PATH} cannot be read as JSON, so no tracker write is allowed. A person should look at it; nothing else changes it.` };
  }
  const bad = (why) => ({ ok: false, problem: `${POLICY_PATH} is malformed (${why}), so no tracker write is allowed. A person should look at it.` });
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return bad("not one object");
  if (policy.version !== 1) return bad("version is not 1");
  if (!validDestination(policy.live_tracker ?? null)) return bad("live_tracker");
  if (!policy.launches || typeof policy.launches !== "object" || Array.isArray(policy.launches)) return bad("launches");
  for (const [name, l] of Object.entries(policy.launches)) {
    if (!LAUNCH_RE.test(name) || name === SETUP) return bad(`launch name ${JSON.stringify(name)}`);
    if (!l || !["live", "practice"].includes(l.mode)) return bad(`${name}.mode`);
    if (l.mode === "practice" && (!l.tracker || !validDestination(l.tracker))) return bad(`${name}.tracker`);
    if (l.mode === "live" && l.tracker !== undefined) return bad(`${name} is live and names its own tracker`);
  }
  return { ok: true, policy };
}

export function emptyPolicy() {
  return { version: 1, live_tracker: liveDestinationFromConnections(), launches: {} };
}

/** "live", "practice", or "unknown" for a destination, by the policy. */
export function classify(policy, dest) {
  if (!dest) return "unknown";
  if (sameDestination(policy.live_tracker, dest)) return "live";
  for (const l of Object.values(policy.launches)) if (l.mode === "practice" && sameDestination(l.tracker, dest)) return "practice";
  return "unknown";
}

// ── transactions ────────────────────────────────────────────────────────────

export function txnPath(id) {
  return `${TXN_DIR}/${id}.json`;
}
const closedPath = (id) => `${CLOSED_DIR}/${id}.json`;

/** Transactions in runs/txn/, and with includeClosed those in runs/txn/closed/ too. */
export function listTxns(includeClosed = false) {
  const out = [];
  for (const dir of includeClosed ? [TXN_DIR, CLOSED_DIR] : [TXN_DIR]) {
    if (!existsSync(abs(dir))) continue;
    for (const name of readdirSync(abs(dir)).sort()) {
      if (!name.endsWith(".json")) continue;
      try {
        out.push(readJsonFile(`${dir}/${name}`));
      } catch {
        out.push({ id: name.replace(/\.json$/, ""), status: "unreadable" });
      }
    }
  }
  return out;
}

/** Open transactions, and any that cannot be read, which count as open. */
export function openTxns(launch) {
  return listTxns().filter((t) => (t.status === "open" || t.status === "unreadable") && (launch === undefined || t.launch === launch || t.status === "unreadable"));
}

export function loadTxn(id) {
  if (typeof id !== "string" || !TXN_RE.test(id)) fail(`"${id ?? ""}" is not a transaction id. node scripts/reconcile.mjs --status lists them.`);
  const path = existsSync(abs(txnPath(id))) ? txnPath(id) : existsSync(abs(closedPath(id))) ? closedPath(id) : null;
  if (!path) fail(`No transaction ${id} in ${TXN_DIR}/.`);
  try {
    return readJsonFile(path);
  } catch {
    fail(`${path} cannot be read. A person should look at it.`);
  }
}

/** For a script handed a transaction that is no longer open: nothing to do, which is not an error. */
export function exitIfClosed(txn) {
  if (txn.status === "open") return;
  console.log(`Transaction ${txn.id} is already ${txn.status === "closed" ? "closed" : `closed (${txn.status})`}; there is nothing to do. node scripts/reconcile.mjs --status lists the open ones.`);
  process.exit(0);
}

/** An open transaction stays in runs/txn/; any other moves to runs/txn/closed/. */
export function saveTxn(txn) {
  if (txn.status === "open") {
    writeJsonAtomic(txnPath(txn.id), txn);
    return;
  }
  writeJsonAtomic(closedPath(txn.id), txn);
  if (existsSync(abs(txnPath(txn.id)))) unlinkSync(abs(txnPath(txn.id)));
}

export function newTxnId(launch) {
  const stamp = iso().replace(/[-:TZ]/g, "").slice(0, 14);
  return `${launch}-${stamp}-${randomBytes(2).toString("hex")}`;
}

/** Why the live tracker cannot be re-pointed (a launch has a transaction on
 *  it, or live rows in it), or null when nothing uses it yet. */
export function liveTrackerInUse(policy) {
  const live = policy.live_tracker;
  if (!live) return null;
  const txn = listTxns(true).find((t) => t.launch !== SETUP && sameDestination(t.destination, live));
  if (txn) return `launch ${txn.launch} has written it through transaction ${txn.id}`;
  if (live.kind === "csv") {
    const liveLaunches = Object.entries(policy.launches).filter(([, l]) => l.mode === "live").map(([n]) => n);
    try {
      const { header, rows } = loadCsvTable(live.path);
      const li = header.indexOf("Launch");
      const loaded = li < 0 ? null : liveLaunches.find((n) => rows.some((r) => cell(r[li]) === n));
      if (loaded) return `launch ${loaded} has rows in it`;
    } catch {}
  }
  return null;
}

export const expired = (txn, at = now()) => Date.parse(txn.expires_at) < at.getTime();

export function note(txn, event) {
  txn.log = [...(txn.log ?? []), { at: iso(), event }];
}

// ── provenance ──────────────────────────────────────────────────────────────

/** Every path in value holding source "made-up", however deep. */
export function madeUpPaths(value, path = "") {
  const hits = [];
  if (value === null || typeof value !== "object") return hits;
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...madeUpPaths(v, `${path}[${i}]`)));
    return hits;
  }
  if (value.source === "made-up") hits.push(path ? `${path}.source` : "source");
  for (const [k, v] of Object.entries(value)) hits.push(...madeUpPaths(v, path ? `${path}.${k}` : k));
  return hits;
}

// ── cells, CSV, ranges ──────────────────────────────────────────────────────

export const cell = (v) => (v === null || v === undefined ? "" : String(v).trim());

const SHEETS_EPOCH = Date.UTC(1899, 11, 30);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** A date cell as YYYY-MM-DD: as written, a Sheets serial number (days since
 *  1899-12-30), or M/D/YYYY, the forms a Sheets read gives back. null when it
 *  is none of those. */
export function isoDate(v) {
  const s = cell(v);
  if (isIsoDate(s)) return s;
  if (/^\d{4,6}(\.0+)?$/.test(s)) return new Date(SHEETS_EPOCH + Number(s) * 864e5).toISOString().slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const d = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return isIsoDate(d) ? d : null;
  }
  return null;
}
const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;
/** A leading apostrophe makes Sheets keep a value as text; a read gives it back without one. */
const unquote = (s) => (s.startsWith("'") ? s.slice(1) : s);
/** Two cells hold the same value: as text, or as the same date in a date
 *  column, or as the same number (Sheets reads "007" back as "7"). */
export function sameCell(a, b, column) {
  const x = unquote(cell(a));
  const y = unquote(cell(b));
  if (x === y) return true;
  if (column && DATE_COLUMNS.includes(column)) {
    const dx = isoDate(x);
    if (dx !== null && dx === isoDate(y)) return true;
  }
  return NUMBER.test(x) && NUMBER.test(y) && Number(x) === Number(y);
}
/** Rows compared cell by cell; `columns` names each cell, so date columns compare as dates. */
export const sameRow = (a, b, width, columns) => {
  const n = Math.max(width ?? 0, a.length, b.length);
  for (let i = 0; i < n; i++) if (!sameCell(a[i], b[i], columns?.[i])) return false;
  return true;
};
export const pad = (row, width) => Array.from({ length: Math.max(width, row.length) }, (_, i) => cell(row[i]));

/** A value Sheets would read as something else when written as typed
 *  (USER_ENTERED): leading zeros, dates and fractions (1/2, 2027-01-05),
 *  times, exponents, a formula or sign at the start, or an apostrophe of its own. */
export const SHEETS_REINTERPRETS = /^(0\d|\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b|\d{1,2}:\d{2}|\d+(\.\d+)?e\d|\d{1,3}(,\d{3})+(\.\d+)?$|\$\d|[=+\-@'])/i;
/** A text cell as written to a Sheet: prefixed with an apostrophe when Sheets would reinterpret it. */
export const sheetsText = (v) => {
  const s = cell(v);
  return SHEETS_REINTERPRETS.test(s) ? `'${s}` : s;
};

/** What is wrong with a value staged for `column`, or null. */
export function valueProblem(column, value) {
  const v = cell(value);
  if (!v) return null;
  if (DATE_COLUMNS.includes(column) && !isIsoDate(v)) return `${column} is ${JSON.stringify(v)}, but dates in the tracker are written YYYY-MM-DD (2027-01-15)`;
  const allowed = ALLOWED_VALUES[column];
  if (allowed && !allowed.includes(v)) return `${column} is ${JSON.stringify(v)}, but it can only be ${allowed.join(", ")}, or empty`;
  return null;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function toCsv(rows, eol = "\n") {
  const q = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(q).join(",")).join(eol) + eol;
}

/** The tracker CSV as { header (trimmed, for matching), rawHeader, rows (as
 *  in the file), eol, bom, finalEol }, so a write keeps what it does not change.
 *  Throws when the file is missing or has no header. */
export function loadCsvTable(rel) {
  if (!existsSync(abs(rel))) throw new Error(`${rel} does not exist.`);
  const text = readFileSync(abs(rel), "utf8");
  const rows = parseCsv(text);
  if (!rows.length) throw new Error(`${rel} has no header row.`);
  const header = rows[0].map((h) => h.trim());
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { header, rawHeader: rows[0], rows: rows.slice(1), eol, bom: text.charCodeAt(0) === 0xfeff, finalEol: /[\r\n]$/.test(text) };
}

export function readCsvTable(rel) {
  try {
    return loadCsvTable(rel);
  } catch (err) {
    fail(err.message);
  }
}

/** The file text for rows of a table loadCsvTable read, with its BOM, header, and line endings. */
export function csvText(table, rows) {
  const body = toCsv([table.rawHeader ?? table.header, ...rows], table.eol);
  return `${table.bom ? "\ufeff" : ""}${table.finalEol === false ? body.slice(0, -table.eol.length) : body}`;
}

export function keyIndexes(header, where) {
  const [li, ti] = KEY_COLUMNS.map((c) => header.indexOf(c));
  if (li < 0 || ti < 0) fail(`${where} has no ${KEY_COLUMNS.join(" or ")} column in its header row, so rows cannot be matched.`);
  return [li, ti];
}

export function findRows(rows, header, launch, task, where) {
  const [li, ti] = keyIndexes(header, where);
  return rows.map((r, i) => ({ r, i })).filter(({ r }) => cell(r[li]) === launch && cell(r[ti]) === task);
}

export function colName(n) {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const colNumber = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/** "Tracker!A5:V5" as { tab, c1, r1, c2, r2 } (1-based), or null. */
export function parseA1(range) {
  if (typeof range !== "string") return null;
  const m = /^(?:'((?:[^']|'')+)'|([^!']+))!\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/.exec(range.trim());
  if (!m) {
    const tabOnly = /^(?:'((?:[^']|'')+)'|([^!':]+))$/.exec(range.trim());
    return tabOnly ? { tab: (tabOnly[1] ?? tabOnly[2]).replace(/''/g, "'"), whole: true } : null;
  }
  const tab = (m[1] ?? m[2]).replace(/''/g, "'");
  const c1 = colNumber(m[3].toUpperCase());
  const r1 = Number(m[4]);
  return { tab, c1, r1, c2: m[5] ? colNumber(m[5].toUpperCase()) : c1, r2: m[6] ? Number(m[6]) : r1 };
}

export function canonicalRange(range) {
  const p = parseA1(range);
  if (!p) return null;
  if (p.whole) return `${p.tab}`;
  return `${p.tab}!${colName(p.c1)}${p.r1}${p.c1 === p.c2 && p.r1 === p.r2 ? "" : `:${colName(p.c2)}${p.r2}`}`;
}

/** A call's values are exactly the staged ones, cell for cell as text: "007"
 *  is not "'007", which is what keeps it text in the Sheet. */
export const sameValues = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((row, i) => Array.isArray(row) && Array.isArray(b[i]) && row.length === b[i].length && row.every((v, j) => cell(v) === cell(b[i][j])));

/** A whole-tab read: { range, values } starting at A1 of the Tracker tab. */
/** An empty tab comes back from get_values with no "values" at all
 *  ({ "range": "Tracker!A1:Z1000" }): that is an empty read. */
export function tabRead(read, where) {
  const shape = `${where} needs { "range": "${TRACKER_TAB}!A1:...", "values": [[...]] } from a fresh read of the whole ${TRACKER_TAB} tab, as get_values returned it.`;
  if (!read || typeof read !== "object" || Array.isArray(read) || typeof read.range !== "string") fail(shape);
  if (read.values !== undefined && !Array.isArray(read.values)) fail(shape);
  const p = parseA1(read.range);
  if (!p || p.tab !== TRACKER_TAB || (!p.whole && (p.c1 !== 1 || p.r1 !== 1))) fail(`${where}: the read must start at A1 of the ${TRACKER_TAB} tab (got ${JSON.stringify(read.range)}).`);
  return (read.values ?? []).map((r) => (Array.isArray(r) ? r.map(cell) : []));
}

// ── completion ──────────────────────────────────────────────────────────────

function historyHas(txnId) {
  if (!existsSync(abs(LIVE_HISTORY_PATH))) return false;
  return readFileSync(abs(LIVE_HISTORY_PATH), "utf8")
    .split("\n")
    .some((line) => {
      try {
        return JSON.parse(line).txn === txnId;
      } catch {
        return false;
      }
    });
}

/** When every operation is verified: append the stored history payload (once,
 *  keyed by the transaction id), then close. Returns a line to print. */
export function complete(txn) {
  if (txn.status !== "open") return `Transaction ${txn.id} is ${txn.status}.`;
  if (txn.ops.some((op) => op.state !== "verified")) return null;
  if (txn.history) {
    if (!historyHas(txn.id)) {
      const dir = `${LIVE_HISTORY_PATH}.next`;
      mkdirSync(abs(dir), { recursive: true });
      writeFileSync(abs(`${dir}/txn-${txn.id}.json`), JSON.stringify({ ...txn.history, txn: txn.id }));
      const run = spawnSync(process.execPath, [abs("scripts/append-store.mjs"), LIVE_HISTORY], { cwd: ROOT, encoding: "utf8" });
      if (!historyHas(txn.id)) {
        note(txn, "history append failed");
        saveTxn(txn);
        return `The tracker change is verified, but the history entry was not added: ${(run.stderr || run.stdout || "").trim()} Transaction ${txn.id} stays open; fix that and run node scripts/reconcile.mjs ${txn.id} again.`;
      }
    }
    note(txn, "history appended");
  }
  txn.status = "closed";
  txn.closed_at = iso();
  note(txn, "closed");
  saveTxn(txn);
  return `Transaction ${txn.id} is complete: ${txn.ops.length} tracker operation${txn.ops.length === 1 ? "" : "s"} verified${txn.history ? `, and its ${txn.history.type} entry is in Launch history` : ""}.`;
}

// ── checking a read against operations ──────────────────────────────────────

/** The state a read-back puts an attempted operation in. `table` is
 *  { header, rows } with rows as arrays (CSV), or the tab's values (Sheets). */
export function judge(op, txn, read) {
  if (txn.destination.kind === "csv") {
    const { header, rows } = read;
    const found = findRows(rows, header, op.key.launch, op.key.task, txn.destination.path);
    if (op.kind === "add") {
      if (!found.length) return "not-applied";
      return found.length === 1 && sameRow(found[0].r, op.row, header.length, header) ? "verified" : "conflict";
    }
    if (found.length !== 1) return "conflict";
    const row = found[0].r;
    const cols = Object.entries(op.changes);
    if (cols.every(([c, ch]) => sameCell(row[header.indexOf(c)], ch.new, c))) return "verified";
    if (cols.every(([c, ch]) => sameCell(row[header.indexOf(c)], ch.old, c))) return "not-applied";
    return "conflict";
  }
  const values = read;
  if (op.tool === "update_values") {
    const p = parseA1(op.range);
    const got = [];
    for (let r = p.r1; r <= p.r2; r++) got.push(pad((values[r - 1] ?? []).slice(p.c1 - 1, p.c2), p.c2 - p.c1 + 1));
    const width = p.c2 - p.c1 + 1;
    // Columns are named by the tab's header row, except when this writes the header.
    const columns = p.r1 > 1 ? (values[0] ?? []).slice(p.c1 - 1, p.c2) : undefined;
    if (got.every((row, i) => sameRow(row, op.values[i] ?? [], width, columns))) return "verified";
    if (got.every((row, i) => sameRow(row, op.before[i] ?? [], width, columns))) return "not-applied";
    return "conflict";
  }
  if (op.tool === "append_values") {
    const header = values[0] ?? [];
    const [li, ti] = KEY_COLUMNS.map((c) => header.indexOf(c));
    if (li < 0 || ti < 0) return "conflict";
    const matches = op.keys.map(([l, t]) => values.slice(1).filter((r) => cell(r[li]) === l && cell(r[ti]) === t));
    if (matches.every((m) => m.length === 0)) return "not-applied";
    if (matches.every((m, i) => m.length === 1 && sameRow(m[0], op.values[i], header.length, header))) return "verified";
    return "conflict";
  }
  return "conflict";
}

/** Moves operations on from a read: an attempted one becomes verified,
 *  authorized again (not applied), or conflict. A conflict is judged again
 *  only from a read made after it was found, and only ever becomes verified
 *  (the write did land); otherwise it stays a conflict for the launch lead.
 *  `readAt` is when the read was made, in ms. Returns how many moved. */
export function settle(txn, read, readAt) {
  let moved = 0;
  for (const op of txn.ops) {
    if (op.state === "attempted") {
      const state = judge(op, txn, read);
      op.state = state === "not-applied" ? "authorized" : state;
      if (state === "conflict") op.conflict_at = new Date().toISOString();
      moved++;
    } else if (op.state === "conflict" && readAt > (Date.parse(op.conflict_at ?? op.attempted_at ?? 0) || 0)) {
      if (judge(op, txn, read) === "verified") {
        op.state = "verified";
        delete op.conflict_at;
        note(txn, `operation ${op.n} verified on a later read`);
        moved++;
      }
    }
  }
  return moved;
}
