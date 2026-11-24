// The live write gate: on a live launch the tracker changes only through a
// checked, staged write, and made-up answers are refused.
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { copy, preToolUse, read, run, write } from "./helpers.mjs";

const AT = "2026-11-17T10:00:00Z";
const approval = (launch) => ({
  type: "decision", launch, at: AT, source: "owner", week_of: null, gate: null, revision: null, status: null, sent: [], skipped: [], responses: [],
  decision: "plan-v1", next: null, decided_by: "Dana Lee", words: "Approve plan-v1.", proposed_conditions: [], conditions: [], pending: [], clarifies: null, waivers: [], findings: null,
});
const row = (launch, id) => ({ Launch: launch, "Task ID": id, Task: `Task ${id}`, Owner: "Ann", "Original due": "2027-01-11", Due: "2027-01-11", Status: "Not started", "Last update": "2026-11-17" });

function liveLaunch(launch = "orbit") {
  const dir = copy();
  const mode = run(dir, "scripts/set-mode.mjs", launch, "live");
  assert.equal(mode.status, 0, mode.out);
  write(dir, `launches/${launch}/plan-v1.md`, "# plan-v1\n");
  write(dir, "runs/proposed.json", { launch, history: approval(launch), ops: ["T01", "T02"].map((id) => ({ add: row(launch, id) })) });
  const staged = run(dir, "scripts/stage-write.mjs", launch);
  assert.equal(staged.status, 0, staged.out);
  const txn = /transaction ([a-z0-9-]+)/.exec(staged.out)[1];
  const done = run(dir, "scripts/tracker-write.mjs", txn);
  assert.equal(done.status, 0, done.out);
  return dir;
}

test("a live load with a named plan approval writes the tracker and one history entry", () => {
  const dir = liveLaunch();
  assert.match(read(dir, "tracker/launch-tracker.csv"), /orbit,T01,/);
  const history = read(dir, "history/launch-history.jsonl").trim().split("\n");
  assert.equal(history.length, 1);
  assert.equal(JSON.parse(history[0]).decision, "plan-v1");
});

test("made-up answers never reach a live launch, at any depth", () => {
  const dir = liveLaunch();
  const tracker = read(dir, "tracker/launch-tracker.csv");
  const history = read(dir, "history/launch-history.jsonl");
  const week = { ...approval("orbit"), type: "week", decision: null, week_of: "2026-11-16", status: { done: [], red: [], amber: ["T02"], green: [], unvalidated: [] }, source: "relayed" };
  for (const proposal of [
    { launch: "orbit", history: { ...week, source: "made-up" }, ops: [] },
    { launch: "orbit", history: { ...week, responses: [{ task: "T02", owner: "Ann", on: "2026-11-17", answers: null, source: "made-up" }] }, ops: [{ set: { "Task ID": "T02" }, changes: { Risk: "Amber" } }] },
    { launch: "orbit", source: "relayed", ops: [{ set: { "Task ID": "T02" }, changes: { Risk: "Amber" }, source: "made-up" }] },
  ]) {
    write(dir, "runs/proposed.json", proposal);
    const r = run(dir, "scripts/stage-write.mjs", "orbit");
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /made-up/);
  }
  assert.equal(read(dir, "tracker/launch-tracker.csv"), tracker, "the tracker is unchanged");
  assert.equal(read(dir, "history/launch-history.jsonl"), history, "history is unchanged");
});

test("on a live launch, no file tool or shell command writes the tracker directly", () => {
  const dir = liveLaunch();
  const csv = join(dir, "tracker/launch-tracker.csv");
  for (const tool of ["Edit", "Write", "MultiEdit"]) assert.ok(preToolUse(dir, tool, { file_path: csv }).blocked, tool);
  for (const command of ["echo x >> tracker/launch-tracker.csv", `node -e "require('fs').appendFileSync('tracker/launch-tracker.csv','x')"`, "head tracker/launch-tracker.csv | tee tracker/launch-tracker.csv"]) {
    assert.ok(preToolUse(dir, "Bash", { command }).blocked, command);
  }
  for (const target of ["setup/policy.json", "scripts/stage-write.mjs", "scripts/write-gate.mjs"]) {
    assert.ok(preToolUse(dir, "Write", { file_path: join(dir, target) }).blocked, target);
  }
  assert.ok(!preToolUse(dir, "Bash", { command: "cat tracker/launch-tracker.csv" }).blocked, "reading stays allowed");
});
