import { build } from "esbuild";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["servers/knowledge/server.mjs"],
  outfile: "dist/knowledge/server.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  minify: true,
  legalComments: "eof",
  metafile: true,
});
const dependencies = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const inputPath = resolve(root, input);
  if (!inputPath.split(sep).includes("node_modules")) continue;
  let directory = dirname(inputPath);
  while (directory !== dirname(directory)) {
    const manifestPath = join(directory, "package.json");
    if (existsSync(manifestPath)
        && JSON.parse(readFileSync(manifestPath, "utf8")).name) {
      dependencies.add(directory);
      break;
    }
    directory = dirname(directory);
  }
}
const notices = [...dependencies].sort().map((directory) => {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const license = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md"].find((name) => existsSync(join(directory, name)));
  if (!license) throw new Error(`Missing bundled dependency license: ${manifest.name}`);
  return `${manifest.name}@${manifest.version}\n\n${readFileSync(join(directory, license), "utf8")}`;
});
writeFileSync(join(root, "dist/knowledge/THIRD-PARTY-NOTICES.txt"), notices.join("\n\n---\n\n"));
console.log(`Bundled saveKnowledge with notices for ${dependencies.size} dependencies.`);