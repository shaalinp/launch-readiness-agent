# Launch readiness: operating manual

Handed off with 0 items open.

## 01 What this is and why

This manual covers Launch readiness, the workflow Launch readiness agent runs with an agent. Named people still answer at 5 decisions. It is not an autopilot.

Measure: Whether each committed launch date is still realistic at the weekly check.
Target: Every week the launch lead asks for a score, each committed launch date is called realistic or not, with a reason.
Owner: Launch lead (Runs the agent and approves every draft)

## 02 What changes in your week

A run starts: A person opens this folder in Claude Code and asks for this week's score. Nothing starts it by itself; a person may create a Monday 09:00 desktop task of their own (TRIGGERS.md). Setup, the gate, a date change, and the retro are separate requests: setup is once, a gate review or a date change is on demand, and the retro is after general availability.

What you will notice, in order:
1. Set up the launch plan, once
2. Approve the launch plan, once
3. Load the approved plan into the tracker, once
4. Read the tracker and score risk, each week
5. Launch team validates status, each week
6. Draft nudges, the escalation, and the weekly report
7. Launch lead approves what goes out, each week
8. Launch lead sends the nudges and the report, each week
9. Record the validated week
10. Draft the gate packet, before a readiness review
11. Decide go, go with conditions, or no-go
12. Record the gate decision
13. Recalculate dates when a date, scope, or no-go moves the launch
14. Approve the new plan before the tracker changes
15. Update the tracker with the approved dates
16. Compile the retro and draft playbook edits, after general availability
17. Launch team reviews the retro findings
18. Launch lead approves each playbook change
19. Update the playbook from the approved edits

Decisions you will be asked to make:
- Approve the launch plan, once: Launch lead answers.
- Launch lead approves what goes out, each week: Launch lead answers.
- Decide go, go with conditions, or no-go: Launch lead or Exec sponsor answers.
- Approve the new plan before the tracker changes: Launch lead answers.
- Launch lead approves each playbook change: Launch lead answers.

At the end: The playbook template the next launch's setup will read.

## 03 What it is worth

Hours per week today (estimate): not set
Hours per week with the agent (estimate): not set

## 04 Who does what

Owner of the goal: Launch lead

People on this workflow:
- Launch lead (Runs the agent and approves every draft): Sends every message. The agent never contacts stakeholders
- Exec sponsor (Approves the gate on a top-tier launch): Decides the gate when the tier says the exec sponsor makes the call
- Launch team (Named owners confirming their own items): Validates the weekly draft, in the meeting or async by a set day
- PM (Product): A seat. Whoever copies the template puts a real name here
- PMM (Product marketing): A seat. Whoever copies the template puts a real name here
- Enablement (Enablement): A shared team. Portfolio mode checks how much is due the same week
- Sales engineering (Sales engineering): A seat. Whoever copies the template puts a real name here
- Customer success (Customer success): A seat. Whoever copies the template puts a real name here
- Pricing and packaging (Pricing): A seat. Whoever copies the template puts a real name here
- Legal (Legal): A shared team. Portfolio mode checks how much is due the same week

Approve the launch plan, once: Launch lead answers. Anyone else: Claude does not accept their answer and names who can.
If Launch lead has not replied, the agent asks once in the same place and stops. Nothing in the bundle keeps time or reminds them, so someone brings their answer back to the session. The agent does not skip the decision.
Good enough at this decision: The tasks match the tier, each task has one owner, and the dates and dependencies are acceptable. That is Launch lead's call, not the agent's.

Launch lead approves what goes out, each week: Launch lead answers. Anyone else: Claude does not accept their answer and names who can.
If Launch lead has not replied, the agent asks once in the same place and stops. Nothing in the bundle keeps time or reminds them, so someone brings their answer back to the session. The agent does not skip the decision.
Good enough at this decision: Each nudge, escalation, and the report is accurate, and anything that should be skipped is skipped. That is Launch lead's call, not the agent's.

Decide go, go with conditions, or no-go: Launch lead or Exec sponsor answers. Anyone else: Claude does not accept their answer and names who can.
If Launch lead or Exec sponsor has not replied, the agent asks once in the same place and stops. Nothing in the bundle keeps time or reminds them, so someone brings their answer back to the session. The agent does not skip the decision.
Good enough at this decision: Only the person the approved plan's header names for this gate decides: the launch lead on a tier 2 or 3 launch, the exec sponsor on a tier 1 launch. The other listed person may relay or comment, and that is input, not a decision. A missing item that ships anyway needs a waiver with a reason. Each condition needs an owner and a due date. Practice launch: the launch lead's answer as the decider is the decision, recorded with source made-up unless they relay a real decider's answer; decided_by is the role they played. That is Launch lead or Exec sponsor's call, not the agent's.

Approve the new plan before the tracker changes: Launch lead answers. Anyone else: Claude does not accept their answer and names who can.
If Launch lead has not replied, the agent asks once in the same place and stops. Nothing in the bundle keeps time or reminds them, so someone brings their answer back to the session. The agent does not skip the decision.
Good enough at this decision: The new dates and the change notice are acceptable. That is Launch lead's call, not the agent's.

Launch lead approves each playbook change: Launch lead answers. Anyone else: Claude does not accept their answer and names who can.
If Launch lead has not replied, the agent asks once in the same place and stops. Nothing in the bundle keeps time or reminds them, so someone brings their answer back to the session. The agent does not skip the decision.
Good enough at this decision: Each proposed edit is accepted, edited, or rejected on its own. That is Launch lead's call, not the agent's.

Identity here is taken from what the person says in Claude Code, not verified. There is no sign-in behind it.
To add or change an approver: ask Claude. After an explicit yes, it updates every place the bundle lists approvers (RUNBOOK.md, CLAUDE.md, the rules skill at `.claude/skills/launch-readiness--rules/SKILL.md`, which mirrors CLAUDE.md for a plugin install, this section, and the agent file). Tell the consultant too, so the source copy matches before the next update.

## 05 Where it runs and how to set it up

Runtime: Claude Code (this computer). Starts: When you start it in Claude Code. Approvals: Stops 5 times for you: Approve the launch plan, once; Launch lead approves what goes out, each week; Decide go, go with conditions, or no-go; Approve the new plan before the tracker changes; Launch lead approves each playbook change.

How a run starts is in TRIGGERS.md.

Ways to run this:
This bundle is set up for one person running it in Claude Code.
- One person: open this folder in Claude Code.
- A team: put the folder in a shared private repository. Each person clones it and opens their clone in Claude Code, so the permission rules in `.claude/settings.json` and the safety checks apply. Do not install it as a plugin: a plugin does not carry the permission rules. `.gitignore` keeps launch data out of git by default; to share launches through that private repository, remove its "Launch data" block there. Each person still connects their own tools and keys.
- With nobody at a laptop:
  - Cloud routine: A routine belongs to its creator's individual claude.ai account and is not shared with teammates. (https://code.claude.com/docs/en/routines.md) Each routine run clones its repository fresh at the start of the run. (https://code.claude.com/docs/en/routines.md) Routines run without stopping for approval, apart from some artifact actions, so a workflow gate cannot pause a run. (https://code.claude.com/docs/en/routines.md) This bundle is not set up for a cloud routine. This version does not support it.
  - Hosted by Anthropic (Managed Agents): Managed Agents supplies MCP server credentials from a vault registered and referenced by ID at session creation, instead of storing secrets in the agent definition. (https://platform.claude.com/docs/en/managed-agents/vaults.md) Managed Agents is not covered by zero data retention; its session transcripts persist until the customer deletes them. (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.md) This bundle is not set up for Managed Agents. This version does not support it.
  - Local scheduled task: A local scheduled task only runs while the Desktop app is open and the computer is awake. A time it sleeps through is skipped, then on wake it starts one catch-up run for the most recent missed time in the last seven days. (https://code.claude.com/docs/en/desktop-scheduled-tasks.md)

## 06 What data it touches

Load the approved plan into the tracker, once
- Launch history (store): writes
- Practice history (store): writes

Read the tracker and score risk, each week
- Launch history (store): reads
- Practice history (store): reads

Record the validated week
- Launch history (store): writes
- Practice history (store): writes

Draft the gate packet, before a readiness review
- Launch history (store): reads
- Practice history (store): reads

Record the gate decision
- Launch history (store): writes
- Practice history (store): writes

Update the tracker with the approved dates
- Launch history (store): writes
- Practice history (store): writes

Compile the retro and draft playbook edits, after general availability
- Launch history (store): reads
- Practice history (store): reads

Update the playbook from the approved edits
- Launch history (store): writes
- Practice history (store): writes

What reaches Anthropic: everything a step reads or writes above is sent to Anthropic's API as part of the run, the same way as any turn in a Claude conversation.

Anthropic's terms for this runtime:
- Under commercial terms, Anthropic does not train models on code or prompts sent to Claude Code unless the customer opts in. (https://code.claude.com/docs/en/data-usage.md)
- Commercial Claude Code usage has a standard 30-day retention period. (https://code.claude.com/docs/en/data-usage.md)
- Consumer plans differ from the commercial terms above: an account that allows its data for model improvement keeps it 5 years; one that does not keeps it 30 days. Which applies depends on how the team signs in: a commercial/API relationship or a personal consumer account.
- Claude Code caches session transcripts locally in plaintext under ~/.claude/projects/ for 30 days by default, adjustable with cleanupPeriodDays. (https://code.claude.com/docs/en/data-usage.md)
- Zero data retention: not recorded for this runtime.
- Anthropic publishes its compliance artifacts, including API logging procedures, in the Anthropic Trust Center. (https://code.claude.com/docs/en/data-usage.md)

What is kept between runs:
- Launch history: Validated weekly status, what was sent, gate decisions, slip and date decisions, and retro findings, by launch. Live launches only; a practice launch writes Practice history instead. Kept as the file history/launch-history.jsonl in the folder.
- Practice history: The same entries as Launch history, for a launch whose entry in setup/state.json has mode "practice". Never read or written for a live launch. Kept as the file history/practice-history.jsonl in the folder.

Run log: `runs/log.jsonl` keeps one line per moment a person stepped in, as codes and ids from this bundle only: how each gate was answered, how each draft went out, where the agent had to ask, how each check came out, and when a session started and on which model. No content, no names, no dates from the plan, no file contents, no tool arguments, no error messages, and nothing from RESULTS.md but a count.
- What leaves this computer: nothing. `runs/log.jsonl` and transcripts stay here.
- Nothing sends it. The agent never contacts anyone. The log is gitignored, so an ordinary push does not share either. Installed as a plugin, nothing is logged, because a plugin's hooks run in every session they are on.

Personal data: none of the recorded actions return personal data. That covers the connected tools only. The files in this folder do hold people's names and their exact words: Launch history and Practice history (owner names, what each said), `launches/<launch>/intake.md`, the tracker (owners, notes), and the launch folder. Transcripts hold the same.

Data the team said must not leave: Not set

How to delete:
- Launch history: delete history/launch-history.jsonl in this folder.
- Practice history: delete history/practice-history.jsonl in this folder.
- Launch history and Practice history also have staging folders: delete `history/launch-history.jsonl.next/` and `history/practice-history.jsonl.next/` if they exist.
- Your launches: delete `setup/state.json` (your answers), `setup/policy.json` (each launch's mode and tracker), `runs/txn/` (the record of each live tracker write), `launches/` (each launch's intake), `practice/` (each practice launch's own tracker, playbook, and launch folder, in `practice/<launch>/`), `tracker/launch-tracker.csv` (reset it to the header row in `tracker/README.md` if you want a blank one), and `launch-folder/`.
- Run log: delete `runs/log.jsonl` and `runs/.state/` in this folder.
- Local session transcripts: Claude Code caches session transcripts locally in plaintext under ~/.claude/projects/ for 30 days by default, adjustable with cleanupPeriodDays.
- Data already sent to Anthropic follows the retention terms above; deleting a local file does not delete it there.

## 07 When something breaks

Start with `node scripts/check-connections.mjs`. It reports each connection as reachable, unreachable, or manual.

Common causes:
- A sign-in expired. Reconnect the tool, then run the check again.
- A connector changed. A tool renamed or removed something the agent calls. The check shows it unreachable, or the agent reports the call failed. Do not work around it.
- A decision was not answered. The agent asks once and stops. Ask Launch lead or Exec sponsor to answer in the same place, and the run goes on from that decision.

Call Launch lead when:
- a connection still fails after you reconnect it
- the monthly check in section 08 shows a problem you cannot explain
- the stop condition is met (the launch lead spends longer correcting drafts than writing the weekly update did)
- the agent does something section 10 says it will not do

## 08 Keeping it healthy

The model is pinned to claude-opus-5-5.
- Claude Code: set in `.claude/settings.json` and in the agent file `.claude/agents/launch-readiness.md`. It needs Claude Code 2.1.280 or newer; an older one stops at the start of the session.

The team can change the model. Ask Claude to compare first.
Claude's comparison:
- Make a copy of the repository in a git worktree, checked out at one captured git commit.
- Reset the stores to one captured starting state for both models: Launch history and Practice history from a copied folder.
- Use the captured inputs of three recent runs.
- Score both runs with `node evals/score.mjs` under the same conservative rule as the monthly check below.
- Show both results.
- Edit every place the model is pinned only after an explicit yes.

Once a month, check the last four real runs. This only reads transcripts you already have. It does not start the agent and it writes nothing.
Where a run's transcript lives: Claude Code caches session transcripts locally in plaintext under ~/.claude/projects/ for 30 days by default, adjustable with cleanupPeriodDays.
For each transcript, run `node evals/score.mjs <transcript>` and read the report, not the exit code. The script exits 0 even when a check is missing or did not arise.
Call Launch lead if the report shows any check as not scored or did not arise, or any failed check marked "(enforced)". A failed check without that mark is the owner's call (Launch lead).

Keep the measure record in `RESULTS.md` in the repo: one dated line per period for "Whether each committed launch date is still realistic at the weekly check". Bring it to the tune-up.
Review the stop condition at the same time: stop if the launch lead spends longer correcting drafts than writing the weekly update did.

## 09 Tune-up

The team:
- Answers the decisions
- Records the measure each period
- Runs `node scripts/check-connections.mjs` when a run fails
- Notes anything odd and brings it to the tune-up

A tune-up:
- Starts from what the team noted since the last tune-up
- Re-verifies the Anthropic doc facts the bundle relies on
- Probes every connection
- Scores recent runs and checks for drift
- Offers a model review as a service (the team can also ask for this any time; see section 08)
- Reviews results against the target and the stop condition
- Ships an updated bundle if anything changed

How a tune-up compares two models, same procedure as section 08:
- Make a copy of the repository in a git worktree, checked out at one captured git commit.
- Reset the stores to one captured starting state for both models: Launch history and Practice history from a copied folder.
- Use the captured inputs of three recent runs.
- Score both runs with `node evals/score.mjs` under the same conservative rule as the monthly check below.
- Show both results.
- Edit every place the model is pinned only after an explicit yes.

## 10 Guardrails and what not to expect

Enforced (the harness refuses):
Denied in .claude/settings.json: Read(./setup/.env), Edit(./setup/.env), Edit(./history/launch-history.jsonl), Write(./history/launch-history.jsonl), Edit(./history/practice-history.jsonl), Write(./history/practice-history.jsonl), Edit(./scripts/append-store.mjs), Write(./scripts/append-store.mjs), Edit(./scripts/entry-contracts.mjs), Write(./scripts/entry-contracts.mjs), Edit(./runs/log.jsonl), Write(./runs/log.jsonl), Edit(./runs/.state/**), Write(./runs/.state/**), Edit(./setup/policy.json), Write(./setup/policy.json), Edit(./runs/txn/**), Write(./runs/txn/**), Edit(./scripts/write-gate.mjs), Write(./scripts/write-gate.mjs), Edit(./scripts/stage-write.mjs), Write(./scripts/stage-write.mjs), Edit(./scripts/tracker-write.mjs), Write(./scripts/tracker-write.mjs), Edit(./scripts/reconcile.mjs), Write(./scripts/reconcile.mjs), Edit(./scripts/set-mode.mjs), Write(./scripts/set-mode.mjs), Edit(./.claude/hooks/guard-tracker.mjs), Write(./.claude/hooks/guard-tracker.mjs), Edit(./scripts/bind-system.mjs), Write(./scripts/bind-system.mjs)
Asks a person first: Bash(node scripts/bind-system.mjs *)
Hook .claude/hooks/no-publish.sh blocks mcp__.*__publish.*
Hook .claude/hooks/guard-secrets.mjs blocks reading, searching, or editing setup/.env, including from a plugin install, where the permission rules above do not apply
Hook .claude/hooks/guard-append.mjs blocks the file tools on history/launch-history.jsonl, history/practice-history.jsonl and on scripts/append-store.mjs, including from a plugin install
Hook .claude/hooks/guard-tracker.mjs blocks every Google Sheets write that is not the next call of a staged live write, any file tool or shell command on a live tracker CSV, and any change to runs/txn/, setup/policy.json, or the write scripts (CLAUDE.md, "Live writes"). A plugin install does not run it, because a plugin's hooks run in every session it is on
Hook .claude/hooks/guard-prompt-secrets.mjs stops a message that looks like it contains a key before Claude sees it. The text may still be in this computer's prompt history, so revoke a key you pasted
Hook .claude/hooks/no-undeclared-outbound.mjs reads connections.json when this folder is opened directly. A call whose tool name matches a declared action of a connected system or connector is allowed on any server, because a claude.ai connector's server id differs per machine. publish, share, send, reply, forward calls on any other connector are blocked, and so is publishing an artifact. Other write-like calls (post, delete, trash, remove, invite, update, upload, schedule, append, create, write, insert, clear, copy, move, rename, set, add, edit, patch) on an undeclared connector ask a person first and name any system that is not connected yet. The desktop app's own tools (mcp__ccd_*) are exempt. A plugin install does not run it, because a plugin's hooks run in every session it is on
The hooks run on Node. Without it, every tool a hook guards is blocked and each message says why; install Node.js LTS, then fully quit and reopen the app

Asked for (a check can fail):
- Set up the launch plan, once: 4 checks, in evals/set-up-the-launch-plan-once--build-plan.cases.json
- Load the approved plan into the tracker, once: 4 checks (2 enforced), in evals/load-the-approved-plan-into-the-tracker-once--load-tracker.cases.json
- Read the tracker and score risk, each week: 5 checks, in evals/read-the-tracker-and-score-risk-each-week--score-week.cases.json
- Draft nudges, the escalation, and the weekly report: 6 checks, in evals/draft-nudges-the-escalation-and-the-weekly-repor--draft-followups.cases.json
- Record the validated week: 8 checks, in evals/record-the-validated-week--record-week.cases.json
- Draft the gate packet, before a readiness review: 3 checks, in evals/draft-the-gate-packet-before-a-readiness-review--draft-packet.cases.json
- Record the gate decision: 8 checks, in evals/record-the-gate-decision--record-decision.cases.json
- Recalculate dates when a date, scope, or no-go moves the launch: 5 checks, in evals/recalculate-dates-when-a-date-scope-or-no-go-mov--draft-replan.cases.json
- Update the tracker with the approved dates: 3 checks (2 enforced), in evals/update-the-tracker-with-the-approved-dates--update-tracker.cases.json
- Compile the retro and draft playbook edits, after general availability: 6 checks, in evals/compile-the-retro-and-draft-playbook-edits-after--draft-retro.cases.json
- Update the playbook from the approved edits: 4 checks, in evals/update-the-playbook-from-the-approved-edits--update-playbook.cases.json
- First run: 3 checks, reported in the chat and the run log. They have no cases file, so `node evals/score.mjs` neither scores them nor lists them as not scored.

What not to expect:
- The agent never contacts stakeholders.
- The agent never decides a gate.

## 11 Words your team will hear

Skill: a job description for one step, in markdown your team can edit.
Decision: Launch lead and Launch lead or Exec sponsor answer. Send back returns to the step before, same thread.
Store: something the workflow remembers between runs.
Check: a statement the agent reports on, pass or fail, at the end of a step.
