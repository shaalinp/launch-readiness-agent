#!/bin/sh
# SessionStart. Shell only, so it runs where Node does not.
. "$(dirname "$0")/node-path.sh"
command -v node >/dev/null 2>&1 && exit 0
echo 'Node.js was not found on this computer, so the safeguards in this folder cannot run and every tool they guard is blocked, including the task list in the desktop app. Tell the person: install Node.js LTS (https://nodejs.org/), check with node --version in a terminal, then fully quit and reopen the Claude desktop app. README.md, the Node.js step.'
