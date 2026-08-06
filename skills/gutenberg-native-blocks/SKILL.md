---
name: gutenberg-native-blocks
description: Build and design WordPress websites using native Gutenberg blocks only, no page builder plugins. Use this skill whenever the user mentions Gutenberg, native blocks, block themes, Full Site Editing (FSE), theme.json, block patterns, converting a design into WordPress blocks, writing a design brief for a site that will be built in Gutenberg, or building a WordPress site with Claude Code. Also use it when reviewing or generating raw block markup (wp:group, wp:cover, wp:columns) or when a design needs to be checked for "buildability" in core blocks.
---

# Gutenberg Native Blocks

Field-tested practices for building client websites with native Gutenberg blocks, extracted from real agency projects (WebAula, Finland). The core lesson from every project: **decide at the design stage that the site is built in Gutenberg, and make every design decision map to a core block.** Sites fail when the design is drawn first and blocks are forced onto it afterwards.

## The core principle

Design for blocks, not against them. Before any visual work, state the constraint explicitly (in the design brief, in the Claude Design prompt, in the Claude Code prompt):

> The final site is WordPress using native Gutenberg blocks only, no page builder. Every section must map cleanly to core blocks.

This one sentence, placed early, changes the entire output. Without it, designs come back with overlapping elements and absolute positioning that cannot be reproduced in blocks and the build stalls.

## Section-to-block mapping

Use this vocabulary consistently in briefs, prompts, and builds:

| Design element | Core block |
|---|---|
| Full-width section with background image or color | Cover or Group with `alignfull` |
| Grid of cards or features | Columns (stacks on mobile) |
| Image next to text, 50/50 or 60/40 | Media & Text |
| Call-to-action buttons | Buttons block |
| Bullet or checklist content | List block |
| Repeatable card (service, testimonial, logo) | Block Pattern made of core blocks |
| Dynamic post or CPT listings | Query Loop |
| FAQ accordion | Details block |
| Site header, footer, sidebar | Template Parts |

## What consistently works

1. **The constraint-first design brief.** When writing a Claude Design prompt for a site that will be built in Gutenberg, include a dedicated section titled "Critical constraint: this gets built in Gutenberg (native blocks)" listing the block mapping above and the anti-pattern list below. Name the core block each designed section maps to. This keeps the output buildable instead of producing a pretty mockup that cannot be reproduced.

2. **theme.json as the single source of truth.** Palette (with semantic names: primary, dark, surface, neutral, text, muted), type scale (display, h1, h2, h3, body, small), spacing presets on a fixed scale (for example 8 / 16 / 24 / 40 / 64 / 96), button styles, and border radius all live in theme.json. If a value is not expressible through theme.json presets, question whether the design needs it.

3. **Request the design system alongside the design.** When a design is generated (by Claude Design or otherwise), ask for a design system summary structured to drop straight into theme.json: named colors, type scale, spacing scale, button styles including hover, card style (radius, shadow, padding), and section spacing rules for vertical rhythm.

4. **Accent color restraint.** The single biggest modernization lever on dated sites: stop using the saturated brand color as a surface. Use it only for buttons, key accents, and one CTA band. Alternate white and a light neutral (#F5F5F5 range) for section backgrounds. A brand color everywhere reads cheap and tiring.

5. **Register Block Patterns for anything repeated.** Typical set worth registering per site: hero cover, service card, CTA band, testimonial card, logo strip, value-prop column. Patterns contain core blocks only. Patterns are what make a Gutenberg site fast to extend.

6. **The master template method for editors.** Build one solid page template containing every element the client might need. New page workflow becomes: load template, delete unneeded elements, replace content. This is far more reliable for non-developers than building from an empty page.

7. **Global styles in the right layer.** Buttons and other elements are styled globally in theme.json (code-level, most reliable) or Appearance > Editor > Styles > Blocks (UI-level). Precedence: individual block settings override template styles, which override global styles, which override theme.json. When one instance looks wrong, a more local override is winning, so check the block itself first.

8. **Workhorse blocks.** Group, Columns, Cover, and Query Loop do most of the layout work on every site. Master these four before reaching for anything else.

## What consistently fails

1. **Absolute positioning, overlapping elements, diagonal masks.** Not expressible in core blocks. If the design has them, either flatten the design or accept a custom block, and custom blocks are expensive (see below).

2. **Heavy custom CSS layered over blocks.** Every custom rule fighting block markup is a maintenance liability and often breaks in the editor view. Prefer theme.json presets, block style variations, and small utility classes.

3. **`:has()` selectors for state styling.** Broke on real client setups. Prefer JS-toggled classes or sibling selectors (`input:checked ~ label`).

4. **Automatic word-break for Finnish (and similar languages).** `word-break` / `overflow-wrap: anywhere` breaks long compound words at random points and looks wrong. Use manual soft hyphens instead: `Ty&ouml;terveys&shy;palvelut` breaks only when needed and only at the sensible point. Apply `&shy;` to long compounds in headings and buttons during content entry.

5. **Toggling between code and visual views carelessly.** Visual editors reflow and mangle pasted markup. When pasting generated HTML or block markup, paste into the Code editor view and save without flipping to visual first.

6. **Assuming custom blocks are cheap.** Each custom block means @wordpress/scripts, edit.js, save.js, a build step, and a deprecation burden every time markup changes. Use a Pattern of core blocks first; only build a custom block when a Pattern genuinely cannot express it (interactive widgets, complex repeaters).

## Generating raw block markup

Do not author serialized block markup from this skill alone. The exact serialization rules (required marker classes, class list order, inline style property order, per-block attribute schemas) live in the companion skill `gutenberg-block-authoring` (source: github.com/ross-mulcahy/gutenberg-block-authoring-skill, validated against WordPress 7.0 Gutenberg source). Whenever output contains `<!-- wp:` delimiters, consult that skill; getting these details wrong triggers "Attempt Block Recovery" in the editor and the client sees a broken page. If that skill is not available, say so, keep styled attributes to a minimum (fewer attributes means fewer validation failure points), and validate by pasting into a test page before delivering.

House rules that apply on top of any markup authoring:

- Colors, font sizes, and spacing in page content reference theme.json preset slugs (`"backgroundColor":"primary"`, `var:preset|spacing|60`), not raw hex values. Raw values fragment the design system. (Hex is technically valid; this is a project convention, not a validation rule.)
- Keep class names to what WordPress generates plus registered block style variations (`is-style-*`). Custom classes only if a stylesheet rule actually exists for them.
- Always validate in a real editor before delivering to a client. Markup that looks right but fails validation is worse than no markup.

## Claude Code build workflow

For scaffolding whole sites or themes with Claude Code:

1. Run Claude Code in the theme directory.
2. Give one large structured prompt up front covering: theme.json design system, templates/ and parts/ (FSE), patterns/, custom post types, menus, and the file structure. A complete prompt beats twenty small ones.
3. Let Claude Code finish each section fully before requesting changes. Interrupting mid-scaffold produces inconsistent halves.
4. Use WP-CLI for all setup (page creation, theme activation, plugin installs) so the build is reproducible.
5. If custom blocks exist: `cd blocks && npm install && npm run build` after generation, then `wp theme activate <theme>`.
6. Keep a CLAUDE.md in the theme repo recording project-specific conventions (preset slugs, registered patterns, naming). Append every hard-won lesson there so the next session starts smarter.

Standard theme structure that has worked:

```
theme/
  theme.json
  style.css
  functions.php
  templates/        (front-page.html, page-*.html, single-*.html)
  parts/            (header.html, footer.html)
  patterns/         (hero.php, services-grid.php, cta-banner.php ...)
  blocks/           (only if custom blocks are unavoidable)
  inc/              (cpt.php, menus.php, enqueue.php)
  assets/
```

## Multilingual and copy rules

- Never translate client copy unless asked. Finnish stays Finnish, Swedish stays Swedish. State this in every design prompt ("All copy stays in Finnish. Do not translate it.").
- Use `&shy;` soft hyphens in long Finnish/Swedish compounds as described above.
- House style: no em dashes or en dashes in any copy, code comments, or output. Use commas, periods, or restructure. Time is always 24-hour format (14:00, not 2 PM).

## Quick checklist before delivering a Gutenberg build or brief

- [ ] Every designed section names the core block it maps to
- [ ] No absolute positioning, overlaps, or diagonal masks anywhere
- [ ] theme.json contains the full design system; no raw hex in content
- [ ] Repeated sections are registered Patterns
- [ ] Brand color used as accent, not surface
- [ ] Block markup validates in the editor (no block recovery prompts)
- [ ] Long compound words carry `&shy;` at sensible break points
- [ ] Copy language untouched, no em dashes, 24-hour time
