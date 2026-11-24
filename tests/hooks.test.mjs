// The safety checks in .claude/hooks/, run the way Claude Code runs them:
// every command registered in .claude/settings.json for the tool, with the
// tool call on stdin. A hook blocks a call by exiting 2.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { copy, preToolUse, registeredHooks } from "./helpers.mjs";

const dir = copy();

test("setup/.env, where keys go, cannot be read, searched, or edited", () => {
  for (const [tool, input] of [
    ["Read", { file_path: join(dir, "setup/.env") }],
    ["Edit", { file_path: join(dir, "setup/.env"), old_string: "a", new_string: "b" }],
    ["Write", { file_path: join(dir, "setup/.env"), content: "x" }],
    ["Grep", { pattern: "KEY", path: "setup" }],
    ["Bash", { command: "cat setup/.env" }],
  ]) {
    const r = preToolUse(dir, tool, input);
    assert.ok(r.blocked, `${tool} ${JSON.stringify(input)} was not blocked`);
    assert.match(r.reasons, /setup\/\.env holds secrets/);
  }
});

test("the history files are append-only: no file tool or shell command writes them", () => {
  for (const file of ["history/launch-history.jsonl", "history/practice-history.jsonl"]) {
    assert.ok(preToolUse(dir, "Edit", { file_path: join(dir, file), old_string: "a", new_string: "b" }).blocked, `Edit ${file}`);
    assert.ok(preToolUse(dir, "Write", { file_path: join(dir, file), content: "{}" }).blocked, `Write ${file}`);
    assert.ok(preToolUse(dir, "Bash", { command: `echo '{}' >> ${file}` }).blocked, `Bash append ${file}`);
    assert.ok(preToolUse(dir, "Bash", { command: `rm ${file}` }).blocked, `Bash rm ${file}`);
  }
  assert.ok(preToolUse(dir, "Write", { file_path: join(dir, "scripts/append-store.mjs"), content: "" }).blocked, "the append script itself");
});

test("publishing, sharing, and sending through a connector are blocked", () => {
  for (const tool of ["mcp__docs__publish_page", "mcp__gmail__send_message", "mcp__drive__share_file", "mcp__slack__reply"]) {
    assert.ok(preToolUse(dir, tool, {}).blocked, tool);
  }
});

test("ordinary work is not blocked: reading and editing the playbook, reading the tracker", () => {
  for (const [tool, input] of [
    ["Read", { file_path: join(dir, "playbook/playbook.md") }],
    ["Edit", { file_path: join(dir, "playbook/playbook.md"), old_string: "a", new_string: "b" }],
    ["Bash", { command: "cat tracker/launch-tracker.csv" }],
    ["Bash", { command: "node scripts/launch-calc.mjs help" }],
  ]) {
    const r = preToolUse(dir, tool, input);
    assert.ok(r.ran > 0, `no hook is registered for ${tool}`);
    assert.ok(!r.blocked, `${tool} ${JSON.stringify(input)} was blocked: ${r.reasons}`);
  }
});

test("a key pasted into chat is stopped before Claude sees it", () => {
  const settings = registeredHooks(dir, "Read"); // sanity: hooks load
  assert.ok(settings.length > 0);
  const hook = join(dir, ".claude/hooks/guard-prompt-secrets.mjs");
  const check = (prompt) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ prompt }), encoding: "utf8" }).stdout;
  assert.match(check("here is my key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"), /"decision":"block"/);
  assert.match(check("api_key: AbCdEfGhIjKlMnOpQrStUvWx1234"), /"decision":"block"/);
  assert.equal(check("set up a practice launch for harbor-insights on 2027-02-08"), "");
});
