#!/usr/bin/env bash
# Regenerate the .skill packages in dist/ from skills/.
# A .skill file is a zip containing the skill folder with SKILL.md inside.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$SCRIPT_DIR/dist"

cd "$SCRIPT_DIR/skills"

# Discovered from the directory rather than hardcoded, so adding a skill needs
# no edit here.
for dir in */; do
  skill="${dir%/}"
  [ -f "$skill/SKILL.md" ] || continue
  rm -f "$SCRIPT_DIR/dist/$skill.skill"
  zip -r -q "$SCRIPT_DIR/dist/$skill.skill" "$skill"
  echo "Packaged: dist/$skill.skill"
done
