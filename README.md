# WebAula Gutenberg Skills

Two Claude skills for building WordPress sites with native Gutenberg blocks. They are designed to work as a pair:

| Skill | Job | Source |
|---|---|---|
| `gutenberg-native-blocks` | Project workflow: design briefs with the Gutenberg constraint, section-to-block mapping, theme.json design systems, patterns strategy, Claude Code build process, WebAula house rules | Internal (WebAula) |
| `gutenberg-block-authoring` | Generating valid serialized block markup that never triggers "Attempt Block Recovery". Per-block attribute schemas, class order, style property order, validated against WordPress 7.0 Gutenberg source | [ross-mulcahy/gutenberg-block-authoring-skill](https://github.com/ross-mulcahy/gutenberg-block-authoring-skill), MIT, vendored snapshot |

Short version: `native-blocks` decides what to build, `block-authoring` writes markup that actually validates.

## What each skill does

### gutenberg-native-blocks

Field-tested practices for building client websites with native Gutenberg blocks, extracted from real WebAula agency projects. The core lesson: decide at the design stage that the site is built in Gutenberg, and make every design decision map to a core block. Sites fail when the design is drawn first and blocks are forced onto it afterwards.

It covers:

- **Constraint-first design briefs.** Every brief and design prompt states up front that the site is native Gutenberg only, and names the core block each designed section maps to.
- **Section-to-block mapping vocabulary.** Full-width section = Cover/Group with `alignfull`, card grid = Columns, image beside text = Media & Text, FAQ = Details block, dynamic listings = Query Loop, repeated cards = registered Patterns, header/footer = Template Parts.
- **theme.json as single source of truth.** Semantic palette names, type scale, spacing presets on a fixed scale, button styles, radius. Content references preset slugs, never raw hex.
- **What consistently works:** accent color restraint, registering Patterns for anything repeated, the master template method for non-developer editors, global styles in the right layer, mastering the four workhorse blocks (Group, Columns, Cover, Query Loop) first.
- **What consistently fails:** absolute positioning and overlapping elements, heavy custom CSS layered over blocks, `:has()` selectors for state styling, automatic word-break on Finnish/Swedish compound words (use manual `&shy;` soft hyphens).
- **The Claude Code build process** for turning an approved design plus design system into theme.json, templates, and patterns.

The skill triggers whenever a conversation mentions Gutenberg, block themes, FSE, theme.json, patterns, converting a design to blocks, or checking a design for "buildability".

### gutenberg-block-authoring

Generates serialized Gutenberg block markup that pastes directly into the block editor without triggering "Attempt Block Recovery" or validation errors. Vendored from [ross-mulcahy/gutenberg-block-authoring-skill](https://github.com/ross-mulcahy/gutenberg-block-authoring-skill) (MIT) and pinned to WordPress 7.0 (Gutenberg `wp/7.0` branch). Every rule in it was tested in a real Gutenberg editor.

It covers:

- **The full serialization grammar:** block delimiters, JSON attribute formatting, HTML structure, and class naming conventions that the editor's validator actually checks.
- **50+ core blocks** with attribute schemas, defaults, and working examples: static blocks (paragraph, heading, image, gallery, columns, cover, buttons, quote, table...), template/theme blocks (query, post-template, navigation, site-title, search...), comment blocks, and widget blocks (latest-posts, categories, archives...).
- **Color, typography, and spacing patterns:** preset class order, style property order, font sizes, and alignment, matching what Gutenberg itself serializes.
- **Ready content patterns:** hero sections, CTAs, FAQs, pricing tables, and galleries.
- **Template patterns** for posts, archives, search results, headers, and footers, plus Query Loop configurations.
- **WordPress 7.0 features** like viewport visibility and block-level CSS, and WordPress VIP constraints.
- **`block-reference.json`:** machine-readable block schemas extracted from the Gutenberg `wp/7.0` source, which the skill consults for exact attribute names and defaults.

The upstream repo also ships validation tooling that is not vendored here (see "Upstream notes" below): `validate-blocks.js` checks generated markup for delimiter mismatches, invalid JSON, nonexistent style attributes, and missing required classes. Worth running before pasting generated markup into a client site.

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
