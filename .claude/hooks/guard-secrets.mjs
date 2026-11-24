#!/usr/bin/env node
// Blocks any tool call that would read, write, or search setup/.env. Exit 2 blocks the tool.
// Hooks travel with a plugin install; permission rules do not, so this is the rule that always applies.
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
// Either slash, any case: setup\.env on Windows and SETUP/.env on a
// case-insensitive disk are the same file.
const secret = /(^|[\\/\s"'=])setup[\\/]\.env(?![.\w])/i;
const dir = /(^|[\\/])setup[\\/]?$/i;
const values = Object.values(input.tool_input ?? {}).filter((v) => typeof v === "string");
const hit = values.some((v) => secret.test(v)) || (input.tool_name === "Grep" && dir.test(input.tool_input?.path ?? ""));
if (hit) {
  console.error("setup/.env holds secrets. Claude does not read, search, or edit it. Paste keys there in your own editor, then run node scripts/check-connections.mjs.");
  process.exit(2);
}
