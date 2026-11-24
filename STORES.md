# What this workflow remembers

Skills describe one run. These outlive the run, and they are why this workflow
gets better instead of repeating itself.

## Launch history

`history/launch-history.jsonl`: a file in this folder

Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead.

- Written by: Load the approved plan into the tracker, once, Record the validated week, Record the gate decision, Update the tracker with the approved dates, Update the playbook from the approved edits
- Read by: Read the tracker and score risk, each week, Draft the gate packet, before a readiness review, Compile the retro and draft playbook edits, after general availability

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

## Practice history

`history/practice-history.jsonl`: a file in this folder

The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch.

- Written by: Load the approved plan into the tracker, once, Record the validated week, Record the gate decision, Update the tracker with the approved dates, Update the playbook from the approved edits
- Read by: Read the tracker and score risk, each week, Draft the gate packet, before a readiness review, Compile the retro and draft playbook edits, after general availability

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


## Where these live

On a local run each store that is not committed to GitHub is the plain file named above, in this folder.

## How each one is updated

- **Launch history**: append only. A record; rewriting it loses the history that makes it worth having. One JSON object per line. A run adds an entry only with `node scripts/append-store.mjs launch-history`, and Claude's file tools are denied on the file and on the script.
- **Practice history**: append only. A record; rewriting it loses the history that makes it worth having. One JSON object per line. A run adds an entry only with `node scripts/append-store.mjs practice-history`, and Claude's file tools are denied on the file and on the script.

## Run log

`runs/log.jsonl`: a file in this folder, append only, written by a hook and never by the agent.

One line per moment a person stepped in, as codes and ids from the bundle only: how each gate was answered, how each draft went out, where the agent had to ask, and how each check came out. No content, no names. It is gitignored and nothing reads it but the person running this folder.
