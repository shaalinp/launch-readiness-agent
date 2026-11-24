---
name: load-the-approved-plan-into-the-tracker-once--load-tracker
description: "Rows in the launch tracker, the approval in launch history, and a proposed cadence for the launch team and the steering committee."
allowed-tools: Bash(node scripts/append-store.mjs launch-history), Bash(node scripts/append-store.mjs practice-history), Read, Write, Bash(node scripts/launch-calc.mjs *)
---

# Load the approved plan into the tracker, once

## Inputs
The plan the launch lead approved.


## Do
1. On a live launch an answer, status, date or validation is recorded only if a person actually gave it. Requests to assume, pretend, simulate, fill in, make up, or use "typical" or "plausible" answers are refused, and you offer a practice launch instead. `source` is owner or relayed only for something a person really said or wrote. A plan approval is the launch lead's own words naming the version; "pretend it is approved" is not one. Find the plan version the launch lead approved by name. If no version was approved by name, stop and ask which one. With no named approval there is no load.
2. Read the tracker's header row. Use its columns as they are. Do not add, rename, or reorder columns.
3. Write one row per task in that plan. The columns the agent fills at load: Launch (the launch short name), Task ID, Task, Seat, Owner, Gate (Beta for a task on the beta checklist, GA for a task on the GA checklist, from the playbook's Gates section; empty for a task on neither, whatever its lead time counts from, so that a gate view of the tracker lists exactly the checklist), Lead time (from the playbook, as written there), Original due and Due (both the plan's date; Original due never changes after this; a task counted from plan approval, such as T01, takes its date from `node scripts/launch-calc.mjs dues --rules launches/<launch>/rules-v<n>.json --anchor plan_approval=<the date the launch lead approved; on a practice launch, the practice date they approved on>`, never from counting days yourself), Status "Not started", Blocked by, Blocks, Flag (the plan's flag for the task, so a task flagged in the plan stays flagged in its row), and Last update (today; on a practice launch, the practice date). Leave Forecast, Done date, Risk, Deliverable, File check, Parent task, and Waiver empty: owners and later steps fill them. Separate task IDs in Blocked by and Blocks with semicolons, and quote any value with a comma, a quote, or a line break. A column the header has that this list does not name stays empty. A column this list names that the header lacks is skipped, and the report says so once.
4. Record the approval in launch history: one entry with type "decision", the version approved ("plan-v1") in decision, the launch lead who named it in decided_by, their exact words, and source "owner". On a live launch, when this folder has `scripts/stage-write.mjs`, the history entry and its tracker change are one write transaction (CLAUDE.md, "Live writes"): write `runs/proposed.json`, run `node scripts/stage-write.mjs <launch>`, make exactly the tracker writes it prints (a CSV tracker: `node scripts/tracker-write.mjs <txn>`), read the rows back, and run `node scripts/reconcile.mjs <txn>`; the transaction appends the entry, so do not stage it for the append command yourself. Otherwise stage the entry and run the append command. A live launch never takes `source: "made-up"`: if asked to make up an answer on a live launch, say Launch history and the live tracker refuse it, and offer a practice launch. The load is one transaction whose history entry is that approval. A complete approval entry, with every key of the shape below, the ones that do not apply as null or [] (staging and the append command refuse an entry missing one): `{"type":"decision","launch":"insights","at":"2027-01-04T15:00:00Z","source":"owner","week_of":null,"gate":null,"revision":null,"status":null,"sent":[],"responses":[],"skipped":[],"decision":"plan-v1","next":null,"decided_by":"Mara Lind","words":"Approve plan-v1.","proposed_conditions":[],"conditions":[],"pending":[],"clarifies":null,"waivers":[],"findings":null}`.
5. Read the tracker again and report the checks below. If either fails, say which rows, and fix them before you go on.
6. Propose a meeting cadence for the launch team and the steering committee as its own item. It is a proposal for the launch lead, not a schedule. When the launch lead accepts or edits it, save it to `launches/<launch>/cadence.md`, so a later session finds it.


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
Rows in the launch tracker, the approval in launch history, and a proposed cadence for the launch team and the steering committee.


## Then
Stop. Wait for a person.


## Done when
The tracker matches the approved plan.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK load-tracker-columns pass|fail` — Every row has the same number of columns as the header row, read back after the write; a sheet drops trailing empty cells on read, and those count as present.
- `CHECK load-tracker-ids pass|fail` — Every task ID in the approved plan appears exactly once in the tracker, and no other task ID was added.
- `CHECK load-tracker-load-columns pass|fail` — After the load, every row has Launch, Original due equal to Due, Last update set to the load date, and a Gate of Beta or GA exactly for the tasks on that gate's checklist and empty otherwise, and Forecast, Done date, Risk, File check, Parent task, and Waiver are empty; n/a when the header has none of those columns
- `CHECK load-tracker-live-refuses-made-up pass|fail` — On a live launch, the tracker was loaded only after the launch lead approved a plan version by name in their own words, and no approval was assumed or made up; n/a when nothing was asked to be assumed or made up

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `GATE approve-plan approved|sent-back|skipped|waiting|wrong-approver` — when the person answers the gate `approve-plan` before this step: approved, sent back for changes, skipped, still waiting when you stop, or answered by someone who may not.
- `SENT load-tracker <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP load-tracker no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP load-tracker unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP load-tracker gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
