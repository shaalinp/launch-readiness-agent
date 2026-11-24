#!/usr/bin/env node
// Blocks the file tools, and Bash writes, on append-only stores and on scripts/append-store.mjs.
// Exit 2 blocks the tool. Hooks travel with a plugin install; permission rules
// do not, so this is the rule that always applies.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const stores = ["history/launch-history.jsonl","history/practice-history.jsonl"];
const appendCommands = ["node scripts/append-store.mjs launch-history","node scripts/append-store.mjs practice-history"];
// Bash: the append command runs alone, exactly as allowed; nothing in Bash
// writes to a store or touches the script. Reading a store is fine.
const command = input.tool_name === "Bash" ? input.tool_input?.command : undefined;
if (typeof command === "string") {
  const cmd = command.trim();
  const lower = cmd.toLowerCase();
  if (/^node scripts\/launch-calc\.mjs( [A-Za-z0-9_.:\/=,-]+)*$/.test(cmd)) process.exit(0);
  const writes = /(\d?>(?!&\d|\/dev\/null)|\btee\b|\bsed\s+(-[a-z]*i|--in-place)|\bperl\s+-[a-z]*i|\brm\b|\bmv\b|\bcp\b|\bdd\b|\btruncate\b|\bchmod\b|\bgit\s+(checkout|restore|clean)\b|\bpython3?\b|\bnode\b)/;
  if ((lower.includes("append-store.mjs") || lower.includes("entry-contracts.mjs")) && !appendCommands.includes(cmd) && writes.test(lower)) {
    console.error(`Run the append command on its own, exactly as allowed: ${appendCommands.join(" or ")}. Do not chain it, wrap it, or pass it anything else.`);
    process.exit(2);
  }
  const outsideStaging = stores.reduce((text, p) => text.split(p.split("/").pop().toLowerCase() + ".next").join(""), lower);
  const touchesStore = stores.some((p) => outsideStaging.includes(p.split("/").pop().toLowerCase()));
  if (touchesStore && writes.test(outsideStaging)) {
    console.error("This file is append-only. Stage the entry in its .next/ folder and run scripts/append-store.mjs with the store's id. Nothing else may change it.");
    process.exit(2);
  }
}
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (typeof target === "string") {
  const cwd = input.cwd ?? process.cwd();
  const project = process.env.CLAUDE_PROJECT_DIR ?? cwd;
  const kept = [
    ...["history/launch-history.jsonl","history/practice-history.jsonl","scripts/append-store.mjs","scripts/entry-contracts.mjs"].map((p) => resolve(project, p)),
    ...(process.env.CLAUDE_PLUGIN_ROOT ? ["scripts/append-store.mjs","scripts/entry-contracts.mjs"].map((p) => resolve(process.env.CLAUDE_PLUGIN_ROOT, p)) : []),
  ].map((p) => p.toLowerCase());
  if (kept.includes(resolve(cwd, target).toLowerCase())) {
    console.error("This file is append-only. Stage the entry in its .next/ folder and run scripts/append-store.mjs with the store's id. Nothing else may change it.");
    process.exit(2);
  }
}
