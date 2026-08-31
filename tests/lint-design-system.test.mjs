import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintDesignSystem } from "../tools/lint-design-system.mjs";

const example = JSON.parse(
  readFileSync(
    new URL("../examples/agency-site/input/design-system.json", import.meta.url)
  )
);
const cliPath = fileURLToPath(
  new URL("../tools/lint-design-system.mjs", import.meta.url)
);

function withChange(mutate) {
  const doc = structuredClone(example);
  mutate(doc);
  return doc;
}

function writeDoc(doc) {
  const path = join(mkdtempSync(join(tmpdir(), "gbs-lint-")), "design-system.json");
  writeFileSync(path, JSON.stringify(doc, null, 2));
  return path;
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

test("the worked example lints clean, no errors and no drift", () => {
  const { errors, warnings } = lintDesignSystem(example);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("a button colour pointing at a nonexistent palette slug is an error", () => {
  const doc = withChange((d) => {
    d.elements.button.background = "primayr";
  });
  const { errors } = lintDesignSystem(doc);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /elements\.button\.background/);
});

test("a hover colour pointing at a nonexistent palette slug is an error", () => {
  const doc = withChange((d) => {
    d.elements.button.hover.background = "darkk";
  });
  assert.equal(lintDesignSystem(doc).errors.length, 1);
});

test("a section rhythm pointing at a nonexistent spacing slug is an error", () => {
  const doc = withChange((d) => {
    d.styles.sectionRhythm.loose = "70";
  });
  const { errors } = lintDesignSystem(doc);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /sectionRhythm\.loose/);
});

test("a button font size pointing outside the type scale is an error", () => {
  const doc = withChange((d) => {
    d.elements.button.fontSize = "h1";
    d.typography.fontSizes = d.typography.fontSizes.filter((s) => s.slug !== "h1");
  });
  assert.equal(lintDesignSystem(doc).errors.length, 1);
});

test("an optional branch that is absent produces no error", () => {
  const doc = withChange((d) => {
    delete d.elements.link;
    delete d.styles.card.borderColor;
  });
  assert.deepEqual(lintDesignSystem(doc).errors, []);
});

test("a palette colour outside the semantic set warns without blocking", () => {
  const doc = withChange((d) => {
    d.palette.push({ slug: "accent-2", name: "Accent 2", color: "#c8553d" });
  });
  const { errors, warnings } = lintDesignSystem(doc);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /accent-2/);
});

test("a missing semantic palette slug warns", () => {
  const doc = withChange((d) => {
    d.palette = d.palette.filter((c) => c.slug !== "muted");
  });
  const { warnings } = lintDesignSystem(doc);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /muted/);
});

test("a palette without surface is an error, the root background dangles", () => {
  const doc = withChange((d) => {
    d.palette = d.palette.filter((c) => c.slug !== "surface");
    // Retarget the references that legitimately pointed at surface, so the
    // only error left is the missing root slug itself.
    d.elements.button.text = "neutral";
    d.elements.button.hover.text = "neutral";
    d.styles.card.background = "neutral";
  });
  const { errors, warnings } = lintDesignSystem(doc);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"surface"/);
  assert.match(errors[0], /root background/);
  assert.equal(
    warnings.some((w) => w.includes("surface")),
    false,
    "no duplicate warning for a slug already reported as an error"
  );
});

test("a palette with neither ink nor text is an error suggesting ink", () => {
  const doc = withChange((d) => {
    d.palette = d.palette.filter((c) => c.slug !== "ink");
  });
  const { errors, warnings } = lintDesignSystem(doc);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /root text/);
  assert.match(errors[0], /Add "ink"/);
  assert.equal(
    warnings.some((w) => w.includes('"ink"')),
    false,
    "no duplicate warning for a slug already reported as an error"
  );
});

test("a palette with text but no ink stays a warning, the documented fallback", () => {
  const doc = withChange((d) => {
    d.palette = d.palette.map((c) =>
      c.slug === "ink" ? { ...c, slug: "text", name: "Text" } : c
    );
  });
  const { errors, warnings } = lintDesignSystem(doc);
  assert.deepEqual(errors, []);
  // "ink" is still reported missing and "text" is drift, but neither blocks,
  // because the generator falls back to the "text" slug for root text.
  assert.equal(warnings.some((w) => w.includes('"ink"')), true);
  assert.equal(warnings.some((w) => w.includes('"text"')), true);
});

test("the CLI exits 0 and prints nothing for a clean document", () => {
  const result = runCli([writeDoc(example)]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});

test("the CLI prints errors to stderr and exits 1", () => {
  const doc = withChange((d) => (d.elements.button.background = "primayr"));
  const result = runCli([writeDoc(doc)]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^error: /m);
  assert.match(result.stderr, /elements\.button\.background/);
});

test("the CLI reports drift as warnings without failing", () => {
  const doc = withChange((d) => {
    d.palette.push({ slug: "accent-2", name: "Accent 2", color: "#c8553d" });
  });
  const result = runCli([writeDoc(doc)]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /^warning: /m);
  assert.doesNotMatch(result.stderr, /^error: /m);
});

test("the CLI without arguments exits 1 with usage", () => {
  const result = runCli([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: node tools\/lint-design-system\.mjs <design-system\.json>/);
});
