/**
 * Referential checks for design-system.json.
 *
 *   node tools/lint-design-system.mjs <design-system.json>
 *
 * JSON Schema can prove that a colour reference is a slug rather than a hex
 * value, but it cannot prove that the slug actually exists in the palette.
 * That gap matters: a typo like "primayr" passes the schema, generates a
 * theme.json that silently drops the colour, and surfaces as a button with no
 * background on a client site. Everything that needs to look across the
 * document lives here.
 *
 * Errors block. Warnings do not, they report design system drift.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEMANTIC_PALETTE = ["primary", "dark", "surface", "neutral", "ink", "muted"];

// Every place a slug points at a definition list elsewhere in the document.
const REFERENCES = [
  ["elements.button.background", "palette"],
  ["elements.button.text", "palette"],
  ["elements.button.fontSize", "fontSizes"],
  ["elements.button.hover.background", "palette"],
  ["elements.button.hover.text", "palette"],
  ["elements.link.text", "palette"],
  ["elements.link.hover.text", "palette"],
  ["styles.card.background", "palette"],
  ["styles.card.borderColor", "palette"],
  ["styles.sectionRhythm.default", "spacing"],
  ["styles.sectionRhythm.tight", "spacing"],
  ["styles.sectionRhythm.loose", "spacing"]
];

function at(doc, path) {
  return path.split(".").reduce((node, key) => (node == null ? node : node[key]), doc);
}

function slugsOf(doc, list) {
  const source = {
    palette: doc.palette,
    fontSizes: doc.typography?.fontSizes,
    spacing: doc.spacing?.spacingSizes
  }[list];
  return new Set((source ?? []).map((entry) => entry.slug));
}

/**
 * @param {object} doc a design-system.json that has already passed the schema
 * @returns {{errors: string[], warnings: string[]}}
 */
export function lintDesignSystem(doc) {
  const errors = [];
  const warnings = [];

  const known = {
    palette: slugsOf(doc, "palette"),
    fontSizes: slugsOf(doc, "fontSizes"),
    spacing: slugsOf(doc, "spacing")
  };

  for (const [path, list] of REFERENCES) {
    const value = at(doc, path);
    if (value === undefined) continue; // optional branch, absence is fine
    if (!known[list].has(value)) {
      errors.push(
        `${path} references "${value}", which is not a ${list} slug. Known: ${[...known[list]].join(", ")}`
      );
    }
  }

  // buildStyles emits root colour references unconditionally: background
  // points at "surface", text at "ink" with "text" as the fallback. A palette
  // without those slugs generates a theme whose root colours are dangling
  // custom properties, so these two block instead of reporting drift.
  const surfaceMissing = !known.palette.has("surface");
  const inkMissing = !known.palette.has("ink") && !known.palette.has("text");
  if (surfaceMissing) {
    errors.push(
      'palette is missing "surface". The generator emits a root background reference to it, so the theme would ship with no background colour.'
    );
  }
  if (inkMissing) {
    errors.push(
      'palette is missing "ink". The generator emits a root text reference to "ink", falling back to "text", and neither slug exists, so the theme would ship with no text colour. Add "ink".'
    );
  }

  for (const slug of known.palette) {
    if (!SEMANTIC_PALETTE.includes(slug)) {
      warnings.push(
        `palette carries "${slug}", outside the semantic set (${SEMANTIC_PALETTE.join(", ")}). Every extra colour is one more an editor can pick wrongly.`
      );
    }
  }

  for (const slug of SEMANTIC_PALETTE) {
    if (slug === "surface" && surfaceMissing) continue; // already an error
    if (slug === "ink" && inkMissing) continue; // already an error
    if (!known.palette.has(slug)) {
      warnings.push(`palette is missing the semantic slug "${slug}".`);
    }
  }

  return { errors, warnings };
}

function main(argv) {
  if (argv.length !== 1) {
    throw new Error("usage: node tools/lint-design-system.mjs <design-system.json>");
  }

  const doc = JSON.parse(readFileSync(argv[0], "utf8"));
  const { errors, warnings } = lintDesignSystem(doc);
  for (const error of errors) process.stderr.write(`error: ${error}\n`);
  for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
  return errors.length > 0 ? 1 : 0;
}

// pathToFileURL, not string interpolation: a Windows path produces
// file:///D:/... with three slashes, so the naive comparison is always false
// and the CLI silently does nothing while exiting 0.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
