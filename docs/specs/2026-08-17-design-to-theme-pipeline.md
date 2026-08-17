# Spec: design-to-theme migration pipeline

Date: 2026-08-17
Status: accepted. Slice 1 (section 8.1) is in scope, the rest waits.

## 1. Current state

The repo ships two knowledge skills and nothing else:

| Path | What it is |
|---|---|
| `skills/gutenberg-native-blocks/SKILL.md` | 10 KB of WebAula practice: constraint-first briefs, section-to-block vocabulary, theme.json as source of truth, what works, what fails, a prose description of a Claude Code build workflow |
| `skills/gutenberg-block-authoring/SKILL.md` + `block-reference.json` | 116 KB + 133 KB vendored MIT snapshot: serialization grammar and per-block attribute schemas pinned to Gutenberg `wp/7.0` |
| `install.sh`, `make-dist.sh`, `dist/*.skill` | Copy skills to `~/.claude/skills` or `.claude/skills`, and zip them for claude.ai |

Both skills are reference material. A model reads them and is better informed, but nothing in the repo turns an approved design into files on disk.

## 2. The gap

The intended workflow is "Claude Design produces a design plus a design system, Claude Code produces a WordPress block theme". Today every step between those two points is improvised per project:

1. **The design system has no defined shape.** `gutenberg-native-blocks` says to request "a design system summary structured to drop straight into theme.json: named colors, type scale, spacing scale, button styles including hover, card style, and section spacing rules". That sentence is the entire contract. Each project invents its own field names, so nothing downstream can be automated and each theme.json is hand-transcribed. Transcription is where palette slugs drift and content ends up carrying raw hex.
2. **No buildability gate.** The skill lists anti-patterns (absolute positioning, overlaps, diagonal masks, `:has()`) but nothing checks a design against them. The failure is discovered halfway through the build, which is exactly the stall the skill was written to prevent.
3. **No scaffold.** The "standard theme structure that has worked" is a code fence in a markdown file. Every project retypes it, and `style.css` headers, `functions.php` pattern registration, and template part wiring are re-derived each time, which is where boilerplate bugs live.
4. **No validation.** The README states plainly that the upstream validator is *not* vendored: "The upstream repo also contains a markup validator worth using before pasting generated markup into a client site". So the one check that catches "Attempt Block Recovery" before the client sees it requires cloning a second repo, and in practice is skipped.
5. **No worked example.** Nothing in the repo demonstrates the whole path end to end, so there is no regression surface. A change to either skill can silently break the workflow and no one finds out until the next client build.
6. **No migration path for non-conforming designs.** Real inputs include designs made before the Gutenberg constraint was stated. There is no defined way to take one of those and produce a flattened, buildable version.

## 3. Goal

A person clones this repo, points the tooling at a Claude Design output plus its design system, and gets a WordPress block theme directory that activates in WordPress and whose every page renders without a block validation error. The interpretive steps stay with the model, guided by a skill. The mechanical steps become scripts, so they are repeatable and testable.

Success is measured by the worked example: `npm test` regenerates the example theme from its inputs and asserts the result byte for byte, and the validator exits 0 on every page of it.

## 4. Non-goals

- Parsing arbitrary design HTML into blocks automatically. Claude Design output is not structurally stable, so a parser would be a permanent maintenance tax for a job the model does better. The model reads the design, the scripts handle only what has a fixed input shape.
- Custom block scaffolding (`@wordpress/scripts`, edit.js/save.js). The native-blocks skill already rules custom blocks a last resort. Out of scope.
- A WordPress plugin, an installer, or any runtime component. The output of this repo is files, not software running on a client site.
- Updating the vendored `gutenberg-block-authoring` snapshot past `wp/7.0`. Separate concern, separate task.

## 5. Chosen approach

**Staged pipeline with a typed artifact between every stage.** Each stage has one defined input and one defined output, so a stage can be rerun, diffed, and reviewed on its own.

```
Claude Design output + design system
  |
  v  stage 1  audit          (model, guided by skill)      -> buildability-report.md
  v  stage 2  extract        (model, guided by schema)     -> design-system.json
  v  stage 3  scaffold       (script, deterministic)       -> theme/ skeleton + theme.json
  v  stage 4  map sections   (model, guided by skill)      -> section-map.md
  v  stage 5  author markup  (model, block-authoring)      -> templates/, parts/, patterns/
  v  stage 6  validate       (script, deterministic)       -> pass or a list of failures
```

Stages 3 and 6 are scripts because their inputs have a fixed shape. Stages 1, 2, 4 and 5 are model work, but each one lands in a named file, which is what makes the pipeline reviewable instead of a single opaque prompt.

Alternatives considered and rejected:

- **One large prompt, no artifacts.** This is today's behaviour, described in the native-blocks skill as "give one large structured prompt up front". It works for an experienced operator and produces nothing anyone can check. Rejected because the failures in section 2 all happen inside that single step.
- **Deterministic HTML-to-blocks converter.** Highest ceiling, wrong bet. It would need to track Claude Design's markup conventions forever, and the interesting decisions (is this a Cover or a Group, is this repeated enough to be a Pattern) are judgement calls, not parsing.

## 6. Deliverables

### 6.1 `schemas/design-system.schema.json`

JSON Schema (draft 2020-12) defining the contract between a design and a theme. This is the keystone deliverable: everything downstream reads it, and it makes "request the design system alongside the design" a checkable instruction instead of a suggestion.

Required top-level keys:

| Key | Shape | Notes |
|---|---|---|
| `meta` | `{ name, textDomain, wpVersion }` | drives `style.css` headers and `theme.json` `$schema` |
| `palette` | array of `{ slug, name, color }` | slugs restricted to the semantic set the skill already names: `primary`, `dark`, `surface`, `neutral`, `text`, `muted`. Additional slugs allowed but flagged by the validator as design-system drift |
| `typography.fontFamilies` | array of `{ slug, name, fontFamily, fontFace? }` | `fontFace` present means self-hosted, absent means system stack |
| `typography.fontSizes` | array of `{ slug, size, fluid? }` | slugs restricted to `display`, `h1`, `h2`, `h3`, `body`, `small` |
| `spacing.spacingSizes` | array of `{ slug, size }` | fixed scale, default `8 / 16 / 24 / 40 / 64 / 96` as the skill specifies |
| `elements.button` | `{ background, text, radius, padding, hover: { background, text } }` | color fields are palette slugs, never hex |
| `styles.card` | `{ radius, shadow, padding, background }` | |
| `styles.sectionRhythm` | `{ default, tight, loose }` | spacing slugs, drives vertical rhythm between sections |
| `layout` | `{ contentSize, wideSize }` | |

Rule enforced by the schema itself: every colour reference outside `palette` must match `^[a-z][a-z0-9-]*$`, that is a slug, not `#rrggbb`. This is where "no raw hex in content" stops being a house rule people remember and becomes a thing that fails.

### 6.2 `skills/gutenberg-design-migration/SKILL.md`

The third skill, the one that drives the pipeline. It does not repeat the other two, it sequences them.

Frontmatter description must trigger on: converting a design to a theme, migrating a Claude design, "build this design in WordPress", scaffolding a block theme, design system to theme.json.

Sections:

1. **When to use this skill** and the explicit handoff to the other two: `native-blocks` for judgement about what maps to what, `block-authoring` for anything containing `<!-- wp:`.
2. **Stage 1, buildability audit.** Walk the design against the anti-pattern list already in `native-blocks` (absolute positioning, overlaps, diagonal masks, `:has()` state styling, automatic word-break). Output `buildability-report.md` with one row per finding: section, anti-pattern, recommended flattening, cost if kept. **Hard gate: no markup is authored until every blocker is either flattened in the design or explicitly accepted with a written cost.** This gate is the single highest-value item in the whole task, because it moves the discovery of an unbuildable design from mid-build to minute one.
3. **Stage 2, design system extraction.** Fill `design-system.json` against the schema. Rules: semantic slugs only, snap measured values to the nearest spacing preset rather than adding presets, if a value cannot be expressed as a preset raise it as a design question instead of inventing one. Carries the accent-restraint rule from `native-blocks`: brand colour is button and accent and at most one CTA band, never a section surface.
4. **Stage 3, scaffold.** Run the script. Review the generated `theme.json` against the design system, do not hand-edit it, fix `design-system.json` and regenerate.
5. **Stage 4, section mapping.** Produce `section-map.md`: one row per design section giving the source section, the target core block, the target file (`templates/front-page.html`, `parts/header.html`, `patterns/hero.php`), and whether it repeats. Anything appearing more than once becomes a registered Pattern, per house rules. This table is the build plan and the review surface.
6. **Stage 5, markup authoring.** Delegate serialization to `gutenberg-block-authoring`. House rules restated as a short checklist: preset slugs not hex, only WordPress-generated classes plus registered `is-style-*`, minimal attributes, paste into the Code editor view.
7. **Stage 6, validation and delivery.** Run the validator, fix, rerun. Then the delivery checklist already at the end of `native-blocks`, extended with the two new lines: `design-system.json` validates against the schema, and the validator exits 0.
8. **Migration mode for existing designs.** For a design produced without the Gutenberg constraint: run stage 1 in flattening mode, which outputs a rewritten section list with each unbuildable construct replaced by its nearest buildable equivalent, plus a short note to send back to the designer. Explicitly names the common cases: overlapping hero card becomes Cover with an inner Group, diagonal mask becomes a flat colour band, absolutely positioned badge becomes an inline element in the heading.

Keep it under roughly 400 lines. The value is in the sequence and the gate, not in restating the other two skills.

### 6.3 `tools/`

Node, ESM, zero runtime dependencies beyond a JSON Schema validator (`ajv`). Node 20 or newer.

**`tools/build-theme-json.mjs`**

```
node tools/build-theme-json.mjs --input design-system.json --out theme/theme.json [--check]
```

Deterministic transform from `design-system.json` to a WordPress `theme.json` version 3 file: `settings.color.palette`, `settings.typography.fontSizes` and `fontFamilies`, `settings.spacing.spacingSizes`, `settings.layout`, `styles.elements.button` including `:hover`, `styles.blocks` defaults for the card style. Emits stable key order so diffs are readable. `--check` exits 1 if the file on disk differs from what would be generated, which is what CI runs to prove nobody hand-edited `theme.json`.

**`tools/scaffold-theme.mjs`**

```
node tools/scaffold-theme.mjs --input design-system.json --out theme/ [--force]
```

Creates exactly the structure the `native-blocks` skill already prescribes:

```
theme/
  theme.json          (delegated to build-theme-json.mjs)
  style.css           (headers from meta, no styles)
  functions.php       (enqueue, pattern registration, theme supports)
  templates/          (index.html, front-page.html, page.html, single.html)
  parts/              (header.html, footer.html)
  patterns/           (empty, .gitkeep, plus a commented example header)
  inc/                (cpt.php, menus.php, enqueue.php, each with a working stub)
  assets/
  CLAUDE.md           (preset slugs, registered patterns, naming conventions, seeded from design-system.json)
```

The generated `CLAUDE.md` matters: the native-blocks skill already tells people to keep one per theme repo and append every lesson to it. Generating it seeded with the actual preset slugs means the next session starts knowing the design system without rereading `theme.json`. Refuses to overwrite a non-empty target without `--force`.

**`tools/validate-blocks.mjs`**

Vendor the upstream validator from `ross-mulcahy/gutenberg-block-authoring-skill` (MIT). Keep the licence header, record the upstream commit in `tools/UPSTREAM.md` next to the existing vendoring note in the README. Closes the README's own admission that the validator is missing.

```
node tools/validate-blocks.mjs --file page.html
node tools/validate-blocks.mjs --theme theme/          # every .html under templates/, parts/, patterns/
```

Upstream checks retained: delimiter mismatch, invalid attribute JSON, nonexistent style attributes, missing required classes.

WebAula checks added on top, each with its own rule id so a project can disable one:

| Rule | Fails on |
|---|---|
| `no-raw-hex` | `#rrggbb` anywhere in block attributes or inline styles |
| `preset-slugs-exist` | a `var:preset\|...` or `backgroundColor` slug not present in `theme.json` |
| `no-absolute-position` | `position:absolute` or `position:fixed` in inline styles |
| `soft-hyphen-hint` | a Finnish or Swedish word over 14 characters in a heading or button with no `&shy;`, warning not error |
| `no-dashes` | an em dash or en dash in copy, per house rules |

Exit 0 clean, 1 on any error, 0 with output on warnings only. Both human and `--json` output, because the `--json` form is what a model reads to fix its own markup without a human relaying the errors.

### 6.4 `examples/agency-site/`

One complete worked example, the proof and the regression surface.

```
examples/agency-site/
  input/design.html            (a Claude Design output, constraint-respecting)
  input/design-system.json     (validates against the schema)
  input/buildability-report.md (stage 1 output, includes at least one real finding)
  input/section-map.md         (stage 4 output)
  expected/theme/              (the full generated theme, committed)
  README.md                    (the six commands, in order, that reproduce expected/ from input/)
```

Content in Finnish, including at least one long compound word carrying `&shy;`, so the example exercises the house rules rather than describing them. Sections: hero Cover, three-card services Columns, Media and Text, CTA band, FAQ Details, Query Loop blog listing, header and footer template parts. That set covers the four workhorse blocks plus the pattern registration path.

A second, smaller example under `examples/legacy-redesign/` carries a deliberately non-conforming design (an overlapping hero, an absolutely positioned badge) with the stage 1 flattening report as its output. Nothing else. It exists to demonstrate migration mode without doubling the maintenance surface.

### 6.5 `tests/` and CI

`npm test` runs, with no WordPress installation required:

1. `design-system.json` in every example validates against `schemas/design-system.schema.json`.
2. `build-theme-json.mjs --check` passes for every example, that is `expected/theme/theme.json` is exactly what the generator produces.
3. `scaffold-theme.mjs` into a temp directory reproduces `expected/theme/` file for file.
4. `validate-blocks.mjs --theme` exits 0 on `examples/agency-site/expected/theme/`.
5. Fixture tests for each WebAula validator rule: one input that must fail, one that must pass.
6. `make-dist.sh` produces a `.skill` for all three skills and each one unzips to a directory with a `SKILL.md` carrying valid frontmatter.

GitHub Actions on push and pull request, Node 20 and 22. This is the first CI in the repo.

One check stays manual and must be stated as such in the README: activating the generated theme in a real WordPress 7.0 install and opening each page in the editor. The validator catches serialization errors, it does not prove a theme activates.

### 6.6 Repo plumbing

- `install.sh`: iterate over `skills/*/` instead of the hardcoded two-name loop, so a fourth skill needs no edit. Keep `--project`. Add `--list`.
- `make-dist.sh`: same, iterate the directory.
- `README.md`: restructure around the pipeline. Lead with the six-stage diagram and a quickstart that runs the example end to end, then the per-skill reference. Keep the upstream notes and MIT attribution verbatim, add the `tools/` vendoring note.
- `package.json`: new, name, `type: module`, `ajv` dev dependency, `test` and `lint` scripts.
- `CONTRIBUTING.md`: short. How to add a validator rule, how to regenerate dist, the no-dashes and 24-hour-time house rules that apply to everything in the repo.

## 7. Acceptance criteria

- [ ] `schemas/design-system.schema.json` exists and rejects raw hex in any colour reference outside `palette`
- [ ] `node tools/scaffold-theme.mjs --input examples/agency-site/input/design-system.json --out /tmp/t` produces a directory identical to `examples/agency-site/expected/theme/`
- [ ] `node tools/validate-blocks.mjs --theme examples/agency-site/expected/theme/` exits 0
- [ ] Each of the five WebAula validator rules has a failing fixture and a passing fixture, and both assert
- [ ] `skills/gutenberg-design-migration/SKILL.md` exists, documents all six stages, and states the stage 1 hard gate in those words
- [ ] `examples/legacy-redesign/` shows a non-conforming design and its flattening report
- [ ] `./install.sh --project` installs all three skills into `.claude/skills/`, discovered by directory listing
- [ ] `./make-dist.sh` emits three `.skill` files and CI unzips and frontmatter-checks each
- [ ] CI green on Node 20 and 22
- [ ] README quickstart reproduces the example from a clean clone with no steps missing
- [ ] Manual, recorded in the pull request: `expected/theme/` activates in WordPress 7.0 and every page opens in the editor with no block recovery prompt

## 8. Work breakdown

Ordered. Each item is a reviewable pull request. Items 1 to 3 unblock everything else.

1. **Schema.** `schemas/design-system.schema.json` plus a hand-written `examples/agency-site/input/design-system.json` that validates. Nothing else. Settling the contract first prevents rework in every later step.
2. **`build-theme-json.mjs`** plus `--check`, plus the generated `theme.json` in the example.
3. **`scaffold-theme.mjs`** plus the full `expected/theme/` skeleton, minus block markup.
4. **Vendor the validator**, `tools/UPSTREAM.md`, licence header, `--theme` mode.
5. **The five WebAula rules** plus their fixtures.
6. **`skills/gutenberg-design-migration/SKILL.md`**, written after the tooling exists so it documents real commands rather than intended ones.
7. **Author the example markup**, templates, parts, patterns, then validate. This is the step that proves the pipeline.
8. **`examples/legacy-redesign/`.**
9. **CI, `package.json`, tests.**
10. **Plumbing and README rewrite** last, once the shape is settled.

### 8.1 Phasing

Do not commit to all ten items at once. The schema will change after the first real client project, and anything built on top of it before then gets touched twice.

**Slice 1, in scope now.** A narrow vertical cut that goes end to end on a single example: items 1, 2, 3, 4 and 7. That is the schema, `build-theme-json.mjs`, `scaffold-theme.mjs`, the vendored validator with upstream checks only, and the `examples/agency-site/` markup authored and validated. One worked example exposes the schema's mistakes more cheaply than five validator rules do.

**Deferred until slice 1 has run against a real client project.** Items 5, 6, 8, 9 and 10. The skill (item 6) is deliberately late so it documents commands that exist.

**If only one evening is available, do item 4 first.** Vendoring the validator is the only item that removes a live client risk rather than saving time. Today the sole defence against "Attempt Block Recovery" reaching a client page is cloning a second repo by hand, which in practice does not happen.

**Cut from the first pass, not merely deferred.** The `soft-hyphen-hint` rule in section 6.3 guesses (14 characters is arbitrary) and will produce false positives. Build it only after the other four rules are running and the noise level is known.

## 9. Risks

- **The schema calcifies too early.** Mitigation: version it (`meta.schemaVersion`), and treat the first three client projects after this lands as the real review. Expect one breaking revision.
- **`expected/theme/` committed in full makes noisy diffs.** Accepted. Byte-exact expectations are what make the scaffold testable without a WordPress install, and the noise is confined to the examples directory.
- **The vendored validator drifts from upstream, twice over.** The repo now vendors from the same upstream in two places, `skills/gutenberg-block-authoring/` and `tools/`. Record both commits in `tools/UPSTREAM.md` and check them together when Gutenberg moves past `wp/7.0`.
- **Stage 1 gets skipped under deadline pressure.** It is the stage that saves the most time and the easiest to skip. Mitigation: `validate-blocks.mjs --theme` warns when no `buildability-report.md` exists next to the theme, and the delivery checklist names it.

## 10. Open questions

1. Does `design-system.json` live in the theme repo or in the client project root? Recommendation: theme repo, next to `theme.json`, so the input that generated the theme travels with it.
2. Should the scaffold emit a `parts/sidebar.html`? The skill's structure lists it under template parts but no worked example needs one. Recommendation: leave it out, add when a project needs it.
3. Is `wp-env` worth adding for a scripted activation smoke test, or does that pull Docker into a repo that is otherwise plain Node? Recommendation: not in this task. Revisit if the manual activation check is ever missed.
