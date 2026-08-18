#!/usr/bin/env bash
# Install WebAula Gutenberg skills for Claude Code.
# Default: global install (~/.claude/skills). Use --project for repo-local install.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

skills() {
  for dir in "$SCRIPT_DIR"/skills/*/; do
    [ -f "$dir/SKILL.md" ] || continue
    basename "$dir"
  done
}

if [ "${1:-}" = "--list" ]; then
  skills
  exit 0
fi

TARGET="$HOME/.claude/skills"
if [ "${1:-}" = "--project" ]; then
  TARGET=".claude/skills"
fi

mkdir -p "$TARGET"

# Discovered from the directory rather than hardcoded, so adding a skill needs
# no edit here.
for skill in $(skills); do
  rm -rf "$TARGET/$skill"
  cp -r "$SCRIPT_DIR/skills/$skill" "$TARGET/$skill"
  echo "Installed: $TARGET/$skill"
done

echo "Done. Claude Code will pick these up automatically."
