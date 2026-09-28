import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyze, serialize, extractTokens, extractCss } from "../tools/analyze-design.mjs";

const designPath = fileURLToPath(
  new URL("../examples/agency-site/input/design.html", import.meta.url)
);
const cliPath = fileURLToPath(new URL("../tools/analyze-design.mjs", import.meta.url));
const design = readFileSync(designPath, "utf8");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

function names(html) {
  return analyze(html).regions.map((r) => r.name);
}

test("the worked example reads as eight regions in source order", () => {
  // The section map has eleven rows. Three of them are templates the design
  // never draws, so eight is the number the HTML can actually account for.
  assert.deepEqual(names(design), [
    "header",
    "hero",
    "palvelut",
    "meista",
    "yhteys",
    "usein",
    "blog teaser",
    "footer"
  ]);
});

test("region signals match what the section map says each section is", () => {
  const byName = Object.fromEntries(analyze(design).regions.map((r) => [r.name, r.signals]));

  assert.equal(byName.hero.headingLevel, 1, "the hero carries the only h1");
  assert.equal(byName.palvelut.columns, 3, "three service cards");
  assert.equal(byName.palvelut.repeatedChildren, 3, "the card repeats, so it is a pattern");
  assert.equal(byName.meista.hasMedia, true, "Media and Text needs media");
  assert.equal(byName.meista.columns, 2);
  assert.equal(byName.yhteys.background, "var(--primary)", "the single accent band");
  assert.equal(byName.usein.details, 3, "three Details blocks");
  assert.equal(byName["blog teaser"].columns, 3, "Query Loop, three across");
});

test("custom properties keep the name the design gave them", () => {
  // The design calls it --text and the design system calls the slug ink. That
  // translation is a stage 2 decision a person signs, so this tool must not
  // quietly perform it.
  const { custom } = extractTokens(extractCss(design));
  assert.equal(custom["--text"].value, "#1b1b1b");
  assert.equal(custom["--text"].kind, "color");
  assert.equal(custom["--ink"], undefined);
  assert.equal(custom["--content"].kind, "length");
});

test("a region styled by a bare element selector still reports its background", () => {
  // The footer has no class. Indexing only class selectors reported it as
  // having no background at all.
  const footer = analyze(design).regions.at(-1);
  assert.equal(footer.name, "footer");
  assert.equal(footer.signals.background, "var(--dark)");
});

test("a descendant selector does not claim to style the whole tag", () => {
  const html = `<style>.faq details { border-bottom: 1px solid red } </style>
<body><section class="faq"><details><summary>x</summary></details></section>
<footer>y</footer></body>`;
  const footer = analyze(html).regions.at(-1);
  assert.equal(footer.signals.background, null);
});

test("a SECTION comment names only the region directly below it", () => {
  // Matching the first comment in the document instead of the nearest one
  // named every region after the top of the file.
  const html = `<body>
<!-- SECTION: first. Maps to a Template Part. -->
<header>a</header>
<section id="second">b</section>
</body>`;
  assert.deepEqual(names(html), ["first", "second"]);
});

test("a comment separated from the region by markup does not name it", () => {
  const html = `<body>
<!-- SECTION: stray. -->
<p>something in between</p>
<section>b</section>
</body>`;
  assert.deepEqual(names(html), ["section-0"]);
});

test("two grid tracks are not an anti-pattern, three are", () => {
  // Two tracks is Media and Text or a two column Columns, both of which stack
  // the way the design already expects. The buildability report prices the
  // About section at zero for exactly this reason.
  const rules = (html) => analyze(html).flags.map((f) => f.rule);

  const two = `<style>.g { grid-template-columns: 1fr 1fr }</style>
<body><section><div class="g">a</div></section></body>`;
  assert.equal(rules(two).includes("css-grid-fixed-columns"), false);

  const three = `<style>.g { grid-template-columns: repeat(3, 1fr) }</style>
<body><section><div class="g">a</div></section></body>`;
  assert.equal(rules(three).includes("css-grid-fixed-columns"), true);
});

test("hex outside :root is reported as the design system fragmenting", () => {
  const html = `<style>:root { --primary: #1f5f4b } .card { color: #ABC123 }</style>
<body><section>a</section></body>`;
  assert.deepEqual(analyze(html).tokens.hexOutsideRoot, ["#abc123"]);
});

test("the flattening table's anti-patterns are flagged against the document", () => {
  const html = `<style>.x { position: absolute } .y { clip-path: circle(50%) }</style>
<body><section>a</section></body>`;
  const rules = analyze(html).flags.map((f) => f.rule);
  assert.equal(rules.includes("absolute-position"), true);
  assert.equal(rules.includes("clip-path"), true);
});

test("output is deterministic and carries no timestamp", () => {
  assert.equal(serialize(analyze(design)), serialize(analyze(design)));
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(serialize(analyze(design))), false);
});

test("--check passes on a written file and fails once it is stale", () => {
  const dir = mkdtempSync(join(tmpdir(), "analyze-"));
  const out = join(dir, "design-analysis.json");

  assert.equal(runCli(["--input", designPath, "--out", out]).status, 0);
  assert.equal(runCli(["--input", designPath, "--out", out, "--check"]).status, 0);

  writeFileSync(out, serialize({ source: "design.html", tokens: {}, regions: [], flags: [] }));
  const stale = runCli(["--input", designPath, "--out", out, "--check"]);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /out of date/);
});

test("--check without --out is refused rather than silently passing", () => {
  const result = runCli(["--input", designPath, "--check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--check needs --out/);
});
