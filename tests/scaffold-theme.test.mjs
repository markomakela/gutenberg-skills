import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scaffoldFiles } from "../tools/scaffold-theme.mjs";
import { buildThemeJson, serialize } from "../tools/build-theme-json.mjs";

const examplePath = fileURLToPath(
  new URL("../examples/agency-site/input/design-system.json", import.meta.url)
);
const expectedThemeDir = fileURLToPath(
  new URL("../examples/agency-site/expected/theme", import.meta.url)
);
const cliPath = fileURLToPath(new URL("../tools/scaffold-theme.mjs", import.meta.url));

const example = JSON.parse(readFileSync(examplePath));

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out.sort();
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

test("the file list matches the structure the skill prescribes", () => {
  assert.deepEqual([...scaffoldFiles(example).keys()].sort(), [
    "CLAUDE.md",
    "assets/.gitkeep",
    "functions.php",
    "inc/cpt.php",
    "inc/enqueue.php",
    "inc/menus.php",
    "parts/footer.html",
    "parts/header.html",
    "patterns/README.md",
    "style.css",
    "templates/front-page.html",
    "templates/index.html",
    "templates/page.html",
    "templates/single.html",
    "theme.json"
  ]);
});

// Stage 5 authors the designed sections into the example theme, so the example
// is a superset of the scaffold. These are the files authoring owns. Everything
// else must still be byte for byte what the scaffold writes, which is what
// stops a hand edit from drifting into the generated half.
const AUTHORED = [
  "patterns/about-media-text.php",
  "patterns/cta-band.php",
  "patterns/faq.php",
  "patterns/hero.php",
  "patterns/services-grid.php",
  "templates/front-page.html"
];

test("the committed example theme is the scaffold plus the authored sections", () => {
  const files = scaffoldFiles(example);
  const expectedFiles = [...new Set([...files.keys(), ...AUTHORED])].sort();
  assert.deepEqual(walk(expectedThemeDir), expectedFiles);

  for (const [name, contents] of files) {
    if (AUTHORED.includes(name)) continue;
    const onDisk = readFileSync(join(expectedThemeDir, name), "utf8").replace(/\r\n/g, "\n");
    assert.equal(contents, onDisk, `${name} differs`);
  }
});

test("every authored file is a pattern or the front page, nothing else", () => {
  for (const name of AUTHORED) {
    assert.equal(
      name.startsWith("patterns/") || name === "templates/front-page.html",
      true,
      `${name} is outside what stage 5 owns`
    );
  }
});

test("theme.json is delegated to the generator, not written twice", () => {
  assert.equal(scaffoldFiles(example).get("theme.json"), serialize(buildThemeJson(example)));
});

test("output is deterministic across runs", () => {
  const a = [...scaffoldFiles(example)].map(([k, v]) => k + v).join("");
  const b = [...scaffoldFiles(example)].map(([k, v]) => k + v).join("");
  assert.equal(a, b);
});

test("style.css carries the headers WordPress requires to see a block theme", () => {
  const css = scaffoldFiles(example).get("style.css");
  assert.match(css, /Theme Name: Agency Site/);
  assert.match(css, /Text Domain: agency-site/);
  assert.match(css, /Requires at least: 7\.0/);
});

test("template parts reference the theme by its text domain", () => {
  const index = scaffoldFiles(example).get("templates/index.html");
  assert.match(index, /"slug":"header","theme":"agency-site"/);
  assert.match(index, /"slug":"footer","theme":"agency-site"/);
});

test("no template carries a raw hex value", () => {
  for (const [name, contents] of scaffoldFiles(example)) {
    if (!name.endsWith(".html")) continue;
    assert.equal(/#[0-9a-fA-F]{6}\b/.test(contents), false, `${name} carries hex`);
  }
});

test("CLAUDE.md is seeded with the real slugs, so the next session starts informed", () => {
  const claude = scaffoldFiles(example).get("CLAUDE.md");
  for (const colour of example.palette) assert.match(claude, new RegExp(`\\b${colour.slug}\\b`));
  assert.match(claude, /var:preset\|spacing\|50/);
  assert.match(claude, /720px/);
});

test("functions.php registers patterns from the patterns directory", () => {
  const php = scaffoldFiles(example).get("functions.php");
  assert.match(php, /agency_site_/);
  assert.match(php, /require_once/);
  assert.equal(php.startsWith("<?php"), true);
});

test("a write run fills an empty directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "gbs-"));
  const result = runCli(["--input", examplePath, "--out", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(walk(dir), [...scaffoldFiles(example).keys()].sort());
});

test("a non-empty target is refused without --force", () => {
  const dir = mkdtempSync(join(tmpdir(), "gbs-"));
  mkdirSync(join(dir, "templates"), { recursive: true });
  writeFileSync(join(dir, "templates", "index.html"), "hand written, do not lose me");

  const result = runCli(["--input", examplePath, "--out", dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not empty/i);
  assert.equal(
    readFileSync(join(dir, "templates", "index.html"), "utf8"),
    "hand written, do not lose me"
  );
});

test("--force overwrites a non-empty target", () => {
  const dir = mkdtempSync(join(tmpdir(), "gbs-"));
  writeFileSync(join(dir, "style.css"), "stale");

  assert.equal(runCli(["--input", examplePath, "--out", dir, "--force"]).status, 0);
  assert.match(readFileSync(join(dir, "style.css"), "utf8"), /Theme Name: Agency Site/);
});
