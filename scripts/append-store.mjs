#!/usr/bin/env node
// Adds staged entries to an append-only store, each with a staged_as id. Claude's file tools are denied
// on these files, and on this script, in .claude/settings.json, so this is the
// only way a run adds to them, and it only adds lines at the end. Earlier
// lines are never touched.
//
//   1. Write each entry, one JSON object, to its own new file in <store path>.next/
//   2. node scripts/append-store.mjs <store id>
//
// One run at a time holds the store's lock. Each staged file is claimed by
// renaming it first, and an entry staged meanwhile is left for the next call.
import { appendFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Each typed store's entry contract, checked before an entry is added.
import { CONTRACTS, validateEntry } from "./entry-contracts.mjs";

const STORES = {
  "launch-history": {
    "name": "Launch history",
    "path": "history/launch-history.jsonl",
    "fields": [
      "type",
      "launch",
      "at",
      "source",
      "week_of",
      "gate",
      "revision",
      "status",
      "sent",
      "responses",
      "skipped",
      "decision",
      "next",
      "decided_by",
      "words",
      "proposed_conditions",
      "conditions",
      "pending",
      "clarifies",
      "waivers",
      "findings"
    ],
    "idField": "txn"
  },
  "practice-history": {
    "name": "Practice history",
    "path": "history/practice-history.jsonl",
    "fields": [
      "type",
      "launch",
      "at",
      "source",
      "week_of",
      "gate",
      "revision",
      "status",
      "sent",
      "responses",
      "skipped",
      "decision",
      "next",
      "decided_by",
      "words",
      "proposed_conditions",
      "conditions",
      "pending",
      "clarifies",
      "waivers",
      "findings"
    ],
    "idField": "txn"
  }
};

// Store paths are relative to the folder root, one level above this script,
// so an earlier cd into a subfolder cannot point them somewhere else.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

function fail(message) {
  console.error(`${message} Nothing was added.`);
  process.exit(1);
}

const id = process.argv[2];
const store = STORES[id];
if (!store) fail(`No append-only store is named "${id ?? ""}". Known: ${Object.keys(STORES).join(", ")}.`);
const dir = `${store.path}.next`;
if (!existsSync(dir)) fail(`Write the entry to a new .json file in ${dir}/ first.`);

// One run at a time per store, from recovery to cleanup, so a failed write's
// repair can only ever touch its own bytes. A lock whose process is gone is
// taken over; a live one is waited for.
const lock = join(dir, ".lock");
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
};
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// The lock is written in full under a private name, then linked into place,
// so it is never seen empty. A lock that cannot be read as a pid and is older
// than a few seconds is left over from something interrupted, and is stale.
const holderOf = (path) => {
  const pid = Number(readFileSync(path, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
};
const draft = join(dir, `.lock-draft-${process.pid}-${randomUUID()}`);
writeFileSync(draft, String(process.pid));
let locked = false;
for (const until = Date.now() + 30000; !locked; ) {
  try {
    linkSync(draft, lock);
    locked = true;
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    let holder;
    let age;
    try {
      holder = holderOf(lock);
      age = Date.now() - statSync(lock).mtimeMs;
    } catch (inspect) {
      if (inspect.code === "ENOENT") continue;
      throw inspect;
    }
    if (holder ? !alive(holder) : age > 5000) {
      // Move the stale lock aside before removing it, so a lock another run
      // has just taken is never deleted by mistake.
      const aside = join(dir, `.lock.stale-${process.pid}-${randomUUID()}`);
      try {
        renameSync(lock, aside);
        const moved = holderOf(aside);
        if (moved && alive(moved)) {
          try {
            linkSync(aside, lock);
          } catch {}
        }
        unlinkSync(aside);
      } catch {}
      continue;
    }
    if (Date.now() > until) {
      unlinkSync(draft);
      fail(`Another run is adding to ${store.path}. Try again when it finishes.`);
    }
    pause(50);
  }
}
unlinkSync(draft);
process.on("exit", () => {
  try {
    if (readFileSync(lock, "utf8").trim() === String(process.pid)) unlinkSync(lock);
  } catch {}
});
// Every line carries the staged_as id its claim was given, so a claim can be
// matched to its own line and never to another entry with the same content.
const appendedIds = () => {
  const ids = new Set();
  if (!existsSync(store.path)) return ids;
  for (const line of readFileSync(store.path, "utf8").split("\n")) {
    try {
      const id = JSON.parse(line).staged_as;
      if (typeof id === "string") ids.add(id);
    } catch {}
  }
  return ids;
};

// A claim whose process is gone was interrupted. If its id is already on a
// line in the store, the append happened and only the cleanup did not, so the
// claim is dropped. Otherwise it goes back to be appended now.
const recovered = [];
for (const name of readdirSync(dir)) {
  const m = /^(.+\.json)\.taking-(\d+)-([\w-]+)$/.exec(name);
  if (!m || Number(m[2]) === process.pid) continue;
  if (alive(Number(m[2]))) continue;
  const claim = join(dir, name);
  if (appendedIds().has(m[3])) {
    unlinkSync(claim);
    recovered.push(`${m[1]} was already added`);
  } else {
    renameSync(claim, join(dir, existsSync(join(dir, m[1])) ? `recovered-${m[2]}-${m[1]}` : m[1]));
    recovered.push(`${m[1]} was put back to add`);
  }
}
if (recovered.length) console.log(`Recovered from an interrupted run: ${recovered.join("; ")}.`);

const staged = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
if (!staged.length) fail(`Write the entry to a new .json file in ${dir}/ first.`);

const claimed = [];
for (const name of staged) {
  const id = randomUUID();
  const taking = join(dir, `${name}.taking-${process.pid}-${id}`);
  try {
    renameSync(join(dir, name), taking);
    claimed.push({ name, taking, id });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
if (!claimed.length) fail("Another run took every staged entry.");
const release = (item) => renameSync(item.taking, join(dir, item.name));

if (existsSync(store.path)) {
  const current = readFileSync(store.path, "utf8");
  if (current.length && !current.endsWith("\n")) {
    claimed.forEach(release);
    fail(`The last line of ${store.path} is incomplete. A person should look at it before anything is added.`);
  }
}

// A practice launch's entries go to practice-history, a live launch's to launch-history.
const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
function launchModeProblem(entry) {
  let policy;
  try {
    policy = JSON.parse(readFileSync("setup/policy.json", "utf8"));
  } catch {
    return "setup/policy.json is missing or unreadable, so no launch's mode is known and nothing is filed. Register the launch with node scripts/set-mode.mjs <launch> live|practice";
  }
  const launches = policy?.launches;
  if (!launches || typeof launches !== "object" || Array.isArray(launches)) return "setup/policy.json is malformed; a person should look at it";
  const launch = launches[entry.launch];
  if (!launch) {
    return `launch "${entry.launch}" is not registered in setup/policy.json (known: ${Object.keys(launches).join(", ") || "none"}); register it with node scripts/set-mode.mjs, or fix a typo that would file the entry under the wrong launch`;
  }
  const practice = launch.mode === "practice";
  if (id === "practice-history" && !practice) return `launch "${entry.launch}" is not a practice launch in setup/policy.json, so its entry belongs in launch-history`;
  if (id === "launch-history" && practice) return `launch "${entry.launch}" is a practice launch in setup/policy.json, so its entry belongs in practice-history`;
  if (id === "launch-history") {
    const how = `a live launch's entry is added by its write transaction: put it in runs/proposed.json and run node scripts/stage-write.mjs ${entry.launch}`;
    if (typeof entry.txn !== "string" || !/^[a-z0-9][a-z0-9-]{5,120}$/.test(entry.txn)) return how;
    let txn;
    try {
      txn = JSON.parse(readFileSync(`runs/txn/${entry.txn}.json`, "utf8"));
    } catch {
      return `transaction ${entry.txn} does not exist; ${how}`;
    }
    if (txn.launch !== entry.launch || txn.status !== "open" || !txn.history || (txn.ops ?? []).some((op) => op.state !== "verified")) {
      return `transaction ${entry.txn} is not ready to add its entry: every tracker operation in it must be verified first (node scripts/reconcile.mjs ${entry.txn})`;
    }
    const { txn: _txn, staged_as: _staged, ...rest } = entry;
    if (JSON.stringify(canonical(rest)) !== JSON.stringify(canonical(txn.history))) return `the entry differs from the one staged in transaction ${entry.txn}`;
  }
  return null;
}

const good = [];
const problems = [];
for (const item of claimed) {
  let entry;
  try {
    entry = JSON.parse(readFileSync(item.taking, "utf8"));
  } catch {
    problems.push(`${item.name} is not valid JSON`);
    release(item);
    continue;
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    problems.push(`${item.name} is not one JSON object`);
    release(item);
    continue;
  }
  const missing = store.fields.filter((field) => !(field in entry));
  if (missing.length) {
    problems.push(`${item.name} is missing ${missing.join(", ")}`);
    release(item);
    continue;
  }
  const wrongHistory = launchModeProblem(entry);
  if (wrongHistory) {
    problems.push(`${item.name}: ${wrongHistory}`);
    release(item);
    continue;
  }
  const contractProblems = validateEntry(CONTRACTS[id], entry);
  if (contractProblems.length) {
    problems.push(`${item.name}: ${store.name} does not take this entry: ${contractProblems.join("; ")}`);
    release(item);
    continue;
  }
  good.push({ item, entry: { ...entry, staged_as: item.id } });
}

// An entry keyed by the store's id field (a transaction id) is added once:
// one already in the store, or twice in this batch, is dropped as done.
if (store.idField) {
  const seen = new Set();
  if (existsSync(store.path)) {
    for (const line of readFileSync(store.path, "utf8").split("\n")) {
      try {
        const key = JSON.parse(line)[store.idField];
        if (key !== undefined && key !== null) seen.add(JSON.stringify(key));
      } catch {}
    }
  }
  for (const g of [...good]) {
    const key = g.entry[store.idField];
    if (key === undefined || key === null) continue;
    if (seen.has(JSON.stringify(key))) {
      unlinkSync(g.item.taking);
      good.splice(good.indexOf(g), 1);
      console.log(`${g.item.name} was already added (${store.idField} ${JSON.stringify(key)}); nothing added for it.`);
    } else seen.add(JSON.stringify(key));
  }
}

if (good.length) {
  mkdirSync(dirname(store.path), { recursive: true });
  const start = existsSync(store.path) ? statSync(store.path).size : 0;
  try {
    appendFileSync(store.path, good.map(({ entry }) => `${JSON.stringify(entry)}\n`).join(""));
  } catch (err) {
    // The write may have landed in part. Cut off a half-written last line,
    // which only this call wrote, then keep the claims whose line is there
    // and put back only the ones that are not, so a retry adds each once.
    let settled = true;
    try {
      const written = readFileSync(store.path).subarray(start);
      const end = written.lastIndexOf(10) + 1;
      if (end < written.length) truncateSync(store.path, start + end);
    } catch {
      settled = false;
    }
    if (!settled) {
      fail(`Could not write ${store.path}: ${err.message}. Its last line may be incomplete, and the entries are still claimed in ${dir}/. A person should look before anything else is added.`);
    }
    const ids = appendedIds();
    const landed = good.filter(({ item }) => ids.has(item.id));
    for (const { item } of landed) unlinkSync(item.taking);
    good.filter(({ item }) => !ids.has(item.id)).forEach(({ item }) => release(item));
    console.error(`Could not write ${store.path}: ${err.message}. Added before it stopped: ${landed.map(({ item }) => item.name).join(", ") || "none"}. The rest are back in ${dir}/.`);
    process.exit(1);
  }
  for (const { item } of good) unlinkSync(item.taking);
  console.log(`Added ${good.length} entr${good.length === 1 ? "y" : "ies"} to ${store.path}: ${good.map(({ item }) => item.name).join(", ")}.`);
}
if (problems.length) {
  console.error(`Not added, and left in ${dir}/ to fix: ${problems.join("; ")}.`);
  process.exit(1);
}
