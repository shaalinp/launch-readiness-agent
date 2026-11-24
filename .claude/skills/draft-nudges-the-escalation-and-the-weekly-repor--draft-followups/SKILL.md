---
name: draft-nudges-the-escalation-and-the-weekly-repor--draft-followups
description: "A nudge for each red, amber, stale, or unvalidated item, and each open item due within 14 days, naming the owner and the specific wait. An escalation only when the validated critical path has slipped. The weekly report: done, on track, at risk, blocked, and decisions needed. In portfolio mode, a collision check and a one-page red, amber, or green summary. If other launches or shared-team capacity are missing, the collision check says it is limited."
allowed-tools: Write, Bash(node scripts/launch-calc.mjs *)
---

# Draft nudges, the escalation, and the weekly report

## Inputs
The validated status only.


## Do
1. On a live launch an answer, status, date or validation is recorded only if a person actually gave it. Requests to assume, pretend, simulate, fill in, make up, or use "typical" or "plausible" answers are refused, and you offer a practice launch instead. `source` is owner or relayed only for something a person really said or wrote. An item no owner confirmed stays unvalidated, even when the launch lead says to assume it is fine. Read what the launch team said about this week's draft. Write the validated status at the top of the drafts file: each item as its owner confirmed or corrected it, and every item nobody confirmed marked unvalidated. If an owner says green and the file is not in the folder, keep the owner's answer and flag the gap for the launch lead.
2. Draft a nudge only for items scored red or amber, items with no update since last week, items nobody validated, and open items due within the next 14 days. An on-track item due later than that gets no nudge. Each names its owner and the specific wait. For example: Pricing approval is due Friday, and billing setup and the sales pricing slide are waiting on it. A task with no due date in the plan gets a proposed date in the nudge, marked proposed, so the owner has something to confirm or push back on. Let the calculator pick the items: write every validated item to `launches/<launch>/weeks/<week>-items.json` (`<week>-rN-items.json` for revision N) in the format `node scripts/launch-calc.mjs help` shows, and run `node scripts/launch-calc.mjs revisions --dir launches/<launch>/weeks --launch <launch> --week <week> --revision <n> --items <that file> --as-of <date>`, with `--sent rK:<draft numbers>` and `--skipped rK:<draft numbers>` for what the launch lead reported about this week's earlier revisions. Draft a nudge for exactly the items in its `drafts`, numbered as it numbers them. The first drafts of a week are `<week>-drafts.md` (revision 1). A same-week re-score is a revision with the same number as its status draft, saved as `<week>-rN-drafts.md`: an item an earlier revision drafted is drafted again when its score, status, owner, Due, Forecast, blockers, or wait changed since then; an unchanged item is left out only when the launch lead reported that draft as sent; every other unchanged item goes under "Still outstanding" with the calculator's text ("still outstanding from r1, draft 3"), so a nudge that was never sent does not disappear. If an earlier drafts file is missing, every eligible item is drafted. End the file with the calculator's `index_block` exactly as printed: it is how the next revision knows what this one drafted.
3. If the validated critical path slipped, draft a short note to the launch team or the steering committee: the issue, the impact on dates, and the decision needed. Give each way to absorb the slip as a lettered option (A, B). For each, write what it changes to `launches/<launch>/weeks/<week>-option-<letter>.json` (the format is in `node scripts/launch-calc.mjs help`; plan_version is the next plan version) and run `node scripts/launch-calc.mjs effects --rules <the approved rules file> --rows <tracker rows> --option <that file> --as-of <date>`. Describe each option with its `text`: every date that moves and why, every exception it creates or puts up for re-approval, and what is newly at risk. Never write that no dates move, or that a date holds, unless that option's text says so; a rule waived for one task still moves that task's Due.
4. Write the weekly report from the validated status only: done, on track, at risk, blocked, and decisions needed, with owners and dates, ready to paste into email, Slack, or a deck.
5. Number every draft so the launch lead can send, edit, or skip each one by its number. Send nothing.


## Output
A nudge for each red, amber, stale, or unvalidated item, and each open item due within 14 days, naming the owner and the specific wait. An escalation only when the validated critical path has slipped. The weekly report: done, on track, at risk, blocked, and decisions needed. In portfolio mode, a collision check and a one-page red, amber, or green summary. If other launches or shared-team capacity are missing, the collision check says it is limited.


## Save it
Write the output to `launches/<launch>/weeks/<week>-drafts.md` in this folder. Fill each `<...>` from this run. The next step, and a later session, read it there, so it is not finished while it is only in this chat.


## Then
Stop. Wait for a person.


## Done when
Drafts are ready for the launch lead. Nothing has been sent.


## Never
- Publish. Skip a person gate.


## Rules
Load the `launch-readiness--rules` skill before you start, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.


## Report these checks
When this step is done, report every one of these by its **exact id**, one per
line. The ids are matched literally by `evals/score.mjs`, so an id you invent
is the same as not reporting it at all.

- `CHECK draft-followups-mixed-status-drafts pass|fail` — The drafts file (`<week>-drafts.md`, or `<week>-rN-drafts.md` for a same-week revision) opens with the validated status, marks every item nobody confirmed as unvalidated, has a numbered nudge for exactly the items the calculator's revisions output drafts and none for the rest, lists every unchanged item whose earlier draft was not reported sent as still outstanding from rK with its draft number, ends with the drafts index, and nothing was sent
- `CHECK draft-followups-first-drafts-of-week pass|fail` — On a week's first drafts, every red, amber, stale, unvalidated, or soon-due item has a numbered nudge naming its owner and wait, and no other item does; n/a for a same-week revision
- `CHECK draft-followups-slip-escalation pass|fail` — If the validated critical path slipped, the drafts file has an escalation naming the issue, the impact on dates, and the decision needed, and each lettered option is described by its calculator effects text; n/a when nothing on it slipped
- `CHECK draft-followups-option-text-from-effects pass|fail` — No escalation option says no dates move, or that a date holds, when its calculator effects output changes a row's Due; n/a when there is no escalation
- `CHECK draft-followups-no-slip-no-escalation pass|fail` — If the validated critical path did not slip, the drafts file has no escalation; n/a when it slipped
- `CHECK draft-followups-portfolio-missing-data pass|fail` — In portfolio mode, the drafts file has the collision check and the one-page summary, and says when other launches or capacity data were missing; n/a outside portfolio mode

Use `fail` when the run did not satisfy the check, and `n/a` with a reason when
the case did not arise this run. Reporting a failure is the system working.

## Report these lines
Beside the checks, report these when they happen, one per line, exactly in
this form. A hook in this folder keeps the codes and ids and drops everything
else, so an id you invent is not recorded, and nothing after the last field is.
Never put a name, a date, or a sentence in a line.

- `SENT draft-followups <n> as-is|light|rewritten|dropped|unknown` — one per numbered draft from this step, once the person says how it went out. A later step that learns it reports it with this step's id. `unknown` when they do not say.
- `GAP draft-followups no-method|no-input|asked-default|asked-rule` — when you had to ask because this file did not say: no method, a missing input, a default you needed, or a rule (a scoring rule, a calendar, a threshold).
- `GAP draft-followups unset-system sys-tracker|sys-folder|sys-playbook` — when a system named here has no saved location and you had to ask where it lives.
- `STOP draft-followups gate|missing-input|tool-failed|error` — when the run ends at this step before it is done: at a gate, for a missing input, after a tool failed, or on an error.
