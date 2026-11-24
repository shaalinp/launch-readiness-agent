---
name: first-run
description: "Set this folder up for its first launch: confirm the folder loaded, choose where the tracker, playbook, and launch folder live (files here by default, Google Sheets or Drive if the person prefers), take the launch intake one question at a time with the starter defaults offered first, derive the launch short name, and record every answer in setup/state.json so no later session asks again. Also sets up a practice launch on its own copies of the tracker, playbook, launch folder, and history. Run before step 1 whenever setup/state.json is missing, or when the person says 'set up', 'new launch', 'practice launch', or 'start'."
allowed-tools: Read, Edit(./setup/state.json), Edit(./launches/**), Edit(./practice/**), Edit(./playbook/**), Bash(node scripts/check-connections.mjs), Bash(node scripts/intake.mjs set *), Bash(node scripts/intake.mjs get *), Bash(node scripts/set-mode.mjs *), Bash(node scripts/stage-write.mjs setup), Bash(node scripts/reconcile.mjs *), Edit(./runs/proposed.json), Edit(./runs/readback.json)
---

# First run

This folder ships with a starter playbook, an empty tracker, an empty launch folder, and an intake template. The person who opened it may have none of their own. This skill gets them from nothing to an approved plan in one conversation, asking only for what the defaults cannot assume.

Rules for the whole conversation:
- One question at a time. Offer the default first, as the first option, so "use the default" is always a complete answer.
- Never ask for something that is already recorded in `setup/state.json`, `connections.json`, or an existing `launches/<launch>/intake.md`. Read them first and say what you found.
- Record each answer as soon as it is given: a system location with `node scripts/bind-system.mjs`, everything else in `setup/state.json` and the intake file. An answer that lives only in this chat is lost to the next session.
- Do not invent a playbook section, a column, or a date. When something is missing and there is no default, say so and ask.

## 0. Check the folder loaded

Check for Node first: if the session showed a notice that Node.js is not installed (README.md, step 2), tell the person to install it and then fully quit and reopen the app, and do nothing else. Then check that `runs/log.jsonl` exists, with the Read tool rather than a shell command. If it does not, the safeguards did not load: stop and tell the person to open this folder (the one with `CLAUDE.md` and `.claude/`) as its own new session, not its parent and not added to a running session. Do nothing else until that is true. The one exception is a plugin install, where this skill came from a plugin and the project folder has no `.claude/hooks/` of its own: the safeguards travel with the plugin and the run log is off, so skip this check and say so.

## 1. What is already recorded

Read `setup/state.json` if it exists. If it names a launch whose plan is approved, say so and ask which step they want: the weekly score, a gate packet, a date change, a new launch, or a practice launch. If the request already names one of these (a new launch, a practice launch), skip the question and do it. A new launch repeats sections 4 and 5 only; the systems and the playbook stay. A practice launch is section 1a, then sections 4 and 5.

If there is no `setup/state.json`, say in two sentences what this folder is and that setup takes a few minutes of questions. Then ask once, live first: is this a live launch or a practice launch? If the request already says practice or live, skip this question. A request that says "practice", "test run" (the word in older copies of the intake sheet), "fake data", "dummy", "just testing", "rehearse", "simulate", or "made-up" means practice.

- Live (the default): the plan, tracker, and history it writes are the real launch's, and the nudges and reports it drafts are for real people, sent only by the launch lead. Say so plainly, then go on to section 2.
- Practice: a rehearsal on made-up weeks, kept apart from everything live. Go to section 1a. A person can set up a practice launch beside a live one at any time.

## 1a. A practice launch

Only when the person chose practice. Nothing a practice launch writes touches the live tracker, playbook, launch folder, launch history, Google Sheets, or Drive, apart from a practice sheet the launch lead chose for it (below).

- Product name first: ask for it (or take it from the request or a live launch's intake) before proposing anything.
- Short name: the product's short name with `-practice` on the end (`insights-practice`); propose it, and they confirm or change it. It names every file for this launch: its plans and drafts live in `launches/<launch>/`, and its own tracker, playbook, and launch folder in `practice/<launch>/`. Below, `<launch>` is that full name (`insights-practice`). A second practice launch gets another name (`insights-practice-2`) and its own `practice/<launch>/` folder, so two practice launches never share a file.
- Register the launch first: `node scripts/set-mode.mjs <launch> practice practice/<launch>/launch-tracker.csv` (or the practice sheet's link, below). A tracker copy is refused until it is registered; a practice launch can never use the live tracker, and set-mode refuses a tracker another practice launch already uses.
- Make the copies once, as files in this folder even when the live tracker is a Google Sheet, with the file tools, one file at a time and no shell commands (writing a file creates its folder): `practice/<launch>/playbook.md`, a copy of `playbook/playbook.md`; `practice/<launch>/launch-tracker.csv`, the header row of `tracker/launch-tracker.csv` only; and `practice/<launch>/launch-folder/README.md` with one line saying this is that practice launch's folder. If the copies already exist for this launch, keep them. Never copy or reuse another practice launch's files, and never write the files of the older single-folder layout (`practice/playbook.md`, `practice/launch-tracker.csv`) for a new launch.
- The practice tracker can be a Google Sheet instead of `practice/<launch>/launch-tracker.csv`, so the launch lead can watch it change: offer it only when Google Sheets is connected. They make their own copy of the tracker template (the Sheets one, or `templates/launch-tracker-template.xlsx` imported) with "practice" in its name, and give you its link. Check that it is not the live tracker in `connections.json` or in any live launch's entry, and not another practice launch's sheet, that its title says practice, and that its `Tracker` tab has the header row and no task rows; if any check fails, say which and use the CSV. Name that sheet as the tracker in this launch's `systems`, and write only its `Tracker` tab.
- Record it in `setup/state.json` under the practice launch's name: `"mode": "practice"`, `"systems"` naming the three copies in `practice/<launch>/`, and `"history": "practice-history"` (shape in section 6).
- Ask once for the practice date the launch starts on, unless the request gave one. On a practice launch every date written or passed (Last update, `--as-of`, the plan approval date, any "today") is the practice date, never the calendar's.
- Say once how practice runs: the launch lead says what date it is ("it is the week of 2027-01-11"). A jump forward follows "Practice weeks and jumps" in CLAUDE.md: it stops at every gate review it crosses, for a real packet and the launch lead's decision, and the weeks between are not observed, so nothing is recorded for them. Owner updates come from the launch lead, or from a scenario they ask for ("a rough launch"); the agent writes made-up updates into the practice tracker, says each one is made up, and records each made-up reply as its own `source: "made-up"` event with its practice date, task, and owner. A deliverable the scenario needs is a file in `practice/<launch>/launch-folder/`. Drafts are headed "PRACTICE", nobody is sent anything, and "sent" means what the launch lead says they would have sent. Retro edits go to `practice/<launch>/playbook.md`; one reaches the real playbook only if the launch lead later asks for it during a live launch's playbook step.

Then take the intake (section 4) and the deciders (section 5). If a live launch's intake exists, offer to start from a copy of it.

## 2. Where things live

Read `connections.json`. Each system is bound to a file in this folder by default:

- Launch tracker: `tracker/launch-tracker.csv` (its header row is the schema; see `tracker/README.md`)
- Playbook: `playbook/playbook.md`
- Shared launch folder: `launch-folder/`

Ask once: keep these as files in this folder, or use a Google Sheets spreadsheet for the tracker (a spreadsheet, not a Google Doc) and a Google Drive folder for the launch folder, through the Claude connectors? Files here is the default and needs nothing else.

If they choose Google Sheets or Drive: they connect it in the Claude desktop app (Settings, Connectors) and enable it for this session. For the tracker, offer the template first: `templates/launch-tracker-template.xlsx`, imported into Google Sheets (File, Import, or upload it to Drive and open it with Sheets), has the `Tracker` tab with the header row plus Summary, Gate view, Slip log and Guide tabs that calculate from it. Ask for the sheet URL or the folder link, then record it: `node scripts/bind-system.mjs sys-tracker google-sheets <sheet url>` or `node scripts/bind-system.mjs sys-folder google-drive <folder link>`. Claude Code asks the person to approve each `bind-system.mjs` run before it binds anything; say so before you run it. The agent reads and writes the sheet's `Tracker` tab only; if the sheet has one tab, that is the tracker. If the tracker tab is empty, write the header row from `tracker/launch-tracker.csv` into it through a setup transaction (CLAUDE.md, "Live writes": `node scripts/stage-write.mjs setup`), the header only, no rows; rows come after a plan is approved; if it has a header row already, read it and say which of the columns in `tracker/README.md` it lacks, if any. Run `node scripts/check-connections.mjs` and show the result.

## 3. The playbook

Ask once: do they have a launch playbook of their own (a task list, lead times, who decides gates)? Offer the default first: the starter playbook in `playbook/playbook.md`, written for a SaaS product launch with three tiers.

- Starter: keep it. Confirm the tier scale in one line ("Tier 1 is a company launch the exec sponsor gates; tier 2 a product launch you gate; tier 3 a feature note") and go on.
- Their own: ask them to paste it or name the file. Replace the contents of `playbook/playbook.md` with it, keeping the eight section names from the starter (Scope, Setup rules, Tasks, Gates, Risk scoring rules, Re-plan rules, Retro rules, Change log). For each section their playbook does not cover, keep the starter's section and say so, marked "starter default". Do not merge the two task lists; use theirs.

Write the choice to `setup/state.json` (`playbook.source`: `starter` or `own`, and the date).

## 4. The launch intake

If the person already filled the intake somewhere else (a Google Sheet, a doc, a pasted table), read it once, show which fields it answers, and ask only for the blank ones. A sheet made from `templates/launch-intake-template.xlsx` has tabs for tiers 1 and 2 only; tier 3 has no tab and is taken in chat. Pick the tab whose Tier row matches the tier the person named, or the one with more answers filled, and confirm it with them. Take Field from column B and the answer from column C. A row whose Check column says "Needed" or "Fix: ..." is asked for; a row whose Check says "Default applies", "Not required" or "T01 will carry it" takes column D's default. Column D on a required row is an example, never an answer. Read "practice", or "Test run" in an older copy of the sheet, as a practice launch. Its Systems rows name the tracker, the launch folder and the playbook: bind them as in section 2. Otherwise fill `templates/intake.md` one field at a time, in its order, with the template's default offered first. Either way the intake ends up as one file, below; tell the person that later changes go to that file or to you, not to the sheet. Then:

- Ask the product name first, then derive the launch short name from it (lowercase letters, digits and hyphens, no spaces). Propose it; they confirm or change it. It names every file for this launch.
- Check the dates: both in the future, early access before general availability. If not, ask again; never guess a year.
- Launch lead: ask for their name unless they gave it in this conversation or the intake. Never take a name from the account, the session, or the computer; the plan and every decision record carry it.
- Tier: if they do not know, recommend one from the description and the goals, and say why. Say who decides the gates and slips on that tier, from the playbook's Scope.
- Success metric: ask for metric, baseline, and target. A target alone is fine; say that task T01 will carry the rest.
- Seats: a seat with no name is "unowned"; say the plan will flag its tasks.
- A live launch whose people are placeholders (names like "Test ...", "TBD", "placeholder", or "test placeholder") looks like a test. Say so, and recommend a practice launch, with a practice Sheet when Google Sheets is connected, so nothing made up reaches the live tracker or Launch history. Go on live only if the launch lead says it is a real launch.

Save the filled table as `launches/<launch>/intake.md`, every row of `templates/intake.md` in its order with the answers in the "Your answer" column. Save the short name, tier, dates, deciders, holiday rule, and seats in `setup/state.json` as well (shape in section 6). The deciders and the holiday rule are saved as the intake gave them, or as the playbook's defaults when it left them blank; section 5 confirms them.

Once both files exist, change an answer only with `node scripts/intake.mjs set <launch> <field> <value>`, never by editing either file or with a script of your own. It changes the existing row in the intake and the same answer in `setup/state.json` together, then prints both as read back from disk; show that to the person. Several answers go in one command as pairs, for example the seats: `node scripts/intake.mjs set insights pm "Ana Ruiz" pmm "Ben Ode" legal unowned`. Field names are the intake's row names or short keys (`node scripts/intake.mjs get <launch>` lists them with their current answers). If it refuses, say why in its words and do not work around it: the short name and live or practice do not change once set, and a system location is bound as in section 2.

## 5. Who decides, and the calendar

Confirm in one question each, default first. Both files exist by now, so record each answer that differs from what is saved with `node scripts/intake.mjs set <launch> <field> <value>` (fields `decides-gates`, `decides-slip`, `holiday-rule`), never by editing a file:
- Who decides the gates and who decides a slip on this tier (from the playbook's Scope). On tier 1 the exec sponsor; the launch lead may relay their answer, and the record says so. On a practice launch the launch lead plays every role, deciders included.
- The holiday rule (default: US federal holidays plus weekends, move earlier).
- The meeting cadence (default from the playbook's Setup rules). Save it to `launches/<launch>/cadence.md` when they accept or edit it.

## 6. Hand off to step 1

Write `setup/state.json` in this shape, register the launch with `node scripts/set-mode.mjs <launch> live` (a practice launch was registered in section 1a), then say what was recorded and start step 1 (build the plan) from `launches/<launch>/intake.md` without asking anything the state answers:

```json
{
  "version": 1,
  "set_up_at": "YYYY-MM-DD",
  "systems": { "tracker": "tracker/launch-tracker.csv", "playbook": "playbook/playbook.md", "folder": "launch-folder/" },
  "playbook": { "source": "starter", "tiers_confirmed": true },
  "launches": {
    "<launch>": {
      "product": "<product name>",
      "tier": 2,
      "ea": "YYYY-MM-DD",
      "ga": "YYYY-MM-DD",
      "launch_lead": "<name>",
      "exec_sponsor": "<name or null>",
      "decides": { "gate": "<name>", "slip": "<name>" },
      "seats": { "pm": "<name or unowned>", "pmm": "...", "enablement": "...", "sales_engineering": "...", "customer_success": "...", "pricing_and_packaging": "...", "legal": "..." },
      "holiday_rule": "US federal holidays plus weekends, move earlier",
      "intake": "launches/<launch>/intake.md",
      "plan_approved": null,
      "mode": "live"
    }
  }
}
```

The `systems` values mirror `connections.json`; `connections.json` wins if they differ. A practice launch's entry has its own `systems` and `history`, and those win for that launch. `<practice-launch>` is its full short name, which already ends in `-practice` (`insights-practice`); never add a second `-practice`:

```json
"<practice-launch>": {
  "mode": "practice",
  "systems": { "tracker": "practice/<practice-launch>/launch-tracker.csv", "playbook": "practice/<practice-launch>/playbook.md", "folder": "practice/<practice-launch>/launch-folder/" },
  "history": "practice-history",
  "...": "the same intake fields as a live launch"
}
```

## Report these checks

- `CHECK first-run-folder-loaded pass|fail` — `runs/log.jsonl` existed before any question was asked.
- `CHECK first-run-no-repeat-question pass|fail` — no question was asked whose answer was already in `setup/state.json` or `connections.json`.
- `CHECK first-run-state-written pass|fail` — `setup/state.json` exists with the launch, its dates, deciders, and systems, and `launches/<launch>/intake.md` exists.
