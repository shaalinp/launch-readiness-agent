# Launch readiness agent

[![tests](https://github.com/shaalinp/launch-readiness-agent/actions/workflows/test.yml/badge.svg)](https://github.com/shaalinp/launch-readiness-agent/actions/workflows/test.yml) · [Latest release](https://github.com/shaalinp/launch-readiness-agent/releases/latest) · [MIT license](LICENSE) · [Security and data](SECURITY.md)

An agent for Claude Code that turns a launch playbook into a live plan, scores risk every week, drafts the nudges and the weekly report, prepares the go or no-go packet, re-plans when a date moves, and runs the retro that improves the playbook for the next launch. It was built by a launch lead who runs product launches for a living and Shaalin Parekh, who builds agents for go-to-market teams.

It works on day one with what you already know: the product's name and who it is for, its early-access and general-availability dates, a success target, and your name. Everything else has a default, and a role with no name yet is marked unowned. It ships with a starter playbook for a SaaS launch; you can replace it with your own at any time.

Your launch files stay in this folder unless you choose Google Sheets or Drive. What you type, and the files the agent reads, go to Anthropic to run the model, as in any Claude session. The agent never sends a message, and never marks anything approved: it drafts, and the launch lead sends.

**What it won't do:**
- send email or messages, or publish or share anything
- read your keys
- rewrite history
- change a live launch's tracker except through a checked write that it reads back
- record a made-up answer on a live launch

There's no telemetry and there are no packages to install: only Node.js, which you install yourself. [SECURITY.md](SECURITY.md) shows how each of these is enforced, what isn't covered, and how to check a release.

## Get started

1. Install [Claude Code](https://claude.com/claude-code) (the desktop app or the CLI) if you do not have it.
2. Install Node.js LTS from https://nodejs.org/ (on a Mac with Homebrew, `brew install node`). The agent cannot run without it: the safety checks in this folder (small scripts that run before the agent's actions, in `.claude/hooks/`) run on Node, and every file and shell tool is blocked until it is installed. To check, run `node --version` in a terminal. After installing, fully quit and reopen the Claude desktop app, or open a new terminal for the CLI, so it sees Node.
3. Get your own copy:
   - Click **Use this template** at the top of the repository page, and make the new repository **private**. Once you use it, your tracker, playbook and launch notes are in it.
   - Or download the zip from the [latest release](https://github.com/shaalinp/launch-readiness-agent/releases/latest) and unzip it.
4. Put the folder on your computer: clone your private copy with git, or unzip the download. Open **this exact folder**, the one that holds `CLAUDE.md` and `.claude/`, as its own new session in Claude Code. In the desktop app, choose the folder when you start a new session. With the CLI, run `claude` from inside it. (`.claude/` is hidden in Finder; that's normal.) Not the folder above it, and not added to a session that is already running. Claude Code loads the safety checks only from the folder a session was opened on, when it starts, and the agent checks for that before it does anything.
5. Say: **set up a launch** (or **set up a practice launch**). The agent asks you a few questions, one at a time, with a default for each. Ten minutes later you have a plan to approve.

Every Monday after that, open the folder and say: **score this week**.

## What it does

| When | What the agent does | What you do |
|---|---|---|
| Once | Builds the plan from the playbook: tasks for your tier, one owner each, dates counted back from your launch dates | Approve the plan |
| Once | Loads the approved plan into the tracker | Nothing |
| Every week | Reads the tracker, checks deliverables exist, scores every task red, amber, or green, says whether the launch dates are still realistic | Your team confirms or corrects their rows: in the Google Sheet themselves when the tracker is one, or by telling you, and you tell the agent, when it is the CSV |
| Every week | Drafts a nudge for each red, amber, stale, or soon-due item, an escalation if the critical path slipped, and the weekly report | Send, edit, or skip each one |
| Before a review | Compiles the gate packet with evidence and a recommendation | Decide go, go with conditions, or no-go |
| When a date moves | Recalculates the downstream dates and drafts the change notice | Approve the new plan |
| After GA | Compiles the retro and proposes playbook edits | Accept, edit, or reject each edit |

## What is in this folder

Some of these, such as `launches/`, `history/` and `practice/`, appear only after you start using the agent.

- `CLAUDE.md`: the rules the agent follows. Start here if you want to know what it will and will not do.
- `playbook/playbook.md`: the starter playbook. Tiers, task list, lead times, gates, scoring and re-plan rules. Yours to edit.
- `tracker/launch-tracker.csv`: the launch tracker, the system of record. Owners update their own rows in a Google Sheet; with the CSV, you pass their answers to the agent, which writes them.
- `launch-folder/`: where deliverables go. A task marked done with no file here gets flagged.
- `templates/intake.md`: what the agent asks for at setup. It fills this in with you. `templates/launch-intake-template.xlsx` is the same intake as a Google Sheets template, tabs for tiers 1 and 2 (tier 3 is taken in chat), if you would rather fill it in first.
- `templates/launch-tracker-template.xlsx`: the tracker as a Google Sheets template, with Summary, Gate view and Slip log tabs calculated from the Tracker tab. `tracker/README.md` explains every column.
- `launches/<launch>/`: the plan versions, weekly drafts, gate packets, and retro for each launch.
- `history/launch-history.jsonl`: validated weekly status and gate decisions, one entry per line. Entries are only ever added, never changed or removed.
- `practice/<launch>/` and `history/practice-history.jsonl`: each practice launch's own tracker, playbook, and launch folder, and the practice history, made only if you ask for one.
- `.claude/`: the skills (one per step), the safety checks that stop the agent from using a pasted key, contacting anyone, or writing the live tracker outside a checked write, and the permissions.
- `OPERATING.md`, `RUNBOOK.md`, `HOW-TO.md`: the manual for the people who run it, who may approve what, and how.

## What you say at each step

Claude Code will ask you to trust the folder and to approve writes. That is expected.

- Setup: **set up a launch**, or **set up a practice launch**.
- Change an intake answer: **set the PM to Ana Ruiz**. It changes the intake and `setup/state.json` together and shows you both.
- Approve the plan: **approve plan-v1**, naming the version.
- Each week: **score this week**.
- Validate: tell it what each owner said.
- Nudges: **I sent 1, 2 and 4 on Monday, skipped 3**. Say when each went out if you know, and which owners answered and when; it records only what you say.
- Gate packet: **draft the beta gate packet**.
- Gate decision: **record the beta gate: go**, or **go with conditions** and the conditions, or **no-go** and the new date, in the named decider's own words, or relayed from them as theirs.
- A date moved: **the GA date moved to YYYY-MM-DD**, or **T04 will slip to YYYY-MM-DD**. It drafts a re-plan for you to approve; the tracker changes only after you do.
- After general availability: **run the retro**. It compiles what slipped and proposes numbered playbook edits for you to accept, edit, or reject.
- In a practice launch: **it's the week of YYYY-MM-DD**. A jump past a gate review stops at that gate for a real packet and your decision.

Words used here:

- Tier: the size of the launch, 1 to 3; it sets who decides.
- Seat: a role on the launch, such as PM or Legal, with one owner each.
- Short name: the lowercase name for the launch that names its files.
- Gate: a go or no-go review, such as beta or GA.
- Tracker tab: the tab named Tracker in the Sheets tracker; the CSV is the same columns with no tabs.
- Live launch: a real one. The agent records only what people actually said, and refuses to make up answers for it.
- Practice launch: a rehearsal on made-up weeks, kept apart from every live record.
- Portfolio: more than one launch run from this folder at once. The weekly score then also checks how much a shared team, such as Enablement or Legal, has due the same week.

## Practice first

Say **set up a practice launch** to rehearse on made-up weeks before a real one. You say what week it is and what happened, or ask for a scenario such as "a rough launch"; the agent plays the owners. It works on its own copies of the tracker and playbook in `practice/<launch>/` and keeps its own history, so nothing it writes mixes with a live launch or another practice launch, and nothing is sent to anyone. When you jump ahead, it stops at each gate review on the way; the weeks it skips are not observed, and any owner reply it makes up is labeled made up, so the retro calls a response time from it simulated.

## Google Sheets and Google Drive

By default the tracker is a CSV file and the launch folder is a folder, both in this repository. If your team already lives in Google Sheets or Drive, say so during the first run: the agent uses the Claude connectors you have enabled in the desktop app and records which sheet and which folder in `connections.json`. A spreadsheet has tabs; the CSV does not, so "Tracker tab" means the tab in Sheets. Import `templates/launch-tracker-template.xlsx` into Sheets to start from a tracker with the Summary, Gate view and Slip log tabs; the agent is told to write only its `Tracker` tab. Nothing else changes.

## Privacy

- The agent runs in your Claude Code session with your Anthropic account. What you type and the files it reads go to Anthropic under your account's terms.
- Nothing in this folder sends data to us or anyone else. There's no telemetry, and the one network call is a link check you run yourself (`node scripts/check-connections.mjs`). If you connect Google Sheets or Drive, your tracker and launch folder data go to Google through Claude's connectors, under your Google account.
- `.gitignore` keeps your launches, practice runs, history, write records and setup out of git. The tracker, the playbook and `connections.json` are tracked and hold your launch data once you use them, so keep your copy private.
- The safety checks under `.claude/hooks/` block the connector tools that send, post, share or publish, and block pasted secrets from being used. The agent is also told to never send anything itself.
- On a live launch, `guard-tracker.mjs` blocks every change to the live tracker except the one change the agent staged and checked (`scripts/stage-write.mjs`), and `.claude/settings.json` denies the agent's file tools on the history files, the run log, `setup/policy.json`, the write records in `runs/txn/`, and the scripts that check writes. Made-up answers are refused there.
- `runs/log.jsonl` is a local log of codes only (which gate was answered, which check passed). Nothing reads it but you. Nothing sends it.

## Make it yours

Edit `playbook/playbook.md`. Keep its section names; the agent looks for them. After each launch the agent proposes edits from the retro, and writes back only the ones you accept.

Built with Agent Studio. To work with Shaalin on an agent for your own team, see https://industrygtm.com.
