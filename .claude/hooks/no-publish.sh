#!/bin/sh
# Same rule as permissions.deny for publish. Exit 2 blocks the tool.
echo "Publish is off. A person pastes. See .claude/settings.json." >&2
exit 2
