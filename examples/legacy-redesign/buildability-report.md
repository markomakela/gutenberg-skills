# Buildability report, Legacy Redesign (flattening mode)

Stage 1 run against a design produced before the Gutenberg constraint was
stated. Source: `input/design.html`.

This is the mode that matters in practice. A conforming design makes stage 1 a
formality. A design like this one is why the stage exists: every finding below
would otherwise surface halfway through the build, with the client already
expecting the mockup they signed off.

**Status: blocked.** Four blockers. No markup is authored until the design is
changed or each blocker is accepted with a written cost.

## Blockers

| Section | Anti-pattern | Flatten to | Cost if kept |
|---|---|---|---|
| Hero | Card absolutely positioned and pulled 80px below the hero edge, overlapping the next section | Cover with the card as an inner Group, sitting inside the Cover rather than across its boundary | A custom block, plus the CSS that positions it, plus a deprecation every time the markup changes. The overlap also breaks at every breakpoint the designer did not check. |
| Hero card | Badge absolutely positioned at the card corner | An inline element at the start of the heading, or a Group above it with the badge as its own line | Same as above. A badge is not worth a custom block. |
| Section divider | `clip-path` diagonal mask between sections | A flat colour band. If the diagonal is load bearing to the brand, a background SVG on a Cover gets close without positioning anything | Custom CSS layered over block markup, and the mask reflows differently in the editor than on the front end, so the client sees a broken preview. |
| Plan selector | `:has(input:checked)` state styling | A sibling selector (`input:checked ~ label`) or a JS toggled class | This one has already broken on real client setups. Not a theoretical risk. |

## Also flagged, not blocking

| Finding | Action |
|---|---|
| `overflow-wrap: anywhere` on all headings | Remove it. It breaks Finnish compounds at random points. `Työterveyspalvelut` becomes `Työterveyspalve` / `lut`. Use manual `&shy;` at the compound boundary instead: `Työterveys&shy;palvelut`. |
| Brand colour used as a surface in three consecutive sections | Reduce to one band. Alternate white and a light neutral for the others. This is the single biggest modernisation lever on a dated site, and it costs nothing to apply. |
| No semantic palette | The design uses two raw hex values with no names. Stage 2 cannot produce a `design-system.json` until the palette has semantic slugs. |

## Note to send back to the designer

Four constructs in the design cannot be built in native Gutenberg blocks: the
overlapping hero card, the corner badge, the diagonal section mask, and the
`:has()` based selected state. Each one needs either a flattened version or a
custom block, and a custom block carries a build step and a maintenance cost
for the life of the site.

The flattened versions are in the table above. None of them change what the
page says, only how the sections stack. Two smaller things worth fixing while
the design is open: automatic word break mangles Finnish compound words, and
the brand colour is currently a surface in three sections in a row.

## What happens next

Stage 2 does not start until this report is answered. That is the gate.
