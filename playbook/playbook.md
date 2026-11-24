# Launch playbook

This is the starter playbook that ships with the launch readiness agent. It is a working default for a SaaS product launch, written by a launch lead who has run them, so the agent can plan a launch on day one without being handed anything. Every number in it is a starting point. The agent reads this file at setup, proposes edits to it after each retro, and writes back only the edits the launch lead accepts. Replace any section with your own; keep the section names, because the agent looks for them.

If you already have a playbook, paste it in here in place of this one, or tell the agent where it is during the first run. Keep these sections: Scope, Setup rules, Tasks, Gates, Risk scoring rules, Re-plan rules, Retro rules, Change log.

## Scope

Tiers. Tier 1 is the top tier.

| Tier | What it is | Who decides the gates | Who decides a slip |
|---|---|---|---|
| 1 | A company launch: new product or a new line of business, with press, analysts, and a company-wide enablement push | Exec sponsor | Exec sponsor, on the launch lead's recommendation |
| 2 | A product launch: a new product or a major capability, marketed to customers and prospects | Launch lead | Launch lead |
| 3 | A feature note: shipped with release notes, a help article, and a sales heads-up, no gate | Launch lead (no gate review; the checklist is a self-check) | Launch lead |

A slip is a date change that the owner forecasts before the task is due. The person who decides a slip chooses between the options the agent drafts (hold the date and waive a rule, move the downstream date, or hold the upstream task to its date). The agent never chooses.

Launch phases: plan, pre-beta (or pre-early-access), beta (or early access), pre-GA, GA, retro. Beta and early access (EA) are the same phase here; use whichever word your team uses.

## Setup rules

- Launch short name: lowercase letters, digits and hyphens, no spaces, derived from the product name (for example "Harborline Insights" becomes `insights`). The agent proposes it and the launch lead confirms it at the plan gate. It names every file for this launch.
- Required at intake: product and who it is for, tier, EA date, GA date, launch goals, launch lead, a named person in each seat, success metric with baseline and target.
- Dates: both launch dates must be in the future and EA must come before GA. Lead times are calendar days counted back from EA or GA.
- Holidays: a due date that lands on a weekend or a US federal holiday moves earlier to the last working day before it. Add Canadian or other national holidays by naming them at intake. Lead times stay calendar days; only the landing date moves.
- Success metric: a metric, a baseline, and a target are agreed before the plan is approved. If the intake gives only a target, the plan carries task T01 with a due date five working days after plan approval, owned by the PM.
- Seats: PM, PMM, enablement, sales engineering, customer success, pricing and packaging, legal. A seat with no name is unowned and every task it owns is flagged until someone is named.
- Meeting cadence (default): launch team weekly, 30 minutes, the day after the agent's weekly score; steering committee every two weeks from eight weeks before EA, and weekly from four weeks before GA.

## Tasks

Lead times count back from early access (EA) or general availability (GA). "Blocks" lists the tasks that cannot finish until this one does. A task applies to the tiers in its Tiers column.

| Task ID | Task | Seat | Lead time | Tiers | Blocks | Deliverable |
|---|---|---|---|---|---|---|
| T01 | Success metric, baseline, and target agreed | PM | Plan approval + 5 working days | 1,2,3 | | Metric note in the launch folder |
| T02 | Naming and trademark check | PMM | EA - 12w | 1,2 | T03 | Naming decision note |
| T03 | Positioning and messaging doc | PMM | EA - 8w | 1,2 | T05, T08, T12 | Messaging doc |
| T04 | Pricing and packaging approved | Pricing and packaging | EA - 4w | 1,2 | T06, T07 | Pricing approval record |
| T05 | Customer-facing launch deck | PMM | EA - 3w | 1,2 | T10 | Deck |
| T06 | Billing and quoting set up for the new SKU | PM | EA - 2w | 1,2 | | Billing setup confirmation |
| T07 | Sales pricing slide and discount guidance | PMM | EA - 2w | 1,2 | T10 | Pricing slide |
| T08 | Legal review of claims, terms, and NDA for early access | Legal | EA - 4w | 1,2 | T09, T13 | Legal sign-off |
| T09 | Early-access terms or NDA in place | Legal | EA - 3w | 1,2 | T13 | Signed terms or NDA template |
| T10 | Sales and customer success enablement session | Enablement | EA - 1w | 1,2 | | Session recording and one-pager |
| T11 | Demo environment and demo script | Sales engineering | EA - 2w | 1,2 | T10 | Demo environment link and script |
| T12 | Help center articles | Customer success | EA - 2w | 1,2,3 | | Published or staged articles |
| T13 | Early-access customer list, invites, and feedback plan | Customer success | EA - 2w | 1,2 | | Customer list and feedback plan |
| T14 | Beta readiness review packet | Launch lead | EA - 2w | 1,2 | | Gate packet |
| T15 | Beta feedback summary and go-forward decisions | PM | GA - 5w | 1,2 | T16 | Feedback summary |
| T16 | Website and in-app copy | PMM | GA - 2w | 1,2,3 | T17 | Copy, reviewed |
| T17 | Legal copy review for GA | Legal | GA - 10d | 1,2 | | Legal sign-off on copy |
| T18 | Support runbook and escalation path | Customer success | GA - 2w | 1,2 | | Runbook |
| T19 | Analyst and press briefing | PMM | GA - 2w | 1 | | Briefing deck and schedule |
| T20 | Release notes and customer announcement | PMM | GA - 10d | 1,2,3 | | Release notes draft |
| T21 | GA readiness review packet | Launch lead | GA - 8d | 1,2 | | Gate packet |
| T22 | GA launch checklist complete | Launch lead | GA - 1d | 1,2,3 | | Checklist |

Dependency chains the dates follow: naming and trademark, then messaging, then downstream content; pricing approval, then billing and quoting, then pricing in sales content; demo environment, then enablement; legal review, then early-access terms, then early-access invites; beta readiness, then beta, then GA readiness, then GA.

Tier 3 uses only the rows marked 3. Tier 1 adds the analyst and press briefing to the tier 2 list; everything else is shared.

## Gates

Beta (early access) readiness review, two weeks before EA. Checklist:
- Messaging doc final (T03)
- Pricing approved (T04)
- Legal sign-off on claims and terms (T08)
- Early-access terms or NDA in place (T09)
- Demo environment working (T11)
- Early-access customer list and feedback plan (T13)
- Help center articles staged (T12)

GA readiness review, eight days before GA. Checklist:
- Beta feedback summary with go-forward decisions (T15)
- Website and in-app copy reviewed by legal (T16, T17)
- Billing and quoting live (T06)
- Enablement delivered (T10)
- Support runbook in place (T18)
- Release notes drafted (T20)
- Analyst and press briefings scheduled, tier 1 only (T19)

Rules:
- Who decides is set by tier (see Scope). The agent recommends go, go with conditions, or no-go, and records the decision. It never decides.
- A missing item that ships anyway needs a waiver with a reason, an owner, and a date. The agent records it.
- Go with conditions: each condition has an owner and a due date, and becomes a row in the tracker at once, so the weekly score tracks it like any task. Condition rows are numbered C01, C02, ... across the launch, in the order they were set, and Blocks names the gate task they hold.
- No-go means a re-plan.
- Tier 3 has no review meeting: the launch lead runs the GA checklist as a self-check and the agent records the result.

## Risk scoring rules

Each open task is scored every week. The agent does not score by hand: at plan time it turns this playbook into the launch's rules file, `launches/<launch>/rules-v<n>.json`, which the launch lead confirms with the plan, and `scripts/launch-calc.mjs` scores from it. A rule here that the rules file cannot express is listed in it as unsupported and is not applied until someone says how.

Precedence: the approved Due is the commitment. A Forecast is the owner's evidence of an expected miss, not a new commitment. Overdue is always counted from Due, whatever the Forecast, and a task on its due date is not overdue yet.

- Red: overdue (the day after Due or later); or forecast past due by its owner (a Forecast after Due is red at once, before Due arrives); or blocked by a red task and the slip is larger than the slack between the two tasks; or it breaks a playbook rule (for example pricing final less than four weeks before EA) even when no date is past.
- Amber: due within 7 days and not started; or no update for 14 days; or blocked by a red task where the slack still covers the slip.
- Green: everything else that is open.
- Done: marked done and the deliverable is in the launch folder. Marked done with no deliverable in the folder: keep the owner's status, flag the gap for the launch lead.
- A task with no due date is scored amber, not red, and the nudge proposes a date.
- Cascade: a red task turns its downstream tasks red only when the slip exceeds their slack. A slip that still fits is amber downstream. Never cascade past a task that is already done.
- Launch dates: a launch date is "not realistic as planned" when the critical path to it has negative slack or a gate checklist item cannot be met by the review date.
- Staleness is measured from the task's last update in the tracker.
- Slack between a blocking task and a task it blocks: the calendar days from the blocker's Due to the blocked task's Due. A blocker's slip is how far its Forecast, or the as-of date when it is open past Due, is after its Due. The as-of date is today, or on a practice launch the practice date. The launch lead confirms this definition, or their own, with the plan.

## Re-plan rules

- Only downstream tasks move. A task upstream of the change keeps its date unless the launch lead asks for it to move.
- When a launch date (EA or GA) moves, every open task whose due date counts back from that date moves with it, downstream of the slip or not. The re-plan lists which tasks moved for that reason.
- Dates already sent in a nudge or a report are protected: the change notice names each one that moves.
- Recalculate the downstream dates with the same lead times and the same holiday rule as the plan. Keep each task's slack where the dates allow it; do not use it up to hold a launch date without saying so as an option. A task its blocker would now finish after moves to the first working day after the blocker's Due.
- When the change can be absorbed more than one way, the re-plan offers lettered options: hold the launch date and waive the rule it breaks; move the launch date; hold the upstream task to its original date. The person who decides a slip for this tier picks one. Each option's text lists every date it moves, so waiving a rule for one task still shows that task's new Due.
- A waived lead-time rule is an exception for that task, granted against the launch date it counts from. It holds while that date holds. When that launch date moves, the re-plan recomputes the task from its rule and asks the launch lead to keep, move, or drop the exception. An evidence waiver (an item ships without its file) never changes a date.
- A gate review's lead time (two weeks before EA, eight days before GA) may be shortened only by an explicit waiver recorded in the plan header.
- Each re-plan is a new plan version. The tracker changes only after the launch lead approves the version by name.

## Retro rules

- The retro records which tasks slipped and by how much, where the bottleneck seat was, waivers taken at gates, conditions and whether they were met, and results against the success metric.
- Findings are stored in launch history as a retro entry, so the next launch's retro can say which slips repeat.
- Playbook edits are numbered per launch and cited as `<launch> <n>` (for example `insights 3`) so edits from two launches never share a number.
- A gap the retro finds in this playbook (a tier not defined, a rule missing) is itself a proposed edit, not a note.

## Change log

| Edit | Change | Date |
|---|---|---|
| starter 1 | First version of the starter playbook, shipped with the launch readiness agent | 2026-10-21 |
