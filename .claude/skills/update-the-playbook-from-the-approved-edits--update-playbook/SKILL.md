---
name: update-the-playbook-from-the-approved-edits--update-playbook
description: "The playbook template the next launch's setup will read."
allowed-tools: Bash(node scripts/append-store.mjs launch-history), Bash(node scripts/append-store.mjs practice-history), Read, Write
---

# Update the playbook from the approved edits

## Inputs
The edits the launch lead accepted.


## Do
1. Read the retro file and the launch lead's answer on each numbered edit. An edit with no answer is not accepted.
2. Apply only the accepted edits, and the edited ones as the launch lead edited them.
3. Keep the playbook's structure. If an accepted edit does not fit it, ask the launch lead before you change the structure.
4. Add one line per applied edit to the playbook's change log: the edit's id, what changed, and the date. An edit's id is `<launch> <n>` (the launch's short name and the retro's edit number), so edits from different launches never share a number.
5. Add one entry with type "retro" to launch history: the retro's findings (slips with days, bottlenecks, waivers, conditions met, goals against results, and owner response times as the retro gave them, simulated and not measurable included) in findings, the launch lead in decided_by, their answer on the edits in words, and source "owner". On a live launch with `scripts/stage-write.mjs`, this entry goes through a write transaction with no tracker change (CLAUDE.md, "Live writes"). The next launch's retro reads it to flag repeats. A complete retro entry, with every key of the shape below, the ones that do not apply as null or [] (staging and the append command refuse an entry missing one): `{"type":"retro","launch":"insights","at":"2027-05-03T10:00:00Z","source":"owner","week_of":null,"gate":null,"revision":null,"status":null,"sent":[],"responses":[],"skipped":[],"decision":null,"next":null,"decided_by":"Mara Lind","words":"Accept 1 and 3, edit 2 to 15 working days, reject 4.","proposed_conditions":[],"conditions":[],"pending":[],"clarifies":null,"waivers":[],"findings":{"slips":[{"task":"T04","days":8}],"bottlenecks":["Legal"],"waivers":[],"conditions_met":["C01"],"goals":[{"metric":"early-access accounts","target":"20","result":"17"}],"response_times":["Ana Ruiz: 1 answer, measured, 1 day"]}}`.


## Writes back
Update these when the job is done.

- **Launch history** — `history/launch-history.jsonl` in this folder. Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead.
  Append only, one JSON object per line; your file tools are denied on this file. A live launch's entry is never staged in `history/launch-history.jsonl.next/` and never appended by you: it is the `history` of a write transaction in `runs/proposed.json` (CLAUDE.md, "Live writes"), and the transaction adds it once every tracker change in it is verified. `node scripts/stage-write.mjs <launch>` checks it first against Launch history's contract (in `scripts/entry-contracts.mjs`) and refuses an entry that does not meet it, naming the field, or that holds a made-up answer anywhere; fix that field and stage it again. `node scripts/append-store.mjs launch-history` refuses an entry that did not come from a transaction. The entry needs every field in the shape below. To check the result, read `history/launch-history.jsonl` with your Read tool afterwards. Only a practice launch runs the append command itself, for Practice history (below). If `scripts/stage-write.mjs` is not in this folder, as when this bundle is installed as a plugin, stop and say the entry cannot be added safely here. Do not write the file another way.
- **Practice history** — `history/practice-history.jsonl` in this folder. The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch.
  Append only, one JSON object per line. Your file tools are denied on this file, so an earlier entry cannot be rewritten. Write the new entry as one JSON object to a new file in `history/practice-history.jsonl.next/` with a name no other run would use, such as `<step>-<time>.json`, then run `node scripts/append-store.mjs practice-history` as its own command, exactly as written: no `cd`, no `&&`, `;` or `|`, and nothing before or after it. Only that exact command is approved in advance, so anything added to it stops the run for a permission prompt. It runs from this folder's root, the one that holds `CLAUDE.md`: if an earlier command changed directory, `cd` back to the root as a command of its own first. To check the result, read `history/practice-history.jsonl` with your Read tool afterwards. It checks each staged entry and adds it as a line at the end, with a `staged_as` id it uses to recover from an interrupted run. The entry needs every field in the shape below. It also checks each entry against Practice history's contract for its type (in `scripts/entry-contracts.mjs`) and refuses one that does not meet it, naming the field; fix that field and stage the entry again. If it fails, say what it printed and stop. If `scripts/append-store.mjs` is not in this folder, as when this bundle is installed as a plugin, stop and say the entry cannot be added safely here. Do not write the file another way.

### Shape of Launch history

```json
{
  "type": "week | gate-decision | decision | retro | clarification",
  "launch": "<launch>, as in the plan's file names",
  "at": "YYYY-MM-DDTHH:MM:SSZ, when this entry was written",
  "source": "owner | relayed | made-up: owner when the person who decided or answered said it to you; relayed when the launch lead passes on someone else's answer; made-up when it was invented for a practice scenario. Launch history refuses made-up anywhere in the entry; Practice history takes it",
  "week_of": "week: YYYY-MM-DD, the Monday of the week; otherwise null",
  "gate": "gate-decision: the gate's short name from the plan (beta, ga); otherwise null",
  "revision": "gate-decision: 1 for the first review of this gate, 2 for a re-run after a no-go, then 3; otherwise null",
  "status": "week: { done: [task IDs], red: [], amber: [], green: [], unvalidated: [] }; otherwise null",
  "sent": "week: one item per draft the launch lead says they sent: [{ draft: its number, revision: 1 for the week's first drafts file, 2 or 3 for a same-week revision, tasks: [the task IDs it nudged, from the drafts index; [] when the drafts file does not say], sent_on: YYYY-MM-DD the launch lead says it went out, or null when they do not know, to: the owner it went to, or null }]; otherwise []. Older entries hold draft numbers only: read one as a draft with no task or date evidence, and never rewrite it",
  "responses": "week: one item per owner answer recorded this week: [{ task, owner, on: YYYY-MM-DD they answered, or null when unknown, answers: { week, draft, revision } of the nudge it answers (the latest one for that task sent before it), or null when no nudge asked, source: only when it differs from the entry's, such as made-up for a reply invented in a practice scenario, dated with its practice date }]; otherwise []. A skipped week has no entry and no answers. Older entries may lack this field: read it as []",
  "skipped": "week: [{ draft: number, reason }]; otherwise []",
  "decision": "gate-decision: go | go with conditions | no-go; decision: the plan version and option approved, such as plan-v2 option B; otherwise null",
  "next": "gate-decision no-go: the new date as the decider gave it (YYYY-MM-DD), or \"to be proposed\"; otherwise null",
  "decided_by": "who decided or approved, as they named themselves; when the launch lead relays someone else's answer, that person, with the relay in words",
  "words": "their exact words",
  "proposed_conditions": "gate-decision: [{ id, text, owner, due }] as the packet proposed them, or []; otherwise []",
  "conditions": "gate-decision and clarification: only what the decider adopted: [{ id, text, owner, due, missing: [the fields among text, owner, due the decider did not give, each null], adopted_from: \"packet\" when the decider adopted a condition the packet proposed, \"decider\" when they set it themselves, words: the decider's words for it, never blank }], or []",
  "pending": "gate-decision: [\"conditions\"] when the decider said go with conditions and gave none yet; otherwise []",
  "clarifies": "clarification: { gate, revision } of the gate decision whose conditions it adds; otherwise null",
  "waivers": "[{ item, reason }], or []",
  "findings": "retro: { slips: [{ task, days }], bottlenecks: [seat or person], waivers: [item], conditions_met: [condition ids], goals: [{ metric, target, result }], response_times: [the by_owner lines of launch-calc.mjs responses, each measured, week-level, simulated, or not measurable as it says] }; otherwise null"
}
```

### Shape of Practice history

```json
{
  "type": "week | gate-decision | decision | retro | clarification",
  "launch": "<launch>, as in the plan's file names",
  "at": "YYYY-MM-DDTHH:MM:SSZ, when this entry was written",
  "source": "owner | relayed | made-up: owner when the person who decided or answered said it to you; relayed when the launch lead passes on someone else's answer; made-up when it was invented for a practice scenario. Launch history refuses made-up anywhere in the entry; Practice history takes it",
  "week_of": "week: YYYY-MM-DD, the Monday of the week; otherwise null",
  "gate": "gate-decision: the gate's short name from the plan (beta, ga); otherwise null",
  "revision": "gate-decision: 1 for the first review of this gate, 2 for a re-run after a no-go, then 3; otherwise null",
  "status": "week: { done: [task IDs], red: [], amber: [], green: [], unvalidated: [] }; otherwise null",
  "sent": "week: one item per draft the launch lead says they sent: [{ draft: its number, revision: 1 for the week's first drafts file, 2 or 3 for a same-week revision, tasks: [the task IDs it nudged, from the drafts index; [] when the drafts file does not say], sent_on: YYYY-MM-DD the launch lead says it went out, or null when they do not know, to: the owner it went to, or null }]; otherwise []. Older entries hold draft numbers only: read one as a draft with no task or date evidence, and never rewrite it",
  "responses": "week: one item per owner answer recorded this week: [{ task, owner, on: YYYY-MM-DD they answered, or null when unknown, answers: { week, draft, revision } of the nudge it answers (the latest one for that task sent before it), or null when no nudge asked, source: only when it differs from the entry's, such as made-up for a reply invented in a practice scenario, dated with its practice date }]; otherwise []. A skipped week has no entry and no answers. Older entries may lack this field: read it as []",
  "skipped": "week: [{ draft: number, reason }]; otherwise []",
  "decision": "gate-decision: go | go with conditions | no-go; decision: the plan version and option approved, such as plan-v2 option B; otherwise null",
  "next": "gate-decision no-go: the new date as the decider gave it (YYYY-MM-DD), or \"to be proposed\"; otherwise null",
  "decided_by": "who decided or approved, as they named themselves; when the launch lead relays someone else's answer, that person, with the relay in words",
  "words": "their exact words",
  "proposed_conditions": "gate-decision: [{ id, text, owner, due }] as the packet proposed them, or []; otherwise []",
  "conditions": "gate-decision and clarification: only what the decider adopted: [{ id, text, owner, due, missing: [the fields among text, owner, due the decider did not give, each null], adopted_from: \"packet\" when the decider adopted a condition the packet proposed, \"decider\" when they set it themselves, words: the decider's words for it, never blank }], or []",
  "pending": "gate-decision: [\"conditions\"] when the decider said go with conditions and gave none yet; otherwise []",
  "clarifies": "clarification: { gate, revision } of the gate decision whose conditions it adds; otherwise null",
  "waivers": "[{ item, reason }], or []",
  "findings": "retro: { slips: [{ task, days }], bottlenecks: [seat or person], waivers: [item], conditions_met: [condition ids], goals: [{ metric, target, result }], response_times: [the by_owner lines of launch-calc.mjs responses, each measured, week-level, simulated, or not measurable as it says] }; otherwise null"
}
```


## Output
The playbook template the next launch's setup will read.


## Then
Stop. Wait for a person.


## Done when
Only accepted edits are in the playbook.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK update-playbook-accepted-and-edited-applied pass|fail` — The playbook holds every accepted edit as written and every edited one in the launch lead's wording, and nothing else changed
- `CHECK update-playbook-no-answer-not-applied pass|fail` — No edit without an explicit answer from the launch lead is in the playbook
- `CHECK update-playbook-structure-misfit-asks-first pass|fail` — No section was added or renamed without the launch lead's answer first; n/a when every accepted edit fit the existing sections
- `CHECK update-playbook-nothing-accepted pass|fail` — If no edit was accepted, the playbook is unchanged; n/a when at least one was

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `GATE approve-playbook approved|sent-back|skipped|waiting|wrong-approver` — when the person answers the gate `approve-playbook` before this step: approved, sent back for changes, skipped, still waiting when you stop, or answered by someone who may not.
- `SENT update-playbook <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP update-playbook no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP update-playbook unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP update-playbook gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
