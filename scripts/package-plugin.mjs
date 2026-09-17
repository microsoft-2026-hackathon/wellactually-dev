#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const targetArgument = process.argv[2];

if (!targetArgument) {
  console.error("Usage: node scripts/package-plugin.mjs <target-directory>");
  process.exit(1);
}

function canonicalPath(filePath) {
  if (existsSync(filePath)) return realpathSync(filePath);
  return join(canonicalPath(dirname(filePath)), basename(filePath));
}

function containsPath(parent, child) {
  const difference = relative(parent, child);
  return difference === "" ||
    (!isAbsolute(difference) && difference !== ".." && !difference.startsWith(`..${sep}`));
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

const targetRoot = canonicalPath(resolve(process.cwd(), targetArgument));
if (containsPath(repositoryRoot, targetRoot) || containsPath(targetRoot, repositoryRoot)) {
  console.error("The target directory must not overlap wellactually-dev.");
  process.exit(1);
}

const sourceAgentRoot = join(repositoryRoot, ".github", "agents");
const sourceSkillRoot = join(repositoryRoot, ".github", "skills");
const sourceInstruction = join(
  repositoryRoot,
  ".github",
  "instructions",
  "wellactually-navigator.instructions.md",
);
const targetCopilotRoot = join(targetRoot, "com.github.copilot");
const targetAgentRoot = join(targetCopilotRoot, "agents");
const targetLegacyAgentRoot = join(targetRoot, "agents");
const targetRuleRoot = join(targetCopilotRoot, "rules");
const targetSkillRoot = join(targetRoot, "skills");
const skillNames = readdirSync(sourceSkillRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const skillName of skillNames) {
  if (!existsSync(join(sourceSkillRoot, skillName, "SKILL.md"))) {
    console.error(`${skillName} is missing SKILL.md`);
    process.exit(1);
  }
}

mkdirSync(targetRoot, { recursive: true });
rmSync(targetCopilotRoot, { recursive: true, force: true });
rmSync(targetLegacyAgentRoot, { recursive: true, force: true });
rmSync(targetSkillRoot, { recursive: true, force: true });
mkdirSync(targetAgentRoot, { recursive: true });
mkdirSync(targetLegacyAgentRoot, { recursive: true });
mkdirSync(targetRuleRoot, { recursive: true });
mkdirSync(targetSkillRoot, { recursive: true });

for (const skillName of skillNames) {
  cpSync(join(sourceSkillRoot, skillName), join(targetSkillRoot, skillName), { recursive: true });
}

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
  writeFileSync(join(targetLegacyAgentRoot, fileName), source.replaceAll(
    "../instructions/wellactually-navigator.instructions.md",
    "../com.github.copilot/rules/wellactually-navigator.instructions.md",
  ));
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

for (const filePath of [...markdownFiles(targetCopilotRoot), ...markdownFiles(targetLegacyAgentRoot),
  ...markdownFiles(targetSkillRoot)]) {
  const content = readFileSync(filePath, "utf8");
  for (const match of content.matchAll(/\]\((\.{1,2}\/[^)]+)\)/g)) {
    const destination = resolve(dirname(filePath), match[1].split("#")[0]);
    if (!containsPath(targetRoot, destination) || !existsSync(destination)) {
      failures.push(`${relative(targetRoot, filePath)} has a broken reference: ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Packaged Wellactually ${manifest.version} with ${packagedAgents.length} agents and ${skillNames.length} skills to ${targetRoot}`);
