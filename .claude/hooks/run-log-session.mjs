#!/usr/bin/env node
// Records that a session started and on which model, in runs/log.jsonl. It
// never blocks and prints nothing, because what a SessionStart hook prints is
// added to the conversation. It does nothing from a plugin install. Generated
// by Agent Studio. It needs no packages.
import { readFileSync } from "node:fs";

if (process.env.CLAUDE_PLUGIN_ROOT) process.exit(0);
try {
  const input = JSON.parse(readFileSync(0, "utf8") || "{}");
  const sessionId = String(input.session_id || "");
  if (sessionId) {
    const log = await import("./run-log.mjs");
    const source = input.source === "startup" || input.source === "resume" ? input.source : "other";
    const model = typeof input.model !== "string" ? "unknown" : log.VOCAB.models.includes(input.model) ? input.model : "other";
    log.append(log.projectRoot(), sessionId, [{ kind: "session", source, model }]);
  }
} catch {}
process.exit(0);
