/**
 * Referential checks for design-system.json.
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

  for (const slug of known.palette) {
    if (!SEMANTIC_PALETTE.includes(slug)) {
      warnings.push(
        `palette carries "${slug}", outside the semantic set (${SEMANTIC_PALETTE.join(", ")}). Every extra colour is one more an editor can pick wrongly.`
      );
    }
  }

  for (const slug of SEMANTIC_PALETTE) {
    if (!known.palette.has(slug)) {
      warnings.push(`palette is missing the semantic slug "${slug}".`);
    }
  }

  return { errors, warnings };
}
