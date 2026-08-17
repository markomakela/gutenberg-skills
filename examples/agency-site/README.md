# Worked example: Agency Site

A Finnish service company site taken all the way from a Claude Design output to
a WordPress block theme whose every page validates. This is the regression
surface for the whole pipeline: `npm test` regenerates the theme from these
inputs and compares it byte for byte.

```
input/
  design.html               stage 0, the design, written against the Gutenberg constraint
  buildability-report.md    stage 1, the audit and the accepted costs
  design-system.json        stage 2, the contract, validates against schemas/
  section-map.md            stage 4, the build plan
expected/theme/             stages 3 and 5, the theme
```

## Reproducing it

From the repository root. Stages 1, 2 and 4 are model work and their outputs are
committed above, so what runs here is stages 3, 5 and 6.

Stage 3, scaffold the theme from the design system:

```bash
node tools/scaffold-theme.mjs --input examples/agency-site/input/design-system.json --out /tmp/agency-theme
```

Stage 5 is authoring the designed sections. They are committed under
`expected/theme/patterns/` and referenced from `expected/theme/templates/front-page.html`.
Copy them across:

```bash
cp -r examples/agency-site/expected/theme/patterns /tmp/agency-theme/ && cp examples/agency-site/expected/theme/templates/front-page.html /tmp/agency-theme/templates/
```

Stage 6, validate:

```bash
node tools/validate-blocks.mjs --theme /tmp/agency-theme --report examples/agency-site/input/buildability-report.md
```

Confirm the generated theme.json still matches its design system:

```bash
node tools/build-theme-json.mjs --input examples/agency-site/input/design-system.json --out /tmp/agency-theme/theme.json --check
```

## What this example is for

It exercises the four workhorse blocks (Group, Columns, Cover, Query Loop) plus
Media & Text and Details, the registered pattern path, and the house rules that
have a machine check: preset slugs instead of hex, no absolute positioning, no
em or en dashes, and manual `&shy;` in long Finnish compounds.

The copy is Finnish and stays Finnish. `Verkko&shy;sivustot` and
`Verkko&shy;kaupat` carry their soft hyphens, which is the rule the example
exists to demonstrate rather than describe.

## What it does not prove

That the theme activates. The validator checks serialization, not WordPress.
Activating `expected/theme/` in a real WordPress 7.0 install and opening each
page in the editor is a manual step, and it is the last one before a client
sees anything.
