# Buildability report, Agency Site

Stage 1 of the design to theme pipeline. Source: `design.html`.

Findings block markup authoring until each one is flattened in the design or
accepted with a written cost. No markup was authored before this table was
finished.

## Findings

| Section | Anti-pattern | Recommended flattening | Cost if kept |
|---|---|---|---|
| Header | Flex row with `justify-content: space-between` | None needed. The Group block's flex layout expresses this exactly. | Zero. |
| Hero | None. Solid background, text left, one button. | Maps to Cover with a solid overlay. | Zero. |
| Services | `grid-template-columns: repeat(3, 1fr)` | Columns block. Note the difference: Columns stacks at the mobile breakpoint, CSS Grid as written does not. The design has to accept the stack. | Accepting a custom grid means custom CSS layered over block markup, which the house rules treat as a maintenance liability. |
| About | Two column grid with `align-items: center` | Media & Text with `verticalAlignment`. | Zero. |
| CTA | Brand colour used as a full section surface | **Accepted, with a cost.** This is the one band where the brand colour is a surface. The accent restraint rule allows exactly one. | If a second band appears later, the restraint rule is broken and the site starts reading cheap. Reject the second one. |
| FAQ | `<details>` with a custom bottom border | Details block. The border is a theme.json or block style concern, not a layout one. | Zero. |
| Blog teaser | Three column grid of posts | Query Loop with a grid layout and `columnCount: 3`. | Zero. |
| Footer | Centred text on dark | Template part. | Zero. |

## Blockers

None. The design was written against the Gutenberg constraint, so stage 1 is a
check rather than a rescue. Compare with `examples/legacy-redesign/`, where the
same stage runs in flattening mode against a design that was not.

## Accepted costs

1. The services grid stacks on mobile rather than staying three across. Signed
   off, because the alternative is custom CSS fighting the Columns block.
2. One brand coloured band, the CTA. No second one.
