#!/usr/bin/env bash
# install-hooks.sh — links the repository's git hooks into .git/hooks.
# Idempotent; run by init.sh on every bootstrap.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
hooks_dir="$(git rev-parse --git-path hooks)"
mkdir -p "$hooks_dir"
for hook in pre-commit commit-msg pre-push; do
  chmod +x "scripts/hooks/$hook"
  ln -sf "$(pwd)/scripts/hooks/$hook" "$hooks_dir/$hook"
done
chmod +x scripts/hooks/guard-destructive-commands.sh
echo "[hooks] installed pre-commit, commit-msg, pre-push → $hooks_dir"
