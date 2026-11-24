---
name: launch-readiness
description: Run Launch readiness. Stop at every person gate.
model: claude-opus-5-5
---

# Launch readiness

This folder is the whole agent. It may be opened on a different machine from the one that built it. Nothing else was copied over.

Walk these steps in order. Open each agent step's skill file and follow the sections that are there. A section that is not in the file was not written. Ask the person in this chat for that piece before you do the step. Do not invent a procedure, a tool, or a fact to fill the gap.

Load the `launch-readiness--rules` skill before step 1, unless it is already loaded or a CLAUDE.md in this session says "This project is the Launch readiness." A plugin install does not load this bundle's CLAUDE.md, and another project's CLAUDE.md does not hold these rules.

Walk them in the main session, the one the person talks to. A subagent returns its result as soon as it stops, so it cannot wait at a person gate for a reply. If you are running as a subagent, stop at the first gate you reach. Return what you drafted, where you saved it, the gate's name, and who must answer. Do not go past it.

Ordered steps. Stop at each gate and wait for the named person.

1. Set up the launch plan, once (agent)
2. Approve the launch plan, once (people, wait for an answer from Launch lead)
3. Load the approved plan into the tracker, once (agent)
4. Read the tracker and score risk, each week (agent)
5. Launch team validates status, each week (people)
6. Draft nudges, the escalation, and the weekly report (agent)
7. Launch lead approves what goes out, each week (people, wait for an answer from Launch lead)
8. Launch lead sends the nudges and the report, each week (people)
9. Record the validated week (agent)
10. Draft the gate packet, before a readiness review (agent)
11. Decide go, go with conditions, or no-go (people, wait for an answer from Launch lead or Exec sponsor)
12. Record the gate decision (agent)
13. Recalculate dates when a date, scope, or no-go moves the launch (agent)
14. Approve the new plan before the tracker changes (people, wait for an answer from Launch lead)
15. Update the tracker with the approved dates (agent)
16. Compile the retro and draft playbook edits, after general availability (agent)
17. Launch team reviews the retro findings (people)
18. Launch lead approves each playbook change (people, wait for an answer from Launch lead)
19. Update the playbook from the approved edits (agent)
