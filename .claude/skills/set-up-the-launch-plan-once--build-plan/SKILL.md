---
name: set-up-the-launch-plan-once--build-plan
description: "A draft plan: tasks for that tier, one owner per task, dates set backward from the launch dates, and the dependency chains. Unowned or double-owned tasks are flagged."
allowed-tools: Write, Bash(node scripts/launch-calc.mjs *)
---

# Set up the launch plan, once

## Inputs
Product description, tier, dates, goals, named seats, and the playbook. If the tier or a dependency map is missing, draft a recommendation for the launch lead to correct.


## Do
1. Read the intake: the product and who it is for, the tier, the beta or early-access and general availability dates, the launch goals, the launch lead, a named person in each seat, where the launch tracker lives, and, when the intake gives them, who decides the gates and a slip, the date the success metric is measured by, the analyst firms and press to brief, and the steering committee. A goal that is a count (accounts, customers, seats) must say what counts, such as invited, signed, or active; if it does not, ask. Check the dates: both must be in the future, and the beta or early-access date must come before general availability. If either is wrong, ask before you plan; do not guess a year. Without the launch tracker, stop. There is no fallback for the system of record.
2. If the tier is missing, recommend one from the description and the goals, marked as a recommendation for the launch lead.
3. Read the playbook and keep only the tasks for this tier, each with its owning seat and lead time. If the playbook has no task list for this tier, use the nearest tier's list, mark every task "from the tier <n> list, not defined for tier <m>", and say so at the plan gate so the launch lead can correct it. If there is no playbook, say so and ask the launch lead whether to start from defaults. Only after a yes, draft the task list, lead times, and gate definitions as defaults, and mark each one "default, not from the playbook".
4. Assign each seat's tasks to the person named in that seat. A seat with no name is an unowned role: flag every task it owns.
5. Merge duplicate tasks into one primary owner plus contributors. Flag a task with no owner, or with several competing owners.
6. Map what each task blocks and what blocks it. If the team has no dependency map, draft one from the usual SaaS chains for the launch lead to correct: naming and trademark, then messaging, then downstream content; pricing approval, then billing and quoting, then pricing in sales content; demo environment, then demo recording, then sales and customer success enablement; beta readiness, then beta, then general availability readiness, then general availability.
7. Set due dates backward from the launch dates along those chains, using each task's lead time, with the launch calculator, never by counting days yourself. Draft the launch's rules file: `node scripts/launch-calc.mjs draft-rules --playbook <the playbook file> --launch <launch> --tier <n> --ea <date> --ga <date> --as-of <today; on a practice launch, the practice date> --save launches/<launch>/rules-v1.json`, adding `--holidays us-federal` when the playbook or the intake names US federal holidays. It reads the playbook's task table, lead times, and gates, lists US federal holidays on their observed days, and lists every rule it cannot express under `unsupported`. It refuses an early-access date before the as-of date; when it warns "the plan is born overdue", put that warning, with each task it names, to the launch lead with the plan, as the calculator wrote it. Then edit that file to match steps 3 to 6 (tasks for this tier, dependencies, a lead time the team set differently) and add any other holiday the intake names to `calendar.holidays`. Run `node scripts/launch-calc.mjs validate-rules --rules launches/<launch>/rules-v1.json` until it has no errors, then `node scripts/launch-calc.mjs dues --rules launches/<launch>/rules-v1.json`, and take every due date and gate review date in the plan from that output. Pricing is final at least 4 weeks before early access unless the team set a different lead time. Ask the launch lead for a holiday calendar only when the intake's Holiday rule row is empty; a rule there (the default is US federal holidays plus weekends, move earlier) is the answer. A task counted from plan approval (T01) has no date until the plan is approved: the plan says "<n> working days after approval", and the tracker load counts it with `node scripts/launch-calc.mjs dues --rules launches/<launch>/rules-v1.json --anchor plan_approval=<approval date>`.
8. Head the plan with its version (v1, then the next number for each revision), the tier, the playbook's Risk scoring rules and Re-plan rules copied in so the weekly score and a re-plan work from the version the launch lead approved, who decides the gate for this tier (the person the intake names; otherwise the launch lead for a smaller launch, the exec sponsor for a top-tier launch), and every default or recommendation in it. Name its rules file (`launches/<launch>/rules-v1.json`) in the header, and show what the launch lead confirms with the plan: the holiday list and where a due date that lands on a weekend or holiday moves, the definition of slack and how a slip moves the tasks it blocks (the file's `dependencies`; the starter playbook describes slack without defining it), the scoring rules in order of precedence, and every rule listed as unsupported, which the calculator will not apply.
9. Save it, and ask the launch lead to approve it by naming the version. When they approve it, record the day once with `node scripts/launch-calc.mjs set-anchor --rules launches/<launch>/rules-v<n>.json --plan-approval <the approval date; on a practice launch, the practice date>` (the approved option's `rules-v<n>-<letter>.json` for a re-plan), before the tracker is loaded. It writes the date once and refuses a different one: if it refuses, say what it printed and do not edit the file. A revision is a new file with the next version. Never overwrite an earlier one. `<launch>` is one short lowercase name for this launch, the same in every file.


## Output
A draft plan: tasks for that tier, one owner per task, dates set backward from the launch dates, and the dependency chains. Unowned or double-owned tasks are flagged.


## Save it
Write the output to `launches/<launch>/plan-v<n>.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
The draft plan is ready for the launch lead, and nothing has been written to the tracker.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK build-plan-normal-tier-plan pass|fail` — The plan file for this launch exists as launches/<launch>/plan-v1.md with its rules file launches/<launch>/rules-v1.json beside it, its header shows the version, the tier, who decides each gate, and the slack definition and holidays for the launch lead to confirm, and every task has one owner and the due date the calculator's dues output gives it
- `CHECK build-plan-no-tracker-stop pass|fail` — If the intake did not say where the launch tracker lives, the step stopped and said so without drafting a plan; n/a when it did
- `CHECK build-plan-missing-tier-no-map-no-playbook pass|fail` — Every tier, dependency map, or task list not given by the intake or playbook is marked in the plan header as a recommendation or a default; n/a when all were given
- `CHECK build-plan-unowned-and-double-owned pass|fail` — Every task whose seat has no named person is flagged unowned, and every task with more than one owner is flagged, with no name invented; n/a when every seat is named once

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT build-plan <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP build-plan no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP build-plan unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP build-plan gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
