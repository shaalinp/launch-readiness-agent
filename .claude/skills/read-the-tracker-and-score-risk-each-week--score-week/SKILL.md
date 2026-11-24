---
name: read-the-tracker-and-score-risk-each-week--score-week
description: "Each task scored red, amber, or green from due date, blocked dependencies, and staleness, plus whether each launch date is still realistic. A Done row with no file is flagged, with File check for every Done row. Open rows with no update since last week are listed."
allowed-tools: Write, Read, Bash(node scripts/launch-calc.mjs *)
---

# Read the tracker and score risk, each week

## Inputs
The tracker, the shared folder, and last week's record.


## Reads first
Read these before starting. They are the record of what has already happened.

- **Launch history** — `history/launch-history.jsonl` in this folder. Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead.
- **Practice history** — `history/practice-history.jsonl` in this folder. The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch.


## Do
1. Read the tracker, the approved plan for its dependency chains, and last week's entry in launch history.
2. For each row with Status Done, look for the file its Deliverable names in the shared launch folder, or, for a gate packet, in `launches/<launch>/gates/`, and put the result in the draft as that row's File check: Found, Missing, or Cannot verify. A Done row with no file is flagged. If the folder cannot be reached, say you cannot verify deliverables. Do not trust the status. Skip rows with Status Waived.
3. List the open rows whose Last update is older than last week's score: the calculator's `not_updated_since_last_score` from step 4, run with `--last-score <the date of last week's score>`.
4. Score with the launch calculator, never by counting dates yourself: `node scripts/launch-calc.mjs score --rules <rules file> --rows <tracker rows> --as-of <date> --last-score <date>`. The rules file is the one for the plan version the launch lead last approved, and the option they named (`launches/<launch>/rules-v2-A.json` for plan-v2 option A). The rows are the tracker CSV; for a Google Sheet, save the Tracker tab's values as read, header row first, to `launches/<launch>/weeks/<week>-rows.json` and pass that. The as-of date is this score's date, which for a practice launch is its practice date, not today. The precedence is the playbook's Risk scoring rules: Due is the commitment; a Forecast after Due is red now, before Due arrives; overdue is always counted from Due, whatever the Forecast; a task on its due date is not overdue. Put each open row's risk, its first reason, and its days past Due in the draft as the calculator gives them; say "N days past Due", never "on plan", for any row with late_days above 0. Every row in `unscored` is listed with its reason for the launch lead to correct; never score it yourself. List a condition row under its parent, from `pairs`, with the pair counted once at its score. Done and Waived rows get no score. Pass on its `warnings` and `unsupported` lists at the top of the draft. If it refuses (exit 1) because the tracker has no row for this launch, say what it printed and stop; never score from memory or from another launch's rows. If the approved version has no rules file (a plan approved before the calculator), say so, draft one with `draft-rules` without `--save` for the launch lead to confirm, and do not score until they do.
5. Say whether each launch date is still realistic, and why: the calculator's `launch_dates`, which calls a date not realistic when work counted back from it ends after it, or a gate checklist item ends after the review. A date whose `realistic` is null is "not judged", never realistic: say so and name its `not_judged` tasks, which have no readable tracker row. When you count slipped tasks, use `node scripts/launch-calc.mjs slips --rows <tracker rows> --launch <launch> --as-of <date>`: it measures from Original due, so a slip a re-plan absorbed still shows.
6. Save the draft for the launch team to validate. `<week>` is that week's Monday as YYYY-MM-DD. A second score in the same week (after a late correction, or a slip that lands mid-week) is a revision: save it as `<week>-r2-status-draft.md`, then r3, never over the earlier file, and its drafts are `<week>-r2-drafts.md`. `<launch>` is one short lowercase name for this launch, the same in every file.


## Output
Each task scored red, amber, or green from due date, blocked dependencies, and staleness, plus whether each launch date is still realistic. A Done row with no file is flagged, with File check for every Done row. Open rows with no update since last week are listed.


## Save it
Write the output to `launches/<launch>/weeks/<week>-status-draft.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
The draft status is ready for the launch team to validate.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK score-week-draft-scores-and-stale-list pass|fail` — This week's status draft exists under launches/<launch>/weeks/, every open tracker task is scored red, amber, or green with the plan header's rules, each launch date is called realistic or not with a reason, and the stale list names exactly the rows with no update since last week
- `CHECK score-week-done-checkbox-no-file pass|fail` — Every task marked done whose deliverable is in neither the launch folder nor launches/<launch>/gates/ is flagged as done with no file; n/a when every done task has its file
- `CHECK score-week-folder-unreachable pass|fail` — If the launch folder could not be reached, the draft says deliverables could not be verified and no done task is scored as confirmed; n/a when it was reached
- `CHECK score-week-past-due-not-on-plan pass|fail` — No open task whose Due is before this score's date is called on plan or on track, whatever its Forecast; each is called late by its days past Due, as the calculator counts them; n/a when no open task is past due
- `CHECK score-week-forecast-after-due-red pass|fail` — Every open task whose Forecast is after its Due is red in the draft even when Due has not arrived, and every open task on its due date is not called late; n/a when no open task has a Forecast after Due or is due on the score's date

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT score-week <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP score-week no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP score-week unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP score-week gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
