#!/usr/bin/env bash
# Install WebAula Gutenberg skills for Claude Code.
# Default: global install (~/.claude/skills). Use --list to see what would be
# installed, --project for a repo-local install. Anything else is an error.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

skills() {
  for dir in "$SCRIPT_DIR"/skills/*/; do
    [ -f "$dir/SKILL.md" ] || continue
    basename "$dir"
  done
}

TARGET="$HOME/.claude/skills"
case "${1:-}" in
  --list)
    skills
    exit 0
    ;;
  --project)
    TARGET=".claude/skills"
    ;;
  "")
    ;;
  *)
    echo "Usage: $0 [--list | --project]" >&2
    exit 1
    ;;
esac

mkdir -p "$TARGET"

# Discovered from the directory rather than hardcoded, so adding a skill needs
# no edit here. A glob loop rather than a pipeline, so names never word-split
# and the counter is not lost to a subshell.
count=0
for dir in "$SCRIPT_DIR"/skills/*/; do
  [ -f "$dir/SKILL.md" ] || continue
  skill="$(basename "$dir")"
  rm -rf "$TARGET/$skill"
  cp -r "$SCRIPT_DIR/skills/$skill" "$TARGET/$skill"
  echo "Installed: $TARGET/$skill"
  count=$((count + 1))
done

if [ "$count" -eq 0 ]; then
  echo "no skills found under skills/" >&2
  exit 1
fi

echo "Done. Claude Code will pick these up automatically."
