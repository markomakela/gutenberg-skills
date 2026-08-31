#!/usr/bin/env bash
# Regenerate the .skill packages in dist/ from skills/.
# A .skill file is a zip containing the skill folder with SKILL.md inside.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$SCRIPT_DIR/dist"

# Clear everything first so a renamed or deleted skill does not leave a stale
# package behind. dist/ always mirrors skills/.
rm -f "$SCRIPT_DIR/dist"/*.skill

cd "$SCRIPT_DIR/skills"

# Discovered from the directory rather than hardcoded, so adding a skill needs
# no edit here.
count=0
for dir in */; do
  skill="${dir%/}"
  [ -f "$skill/SKILL.md" ] || continue
  zip -r -q "$SCRIPT_DIR/dist/$skill.skill" "$skill"
  echo "Packaged: dist/$skill.skill"
  count=$((count + 1))
done

if [ "$count" -eq 0 ]; then
  echo "no skills found under skills/" >&2
  exit 1
fi
