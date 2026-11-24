# Launch intake: <product name>

The agent fills this in with you during the first run, one question at a time, and saves it as `launches/<launch>/intake.md`. You never fill in a blank form. To change an answer later, ask the agent: it runs `node scripts/intake.mjs set <launch> <field> <value>`, which changes the row here and the same answer in `setup/state.json` together. Each row shows the default the agent will use when you say "use the default".

If you would rather fill it in first, `launch-intake-template.xlsx` in this folder is the same intake as a Google Sheets template: tabs for tiers 1 and 2 (tier 3 is taken in chat), each with a Check column, and a Guide tab. Give the agent the sheet's link at the first run and it copies your answers into the file below, then asks only for the blanks. Later changes go to that file or to the agent, not to the sheet.

| Field | Your answer | Default or example |
|---|---|---|
| Product name | | e.g. Harborline Insights |
| Launch short name | | derived from the product name, e.g. `insights`; the agent proposes it. It names every file for this launch. |
| Live launch or practice | | live. A practice launch gets its own short name and its own copies, so its records never mix with a real launch. |
| Who it is for, and the problem it solves | | one or two sentences |
| Tier (1, 2, or 3) | | the agent recommends one from the description and goals; see Scope in playbook/playbook.md |
| Early access or beta date | | YYYY-MM-DD, in the future |
| General availability date | | YYYY-MM-DD, after the early access date |
| Launch goals | | e.g. 20 early-access accounts by EA; sales enabled before EA |
| Success metric, baseline, target | | e.g. pipeline from the launch: baseline $0, target $500,000. If the baseline or target is unknown, task T01 carries it. |
| Measured by | | GA + 60 days. The retro reports the result at this date. |
| Launch lead | | you, unless you say otherwise |
| Exec sponsor | | required for tier 1; optional on tier 2 |
| Decides the gates | | from the playbook's Scope: the exec sponsor on tier 1, the launch lead otherwise |
| Decides a slip | | from the playbook's Scope: the exec sponsor on tier 1, on the launch lead's recommendation; the launch lead otherwise |
| PM | | a name, or "unowned" |
| PMM | | a name, or "unowned" |
| Enablement | | a name, or "unowned" |
| Sales engineering | | a name, or "unowned" |
| Customer success | | a name, or "unowned" |
| Pricing and packaging | | a name, or "unowned" |
| Legal | | a name, or "unowned" |
| Pricing and packaging status | | decided, in progress, or unchanged |
| Holiday rule | | US federal holidays plus weekends, move earlier (add other countries by name) |
| Known constraints | | compliance, regulated segment, partner dependency, or none |
| Analyst firms and press to brief | | tier 1 only: firms or outlets by name, or none named yet; their calendars set the booking date for the briefing task |
| Weekly meeting day | | the day after the Monday score |
| Steering committee | | tier 1 only: the exec sponsor and the launch lead, plus anyone you name |
| Where the report goes | | default: the launch team's usual channel, pasted by the launch lead; the agent drafts it ready to paste into email or Slack |
| Escalation beyond the launch team | | default: whoever decides slips on this tier (the exec sponsor on tier 1) |
| Launch tracker | | `tracker/launch-tracker.csv`, or a Google Sheet link |
| Shared launch folder | | `launch-folder/`, or a Google Drive folder link |
| Playbook | | `playbook/playbook.md`, or your own |

