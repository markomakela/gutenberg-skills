# Agency Site

Conventions for this theme. Append every hard won lesson so the next session
starts smarter.

## Generated files, do not hand edit

`theme.json` is generated from `design-system.json`. Change the design system
and regenerate:

```sh
node tools/build-theme-json.mjs --input design-system.json --out theme.json
```

`--check` fails if the two have drifted apart.

## Colour presets

| Slug | Name | Value |
|---|---|---|
| `primary` | Primary | #1f5f4b |
| `dark` | Dark | #12261f |
| `surface` | Surface | #ffffff |
| `neutral` | Neutral | #f4f4f1 |
| `text` | Text | #1b1b1b |
| `muted` | Muted | #5c625f |

Brand colour is for buttons, key accents and at most one CTA band. It is not a
section surface. Alternate `surface` and `neutral` for section backgrounds.

## Type scale

| Slug | Size |
|---|---|
| `small` | 0.875rem |
| `body` | 1rem |
| `h3` | 1.375rem |
| `h2` | 1.875rem |
| `h1` | 2.5rem |
| `display` | clamp(2.5rem, 1.8rem + 3vw, 4rem) |

## Spacing scale

| Slug | Size | Reference |
|---|---|---|
| `10` | 8px | `var:preset|spacing|10` |
| `20` | 16px | `var:preset|spacing|20` |
| `30` | 24px | `var:preset|spacing|30` |
| `40` | 40px | `var:preset|spacing|40` |
| `50` | 64px | `var:preset|spacing|50` |
| `60` | 96px | `var:preset|spacing|60` |

Section rhythm: default `50`, tight
`40`, loose `60`.

## Layout

Content 720px, wide 1200px.

## Registered patterns

None yet. Add a row here whenever one is registered.

## Lessons

- Long Finnish and Swedish compounds carry manual `&shy;` soft hyphens. Never
  automatic word break.
- Paste generated markup into the Code editor view and save without flipping to
  visual first.
