---
name: recalculate-dates-when-a-date-scope-or-no-go-mov--draft-replan
description: "New downstream due dates, what is newly at risk, and a change notice. The tracker is not updated yet."
allowed-tools: Write, Bash(node scripts/launch-calc.mjs *)
---

# Recalculate dates when a date, scope, or no-go moves the launch

## Inputs
The date or scope change, or a no-go.


## Do
1. Start from the latest approved plan version, its rules file (`launches/<launch>/rules-v<n>.json`, or `rules-v<n>-<letter>.json` when the launch lead approved an option), and the change: a new date, a scope change, or a no-go. A slip decision already given (the escalation's option file and the decision entry in launch history) is the change as decided.
2. Recalculate with the launch calculator, never by counting days yourself. Write each way to absorb the change to an option file, `launches/<launch>/option-v<next>-<letter>.json` (`option-v<next>.json` when there is one way), in the format `node scripts/launch-calc.mjs help` shows, and run `node scripts/launch-calc.mjs effects --rules <the approved rules file> --rows <tracker rows> --option <that file> --as-of <date>`. It recalculates with the same lead-time and holiday rules as the plan, moves every open task whose due date counts back from a launch date that moves (its `because` says so; list which ones moved for that reason), and moves or flags a task its blocker now runs past, as the rules' dependencies say. An exception granted against a launch date that moves does not carry forward: the calculator recomputes that task from its rule and lists the exception under `needs_re_approval`. Put each one to the launch lead to keep, move, or drop, and once they answer, put that in the option's `exceptions` and run it again. Until the launch lead approves the new version, the approved rules file and its exceptions keep scoring the tracker, and a rejected option changes nothing.
3. Show what is newly at risk: the calculator's `newly_at_risk`, any `conflicts`, and whether each launch date is realistic after the change (`launch_dates_after`).
4. If there is more than one way to absorb the change, give each as a lettered option (A, B) so the approval can name one. Describe each option with its effects `text`; never write that no dates move unless that text says so.
5. Draft the change notice for the launch lead to send, with the dates from the option's `row_changes`. With lettered options, draft one notice per option, so the one sent matches the option picked without editing an approved draft. Send nothing. Save each option's rules with the plan version by running its effects once more with `--save launches/<launch>/rules-v<next>.json` (`rules-v<next>-<letter>.json` for an option); the calculator never writes over an earlier file.
6. A launch date the decider did not give (a no-go recorded with next "to be proposed") is a proposal: mark it "(proposed)" in the plan header. Do not stop to ask the launch lead for a date first: propose one yourself. Take the earliest date that clears what the no-go said is not ready (the open items' Forecasts, or their Due plus their slip when no Forecast is set), keep the gap between EA and GA, run `effects` with that option to check it, and say how you chose it. Save it as the next plan version, and ask the launch lead to approve it by naming the version, and the option when there is more than one. The tracker is not changed yet. `<launch>` is one short lowercase name for this launch, the same in every file.


## Output
New downstream due dates, what is newly at risk, and a change notice. The tracker is not updated yet.


## Save it
Write the output to `launches/<launch>/plan-v<n>.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
The new plan is ready for the launch lead.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK draft-replan-date-move-downstream-dates pass|fail` — The new plan version is the next number, the earlier versions are unchanged, every moved date follows the plan's lead times from the change, every open task anchored to a moved launch date moved, and no upstream task moved unless the launch lead asked
- `CHECK draft-replan-two-options-lettered pass|fail` — When the change can be absorbed more than one way, each way is a lettered option with its own dates and at-risk items, and one change notice per option; n/a when there is one way
- `CHECK draft-replan-single-path-no-options pass|fail` — When there is only one way to absorb the change, the plan has no lettered options and the approval asks for the version only; n/a when there are options
- `CHECK draft-replan-based-on-latest-approved pass|fail` — The recalculation starts from the latest version the launch lead approved by name, not from a later unapproved draft
- `CHECK draft-replan-exception-needs-reapproval pass|fail` — Every approved date exception granted against a launch date the re-plan moves is listed as needing re-approval, with its task recomputed from its rule, and the approved rules file is unchanged; n/a when no such exception exists

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT draft-replan <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP draft-replan no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP draft-replan unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP draft-replan gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
