import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lintDesignSystem } from "../tools/lint-design-system.mjs";

const example = JSON.parse(
  readFileSync(
    new URL("../examples/agency-site/input/design-system.json", import.meta.url)
  )
);

function withChange(mutate) {
  const doc = structuredClone(example);
  mutate(doc);
  return doc;
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
