#!/usr/bin/env bash
# PreToolUse guard for git commits made through Claude Code.
# Blocks (exit 2) when committing on main, or when src/packages changed and the build fails.

input=$(cat)
echo "$input" | grep -q 'git commit' || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if [ "$(git branch --show-current)" = "main" ]; then
  echo "Blocked: never commit directly to main. Create a feature branch first (git switch -c <issue>-<slug>), then commit in a separate command." >&2
  exit 2
fi

if git status --porcelain | grep -qE '^.. "?(src|packages)/'; then
  if ! out=$(npm run build 2>&1); then
    echo "Blocked: npm run build failed. Fix the errors before committing." >&2
    echo "$out" | tail -40 >&2
    exit 2
  fi
fi

exit 0
