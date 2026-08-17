import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildThemeJson, serialize } from "../tools/build-theme-json.mjs";

const examplePath = fileURLToPath(
  new URL("../examples/agency-site/input/design-system.json", import.meta.url)
);
const expectedPath = fileURLToPath(
  new URL("../examples/agency-site/expected/theme/theme.json", import.meta.url)
);
const cliPath = fileURLToPath(new URL("../tools/build-theme-json.mjs", import.meta.url));

const example = JSON.parse(readFileSync(examplePath));

function withChange(mutate) {
  const doc = structuredClone(example);
  mutate(doc);
  return doc;
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

test("the committed example theme.json is exactly what the generator produces", () => {
  const generated = serialize(buildThemeJson(example));
  const onDisk = readFileSync(expectedPath, "utf8").replace(/\r\n/g, "\n");
  assert.equal(generated, onDisk);
});

test("output is deterministic across runs", () => {
  assert.equal(serialize(buildThemeJson(example)), serialize(buildThemeJson(example)));
});

test("the schema url and version follow meta.wpVersion", () => {
  const theme = buildThemeJson(example);
  assert.equal(theme.$schema, "https://schemas.wp.org/wp/7.0/theme.json");
  assert.equal(theme.version, 3);
});

test("every palette colour reaches settings.color.palette", () => {
  const theme = buildThemeJson(example);
  assert.deepEqual(
    theme.settings.color.palette.map((c) => c.slug),
    example.palette.map((c) => c.slug)
  );
  assert.equal(theme.settings.color.custom, false);
  assert.equal(theme.settings.color.defaultPalette, false);
});

test("button colours become preset references, never hex", () => {
  const theme = buildThemeJson(example);
  const button = theme.styles.elements.button;
  assert.equal(button.color.background, "var:preset|color|primary");
  assert.equal(button.color.text, "var:preset|color|surface");
  assert.equal(serialize(theme).includes("#1f5f4b"), true, "palette keeps its hex");
  assert.equal(/#[0-9a-fA-F]{3,8}/.test(serialize(theme.styles)), false, "styles carry none");
});

test("button hover lands under the :hover pseudo selector", () => {
  const hover = buildThemeJson(example).styles.elements.button[":hover"];
  assert.equal(hover.color.background, "var:preset|color|dark");
  assert.equal(hover.color.text, "var:preset|color|surface");
});

test("the card style becomes custom properties, not a block override", () => {
  const theme = buildThemeJson(example);
  assert.equal(theme.settings.custom.card.radius, "8px");
  assert.equal(
    theme.settings.custom.card.background,
    "var(--wp--preset--color--surface)"
  );
  // A card is a Pattern of core blocks, so styling core/group globally would
  // hit every Group on the site. Custom properties let the pattern opt in.
  assert.equal(theme.styles.blocks, undefined);
});

test("section rhythm resolves spacing slugs to preset variables", () => {
  const rhythm = buildThemeJson(example).settings.custom.sectionRhythm;
  assert.equal(rhythm.default, "var(--wp--preset--spacing--50)");
  assert.equal(rhythm.loose, "var(--wp--preset--spacing--60)");
});

test("an absent optional element produces no empty branch", () => {
  const theme = buildThemeJson(withChange((d) => delete d.elements.link));
  assert.equal("link" in theme.styles.elements, false);
});

test("the generator refuses a design system with a dangling reference", () => {
  assert.throws(
    () => buildThemeJson(withChange((d) => (d.elements.button.background = "primayr"))),
    /elements\.button\.background/
  );
});

test("--check passes when the file on disk matches", () => {
  const result = runCli(["--input", examplePath, "--out", expectedPath, "--check"]);
  assert.equal(result.status, 0, result.stderr);
});

test("--check fails when the file on disk has been hand edited", () => {
  const dir = mkdtempSync(join(tmpdir(), "gbs-"));
  const target = join(dir, "theme.json");
  const tampered = buildThemeJson(example);
  tampered.settings.layout.wideSize = "1400px";
  writeFileSync(target, serialize(tampered));

  const result = runCli(["--input", examplePath, "--out", target, "--check"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /differs/i);
});

test("a write run produces a file that then passes --check", () => {
  const dir = mkdtempSync(join(tmpdir(), "gbs-"));
  const target = join(dir, "theme.json");

  assert.equal(runCli(["--input", examplePath, "--out", target]).status, 0);
  assert.equal(runCli(["--input", examplePath, "--out", target, "--check"]).status, 0);
});
