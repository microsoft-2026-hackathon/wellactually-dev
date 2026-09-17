import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = "skills/knowledge-compile";
const rulePath = "com.github.copilot/rules/wellactually-navigator.instructions.md";

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), "wellactually-package-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  for (const directory of [".github", "packaging", "scripts"]) {
    cpSync(join(repositoryRoot, directory), join(source, directory), { recursive: true });
  }
  const output = join(root, "plugin");
  const run = (target = output) => spawnSync(process.execPath, [join(source, "scripts/package-plugin.mjs"), target], { encoding: "utf8" });
  return { root, source, output, run };
}

function snapshot(directory) {
  return Object.fromEntries(readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath ?? entry.path, entry.name);
      return [path.slice(directory.length), readFileSync(path, "utf8")];
    }));
}

test("packages five agents, Skill resources and relocated policy references", (context) => {
  const { source, output, run } = fixture(context);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const agents = readdirSync(join(output, "com.github.copilot/agents"));
  assert.equal(agents.length, 5);
  for (const name of ["SKILL.md", "references/writing-guide.md"]) {
    assert.equal(readFileSync(join(output, skillPath, name), "utf8"), readFileSync(join(source, ".github", skillPath, name), "utf8"));
  }
  assert.match(readFileSync(join(output, rulePath), "utf8"), /\]\(\.\.\/\.\.\/skills\/knowledge-compile\/SKILL.md\)/);
  assert.equal(readFileSync(join(output, "com.github.copilot/agents/wellactually-driver.agent.md"), "utf8"), readFileSync(join(source, ".github/agents/wellactually-driver.agent.md"), "utf8"));
});

test("repeat packaging removes stale owned resources but preserves unrelated skills", (context) => {
  const { output, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(output);
  writeFileSync(join(output, skillPath, "obsolete.md"), "stale");
  mkdirSync(join(output, "skills/unrelated"));
  writeFileSync(join(output, "skills/unrelated/keep.md"), "keep");
  assert.equal(run().status, 0);
  assert.equal(existsSync(join(output, skillPath, "obsolete.md")), false);
  const repeated = snapshot(output);
  const unrelated = Object.keys(repeated).find((path) => path.endsWith("keep.md"));
  assert.equal(repeated[unrelated], "keep");
  delete repeated[unrelated];
  assert.deepEqual(repeated, original);
});

test("missing guide or broken Skill reference fails before changing output", (context) => {
  const { source, output, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(output);
  rmSync(join(source, ".github", skillPath, "references/writing-guide.md"));
  assert.notEqual(run().status, 0);
  assert.deepEqual(snapshot(output), original);
});

test("rejects source, nested and ancestor destinations without modifying source", (context) => {
  const { root, source, run } = fixture(context);
  const original = snapshot(source);
  for (const target of [source, join(source, "output"), root]) {
    const result = run(target);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be separate/);
  }
  assert.deepEqual(snapshot(source), original);
});

test("rejects a symlink destination into source", { skip: process.platform === "win32" }, (context) => {
  const { root, source, run } = fixture(context);
  const alias = join(root, "alias");
  symlinkSync(source, alias, "dir");
  assert.notEqual(run(join(alias, "output")).status, 0);
  assert.equal(existsSync(join(source, "output")), false);
});