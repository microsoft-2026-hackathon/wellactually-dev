import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillNames = [
  "application-foundations", "debugging-and-verification",
  "distributed-systems", "engineering-decisions",
];

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), "wellactually-package-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const target = join(root, "plugin");
  for (const directory of [".github/agents", ".github/instructions", ".github/skills", "packaging"]) {
    cpSync(join(repositoryRoot, directory), join(source, directory), { recursive: true });
  }
  mkdirSync(join(source, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts/package-plugin.mjs"), join(source, "scripts/package-plugin.mjs"));
  return { root, source, target };
}

function packageInto(source, target) {
  return spawnSync(process.execPath, [join(source, "scripts/package-plugin.mjs"), target], {
    encoding: "utf8",
  });
}

function filesAt(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = join(prefix, entry.name);
    return entry.isDirectory() ? filesAt(root, name) : [name];
  }).sort();
}

function snapshot(root) {
  return Object.fromEntries(filesAt(root).map((name) => [name, readFileSync(join(root, name))]));
}

test("packages four discoverable skills and twelve references without changing bytes", (context) => {
  const { source, target } = fixture(context);
  const result = packageInto(source, target);
  assert.equal(result.status, 0, result.stderr);
  const sourceSkills = join(source, ".github/skills");
  assert.deepEqual(readdirSync(join(target, "skills")).sort(), skillNames);
  assert.deepEqual(snapshot(join(target, "skills")), snapshot(sourceSkills));
  assert.equal(filesAt(sourceSkills).filter((name) => name.includes("references/")).length, 12);
  for (const name of skillNames) {
    const content = readFileSync(join(sourceSkills, name, "SKILL.md"), "utf8");
    assert.ok(content.startsWith(`---\nname: ${name}\n`));
    assert.match(content, /^description: "[^\n]+"$/m);
    assert.match(content, /^user-invocable: false$/m);
    assert.match(content, /^disable-model-invocation: false$/m);
  }
  const agents = join(target, "com.github.copilot/agents");
  assert.equal(readdirSync(agents).length, 5);
  assert.deepEqual(readdirSync(join(target, "agents")).sort(), readdirSync(agents).sort());
  for (const name of readdirSync(agents)) {
    const original = readFileSync(join(source, ".github/agents", name), "utf8");
    assert.equal(readFileSync(join(agents, name), "utf8"), original.replaceAll(
      "../instructions/wellactually-navigator.instructions.md",
      "../rules/wellactually-navigator.instructions.md",
    ));
    assert.equal(readFileSync(join(target, "agents", name), "utf8"), original.replaceAll(
      "../instructions/wellactually-navigator.instructions.md",
      "../com.github.copilot/rules/wellactually-navigator.instructions.md",
    ));
  }
  assert.equal(JSON.parse(readFileSync(join(target, "plugin.json"), "utf8")).name, "wellactually");
  for (const name of ["README.md", "plugin.json"]) {
    assert.deepEqual(readFileSync(join(target, name)), readFileSync(join(source, "packaging", name)));
  }
});

test("repeat packaging is content-stable and cleans owned stale files only", (context) => {
  const { source, target } = fixture(context);
  assert.equal(packageInto(source, target).status, 0);
  mkdirSync(join(target, ".git"));
  writeFileSync(join(target, ".git/config"), "preserve git metadata");
  writeFileSync(join(target, "release-notes.md"), "preserve unmanaged file");
  const before = snapshot(target);
  assert.equal(packageInto(source, target).status, 0);
  assert.deepEqual(snapshot(target), before);
  writeFileSync(join(target, "skills/distributed-systems/references/stale.md"), "stale");
  writeFileSync(join(target, "agents/stale.agent.md"), "stale");
  rmSync(join(source, ".github/skills/engineering-decisions"), { recursive: true });
  const result = packageInto(source, target);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, "skills/engineering-decisions")), false);
  assert.equal(existsSync(join(target, "skills/distributed-systems/references/stale.md")), false);
  assert.equal(existsSync(join(target, "agents/stale.agent.md")), false);
  assert.equal(readFileSync(join(target, ".git/config"), "utf8"), "preserve git metadata");
  assert.equal(readFileSync(join(target, "release-notes.md"), "utf8"), "preserve unmanaged file");
});

test("rejects missing skill entrypoints and broken nested references", (context) => {
  const { source, target } = fixture(context);
  const skill = join(source, ".github/skills/engineering-decisions/SKILL.md");
  const original = readFileSync(skill, "utf8");
  rmSync(skill);
  let result = packageInto(source, target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing SKILL\.md/);
  writeFileSync(skill, original);
  writeFileSync(join(source, ".github/skills/engineering-decisions/references/broken.md"),
    "[Missing](./missing.md)\n");
  result = packageInto(source, target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken reference: .\/missing\.md/);
});

test("rejects output overlapping the source, including aliases", (context) => {
  const { root, source } = fixture(context);
  const alias = join(root, "source-alias");
  symlinkSync(source, alias, "dir");
  for (const target of [source, join(source, ".github"), join(source, "new/output"), root, alias]) {
    const result = packageInto(source, target);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not overlap/);
  }
  assert.ok(existsSync(join(source, ".github/skills/engineering-decisions/SKILL.md")));
});

test("Copilot SDK discovers all five packaged agents", {
  skip: !process.env.WELLACTUALLY_COPILOT_SDK,
}, (context) => {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 22,
    "The optional SDK check requires Node 22+ or the VS Code Node runtime.");
  const { root, source, target } = fixture(context);
  const packaged = packageInto(source, target);
  assert.equal(packaged.status, 0, packaged.stderr);
  const workspace = join(root, "workspace");
  const home = join(root, "home");
  mkdirSync(workspace);
  mkdirSync(home);
  const probe = `
    import { pathToFileURL } from "node:url";
    const [sdkPath, workspace, home, pluginPath] = process.argv.slice(1);
    const { getCustomAgents } = await import(pathToFileURL(sdkPath).href);
    const logger = { debug() {}, info() {}, warning() {}, error() {} };
    const agents = await getCustomAgents(undefined, workspace, undefined, logger,
      { configDir: home }, [{ name: "wellactually", marketplace: "_direct",
        enabled: true, cache_path: pluginPath }]);
    console.log(JSON.stringify(agents.map(agent => ({
      name: agent.name, displayName: agent.displayName, path: agent.path,
    }))));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe,
    resolve(process.env.WELLACTUALLY_COPILOT_SDK), workspace, home, target], {
    cwd: workspace,
    env: { PATH: process.env.PATH, HOME: home, COPILOT_HOME: home, TMPDIR: tmpdir(),
      ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const agents = JSON.parse(result.stdout.trim());
  const expectedNames = ["Wellactually Advanced", "Wellactually Beginner", "Wellactually Driver",
    "Wellactually Easy", "Wellactually Intermediate"];
  assert.deepEqual(agents.map(agent => agent.displayName).sort(), expectedNames,
    `SDK discovered: ${JSON.stringify(agents)}`);
});