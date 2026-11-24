# Connections

No catalog-locked tool connections in this workflow.

## Systems on the board

Each system the workflow reads or writes, and the connector it is bound to, as of export. connections.json is the current state: `node scripts/bind-system.mjs` changes it at setup, and `node scripts/check-connections.mjs` reads it back. An unset system blocks the steps that write it until a person names the tool. A system can also be a file or folder in this bundle: `node scripts/bind-system.mjs <systemId> local-file <path>`.

| System | Connector | Status | Actions | Next step |
|---|---|---|---|---|
| Launch tracker | Files in this folder (`tracker/launch-tracker.csv`) | bound | read, write, append | Nothing |
| Shared launch folder | Files in this folder (`launch-folder/`) | bound | read | Nothing |
| Playbook | Files in this folder (`playbook/playbook.md`) | bound | read, write | Nothing |

Actions say what a connector may be used for, not when. On a live launch the tracker is written only through a staged write that a hook checks (CLAUDE.md, "Live writes"), whatever its actions list; a practice launch's own tracker is written directly.
