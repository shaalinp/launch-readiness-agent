# What starts a run

Skills do not contain the trigger. A skill is invoked by its description, or dispatched by name. The run itself is started by runtime:

- A person starts it: open this folder in Claude Code and ask for the run. Nothing in this folder schedules itself or listens for events. Say: "score this week" (or "set up a launch" the first time).
- A Monday run is optional, and yours to create. In the Claude desktop app's Code tab, open Routines in the sidebar, choose New routine, then Local, pick this folder, and set the schedule `0 9 * * 1` (Mondays 09:00, your time zone). In a Desktop session you can also ask Claude to create it. It fires only while the desktop app is open and the computer is awake, and a time it sleeps through is skipped; on wake it starts one catch-up run for the most recent missed time in the last seven days. A scheduled run still stops at every gate until you answer.
- Opening line for that session: A person opens this folder in Claude Code and asks for this week's score. Nothing starts it by itself; a person may create a Monday 09:00 desktop task of their own (TRIGGERS.md). Setup, the gate, a date change, and the retro are separate requests: setup is once, a gate review or a date change is on demand, and the retro is after general availability
- What the run is given at the start: The launch tracker, the playbook, and the shared launch folder

Human gates are the next user turn. `.claude/settings.json` can deny publishes and ask on writes. It cannot pause the session for Launch lead. Do not continue without their reply in the thread.
