import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineeringSkillNames = [
  "application-foundations",
  "debugging-and-verification",
  "distributed-systems",
  "engineering-decisions",
];
const skillNames = [...engineeringSkillNames, "knowledge-compile"].sort();
const knowledgeSkillPath = "skills/knowledge-compile";
const rulePath = "com.github.copilot/rules/wellactually-navigator.instructions.md";

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), "wellactually-package-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  for (const directory of [".github", "packaging", "scripts", "dist/knowledge"]) {
    cpSync(join(repositoryRoot, directory), join(source, directory), { recursive: true });
  }
  const target = join(root, "plugin");
  const run = (destination = target) => spawnSync(
    process.execPath,
    [join(source, "scripts/package-plugin.mjs"), destination],
    { encoding: "utf8" },
  );
  return { root, source, target, run };
}

function filesAt(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = join(prefix, entry.name);
    return entry.isDirectory() ? filesAt(root, name) : [name];
  }).sort();
}

function snapshot(root) {
  return Object.fromEntries(filesAt(root).map((name) => [
    name,
    readFileSync(join(root, name)),
  ]));
}

function agentTools(filePath) {
  const agent = readFileSync(filePath, "utf8");
  const tools = agent.match(/^tools:\r?\n((?:[ \t]+- [^\r\n]+\r?\n)+)/m);
  assert.ok(tools, `${filePath} must have an explicit tool list`);
  return tools[1].trim().split(/\r?\n/).map((line) => line.trim().slice(2));
}

test("packages all agents, Skills, runtime resources, and relocated references", (context) => {
  const { source, target, run } = fixture(context);
  const result = run();
  assert.equal(result.status, 0, result.stderr);

  const sourceSkills = join(source, ".github/skills");
  assert.deepEqual(readdirSync(join(target, "skills")).sort(), skillNames);
  assert.deepEqual(snapshot(join(target, "skills")), snapshot(sourceSkills));
  assert.equal(filesAt(sourceSkills).filter((name) => name.includes("references/")).length, 13);
  for (const name of engineeringSkillNames) {
    const content = readFileSync(join(sourceSkills, name, "SKILL.md"), "utf8");
    assert.ok(content.startsWith(`---\nname: ${name}\n`));
    assert.match(content, /^description: "[^\n]+"$/m);
    assert.match(content, /^user-invocable: false$/m);
    assert.match(content, /^disable-model-invocation: false$/m);
  }

  const sourceAgents = join(source, ".github/agents");
  const packagedAgents = join(target, "com.github.copilot/agents");
  const legacyAgents = join(target, "agents");
  assert.equal(readdirSync(packagedAgents).length, 5);
  assert.deepEqual(readdirSync(legacyAgents).sort(), readdirSync(packagedAgents).sort());
  for (const name of readdirSync(packagedAgents)) {
    const original = readFileSync(join(sourceAgents, name), "utf8");
    assert.equal(readFileSync(join(packagedAgents, name), "utf8"), original.replaceAll(
      "../instructions/wellactually-navigator.instructions.md",
      "../rules/wellactually-navigator.instructions.md",
    ));
    assert.equal(readFileSync(join(legacyAgents, name), "utf8"), original.replaceAll(
      "../instructions/wellactually-navigator.instructions.md",
      "../com.github.copilot/rules/wellactually-navigator.instructions.md",
    ));
  }

  const expectedPairTools = [
    "read",
    "search",
    "web",
    "get_current_session",
    "create_session",
    "list_sessions",
    "get_session_context",
    "wellactually-knowledge/saveKnowledge",
  ];
  for (const name of ["beginner", "easy", "intermediate", "advanced"]) {
    assert.deepEqual(agentTools(join(sourceAgents, `${name}.agent.md`)), expectedPairTools);
    assert.deepEqual(agentTools(join(packagedAgents, `${name}.agent.md`)), expectedPairTools);
  }

  const sourceRule = readFileSync(
    join(source, ".github/instructions/wellactually-navigator.instructions.md"),
    "utf8",
  );
  assert.equal(
    readFileSync(join(target, rulePath), "utf8"),
    sourceRule.replaceAll("../skills/", "../../skills/"),
  );
  assert.match(
    readFileSync(join(target, rulePath), "utf8"),
    /\]\(\.\.\/\.\.\/skills\/knowledge-compile\/SKILL.md\)/,
  );

  const mcp = JSON.parse(readFileSync(join(target, "mcp.json"), "utf8"));
  assert.deepEqual(Object.keys(mcp.mcpServers), ["wellactually-knowledge"]);
  assert.deepEqual(mcp.mcpServers["wellactually-knowledge"], {
    type: "stdio",
    command: "node",
    args: ["${PLUGIN_ROOT}/servers/knowledge/server.cjs"],
  });
  for (const fileName of ["server.cjs", "THIRD-PARTY-NOTICES.txt"]) {
    assert.deepEqual(
      readFileSync(join(target, "servers/knowledge", fileName)),
      readFileSync(join(source, "dist/knowledge", fileName)),
    );
  }
  for (const name of ["README.md", "plugin.json"]) {
    assert.deepEqual(
      readFileSync(join(target, name)),
      readFileSync(join(source, "packaging", name)),
    );
  }
});

test("repeat packaging cleans owned resources and preserves unrelated files", (context) => {
  const { source, target, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(target);
  assert.equal(run().status, 0);
  assert.deepEqual(snapshot(target), original);

  mkdirSync(join(target, ".git"));
  writeFileSync(join(target, ".git/config"), "preserve git metadata");
  writeFileSync(join(target, "release-notes.md"), "preserve unmanaged file");
  writeFileSync(
    join(target, "skills/distributed-systems/references/stale.md"),
    "stale",
  );
  writeFileSync(join(target, knowledgeSkillPath, "obsolete.md"), "stale");
  writeFileSync(join(target, "agents/stale.agent.md"), "stale");
  mkdirSync(join(target, "skills/unrelated"));
  writeFileSync(join(target, "skills/unrelated/keep.md"), "keep");
  rmSync(join(source, ".github/skills/engineering-decisions"), { recursive: true });

  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, "skills/engineering-decisions")), false);
  assert.equal(
    existsSync(join(target, "skills/distributed-systems/references/stale.md")),
    false,
  );
  assert.equal(existsSync(join(target, knowledgeSkillPath, "obsolete.md")), false);
  assert.equal(existsSync(join(target, "agents/stale.agent.md")), false);
  assert.equal(readFileSync(join(target, "skills/unrelated/keep.md"), "utf8"), "keep");
  assert.equal(readFileSync(join(target, ".git/config"), "utf8"), "preserve git metadata");
  assert.equal(readFileSync(join(target, "release-notes.md"), "utf8"), "preserve unmanaged file");
});

test("missing Skill resources fail before changing output", (context) => {
  const { source, target, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(target);

  const skill = join(source, ".github/skills/engineering-decisions/SKILL.md");
  const content = readFileSync(skill, "utf8");
  rmSync(skill);
  assert.notEqual(run().status, 0);
  assert.deepEqual(snapshot(target), original);

  writeFileSync(skill, content);
  writeFileSync(
    join(source, ".github/skills/engineering-decisions/references/broken.md"),
    "[Missing](./missing.md)\n",
  );
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken reference: \.\/missing\.md/);
  assert.deepEqual(snapshot(target), original);
});

test("missing Knowledge guide fails before changing output", (context) => {
  const { source, target, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(target);
  rmSync(join(source, ".github", knowledgeSkillPath, "references/writing-guide.md"));
  assert.notEqual(run().status, 0);
  assert.deepEqual(snapshot(target), original);
});

test("missing runtime fails before changing output", (context) => {
  const { source, target, run } = fixture(context);
  assert.equal(run().status, 0);
  const original = snapshot(target);
  rmSync(join(source, "dist/knowledge/server.cjs"));
  assert.notEqual(run().status, 0);
  assert.deepEqual(snapshot(target), original);
});

test("rejects output overlapping the source, including aliases", (context) => {
  const { root, source, run } = fixture(context);
  const alias = join(root, "source-alias");
  symlinkSync(source, alias, "dir");
  for (const target of [source, join(source, ".github"), join(source, "new/output"), root, alias]) {
    const result = run(target);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be separate.*must not overlap/);
  }
  assert.ok(existsSync(join(source, ".github/skills/engineering-decisions/SKILL.md")));
});

test("rejects a symlink destination into source", { skip: process.platform === "win32" }, (context) => {
  const { root, source, run } = fixture(context);
  const alias = join(root, "alias");
  symlinkSync(source, alias, "dir");
  assert.notEqual(run(join(alias, "output")).status, 0);
  assert.equal(existsSync(join(source, "output")), false);
});

test("Copilot SDK discovers all five packaged agents", {
  skip: !process.env.WELLACTUALLY_COPILOT_SDK,
}, (context) => {
  assert.ok(
    Number(process.versions.node.split(".")[0]) >= 22,
    "The optional SDK check requires Node 22+ or the VS Code Node runtime.",
  );
  const { root, target, run } = fixture(context);
  const packaged = run();
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
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      probe,
      resolve(process.env.WELLACTUALLY_COPILOT_SDK),
      workspace,
      home,
      target,
    ],
    {
      cwd: workspace,
      env: {
        PATH: process.env.PATH,
        HOME: home,
        COPILOT_HOME: home,
        TMPDIR: tmpdir(),
        ELECTRON_RUN_AS_NODE: "1",
      },
      encoding: "utf8",
      timeout: 30000,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const agents = JSON.parse(result.stdout.trim());
  const expectedNames = [
    "Wellactually Advanced",
    "Wellactually Beginner",
    "Wellactually Driver",
    "Wellactually Easy",
    "Wellactually Intermediate",
  ];
  assert.deepEqual(
    agents.map((agent) => agent.displayName).sort(),
    expectedNames,
    `SDK discovered: ${JSON.stringify(agents)}`,
  );
});
