import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateMarkup, validateTheme, RULES } from "../tools/validate-blocks.mjs";

const themeDir = fileURLToPath(
  new URL("../examples/agency-site/expected/theme", import.meta.url)
);
const cliPath = fileURLToPath(new URL("../tools/validate-blocks.mjs", import.meta.url));
const themeJson = JSON.parse(readFileSync(new URL(`file://${themeDir}/theme.json`)));

function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

function rulesIn(findings) {
  return [...new Set(findings.map((f) => f.rule))];
}

// Each rule gets a fixture that must fail and one that must pass. The passing
// fixture has to clear every other rule too, which is the point: a rule that
// only works in isolation is not a rule.
for (const rule of RULES) {
  test(`${rule}: the failing fixture reports it`, () => {
    const result = validateMarkup(fixture(`${rule}-fail`), { themeJson, label: rule });
    const reported = rulesIn([...result.errors, ...result.warnings]);
    assert.equal(reported.includes(rule), true, `expected ${rule}, got ${reported.join(", ")}`);
  });

  test(`${rule}: the passing fixture is clean`, () => {
    const result = validateMarkup(fixture(`${rule}-pass`), { themeJson, label: rule });
    assert.deepEqual(result.errors, [], `errors: ${JSON.stringify(result.errors)}`);
    assert.deepEqual(result.warnings, [], `warnings: ${JSON.stringify(result.warnings)}`);
  });
}

test("a raw hex is caught in both the delimiter and the inline style", () => {
  const { errors } = validateMarkup(fixture("no-raw-hex-fail"), { themeJson });
  assert.equal(errors.filter((e) => e.rule === "no-raw-hex").length, 2);
});

test("soft-hyphen-hint warns rather than blocks", () => {
  const result = validateMarkup(fixture("soft-hyphen-hint-fail"), { themeJson });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings[0].rule, "soft-hyphen-hint");
});

test("a rule can be skipped per project", () => {
  const result = validateMarkup(fixture("soft-hyphen-hint-fail"), {
    themeJson,
    skip: ["soft-hyphen-hint"]
  });
  assert.deepEqual(result.warnings, []);
});

test("preset-slugs-exist degrades to a warning without a theme.json", () => {
  const result = validateMarkup(fixture("preset-slugs-exist-fail"), { themeJson: null });
  assert.deepEqual(
    result.errors.filter((e) => e.rule === "preset-slugs-exist"),
    []
  );
  assert.equal(rulesIn(result.warnings).includes("preset-slugs-exist"), true);
});

test("structural failures from the vendored parser are reported", () => {
  // style.typography.color does not exist in Gutenberg. The parser knows that,
  // and no house rule would: it is valid markup carrying a nonexistent
  // attribute, which is exactly the split between the two layers.
  const result = validateMarkup(
    '<!-- wp:paragraph {"style":{"typography":{"color":"red"}}} -->\n<p>Hei</p>\n<!-- /wp:paragraph -->',
    { themeJson }
  );
  assert.equal(rulesIn(result.errors).includes("upstream"), true);
  assert.match(result.errors[0].message, /style\.typography\.color/);
});

test("the scaffolded example theme validates", () => {
  const result = validateTheme(themeDir);
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors, null, 2));
  assert.equal(result.fileCount > 0, true);
});

test("a theme without a buildability report warns that stage 1 may be skipped", () => {
  const { warnings } = validateTheme(themeDir);
  assert.equal(rulesIn(warnings).includes("buildability-report"), true);
});

test("--report points the gate check at a report that lives elsewhere", () => {
  const report = fileURLToPath(
    new URL("../examples/agency-site/input/buildability-report.md", import.meta.url)
  );
  const { warnings } = validateTheme(themeDir, [], report);
  assert.equal(rulesIn(warnings).includes("buildability-report"), false);
});

test("the authored patterns validate, not just the scaffold", () => {
  const { errors, fileCount } = validateTheme(themeDir);
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
  assert.equal(fileCount >= 11, true, `only ${fileCount} markup files found`);
});

test("--theme exits 0 on the example and prints a summary", () => {
  const result = runCli(["--theme", themeDir]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASSED/);
});

test("--file exits 1 on a failing fixture", () => {
  const path = fileURLToPath(new URL("./fixtures/no-raw-hex-fail.html", import.meta.url));
  const result = runCli(["--file", path]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no-raw-hex/);
});

test("--json emits machine readable findings a model can act on", () => {
  const path = fileURLToPath(new URL("./fixtures/no-raw-hex-fail.html", import.meta.url));
  const result = runCli(["--file", path, "--json"]);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.errors.length > 0, true);
  assert.equal(typeof parsed.errors[0].message, "string");
  assert.equal(typeof parsed.errors[0].rule, "string");
});

test("an unknown rule id is refused rather than silently ignored", () => {
  const result = runCli(["--theme", themeDir, "--skip-rule", "no-such-rule"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown rule/);
});
