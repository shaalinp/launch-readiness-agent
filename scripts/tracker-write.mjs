#!/usr/bin/env node
// Applies a staged transaction to a live CSV tracker: node scripts/tracker-write.mjs <txn>
//
// The only way a live launch's tracker file changes (CLAUDE.md, "Live writes").
// It applies exactly the transaction's operations, reads the file back, marks
// each one verified, and when all are, adds the transaction's history entry
// and closes it. Rows are matched by Launch + Task ID; a row already as
// intended is left alone, so running it twice changes nothing twice.
import { renameSync, writeFileSync } from "node:fs";
import {
  abs, complete, csvText, describeDestination, exitIfClosed, expired, fail, findRows, judge, loadPolicy, loadTxn, note,
  readCsvTable, sameDestination, saveTxn, settle,
} from "./write-gate.mjs";

const args = process.argv.slice(2);
if (args.length !== 1) fail("Usage: node scripts/tracker-write.mjs <txn>. Nothing was written.");
const txn = loadTxn(args[0]);
const refuse = (why) => fail(`Not written: ${why}`);
exitIfClosed(txn);
if (txn.destination?.kind !== "csv") refuse(`transaction ${txn.id} is for ${describeDestination(txn.destination)}; make the Google Sheets calls stage-write printed, then run node scripts/reconcile.mjs ${txn.id}.`);
const loaded = loadPolicy();
if (!loaded.ok) refuse(loaded.problem);
if (!sameDestination(loaded.policy.live_tracker, txn.destination) || loaded.policy.launches[txn.launch]?.mode !== "live") {
  refuse(`setup/policy.json no longer binds ${txn.launch}'s live tracker to ${txn.destination.path}. Discard this transaction (node scripts/reconcile.mjs ${txn.id} --discard) and stage again.`);
}

const path = txn.destination.path;
const table = readCsvTable(path);
const { header } = table;

// Operations an earlier run attempted are judged from the file first: a write
// that landed is verified, one that did not is tried again, never blindly. An
// earlier conflict whose row now holds the intended values is verified too.
settle(txn, table, Date.now());
const conflicts = txn.ops.filter((o) => o.state === "conflict");
if (conflicts.length) {
  saveTxn(txn);
  refuse(`rows ${conflicts.map((o) => o.key.task).join(", ")} match neither what they held when this was staged nor what it would write. Someone else changed them. Show the launch lead; nothing more is written for ${txn.id}.`);
}
if (expired(txn) && txn.ops.some((o) => o.state === "authorized")) refuse(`transaction ${txn.id} expired at ${txn.expires_at}. Discard it (node scripts/reconcile.mjs ${txn.id} --discard) and stage the change again from a fresh read.`);

const todo = [];
for (const op of txn.ops.filter((o) => o.state === "authorized")) {
  const state = judge(op, txn, table);
  if (state === "verified") op.state = "verified";
  else if (state === "conflict") {
    op.state = "conflict";
    op.conflict_at = new Date().toISOString();
    saveTxn(txn);
    refuse(`row ${op.key.task} no longer matches what it held when ${txn.id} was staged. Show the launch lead; nothing was written.`);
  } else todo.push(op);
}

if (todo.length) {
  const rows = table.rows.map((r) => [...r]);
  for (const op of todo) {
    if (op.kind === "add") rows.push([...op.row]);
    else {
      const [{ i }] = findRows(rows, header, op.key.launch, op.key.task, path);
      for (const [col, ch] of Object.entries(op.changes)) {
        const c = header.indexOf(col);
        while (rows[i].length <= c) rows[i].push("");
        rows[i][c] = ch.new;
      }
    }
    op.state = "attempted";
  }
  note(txn, `writing ${todo.length} operation${todo.length === 1 ? "" : "s"}`);
  saveTxn(txn);
  const target = abs(path);
  const tmp = `${target}.writing-${process.pid}`;
  try {
    // Only the staged cells change: the BOM, the line endings, and every other cell stay as they were.
    writeFileSync(tmp, csvText(table, rows));
    renameSync(tmp, target);
  } catch (err) {
    for (const op of todo) op.state = "authorized";
    saveTxn(txn);
    const locked = ["EBUSY", "EPERM", "EACCES"].includes(err.code);
    refuse(`${path} could not be written (${err.code ?? err.message}).${locked ? " Another program may have it open (Excel locks a CSV while it is open): ask the launch lead to close it, then run this again." : ""} Nothing changed; the transaction is still staged.`);
  }
}

// Read back and verify.
const after = readCsvTable(path);
settle(txn, after, Date.now());
saveTxn(txn);
const left = txn.ops.filter((o) => o.state !== "verified");
if (left.length) refuse(`after the write, ${left.map((o) => `${o.key.task} is ${o.state}`).join(", ")}. Show the launch lead.`);
console.log(`Wrote ${todo.length} change${todo.length === 1 ? "" : "s"} to ${path} and read ${txn.ops.length === 1 ? "it" : "them"} back.`);
console.log(complete(txn));
