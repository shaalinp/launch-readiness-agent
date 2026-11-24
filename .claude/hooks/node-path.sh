#!/bin/sh
# Sourced by every hook command before it looks for Node. The desktop app
# takes its PATH when it launches, so Node installed after that, or by a
# version manager that only edits a shell profile, is not on it. Probe the
# usual places before giving up. NODE_PROBE_DIRS replaces the list (tests).
if ! command -v node >/dev/null 2>&1; then
  for d in ${NODE_PROBE_DIRS:-/usr/local/bin /opt/homebrew/bin "$HOME/.volta/bin" "${NVM_DIR:-$HOME/.nvm}"/versions/node/*/bin}; do
    if [ -x "$d/node" ]; then PATH="$d:$PATH"; export PATH; break; fi
  done
fi
