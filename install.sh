#!/usr/bin/env bash
# Install WebAula Gutenberg skills for Claude Code.
# Default: global install (~/.claude/skills). Use --project for repo-local install.
set -e

TARGET="$HOME/.claude/skills"
if [ "${1:-}" = "--project" ]; then
  TARGET=".claude/skills"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TARGET"

for skill in gutenberg-native-blocks gutenberg-block-authoring; do
  rm -rf "$TARGET/$skill"
  cp -r "$SCRIPT_DIR/skills/$skill" "$TARGET/$skill"
  echo "Installed: $TARGET/$skill"
done

echo "Done. Claude Code will pick these up automatically."
