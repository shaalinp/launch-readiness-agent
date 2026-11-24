#!/usr/bin/env node
// Decides outbound MCP calls by connections.json, not by words in the tool name.
// Allowed: any tool a declared action lists (any server), any declared server,
// and the desktop app's own mcp__ccd_* tools. Blocked (exit 2): publish, share,
// and send on anything else, and publishing an artifact. Asked: any other
// write-like call on an undeclared connector. Reads are never touched.
// It does nothing from a plugin install, where it would run in every session.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
if (process.env.CLAUDE_PLUGIN_ROOT) process.exit(0);
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const name = String(input.tool_name ?? "");
const HARD_DENY = /(^|[_-])(publish|share|send|reply|forward)([_-]|$)/;
const WRITE_LIKE = /(^|[_-])(send|post|publish|share|delete|trash|remove|forward|reply|invite|update|upload|schedule|append|create|write|insert|clear|copy|move|rename|set|add|edit|patch)([_-]|$)/;
const norm = (t) => t.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const servers = new Set([]);
const tools = new Set();
const unset = [];
try {
  const root = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const file = JSON.parse(readFileSync(join(root, "connections.json"), "utf8"));
  for (const c of file.connections ?? []) {
    // A server in .mcp.json is declared whole, as before. A claude.ai
    // connector is declared action by action: its tools are allowed by name,
    // and anything else on it (share_file, trash_file) is judged like any
    // undeclared call.
    if (!c.connector) {
      servers.add(String(c.entryId).toLowerCase());
      servers.add(String(c.name).toLowerCase());
    }
    for (const a of c.actions ?? []) for (const t of a.tools ?? []) tools.add(norm(String(t)));
  }
  for (const s of file.systems ?? []) if (s.status !== "bound") unset.push(s);
} catch {
  // No connections.json next to this hook: nothing is declared, so a write
  // asks and a publish blocks, as below.
}
const deny = (what) => {
  console.error(`Blocked: ${what}. This workflow does not publish, and the agent never contacts anyone. Draft it for the person to send.`);
  process.exit(2);
};
const ask = (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: reason } }));
  process.exit(0);
};
if (name === "Artifact") {
  if ([undefined, "publish", "delete"].includes(input.tool_input?.action)) deny("publishing an artifact");
  process.exit(0);
}
const m = /^mcp__(.+?)__(.+)$/.exec(name);
if (!m) process.exit(0);
const [, server, tool] = m;
// The desktop app's own tools: the task list, sessions, panes. Local, not outbound.
if (/^ccd_/i.test(server)) process.exit(0);
const words = norm(tool);
if (servers.has(server.toLowerCase())) process.exit(0);
if (tools.has(words)) process.exit(0);
if (HARD_DENY.test(words)) deny(`${tool} on ${server}, which publishes, shares, or sends, and no declared action in connections.json covers it`);
if (WRITE_LIKE.test(words)) {
  const missing = unset
    .map((s) => `${s.name} is not connected in connections.json (the workflow needs ${(s.actions ?? []).join(", ") || "a connector"} on it); when the person names the tool, run node scripts/bind-system.mjs ${s.systemId} <connector> and try again.`)
    .join(" ");
  ask(`${tool} on ${server} looks like a write, and no declared action in connections.json covers it. ${missing || "Every system on the board is connected, so this call is outside the workflow."} Approve only if it is the write the current step asks for.`);
}
