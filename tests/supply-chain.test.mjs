// What SECURITY.md promises about the code itself: no dependencies, no network
// calls but one listed link check, no programs started but the folder's own
// scripts, and no secrets or personal data shipped.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { ROOT } from "./helpers.mjs";

/** Every script the agent runs: scripts/, .claude/hooks/, and evals/. */
function scripts() {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs|sh)$/.test(name)) out.push(p);
    }
  };
  for (const d of ["scripts", ".claude/hooks", "evals"]) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));
  return out.map((p) => ({ path: relative(ROOT, p).split("\\").join("/"), text: readFileSync(p, "utf8") }));
}

test("there is nothing to install: no package.json, and scripts import only Node built-ins and each other", () => {
  assert.ok(!existsSync(join(ROOT, "package.json")), "a package.json would mean dependencies");
  assert.ok(!existsSync(join(ROOT, "node_modules")));
  for (const { path, text } of scripts()) {
    // from "x", a bare import "x", import("x"), and require("x").
    for (const m of text.matchAll(/(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g)) {
      assert.ok(m[1].startsWith("node:") || m[1].startsWith("./") || m[1].startsWith("../"), `${path} imports ${m[1]}`);
    }
  }
});

/** The one network call: a HEAD request to the URLs the user put in connections.json. */
const NETWORK_ALLOWED = { "scripts/check-connections.mjs": 1 };
const NETWORK = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|["'](?:node:)?(?:http|https|http2|net|tls|dgram|dns)(?:\/[\w/]+)?["']|\bcurl\s|\bwget\s/g;

test("no script opens a network connection, except the one listed link check", () => {
  for (const { path, text } of scripts()) {
    const hits = text.match(NETWORK) ?? [];
    assert.equal(hits.length, NETWORK_ALLOWED[path] ?? 0, `${path}: ${hits.join(", ")}`);
  }
  const check = readFileSync(join(ROOT, "scripts/check-connections.mjs"), "utf8");
  assert.match(check, /fetch\(url, \{ method: "HEAD", signal: AbortSignal\.timeout\(5000\) \}\)/);
});

/** The text of a call, from its opening parenthesis to the matching close. */
function callText(text, open) {
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === "(") depth++;
    else if (text[k] === ")" && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}

test("scripts start no program but node running a script in this folder", () => {
  const SPAWNS = ["spawnSync", "spawn", "execFileSync", "execFile"];
  for (const { path, text } of scripts()) {
    if (!/child_process/.test(text)) continue;
    // Only named imports of spawn-style functions, which take a program and its arguments, never a shell line.
    assert.ok(!/import\s+(?:\*\s+as\s+\w+|\w+)\s*(?:,|from)[^;]*["']node:child_process["']/.test(text), `${path} imports child_process whole`);
    assert.ok(!/require\s*\(\s*["'](?:node:)?child_process["']\s*\)/.test(text), `${path} requires child_process`);
    const imports = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']node:child_process["']/g)];
    assert.equal(imports.length, 1, `${path}: one named import of child_process`);
    for (const part of imports[0][1].split(",").map((n) => n.trim()).filter(Boolean)) {
      assert.ok(!/\sas\s/.test(part), `${path} renames ${part}`);
      assert.ok(SPAWNS.includes(part), `${path} imports ${part}, which runs a shell`);
    }
    // Every call: node itself, on a script in scripts/, with no shell option and no inline code.
    for (const m of text.matchAll(/(?<![.\w])(spawnSync|spawn|execFileSync|execFile)\s*\(/g)) {
      const call = callText(text, m.index + m[0].length - 1);
      assert.match(call, /^\(\s*process\.execPath\s*,\s*\[\s*abs\(\s*"scripts\/[\w-]+\.mjs"\s*\)/, `${path} starts something other than node on a script here: ${call.slice(0, 80)}`);
      assert.ok(!/\bshell\s*:/.test(call), `${path} passes a shell option`);
      assert.ok(!/["'](?:-e|--eval|-p|--print|--import|--require|-r)["']/.test(call), `${path} passes node inline code or a preload`);
    }
  }
});

/** What a release must not contain: your keys, setup, and launch data. */
const NOT_IN_A_RELEASE = ["setup/.env", "setup/state.json", "setup/policy.json", "launches", "practice", "history", "runs"];

/** Files under a folder, recursively. Empty folders don't count: git does not keep them. */
function filesUnder(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs).flatMap((n) => filesUnder(`${rel}/${n}`));
}

// The release itself, as committed: CI checks out exactly what is in the
// repository, so there the folder must hold no keys and no launch data. In
// your own copy, after you use the agent, these files are yours and expected.
const releaseTree = process.env.CI === "true" || process.env.RELEASE_TREE === "1";

test("the release holds no keys, no setup, and no launch data", { skip: releaseTree ? false : "only on the release itself (CI); your copy holds your own data" }, () => {
  for (const rel of NOT_IN_A_RELEASE) assert.deepEqual(filesUnder(rel), [], `${rel} is in the release`);
  assert.deepEqual(filesUnder("launch-folder").filter((f) => f !== "launch-folder/README.md"), [], "launch-folder holds only its README");
});

test("no secrets file and no personal data ship", () => {
  assert.match(readFileSync(join(ROOT, ".gitignore"), "utf8"), /^setup\/\.env$/m, "setup/.env, where your keys go, is never committed");
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (d === ROOT && [".git", "node_modules", "tests"].includes(name)) continue;
      // In your own copy, your keys and launch data are yours. On the release they are checked above.
      if (!releaseTree && (d === ROOT && ["launches", "practice", "history", "runs"].includes(name))) continue;
      if (!releaseTree && d === join(ROOT, "setup") && name === ".env") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (!/\.xlsx$/.test(name)) files.push(p);
    }
  };
  walk(ROOT);
  for (const p of files) {
    const text = readFileSync(p, "utf8");
    assert.ok(!/[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|invalid)\b)[A-Za-z0-9.-]+\.[a-z]{2,}/.test(text), `${relative(ROOT, p)} has an email address`);
    assert.ok(!/\bsk-ant-[A-Za-z0-9_-]{8,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b/.test(text), `${relative(ROOT, p)} has a key`);
  }
});
