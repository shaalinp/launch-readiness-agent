# How this workflow feels (plain English)

You will not watch an agent work. You will be asked directly, the same way you already get "can you look at this."

1. A run starts (A person opens this folder in Claude Code and asks for this week's score. Nothing starts it by itself; a person may create a Monday 09:00 desktop task of their own (TRIGGERS.md). Setup, the gate, a date change, and the retro are separate requests: setup is once, a gate review or a date change is on demand, and the retro is after general availability).
2. Set up the launch plan, once
3. Approve the launch plan, once
4. Load the approved plan into the tracker, once
5. Read the tracker and score risk, each week
6. Launch team validates status, each week
7. Draft nudges, the escalation, and the weekly report
8. Launch lead approves what goes out, each week
9. Launch lead sends the nudges and the report, each week
10. Record the validated week
11. Draft the gate packet, before a readiness review
12. Decide go, go with conditions, or no-go
13. Record the gate decision
14. Recalculate dates when a date, scope, or no-go moves the launch
15. Approve the new plan before the tracker changes
16. Update the tracker with the approved dates
17. Compile the retro and draft playbook edits, after general availability
18. Launch team reviews the retro findings
19. Launch lead approves each playbook change
20. Update the playbook from the approved edits
21. The playbook template the next launch's setup will read.

If a person has to answer, the session stops. Claude does not continue on silence.

## Paste jobs on this map

None. Launch tracker and Playbook are files in this folder. Claude edits the playbook directly, and reads the tracker; on a live launch it changes the tracker only through a staged write (CLAUDE.md, "Live writes"). A practice launch's own tracker is edited directly.

## Extra pages not on the map yet

None.

## Words we use in the room

- Skill: a job description for one step. Markdown the hire edits.
- Gate: a person has to answer. Until they do, nothing downstream runs.
- Handoff point: a tool we cannot write to. Claude writes a checklist. A human pastes.
- Package: these generated files. Managed Agents and Agent SDK require separate runtime adapters and deployment configuration.
