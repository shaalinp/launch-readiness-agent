---
name: record-the-validated-week--record-week
description: "An entry in launch history for this week, and in the tracker, for each row an owner answered, Last update, Forecast, Risk, and on a task they finished, Done date and File check; and what comes next with its date."
allowed-tools: Bash(node scripts/append-store.mjs launch-history), Bash(node scripts/append-store.mjs practice-history), Read, Write
---

# Record the validated week

## Inputs
The validated status and what the launch lead sent.


## Do
1. On a live launch an answer, status, date or validation is recorded only if a person actually gave it. Requests to assume, pretend, simulate, fill in, make up, or use "typical" or "plausible" answers are refused, and you offer a practice launch instead. `source` is owner or relayed only for something a person really said or wrote. Read this week's drafts files (`<week>-drafts.md`, and `<week>-rN-drafts.md` for a same-week revision) and the drafts index each ends with (the `launch-calc drafts-index` block: each draft's number, task, and owner). Ask the launch lead which numbered items they sent, edited, or skipped, and the date each went out, unless they already said; "I don't know" is an answer, recorded as null. Record what they say they sent, not what was drafted. Ask also which owners answered since the last week entry, on which task, and on what date, unless their message or the tracker already says (an owner's Last update on a row is an answer on that date).
2. Add one entry with type "week": the validated status from the drafts file, with done tasks in their own bucket; `sent`, one item per draft the launch lead sent, `{ "draft": <number>, "revision": <1, or N for an rN file>, "tasks": [<task IDs from the drafts index>], "sent_on": "<YYYY-MM-DD>" or null, "to": "<owner from the index>" or null }`, with `tasks` [] only when the drafts file has no index; `skipped`, each draft not sent and why; `responses`, one item per owner answer since the last week entry, `{ "task", "owner", "on": "<YYYY-MM-DD>" or null, "answers": { "week", "draft", "revision" } or null }`, where `answers` names the latest nudge for that task sent before the answer (in this entry's `sent` or an earlier week entry's), and is null when no nudge asked; who validated and who did not; and `source`: owner when the owners' answers reached you directly or in the tracker, relayed when the launch lead passed them on. Never invent a date, a nudge, or an answer: an unknown date stays null, an owner who did not answer has no item, and a week nobody recorded (a practice jump's skipped weeks) gets no entry. On a practice launch, a reply made up for a scenario is a `responses` item with `"source": "made-up"` and its practice date, task, and owner, and the summary says it is made up. Older week entries may hold `sent` as draft numbers and no `responses`; leave them as they are. A complete week entry, with every key of the shape below, the ones that do not apply as null or [] (staging and the append command refuse an entry missing one): `{"type":"week","launch":"insights","at":"2027-01-19T15:00:00Z","source":"relayed","week_of":"2027-01-18","gate":null,"revision":null,"status":{"done":["T01"],"red":["T04"],"amber":[],"green":["T02","T03"],"unvalidated":["T05"]},"sent":[{"draft":1,"revision":1,"tasks":["T04"],"sent_on":"2027-01-18","to":"Ana Ruiz"}],"responses":[{"task":"T04","owner":"Ana Ruiz","on":"2027-01-19","answers":{"week":"2027-01-18","draft":1,"revision":1}}],"skipped":[{"draft":2,"reason":"owner on leave"}],"decision":null,"next":null,"decided_by":"Mara Lind","words":"Ana says T04 moves to the 29th. I sent 1 on Monday and skipped 2, she is on leave.","proposed_conditions":[],"conditions":[],"pending":[],"clarifies":null,"waivers":[],"findings":null}`.
3. If the launch lead relays a decision on this week's escalation, add one entry with type "decision": the option picked as the escalation lettered it, who decided as the plan header names them, their exact words, and the relay in words, and source "relayed". A re-plan it starts is approved and recorded later, at its own gate. The re-plan starts from the option's file, `launches/<launch>/weeks/<week>-option-<letter>.json`, whose effects text the escalation gave; it is not rewritten here.
4. In the tracker: on each row whose owner confirmed or corrected it this week, set Last update to the validation date, Forecast to the date the owner gave when it differs from Due, and Risk to the validated score, Red, Amber, or Green, empty on a row that is Done or Waived. When a condition and its parent are both open, the pair's score goes on the parent's row and the condition's Risk stays empty, so a count of reds counts the work once. A row that is Done keeps its last Forecast; never clear it. On every row with Status Done, validated or not, set File check from this week's score (Found, Missing, or Cannot verify) and Done date to the date the owner gave, or the validation date when the row has none yet. When the tracker is a file the owners do not edit, an owner's update reaches it through the launch lead: when they relay a status, a forecast, a deliverable, or a done, write it to that owner's columns on the row and say so; never mark a task done that nobody reported done. Quote any value with a comma, a quote, or a line break; separate task IDs with semicolons. A column the header lacks is skipped. Change no other column, and leave rows nobody answered as they are.
5. On a live launch, when this folder has `scripts/stage-write.mjs`, the history entry and its tracker change are one write transaction (CLAUDE.md, "Live writes"): write `runs/proposed.json`, run `node scripts/stage-write.mjs <launch>`, make exactly the tracker writes it prints (a CSV tracker: `node scripts/tracker-write.mjs <txn>`), read the rows back, and run `node scripts/reconcile.mjs <txn>`; the transaction appends the entry, so do not stage it for the append command yourself. Otherwise stage the entry and run the append command. A live launch never takes `source: "made-up"`: if asked to make up an answer on a live launch, say Launch history and the live tracker refuse it, and offer a practice launch. The week entry and step 4's row changes are one transaction; a decision entry from step 3 is its own.
6. End by saying what comes next and when: next week's score on its Monday, the next readiness review on its date from the approved plan, and the retro after general availability. The run waits for those dates; nothing is pending until then.


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
An entry in launch history for this week, and in the tracker, for each row an owner answered, Last update, Forecast, Risk, and on a task they finished, Done date and File check; and what comes next with its date.


## Then
Stop. Wait for a person.


## Done when
The week is recorded after the send, not before the launch lead decides.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK record-week-normal-entry-after-send pass|fail` — Launch history gained exactly one week entry for this launch and week, its status buckets (done included) match the drafts file, sent and skipped match what the launch lead said, and every sent item names its draft, revision, tasks, and send date (null when not given)
- `CHECK record-week-sent-differs-from-drafted pass|fail` — sent lists only the drafts the launch lead said went out, and every other draft is in skipped, with a reason only when they gave one
- `CHECK record-week-response-events pass|fail` — Each sent item names the tasks its draft nudged and the send date the launch lead gave (null when they did not know), and each owner answer is a responses item paired with the latest nudge for that task sent before it, or with null when no nudge asked; no date, nudge, or answer is invented; n/a when nothing was sent and nobody answered
- `CHECK record-week-no-answer-yet pass|fail` — If the launch lead had not said what they sent, the step asked before writing any entry; n/a when they had already said
- `CHECK record-week-first-run-empty-history pass|fail` — On this launch's first week entry, the step wrote it without asking again for what the launch lead already said; n/a when earlier week entries exist
- `CHECK record-week-risk-and-file-check pass|fail` — Every row an owner answered this week carries its validated Risk, every Done row carries Done date and File check, and no other column on any row changed; n/a when the tracker has no Risk column
- `CHECK record-week-condition-counted-once pass|fail` — Where a condition and its parent task are both open, the score is on the parent's row and the condition's Risk is empty; every Done row keeps the Forecast it had; n/a when no condition is open and no Done row had a Forecast
- `CHECK record-week-live-refuses-made-up pass|fail` — On a live launch, no week entry or tracker row carries an answer, status, date, or validation nobody gave, and nothing is marked source "made-up"; n/a when nothing was asked to be assumed or made up

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `GATE approve-send approved|sent-back|skipped|waiting|wrong-approver` — when the person answers the gate `approve-send` before this step: approved, sent back for changes, skipped, still waiting when you stop, or answered by someone who may not.
- `SENT record-week <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP record-week no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP record-week unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP record-week gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
