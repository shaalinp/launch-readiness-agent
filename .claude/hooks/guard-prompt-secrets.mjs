#!/usr/bin/env node
// Stops a prompt that looks like it contains a secret before Claude sees it.
// It still lands in local prompt history, so the message says to revoke the key.
import { readFileSync } from "node:fs";
const prompt = JSON.parse(readFileSync(0, "utf8") || "{}").prompt ?? "";
const prefixed = /\b(sk_(live|test)_|sk-ant-|ghp_|gho_|github_pat_|xox[abpr]-|AKIA[0-9A-Z]{12}|grn_)[A-Za-z0-9_-]{8,}/;
const labelled = /\b(api[_ -]?key|key|token|secret|password|bearer)\b[\s:="']+[A-Za-z0-9_\-.]{20,}/i;
const bare = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[g-zG-Z])[A-Za-z0-9_-]{32,}\b/g;
// Not keys: a Google Sheets or Drive id on its own ("1" and 32 or 43 more
// characters), and a name of lowercase words joined by hyphens, such as a
// launch's short name (at least two parts all letters, so a UUID is not one).
const notKey = (t) => /^1[A-Za-z0-9_-]{32}$|^1[A-Za-z0-9_-]{43}$/.test(t) || (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(t) && t.split("-").filter((w) => /^[a-z]{2,}$/.test(w)).length >= 2);
// A long bare token inside a link is a document or file id, such as a Google
// Sheet's, not a key. A key in a link's query is still caught by "labelled".
const unlinked = prompt.replace(/https?:\/\/\S+/g, " ");
const bareKey = (unlinked.match(bare) ?? []).some((t) => !notKey(t));
if (prefixed.test(prompt) || labelled.test(prompt) || bareKey) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "That looks like a secret, so it was not sent to Claude. If it is a real key, revoke it and create a new one. Put the new one where OPERATING.md section 05 says, in your own editor, never in chat. The text may still be in this computer's prompt history.",
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true },
  }));
}
