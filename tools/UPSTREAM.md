# Vendored code

## tools/vendor/validate-blocks.cjs

Source: https://github.com/ross-mulcahy/gutenberg-block-authoring-skill
Commit: `62c8a6c8dfecc088495feccaae184e7253da789c` (2026-06-09, "Update skill for WordPress 7.0")
File: `validate-blocks.js`
License: MIT, Copyright (c) 2026 Ross Mulcahy. Full text in `tools/vendor/LICENSE`.

This is the validator the README used to point at without shipping. It parses
markup with `@wordpress/block-serialization-default-parser`, the same parser
WordPress core uses, and reports delimiter mismatches, invalid attribute JSON,
style attributes that do not exist in Gutenberg, and missing required classes.

### Modifications

Two, both mechanical:

1. **Renamed `.js` to `.cjs`.** This repo is `"type": "module"`, and the
   upstream file is CommonJS. The extension is the whole fix, the contents are
   untouched by the rename.

2. **A guard and an export, at the "Main" section.** Upstream dispatches on
   `process.argv` at load time, so requiring it would run the CLI and block on
   stdin. The patch adds `module.exports = { validateMarkup, loadBlockSchemas }`
   and turns the first `if` into `if (require.main !== module) { } else if`.
   Executed directly, behaviour is identical. The patch is marked in the file
   with a `VENDOR PATCH` comment.

House rules are **not** patched into this file. They live in
`tools/validate-blocks.mjs`, which calls the upstream checks and adds its own.
Keeping the two apart is what makes the next upstream update a copy rather than
a merge.

### Attribute type checks are off by default

`loadBlockSchemas()` reads `block.json` files from a Gutenberg checkout at
`$GUTENBERG_DIR` (default `/tmp/gutenberg`). Without that checkout the
structural checks all still run, only the per-attribute type checks are
skipped. To enable them:

```sh
git clone --depth 1 --branch wp/7.0 https://github.com/WordPress/gutenberg /tmp/gutenberg
GUTENBERG_DIR=/tmp/gutenberg node tools/validate-blocks.mjs --theme theme/
```

### Updating

The repo vendors from this same upstream in two places, and they are pinned
independently:

| Path | Upstream file | Pinned to |
|---|---|---|
| `skills/gutenberg-block-authoring/` | `gutenberg-content/` | WordPress 7.0 snapshot |
| `tools/vendor/validate-blocks.cjs` | `validate-blocks.js` | `62c8a6c8` |

Check them together. If a future WordPress release starts triggering block
recovery, take an updated upstream release before debugging by hand.
