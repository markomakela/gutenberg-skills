# WebAula Gutenberg Skills

Two Claude skills for building WordPress sites with native Gutenberg blocks. They are designed to work as a pair:

| Skill | Job | Source |
|---|---|---|
| `gutenberg-native-blocks` | Project workflow: design briefs with the Gutenberg constraint, section-to-block mapping, theme.json design systems, patterns strategy, Claude Code build process, WebAula house rules | Internal (WebAula) |
| `gutenberg-block-authoring` | Generating valid serialized block markup that never triggers "Attempt Block Recovery". Per-block attribute schemas, class order, style property order, validated against WordPress 7.0 Gutenberg source | [ross-mulcahy/gutenberg-block-authoring-skill](https://github.com/ross-mulcahy/gutenberg-block-authoring-skill), MIT, vendored snapshot |

Short version: `native-blocks` decides what to build, `block-authoring` writes markup that actually validates.

## Install for Claude Code

Global (all projects on your machine):

```sh
git clone https://github.com/rejver007/gutenberg-skills.git
cd gutenberg-skills
./install.sh
```

Project-scoped (commit skills into one client repo):

```sh
./install.sh --project
```

You can also skip this repo entirely for a client project and commit the `skills/` folders directly into that project's `.claude/skills/`. Everyone who clones the project gets them automatically.

## Install for claude.ai (chat)

Grab the packaged files from `dist/` and save them in Claude:

- `dist/gutenberg-native-blocks.skill`
- `dist/gutenberg-block-authoring.skill`

Open the file in a Claude chat and click Save skill, or upload it under Settings > Capabilities > Skills.

If WebAula is on a Team or Enterprise plan, the better path is org provisioning: an owner uploads these files once under Organization settings > Skills and everyone gets them automatically, including future updates.

## Updating the skills

1. Edit the SKILL.md under `skills/<name>/`.
2. Regenerate the dist packages: `./make-dist.sh`
3. Commit and push. Claude Code users get updates on `git pull` (global installs: re-run `./install.sh`). claude.ai users re-save the new `.skill` file, or the org admin re-uploads it.

## Upstream notes for gutenberg-block-authoring

- Vendored from the upstream repo and pinned to WordPress 7.0 (Gutenberg `wp/7.0` branch). It ships with `block-reference.json`, the block schemas extracted from Gutenberg source.
- The upstream repo also contains a markup validator worth using before pasting generated markup into a client site: `node validate-blocks.js --file page.html`. Clone the upstream repo for that tooling.
- If a future WordPress version starts triggering block recovery, check upstream for an updated release before debugging by hand.
- License: MIT, Copyright (c) 2026 Ross Mulcahy. The license text is included at `skills/gutenberg-block-authoring/LICENSE`. Keep it there when copying the skill anywhere else.

## House rules baked into gutenberg-native-blocks

- Design for blocks: every section in a brief names the core block it maps to.
- theme.json is the single source of truth. Content references preset slugs, not raw hex.
- Repeated sections become registered Patterns. Custom blocks are a last resort.
- No em dashes or en dashes in copy. 24-hour time format.
- Finnish and Swedish compound words get manual `&shy;` soft hyphens, never automatic word-break.
