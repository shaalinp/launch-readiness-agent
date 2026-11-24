# Security and data

This agent is a folder of instructions, small scripts and safety checks that Claude Code runs on your computer. This page covers where your data goes, what the folder's code can and can't do, how the safety checks work, what they don't cover, and how to check a release.

## Where your data goes

There are four separate parts to this, and the claims below don't stretch past their own part.

1. **To us, the publisher: nothing.** The folder has no telemetry, no analytics and no call home. The tests in `tests/supply-chain.test.mjs` check this on every change: no script uses `fetch`, `node:http`, `node:https`, `node:net`, `node:tls`, `node:dgram`, `node:dns` or WebSockets, apart from the one link check below.
2. **To Anthropic, to run the model: whatever the session reads.** Claude Code sends what you type, and the files the agent reads (your tracker, playbook and launch notes included), to Anthropic under your own account and its terms. This folder can't change that. Your account, plan and data settings decide how that data is handled.
3. **The folder's own scripts: one optional link check.** `node scripts/check-connections.mjs`, which you run yourself, sends one `HEAD` request (5-second timeout) to each URL you put in `connections.json`. No other script opens a connection.
4. **Optional connectors.** If you turn on Google Sheets or Google Drive during the first run, your tracker and launch folder data go to Google through Claude's connectors, under your Google account. The safety checks block connector tools that send, post, share or publish. They don't block reads and writes to the sheet or folder you bound.

## What the folder's code does

- **No packages to install.** You need only Node.js. There is no `package.json` and there are no npm packages. Every script imports only Node.js built-in modules and the folder's own files. A test checks this.
- **No other programs.** The scripts never run a shell command. Where one script runs another, it runs Node itself (`process.execPath`) on a script in this folder. A test checks this.
- **Your launch data stays out of git.** `.gitignore` keeps `launches/`, `practice/`, `history/`, `runs/`, `setup/state.json`, `setup/policy.json`, `setup/.env` and your deliverables in `launch-folder/` out of git.

  Three tracked files hold your launch data once you use the agent:
  - `tracker/launch-tracker.csv`
  - `playbook/playbook.md`
  - `connections.json`

  **Keep your copy of this repository private.**

## The safety checks

Claude Code runs these before each tool call when you open this folder directly. Each one is a short file in `.claude/hooks/` you can read. They need Node.js. Without it, the tools they guard are blocked.

| Check | What it stops |
|---|---|
| `guard-secrets.mjs` | Reading, searching or editing `setup/.env`, where your keys go |
| `guard-prompt-secrets.mjs` | A message that looks like it contains a key, before Claude sees it |
| `guard-append.mjs` | Changing or removing past entries in `history/*.jsonl`. Entries are only ever added, through `scripts/append-store.mjs` |
| `guard-tracker.mjs` | Any change to a live launch's tracker except the one staged and checked change, made through `scripts/stage-write.mjs`. Also stops edits to the scripts that do that checking |
| `no-publish.sh`, `no-undeclared-outbound.mjs` | Connector tools that publish, share, send, reply or forward, and write-like calls to connectors you didn't declare |
| `run-log*.mjs` | Nothing. They keep `runs/log.jsonl`, a local log of codes only. Nothing reads it but you, and nothing sends it |

On top of the checks, `.claude/settings.json` denies the agent's file tools on the history files, the run log, `setup/policy.json`, the write records and the scripts that check writes. On a live launch, `scripts/stage-write.mjs` refuses any answer marked made-up: a live launch records only what people actually said. `tests/hooks.test.mjs` and `tests/write-gate.test.mjs` run these checks the way Claude Code does.

## What they don't cover

- **A hostile agent.** The checks are written for a cooperative agent that follows its instructions, and they stop its mistakes. They aren't a sandbox against a model trying to get around them.
- **Some deletions.** Claude Code asks you before running any of these, unless you've turned on a mode that skips approvals. The safety checks themselves don't block them:
  - `unlink` on a history file
  - `rm -rf history` or `rm -rf setup`
  - `unlink`, `shred` or `find … -delete` on `setup/policy.json`
  - `git clean`

  The approval prompt is the only check on these, because none of them is pre-approved in `.claude/settings.json`. **A mode that skips approvals removes it.** Keep a backup or a private git remote of your copy.
- **A plugin install.** Claude Code's permission rules don't travel with a plugin. Open this folder directly, as the README says.
- **Two people editing at once.** If someone edits the same tracker row while the agent writes it, one edit can be lost. Neither a CSV nor the Sheets connector offers a conditional write. The agent reads every change back and reports a conflict, but it can't prevent one.

## Check a release

Each release has a zip, a `SHA256SUMS` file and a GitHub build-provenance attestation. The zip is built by GitHub Actions from the tagged commit.

```bash
shasum -a 256 -c SHA256SUMS
gh attestation verify launch-readiness-agent-vX.Y.Z.zip --repo shaalinp/launch-readiness-agent
```

To run the tests yourself, you need Node.js 20 or later:

```bash
node --test tests/*.test.mjs
```

## Report a problem

For a security problem, use **Report a vulnerability** on this repository's Security tab, so it stays private until it's fixed. For anything else, open an issue.
