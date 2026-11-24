---
name: record-the-gate-decision--record-decision
description: "The decision recorded with who approved it and when. Go moves the launch to the next phase. Conditions become weekly items. No-go starts a re-plan."
allowed-tools: Bash(node scripts/append-store.mjs launch-history), Bash(node scripts/append-store.mjs practice-history), Read, Write
---

# Record the gate decision

## Inputs
The decision, the waiver, and who approved it.


## Do
1. Take the decision only from the person the plan header names for this gate. Anyone else's answer is input, not a decision. Say who can decide. One exception: in a practice launch the launch lead plays every role, so their answer as the decider is the decision; record it with `source` "made-up" unless they say they are relaying the named decider's real answer.
2. Add one entry with type "gate-decision": the gate, its revision (1, or 2 for a re-run after a no-go), the decision, who decided, their exact words, `source` (owner when the decider told you, relayed when the launch lead passes their answer on), `proposed_conditions` copied from the packet as it proposed them, `conditions` holding only what the decider adopted, and each waiver with its reason. A complete gate-decision entry, with every key of the shape below, the ones that do not apply as null or [] (staging and the append command refuse an entry missing one): `{"type":"gate-decision","launch":"insights","at":"2027-02-01T16:00:00Z","source":"owner","week_of":null,"gate":"beta","revision":1,"status":null,"sent":[],"responses":[],"skipped":[],"decision":"go with conditions","next":null,"decided_by":"Mara Lind","words":"Go, with the packet's security review, and legal signs the DPA by 2027-02-12.","proposed_conditions":[{"id":"C01","text":"Security review signed off","owner":"Lee Park","due":"2027-02-08"}],"conditions":[{"id":"C01","text":"Security review signed off","owner":"Lee Park","due":"2027-02-08","missing":[],"adopted_from":"packet","words":"Go, with the packet's security review"},{"id":"C02","text":"Legal signs the DPA","owner":null,"due":"2027-02-12","missing":["owner"],"adopted_from":"decider","words":"legal signs the DPA by 2027-02-12"}],"pending":[],"clarifies":null,"waivers":[],"findings":null}`. A clarification has the same keys, with type "clarification", `clarifies` { "gate", "revision" }, `decision` null, and each condition `adopted_from: "decider"`.
3. Each adopted condition has an id (C01, C02, and on across the launch), and text, owner, and due as the decider gave them. A part they did not give is null and named in that condition's `missing`. Do not fill it in for them, from the packet or anywhere else. Every adopted condition says where it came from and carries the decider's `words` for it, never blank: `adopted_from: "packet"` for one the decider adopted from the packet ("go, with the packet's conditions"), with the packet's text, and `adopted_from: "decider"` for one the decider set themselves. A condition with neither, or with no words, is refused, so a condition nobody gave cannot be recorded. A packet proposal the decider did not adopt stays only in `proposed_conditions`. A bare "go with conditions" is recorded with `conditions: []` and `pending: ["conditions"]`: it is still a go, and the missing conditions become one flagged weekly item, "conditions not given by the decider", until they arrive. When they do, add one entry with type "clarification": `clarifies` names the gate decision ({ gate, revision }), with the conditions as above, who gave them, and their words. A missing item that ships with no waiver is flagged to the launch lead.
4. Go moves the launch to the next phase. Go with conditions, or a clarification: add each adopted condition to the tracker as its own row, keyed by its condition id, so a repeat adds nothing twice: Launch, the condition text as Task, the owner's Seat and Owner, Gate as the tracker writes it (Beta or GA), Lead time empty, its due date in both Original due and Due, Status "Not started", Parent task naming the checklist task it adds to when there is one, Blocks naming the gate's task, Flag "condition", and Last update today (on a practice launch, the practice date); the rest empty. A field the decider has not given leaves its cell empty, and Notes says which fields the decider has not given. The weekly score then tracks it like any task. For each waiver, write what was waived, who decided, the date, and the reason in the Waiver column of the waived item's row, quoted as one value, and leave its Status to the owner. Read the tracker back and check that every row still has the header's number of columns (a sheet drops trailing empty cells on read; those count as present).
5. No-go: `next` is the new date the decider gave, as given, or "to be proposed" when they gave none. Say a re-plan starts.
6. On a live launch, when this folder has `scripts/stage-write.mjs`, the history entry and its tracker change are one write transaction (CLAUDE.md, "Live writes"): write `runs/proposed.json`, run `node scripts/stage-write.mjs <launch>`, make exactly the tracker writes it prints (a CSV tracker: `node scripts/tracker-write.mjs <txn>`), read the rows back, and run `node scripts/reconcile.mjs <txn>`; the transaction appends the entry, so do not stage it for the append command yourself. Otherwise stage the entry and run the append command. A live launch never takes `source: "made-up"`: if asked to make up an answer on a live launch, say Launch history and the live tracker refuse it, and offer a practice launch.


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
The decision recorded with who approved it and when. Go moves the launch to the next phase. Conditions become weekly items. No-go starts a re-plan.


## Then
Stop. Wait for a person.


## Done when
The record is written after the decision.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK record-decision-go-with-conditions-entry pass|fail` — Launch history has one new gate-decision entry with the gate, its revision, the decision, the decider named in the plan header, their exact words, its source, the packet's proposals in proposed_conditions, and every adopted condition and waiver as given, and each adopted condition is a tracker row
- `CHECK record-decision-not-the-decider pass|fail` — No gate-decision entry was written from anyone but the decider named in the plan header, and the output named that person when someone else answered; n/a when only the decider answered
- `CHECK record-decision-condition-missing-owner-due pass|fail` — Every condition given without an owner or a due date is recorded as given, with the missing fields null and named in missing, and flagged to the launch lead, with nothing filled in; n/a when every condition had both
- `CHECK record-decision-no-go-replan pass|fail` — After a no-go, the entry records it with the decider's exact words and next (the date they gave, or "to be proposed"), and the output says a re-plan starts; n/a when the decision was not no-go
- `CHECK record-decision-bare-go-with-conditions pass|fail` — A go with conditions that named no conditions is recorded with conditions [] and pending ["conditions"], no condition row is added, and the output makes the missing conditions a flagged weekly item; n/a when the decider named conditions or did not say go with conditions
- `CHECK record-decision-adopted-from-packet pass|fail` — Every adopted condition that repeats a packet proposal says adopted_from "packet" and carries the decider's words adopting it; n/a when no packet proposal was adopted
- `CHECK record-decision-live-refuses-made-up pass|fail` — No entry or tracker row on a live launch carries source "made-up"; n/a when nothing was made up
- `CHECK record-decision-condition-names-its-source pass|fail` — Every adopted condition says adopted_from "packet" or "decider" and carries the decider's words for it; no condition was recorded that the decider did not give; n/a when no condition was adopted

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `GATE decide-gate approved|sent-back|skipped|waiting|wrong-approver` — when the person answers the gate `decide-gate` before this step: approved, sent back for changes, skipped, still waiting when you stop, or answered by someone who may not.
- `SENT record-decision <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP record-decision no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP record-decision unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP record-decision gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
