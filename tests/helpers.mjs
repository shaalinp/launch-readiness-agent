// Shared helpers for the tests that ship with the agent. Node built-ins only:
// run them with `node --test tests/*.test.mjs` from the repository root. Every test works
// on a fresh copy of the folder, so nothing in your copy changes.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root: the folder that holds CLAUDE.md and .claude/. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Folders a copy leaves out: git, these tests, and anything a person made by using the agent. */
const SKIP = new Set([".git", "tests", "node_modules", "launches", "practice", "history", "runs"]);

/** A fresh copy of the agent folder in a temporary directory. */
export function copy() {
  const dir = mkdtempSync(join(tmpdir(), "launch-agent-"));
  cpSync(ROOT, dir, {
    recursive: true,
    filter: (src) => {
      const rel = relative(ROOT, src);
      if (!rel) return true;
      if (SKIP.has(rel.split(sep)[0])) return false;
      return !["setup/state.json", "setup/policy.json", "setup/.env"].includes(rel.split(sep).join("/"));
    },
  });
  return dir;
}

/** Runs a script in the folder with the node that runs the tests. */
export function run(dir, script, ...args) {
  const r = spawnSync(process.execPath, [join(dir, script), ...args], { cwd: dir, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

export function write(dir, rel, value) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

export const read = (dir, rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), "utf8") : "");

/** Every PreToolUse command registered in .claude/settings.json whose matcher matches the tool. */
export function registeredHooks(dir, toolName) {
  const settings = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
  return (settings.hooks?.PreToolUse ?? [])
    .filter((entry) => new RegExp(`^(?:${entry.matcher})$`).test(toolName))
    .flatMap((entry) => entry.hooks.map((h) => h.command));
}

/**
 * Runs every registered PreToolUse hook for a tool call, as Claude Code does
 * when the folder is opened directly. Blocked when any hook exits 2.
 */
export function preToolUse(dir, tool_name, tool_input) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  delete env.CLAUDE_PLUGIN_ROOT;
  const input = JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input, cwd: dir });
  const results = registeredHooks(dir, tool_name).map((command) => {
    const r = spawnSync("sh", ["-c", command], { cwd: dir, env, input, encoding: "utf8" });
    return { command, status: r.status, stderr: r.stderr };
  });
  const blocking = results.filter((r) => r.status === 2);
  return { ran: results.length, blocked: blocking.length > 0, reasons: blocking.map((r) => r.stderr.trim()).join("\n") };
}
