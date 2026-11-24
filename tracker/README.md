# The launch tracker

`launch-tracker.csv` is the system of record for every launch run from this folder. The agent writes rows here only after the launch lead approves a plan or a re-plan (and the header row at setup, if the sheet is empty), and reads it every week to score risk. On a live launch the agent never edits it directly: it reads it, and changes it only through a staged write that a safety check verifies (CLAUDE.md, "Live writes"), with only what a person actually said. A practice launch's own copy is edited directly. With a Google Sheet, owners update Status, Forecast, Done date, Deliverable and Notes on their own rows; with this CSV they tell the launch lead (below). The agent never marks a task done.

The same columns, in the same order, are the `Tracker` tab of `templates/launch-tracker-template.xlsx`, a Google Sheets template whose Summary, Gate view and Slip log tabs are formulas over that tab. `Tracker` is a tab in the spreadsheet; the CSV has no tabs. The agent is told to write only the `Tracker` tab; nobody types in the other tabs except their blue input cells.

Columns, in order. Keep them as they are; the agent reads the header row as its schema. Dates are YYYY-MM-DD with no leading apostrophe, so the date math works.

| Column | Who writes it | Values |
|---|---|---|
| Launch | agent, at load | the launch short name; a task ID is unique within a launch; a practice launch has its own short name |
| Task ID | agent | T01, T02, ... from the plan; C01, C02, ... for gate conditions |
| Task | agent | the task name from the playbook |
| Seat | agent | the owning seat (PM, PMM, Legal, ...) |
| Owner | agent, from the intake | the named person, or "unowned" |
| Gate | agent | Beta or GA when the row is on that gate's checklist in the playbook, so a gate view lists exactly the checklist; a condition carries the gate that set it; empty otherwise, whatever the lead time counts from |
| Lead time | agent | the playbook lead time, as written there ("GA - 10d"); a launch date change moves every open task anchored to that date |
| Original due | agent, at load | the date from plan v1; it never changes, so slips a re-plan absorbed still show against it; a row added later (a task a re-plan adds, or a condition) takes the Due it had in the version or decision that added it |
| Due | agent, after approval | YYYY-MM-DD, the current approved date |
| Forecast | owner, or agent after validation | YYYY-MM-DD the owner now expects; empty when on plan; kept as it was when the task is done, so it shows the last date expected |
| Done date | owner, or agent after validation | YYYY-MM-DD the work finished; empty until then |
| Status | owner | Not started, In progress, Done, Waived |
| Risk | agent, after validation | Red, Amber, Green from the validated weekly score; empty on a Done or Waived row; while a condition and its parent are both open, the pair's score is on the parent and the condition's Risk is empty, so Summary counts the work once |
| Blocked by | agent | task IDs this one waits on |
| Blocks | agent | task IDs waiting on this one; on a condition, the gate task it holds |
| Deliverable | owner | link or file name in `launch-folder/`; separate two files with a semicolon |
| File check | agent, after validation | Found, Missing, Cannot verify, from the weekly score, for rows marked Done |
| Parent task | agent | on a condition, the task ID it adds to, so the same work is not counted twice; empty on a task. Slips and the Slip log count the parent, not the condition |
| Waiver | agent, after the decider grants it | what was waived, who decided, the date and the reason |
| Flag | agent | the plan's flag for the task: unowned, double-owned, default, or a few words ("baseline missing"); empty when none |
| Last update | agent, at load and when the week is recorded | YYYY-MM-DD of the load, then of the owner's last confirmation or correction; staleness counts from it |
| Notes | owner and agent | old dates after a re-plan, anything else |

Values with a comma, a quote or a line break are quoted as in RFC 4180 (the Waiver and Notes columns often need it). Task IDs in Blocked by and Blocks are separated by semicolons ("T03; T05"), never commas.

If the CSV is open in Excel, Excel locks it and the agent cannot write. Close it before a step that writes the tracker; the agent says so if a write fails.

In local-file mode the owners never open the CSV. Their answers reach the tracker through the launch lead, who relays them in chat; the agent then writes the owner's columns on that row, through a staged write on a live launch, and says so. With a shared Google Sheet the owners edit their own rows. Either way the agent never marks a task done on its own.

A tracker with fewer columns still works: the agent fills the columns the header has and skips the rest, and says so once at load. A column the header has that this table does not name stays empty.

Each practice launch uses its own copy, `practice/<launch>/launch-tracker.csv`, made by the first run; this file is never written for practice, and two practice launches never share a copy. With Google Sheets connected, a practice launch can use a sheet instead, so you can watch it change: make a copy of the tracker template with "practice" in its name and give the agent its link during the first run. It is never the live sheet.

To use Google Sheets instead, tell the agent during the first run. It records the sheet in `connections.json` and uses the same columns there, on the `Tracker` tab.
