#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetArgument = process.argv[2];

if (!targetArgument) {
  console.error("Usage: node scripts/package-plugin.mjs <target-directory>");
  process.exit(1);
}

const targetRoot = resolve(process.cwd(), targetArgument);
if (targetRoot === repositoryRoot) {
  console.error("The target directory must be separate from wellactually-dev.");
  process.exit(1);
}

const sourceAgentRoot = join(repositoryRoot, ".github", "agents");
const sourceInstruction = join(
  repositoryRoot,
  ".github",
  "instructions",
  "wellactually-navigator.instructions.md",
);
const targetCopilotRoot = join(targetRoot, "com.github.copilot");
const targetAgentRoot = join(targetCopilotRoot, "agents");
const targetRuleRoot = join(targetCopilotRoot, "rules");

mkdirSync(targetRoot, { recursive: true });
rmSync(targetCopilotRoot, { recursive: true, force: true });
mkdirSync(targetAgentRoot, { recursive: true });
mkdirSync(targetRuleRoot, { recursive: true });

const agentFiles = readdirSync(sourceAgentRoot)
  .filter((fileName) => fileName.endsWith(".agent.md"))
  .sort();

for (const fileName of agentFiles) {
  const source = readFileSync(join(sourceAgentRoot, fileName), "utf8");
  const packaged = source.replaceAll(
    "../instructions/wellactually-navigator.instructions.md",
    "../rules/wellactually-navigator.instructions.md",
  );
  writeFileSync(join(targetAgentRoot, fileName), packaged);
}

cpSync(
  sourceInstruction,
  join(targetRuleRoot, "wellactually-navigator.instructions.md"),
);
cpSync(join(repositoryRoot, "packaging", "plugin.json"), join(targetRoot, "plugin.json"));
cpSync(join(repositoryRoot, "packaging", "README.md"), join(targetRoot, "README.md"));

const manifest = JSON.parse(readFileSync(join(targetRoot, "plugin.json"), "utf8"));
const packagedAgents = readdirSync(targetAgentRoot).filter((fileName) =>
  fileName.endsWith(".agent.md"),
);
const failures = [];

if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
  failures.push("plugin.json does not use the Agent Plugins 1.0 schema");
}
if (manifest.name !== "wellactually") {
  failures.push("plugin.json name must be wellactually");
}
if (packagedAgents.length !== 5) {
  failures.push(`expected 5 agents, found ${packagedAgents.length}`);
}

for (const fileName of packagedAgents) {
  const content = readFileSync(join(targetAgentRoot, fileName), "utf8");
  for (const match of content.matchAll(/\]\((\.\.\/[^)]+)\)/g)) {
    if (!existsSync(resolve(targetAgentRoot, match[1]))) {
      failures.push(`${fileName} has a broken reference: ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Packaged Wellactually ${manifest.version} with ${packagedAgents.length} agents to ${targetRoot}`);
