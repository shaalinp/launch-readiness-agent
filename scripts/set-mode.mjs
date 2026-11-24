#!/usr/bin/env node
// Registers a launch's mode, and a practice launch's own tracker, in
// setup/policy.json, which the live write gate reads (CLAUDE.md, "Live writes").
//
//   node scripts/set-mode.mjs <launch> live
//   node scripts/set-mode.mjs <launch> practice practice/<launch>/launch-tracker.csv   (or a Google Sheet link)
//
// A live launch writes the tracker bound in connections.json. A launch's mode
// never changes once set: a live launch stays live, and practice is a new
// launch. A practice tracker may not be the live tracker, and two practice
// launches never share one: each practice launch's files live in
// practice/<launch>/. Nothing changes while a live write transaction is open. Only this script and
// scripts/bind-system.mjs change setup/policy.json.
import { existsSync } from "node:fs";
import {
  LAUNCH_RE, POLICY_PATH, SETUP, abs, classify, describeDestination, destinationFrom, emptyPolicy, fail, liveDestinationFromConnections,
  loadPolicy, openTxns, sameDestination, writeJsonAtomic,
} from "./write-gate.mjs";

const args = process.argv.slice(2);
const [launch, mode, tracker] = args;
const usage = "Usage: node scripts/set-mode.mjs <launch> live, or node scripts/set-mode.mjs <launch> practice <tracker CSV path or Google Sheet link>. setup/policy.json is unchanged.";
if (!LAUNCH_RE.test(launch ?? "") || launch === SETUP || !["live", "practice"].includes(mode)) fail(usage);
if (mode === "live" ? args.length !== 2 : args.length !== 3) fail(usage);
const refuse = (why) => fail(`Not changed: ${why} ${POLICY_PATH} is unchanged.`);

const open = openTxns();
if (open.length) refuse(`live write transaction ${open[0].id} is open. Finish or discard it first (node scripts/reconcile.mjs --status).`);

let policy;
if (existsSync(abs(POLICY_PATH))) {
  const loaded = loadPolicy();
  if (!loaded.ok) refuse(loaded.problem);
  policy = loaded.policy;
} else policy = emptyPolicy();

const current = policy.launches[launch];
if (current && current.mode !== mode) {
  refuse(`${launch} is already a ${current.mode} launch, and a launch's mode never changes. ${current.mode === "live" ? `For a rehearsal, set up a practice launch with its own name (${launch}-practice).` : "A live launch needs its own name."}`);
}

if (mode === "live") {
  if (!policy.live_tracker) policy.live_tracker = liveDestinationFromConnections();
  policy.launches[launch] = { mode: "live" };
  writeJsonAtomic(POLICY_PATH, policy);
  console.log(`${launch} is a live launch. Its tracker is ${describeDestination(policy.live_tracker)}${policy.live_tracker ? "" : " (none bound yet: bind it with node scripts/bind-system.mjs sys-tracker <connector> <location>)"}; every change to it, and every Launch history entry, goes through node scripts/stage-write.mjs ${launch}.`);
  process.exit(0);
}

const dest = destinationFrom(tracker);
if (!dest) refuse(`${JSON.stringify(tracker)} is neither a .csv path inside this folder nor a Google Sheet link.`);
const live = [policy.live_tracker, liveDestinationFromConnections()].filter(Boolean);
if (live.some((d) => sameDestination(d, dest)) || classify(policy, dest) === "live") {
  refuse(`${describeDestination(dest)} is the live tracker. A practice launch needs its own copy.`);
}
// Each practice launch has its own tracker, so one practice launch's rows never mix with another's.
const sharer = Object.entries(policy.launches).find(([name, l]) => name !== launch && l.mode === "practice" && sameDestination(l.tracker, dest));
if (sharer) refuse(`${describeDestination(dest)} is already ${sharer[0]}'s practice tracker, and two practice launches never share one. Give ${launch} its own: practice/${launch}/launch-tracker.csv${dest.kind === "sheets" ? ", or its own practice sheet" : ""}.`);
const inFolder = dest.kind === "csv" ? /^practice\/([^/]+)\//i.exec(dest.path) : null;
if (inFolder && inFolder[1].toLowerCase() !== launch) refuse(`${dest.path} is in ${inFolder[1]}'s practice folder. ${launch}'s files live in practice/${launch}/: practice/${launch}/launch-tracker.csv.`);
if (current && !sameDestination(current.tracker, dest)) {
  // Re-pointing a practice launch's tracker is allowed; its mode is not.
  console.log(`${launch}'s practice tracker moves from ${describeDestination(current.tracker)} to ${describeDestination(dest)}.`);
}
policy.launches[launch] = { mode: "practice", tracker: dest };
writeJsonAtomic(POLICY_PATH, policy);
console.log(`${launch} is a practice launch on ${describeDestination(dest)}. Its tracker is written directly, and its entries go to Practice history.`);
