import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const skillsDir = join(root, "skills");

function skillNames() {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

test("the repo ships the three skills the README documents", () => {
  assert.deepEqual(skillNames(), [
    "gutenberg-block-authoring",
    "gutenberg-design-migration",
    "gutenberg-native-blocks"
  ]);
});

for (const skill of skillNames()) {
  test(`${skill}: frontmatter has a name matching the directory and a description`, () => {
    // Normalise first. The vendored skill arrived with CRLF, and .gitattributes
    // only fixes that on the next checkout.
    const source = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(source.startsWith("---\n"), true, "no frontmatter");

    const end = source.indexOf("\n---", 4);
    assert.equal(end > 0, true, "frontmatter is not closed");

    const frontmatter = source.slice(4, end);
    const name = frontmatter.match(/^name:\s*(.+)$/m);
    assert.equal(name?.[1].trim(), skill);

    // description is either inline or a YAML folded scalar continued on the
    // following indented lines. The vendored skill uses the folded form.
    const inline = frontmatter.match(/^description:\s*(.*)$/m);
    assert.notEqual(inline, null, "no description");

    let description = inline[1].trim();
    if (description === ">" || description === "|") {
      description = frontmatter
        .slice(inline.index + inline[0].length)
        .split("\n")
        .filter((line) => line.startsWith("  "))
        .join(" ")
        .trim();
    }

    assert.equal(description.length > 40, true, "description is too thin to trigger on");
  });
}

// The house rules apply to everything in the repo, including its own prose. The
// vendored snapshot is upstream's text and is excluded from the check.
test("no em or en dashes in anything this repo authors", () => {
  // tests/fixtures is where the failing input for the no-dashes rule lives, so
  // it is the one place the characters are supposed to appear.
  const skip = [
    "node_modules",
    ".git",
    "dist",
    "tools/vendor",
    "tests/fixtures",
    "skills/gutenberg-block-authoring"
  ];
  const EM_DASH = String.fromCodePoint(0x2014);
  const EN_DASH = String.fromCodePoint(0x2013);
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = full.slice(root.length).replace(/\\/g, "/");
      if (skip.some((s) => rel.startsWith(s))) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.(md|mjs|cjs|json|sh|html|php|yml)$/.test(entry.name)) {
        const text = readFileSync(full, "utf8");
        if (text.includes(EM_DASH) || text.includes(EN_DASH)) offenders.push(rel);
      }
    }
  };

  walk(root);
  assert.deepEqual(offenders, []);
});

// The exec bit is invisible on Windows and fatal on Linux: CI ran ./make-dist.sh
// and got "Permission denied". git tracks the mode, so assert on the mode.
test("the shell scripts are executable in git", () => {
  const listed = execFileSync("git", ["ls-files", "-s", "install.sh", "make-dist.sh"], {
    cwd: root,
    encoding: "utf8"
  });

  for (const line of listed.trim().split("\n")) {
    const [mode, , , name] = line.split(/\s+/);
    assert.equal(mode, "100755", `${name} is mode ${mode}, run: git update-index --chmod=+x ${name}`);
  }
});
