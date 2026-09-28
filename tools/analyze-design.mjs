#!/usr/bin/env node
/**
 * Stage 0: read a design HTML reference into a checkable artifact.
 *
 *   node tools/analyze-design.mjs --input design.html
 *   node tools/analyze-design.mjs --input design.html --out design-analysis.json
 *   node tools/analyze-design.mjs --input design.html --out design-analysis.json --check
 *   node tools/analyze-design.mjs --input design.html --json
 *
 * The HTML is the visual reference, never the production architecture, so this
 * tool only observes. It names what it sees using the words the design uses,
 * not the words the design system uses: a custom property called `--text` is
 * recorded as `--text` even though the pipeline's semantic slug is `ink`. That
 * translation is a stage 2 decision a person signs, and moving it here would
 * hide it.
 *
 * Nothing here decides anything either. Regions carry signals, suspected
 * anti-patterns carry a rule id, and both are input to stage 1 rather than a
 * verdict. The output is deterministic and carries no timestamp, so a
 * committed analysis can be regenerated and compared with --check exactly as
 * theme.json is.
 *
 * What it does not do, on purpose: it is not a browser and it does not build a
 * cascade. Declarations are collected per selector and matched by class name,
 * which is enough for the structural signals below and wrong for anything that
 * depends on specificity or inheritance. If a signal ever needs the real
 * computed value, that belongs in the Playwright step, which has a browser.
 *
 * No runtime dependencies, same reason as build-theme-json.mjs.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Tags that open a region of the page. `article` is content inside one. */
const REGION_TAGS = new Set(["section", "header", "footer", "main", "aside"]);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;
const SECTION_COMMENT = /<!--\s*SECTION:\s*([^]*?)-->/g;

/** Anti-patterns the flattening table in gutenberg-design-migration names. */
const FLAGS = [
  {
    rule: "absolute-position",
    test: /position\s*:\s*(absolute|fixed)/i,
    message: "position absolute or fixed is not expressible in core blocks."
  },
  {
    rule: "clip-path",
    test: /clip-path\s*:/i,
    message: "clip-path has no core block equivalent. Flatten to a colour band."
  },
  {
    rule: "has-selector",
    test: /:has\(/i,
    message: ":has() state styling needs a sibling selector or a JS toggle."
  },
  {
    rule: "overflow-wrap-anywhere",
    test: /overflow-wrap\s*:\s*anywhere/i,
    message: "Automatic word break. Use a manual soft hyphen at the compound."
  }
];

function attr(raw, name) {
  const match = raw.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function classesOf(raw) {
  const value = attr(raw, "class");
  return value ? value.trim().split(/\s+/) : [];
}

/** The <style> blocks, concatenated, with the rest of the document dropped. */
export function extractCss(html) {
  return [...html.matchAll(/<style[^>]*>([^]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
}

/**
 * Declarations per selector key. A class is keyed as `.name` and a bare element
 * selector as its tag, because a design often styles `footer` directly and a
 * class-only index reports that region as having no background at all.
 *
 * A rule listing several selectors records the same declarations under each.
 */
function rulesBySelector(css) {
  const out = new Map();
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = {};
    for (const part of body.split(";")) {
      const colon = part.indexOf(":");
      if (colon === -1) continue;
      declarations[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim();
    }

    for (const selector of selectors.split(",")) {
      const trimmed = selector.trim();
      const keys = [...trimmed.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => `.${m[1]}`);

      // Only a selector that is one bare tag, so `.faq details` does not
      // claim to style every details element on the page.
      if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(trimmed)) keys.push(trimmed.toLowerCase());

      for (const key of keys) out.set(key, { ...(out.get(key) ?? {}), ...declarations });
    }
  }
  return out;
}

function kindOf(value) {
  if (/^#[0-9a-fA-F]{3,8}$|^(rgb|hsl)a?\(/i.test(value)) return "color";
  if (/^-?[\d.]+(px|rem|em|%|vw|vh|ch)$/.test(value)) return "length";
  if (/^clamp\(|^calc\(|^min\(|^max\(/i.test(value)) return "fluid";
  return "other";
}

/** Custom properties declared on :root, in source order. */
export function extractTokens(css) {
  const root = css.match(/:root\s*\{([^}]*)\}/);
  const custom = {};
  if (root) {
    for (const [, name, value] of root[1].matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g)) {
      const trimmed = value.trim();
      custom[name] = { value: trimmed, kind: kindOf(trimmed) };
    }
  }

  // Hex outside :root is the design system fragmenting before it exists.
  const outside = css.replace(/:root\s*\{[^}]*\}/, "");
  const loose = [...new Set([...outside.matchAll(HEX)].map((m) => m[0].toLowerCase()))].sort();

  return { custom, hexOutsideRoot: loose };
}

function countTracks(value) {
  const repeat = value.match(/repeat\(\s*(\d+)/);
  if (repeat) return Number(repeat[1]);
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Body regions in source order. Only the outermost region is reported: a
 * section nested inside another is that section's content, not a sibling.
 */
export function extractRegions(html, css) {
  const bySelector = rulesBySelector(css);
  const body = html.match(/<body[^>]*>([^]*?)<\/body>/i);
  const source = body ? body[1] : html;

  const regions = [];
  let depth = 0;
  let open = null;

  TAG.lastIndex = 0;
  for (let m = TAG.exec(source); m !== null; m = TAG.exec(source)) {
    const [whole, slash, name, raw] = m;
    if (!REGION_TAGS.has(name.toLowerCase())) continue;

    if (!slash) {
      if (depth === 0) {
        open = { tag: name.toLowerCase(), raw, start: m.index, inner: m.index + whole.length };
      }
      depth += 1;
      continue;
    }

    depth -= 1;
    if (depth !== 0 || !open) continue;

    const inner = source.slice(open.inner, m.index);
    const comment = precedingSectionComment(source.slice(0, open.start));

    regions.push(describe(open, inner, comment, bySelector, regions.length));
    open = null;
  }

  return regions;
}

/**
 * The SECTION comment immediately above a region, if there is one.
 *
 * It has to be the last comment in the text before the region and nothing but
 * whitespace may follow it. Matching the first one instead names every region
 * after the top of the document, which is what this looked like before.
 */
function precedingSectionComment(before) {
  const all = [...before.matchAll(SECTION_COMMENT)];
  if (all.length === 0) return null;

  const last = all[all.length - 1];
  const between = before.slice(last.index + last[0].length);
  return between.trim() === "" ? last[1] : null;
}

function describe(open, inner, comment, bySelector, order) {
  const classes = classesOf(open.raw);
  const inlineStyle = attr(open.raw, "style") ?? "";
  const declared = comment ? comment.trim().replace(/\s+/g, " ") : null;

  // Declarations that reach this region: the bare tag first, then its classes,
  // then the inline style, which wins in a browser and is kept separate.
  const own = { ...(bySelector.get(open.tag) ?? {}) };
  for (const cls of classes) Object.assign(own, bySelector.get(`.${cls}`) ?? {});

  // A grid can be declared on the region or on a wrapper inside it, so the
  // column count is taken from any class used anywhere in the region.
  let columns = 1;
  for (const cls of new Set([...classes, ...[...inner.matchAll(/class\s*=\s*"([^"]*)"/g)]
    .flatMap((m) => m[1].trim().split(/\s+/))])) {
    const declaration = bySelector.get(`.${cls}`)?.["grid-template-columns"];
    if (declaration) columns = Math.max(columns, countTracks(declaration));
  }

  const headings = [...inner.matchAll(/<h([1-6])\b[^>]*>([^]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]*>/g, "").trim() }));

  const background = own.background ?? own["background-color"] ?? null;

  return {
    order,
    name: nameOf(attr(open.raw, "id"), declared, open.tag, order),
    tag: open.tag,
    id: attr(open.raw, "id"),
    classes,
    declared,
    signals: {
      columns,
      background: background ? background.trim() : null,
      textAlign: own["text-align"] ?? null,
      headingLevel: headings.length ? Math.min(...headings.map((h) => h.level)) : null,
      buttons: (inner.match(/class\s*=\s*"[^"]*\bbutton\b|<button\b/g) ?? []).length,
      hasMedia: /<img\b|<video\b|<picture\b|<svg\b/i.test(inner),
      details: (inner.match(/<details\b/gi) ?? []).length,
      repeatedChildren: repeatedChildren(inner),
      inlineStyle: inlineStyle !== ""
    },
    content: {
      headings: headings.map((h) => h.text).filter(Boolean),
      paragraphs: (inner.match(/<p\b/gi) ?? []).length
    }
  };
}

/**
 * A stable handle for the region, so the artifact and the section map can name
 * the same thing. The id wins, then the first clause of a SECTION comment,
 * which is how a design that carries them already names its own sections.
 */
function nameOf(id, declared, tag, order) {
  if (id) return id;
  if (declared) {
    const first = declared.split(".")[0].trim();
    if (first) return first;
  }
  return `${tag}-${order}`;
}

/** The largest run of siblings sharing a class, which is what makes a pattern. */
function repeatedChildren(inner) {
  const counts = new Map();
  for (const [, value] of inner.matchAll(/class\s*=\s*"([^"]*)"/g)) {
    const key = value.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [, tag] of [["", "article"], ["", "details"]]) {
    const n = (inner.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length;
    if (n > 1) counts.set(tag, n);
  }
  const max = Math.max(0, ...counts.values());
  return max > 1 ? max : 0;
}

/** Suspected anti-patterns, reported against the region that carries them. */
export function extractFlags(html, css, regions) {
  const out = [];

  for (const flag of FLAGS) {
    if (flag.test.test(css) || flag.test.test(html)) {
      out.push({ rule: flag.rule, region: null, message: flag.message });
    }
  }

  for (const region of regions) {
    // Two tracks are not flagged. That is Media & Text or a two column
    // Columns, both of which stack the way the design already expects. Three
    // or more is where the design has to accept a stack it did not draw.
    if (region.signals.columns > 2) {
      out.push({
        rule: "css-grid-fixed-columns",
        region: region.name,
        message: `A ${region.signals.columns} track grid. The Columns block stacks at the mobile breakpoint and CSS grid as written does not, so the design has to accept the stack.`
      });
    }
    if (region.signals.inlineStyle) {
      out.push({
        rule: "inline-style",
        region: region.name,
        message: "Layout in an inline style. Express it through block attributes or theme.json, or record it as an accepted cost."
      });
    }
  }

  return out;
}

export function analyze(html, source = "design.html") {
  const css = extractCss(html);
  const regions = extractRegions(html, css);
  return {
    source,
    tokens: extractTokens(css),
    regions,
    flags: extractFlags(html, css, regions)
  };
}

/** Always LF, always a trailing newline, so --check survives a fresh clone. */
export function serialize(analysis) {
  return `${JSON.stringify(analysis, null, 2)}\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--json") args.json = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!args.input) {
    throw new Error("usage: analyze-design.mjs --input <file> [--out <file>] [--check] [--json]");
  }
  if (args.check && !args.out) {
    throw new Error("--check needs --out, the file to compare against");
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const analysis = analyze(readFileSync(args.input, "utf8"), args.input.split(/[\\/]/).pop());
  const serialized = serialize(analysis);

  if (args.json) {
    process.stdout.write(serialized);
    return 0;
  }

  if (args.check) {
    const onDisk = readFileSync(args.out, "utf8").replace(/\r\n/g, "\n");
    if (onDisk !== serialized) {
      process.stderr.write(`${args.out} is out of date. Regenerate it without --check.\n`);
      return 1;
    }
    process.stdout.write(`${args.out} is up to date\n`);
    return 0;
  }

  if (args.out) {
    writeFileSync(args.out, serialized);
    process.stdout.write(`wrote ${args.out}\n`);
  }

  const gaps = analysis.flags.length;
  process.stdout.write(
    `read ${analysis.regions.length} regions, ${Object.keys(analysis.tokens.custom).length} tokens, ${gaps} flags\n`
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
