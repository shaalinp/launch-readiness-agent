---
name: compile-the-retro-and-draft-playbook-edits-after--draft-retro
description: "Findings for the launch team, and proposed playbook edits: lead times, owners, tasks to add, cut, or merge, and new dependencies."
allowed-tools: Write, Read, Bash(node scripts/launch-calc.mjs *)
---

# Compile the retro and draft playbook edits, after general availability

## Inputs
Slips, bottlenecks, handoffs, response times, waivers, and results against the launch goals. In portfolio mode, patterns that repeat across launches.


## Reads first
Read these before starting. They are the record of what has already happened.

- **Launch history** — `history/launch-history.jsonl` in this folder. Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead.
- **Practice history** — `history/practice-history.jsonl` in this folder. The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch.


## Do
1. Read launch history, the tracker, and every plan version.
2. Compile which tasks slipped and by how much with `node scripts/launch-calc.mjs slips --rows <tracker rows> --launch <launch> --as-of <date>`: it measures each row's Done date, or Forecast while open, against its Original due, so a slip a re-plan absorbed by moving Due still counts (`replanned`; mark those), and lists a condition with a Parent task under its parent, not as a slip of its own. Report its days as given; do not recount them. Then compile where the bottlenecks were, unowned or late handoffs, owner response times (step 3), waivers taken at gates (the Waiver column), and results against the launch goals. In portfolio mode, flag patterns that repeat across launches.
3. Owner response times come only from `node scripts/launch-calc.mjs responses --history <this launch's history file> --launch <launch> --as-of <date>`, which pairs each nudge the week entries record as sent with the owner answer that answers it. Report its `summary` and `by_owner` lines as given: where it says not measurable, say not measurable; where an interval is week-level, say send dates were missing; label every figure it marks SIMULATED as simulated, from made-up practice replies, apart from measured ones. Older week entries it lists under `unavailable` (sent as draft numbers only) are named as giving no evidence. Never estimate a response time the calculator did not give, and never count a week with no entry (a practice jump's skipped weeks) as an observation.
4. Read the earlier entries with type "retro" in launch history. A task that slipped on an earlier launch and slipped again is a repeat: flag it with both launches' days. With no earlier retro entry, say you cannot flag a repeat.
5. Propose playbook edits from the findings: adjusted lead times, reassigned owners, tasks to add, cut, or merge, and new dependencies. Number each edit so the launch lead can accept, edit, or reject it on its own. `<launch>` is one short lowercase name for this launch, the same in every file.


## Output
Findings for the launch team, and proposed playbook edits: lead times, owners, tasks to add, cut, or merge, and new dependencies.


## Save it
Write the output to `launches/<launch>/retro.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
The findings and the proposed edits are ready, usually 2 to 4 weeks after general availability.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK draft-retro-findings-and-numbered-edits pass|fail` — launches/<launch>/retro.md names every task that slipped with how many days, the bottleneck seats, owner response times as `launch-calc.mjs responses` gives them (or not measurable), gate waivers, conditions and whether they were met, and results against the goals, and every proposed playbook edit is numbered
- `CHECK draft-retro-no-past-notes-cannot-flag-repeat pass|fail` — If launch history has no earlier retro entry, the retro says it cannot flag repeats; n/a when one exists
- `CHECK draft-retro-portfolio-repeat-slip-flagged pass|fail` — Every task that slipped on this launch and on a launch with an earlier retro entry is flagged as a repeat with both launches' days; n/a when there is no earlier retro entry
- `CHECK draft-retro-clean-launch-still-complete pass|fail` — The retro is written with every section even where the finding is none
- `CHECK draft-retro-replan-absorbed-slip pass|fail` — Every task whose Done date is after its Original due is counted as slipped by that many days, as `launch-calc.mjs slips` counts them, including one whose Due a re-plan moved, and no condition with a Parent task is counted as a slip of its own
- `CHECK draft-retro-response-times-not-invented pass|fail` — Owner response times are the calculator's figures only: not measurable where history has no paired nudge and answer, week-level where send dates are missing, and labeled simulated where they rest on made-up replies; no figure is estimated, and no skipped week counts as an observation

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT draft-retro <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP draft-retro no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP draft-retro unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP draft-retro gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
