#!/usr/bin/env bash
# Regenerate the .skill packages in dist/ from skills/.
# A .skill file is a zip containing the skill folder with SKILL.md inside.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$SCRIPT_DIR/dist"

cd "$SCRIPT_DIR/skills"
for skill in gutenberg-native-blocks gutenberg-block-authoring; do
  rm -f "$SCRIPT_DIR/dist/$skill.skill"
  zip -r -q "$SCRIPT_DIR/dist/$skill.skill" "$skill"
  echo "Packaged: dist/$skill.skill"
done
