---
name: draft-the-gate-packet-before-a-readiness-review--draft-packet
description: "Each item marked complete, missing, or waived, with evidence links, open risks, and a recommendation of go, go with conditions, or no-go. The recommendation is not a decision."
allowed-tools: Write, Read
---

# Draft the gate packet, before a readiness review

## Inputs
The checklist, evidence in the shared folder, and the latest validated week.


## Reads first
Read these before starting. They are the record of what has already happened.

- **Launch history** — `history/launch-history.jsonl` in this folder. Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead.
- **Practice history** — `history/practice-history.jsonl` in this folder. The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch.


## Do
1. Read what must be true to pass this gate from the playbook. If the gate definitions are missing, draft defaults for the team to adjust, and mark each one default.
2. Mark each checklist item complete, missing, or waived, with a link to its evidence in the shared launch folder. An item with no evidence is not complete.
3. On a practice jump that stops at this gate (CLAUDE.md, "Practice weeks and jumps"), the gate week is scored and packeted with no week entry: state the last validated week the risks come from, and that the weeks after it were not observed. List the open risks from the latest validated week in launch history, then check each one against the latest approved plan version: a risk that a later re-plan absorbed (its dates moved and no rule is broken now) is listed as closed by that version, not as open.
4. Recommend go, go with conditions, or no-go, and say why. For go with conditions, propose each condition with an owner and a due date. The recommendation is not a decision.
5. Name who decides this gate, from the plan header. `<gate>` is the gate's short name, such as beta or ga. A second review of the same gate, after a no-go, is a revision: save it as `<gate>-r2-packet.md`, then r3, never over the earlier packet. `<launch>` is one short lowercase name for this launch, the same in every file.


## Output
Each item marked complete, missing, or waived, with evidence links, open risks, and a recommendation of go, go with conditions, or no-go. The recommendation is not a decision.


## Save it
Write the output to `launches/<launch>/gates/<gate>-packet.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
The packet is ready for the approver named by the tier.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK draft-packet-complete-missing-risks pass|fail` — The gate packet under launches/<launch>/gates/ marks every checklist item complete (with a link to a real file), missing, or waived, takes open risks from the latest validated week checked against the latest approved plan, and names the decider from the plan header
- `CHECK draft-packet-no-evidence-not-complete pass|fail` — No checklist item without an evidence file is marked complete, whatever anyone said about it
- `CHECK draft-packet-conditions-owner-due pass|fail` — If the packet recommends go with conditions, each proposed condition has text, an owner, and a due date, and the packet calls it a recommendation; n/a otherwise

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT draft-packet <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP draft-packet no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP draft-packet unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP draft-packet gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
