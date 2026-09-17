import { randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function assertDirectory(path) {
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new Error("Knowledge destination must use real directories, not links.");
  }
}

export function selectWorkspace(roots, workspaceUri) {
  const candidates = roots.filter((root) => {
    try {
      const uri = new URL(root.uri);
      return uri.protocol === "file:" && !uri.search && !uri.hash;
    } catch {
      return false;
    }
  });
  const selected = workspaceUri
    ? candidates.find((root) => root.uri === workspaceUri)
    : candidates.length === 1 ? candidates[0] : undefined;
  if (!selected) throw new Error("Select an exact client workspace root; no unambiguous workspace is available.");
  const path = fileURLToPath(selected.uri);
  assertDirectory(path);
  return { uri: selected.uri, path: realpathSync(path) };
}

export function planArticle(input, roots) {
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 200
      || /[\r\n\u0000-\u001f]/.test(input.title)
      || typeof input.markdown !== "string" || !input.markdown.trim()
      || Buffer.byteLength(input.markdown, "utf8") > 200_000
      || !Array.isArray(input.tags) || input.tags.length > 10
      || input.tags.some((tag) => typeof tag !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(tag))) {
    throw new Error("Provide a title, Markdown body (up to 200 KB), and up to ten lowercase ASCII tags.");
  }
  const workspace = selectWorkspace(roots, input.workspaceUri);
  const date = new Date().toISOString().slice(0, 10);
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "knowledge";
  const filename = `${date}-${slug}-${randomUUID()}.md`;
  const directory = join(workspace.path, ".wellactually", "knowledge");
  for (const path of [join(workspace.path, ".wellactually"), directory]) {
    try { assertDirectory(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return {
    workspace,
    path: join(directory, filename),
    content: `---\ntitle: ${JSON.stringify(input.title)}\ndate: ${JSON.stringify(date)}\ntags: ${JSON.stringify(input.tags)}\n---\n\n${input.markdown.trim()}\n`,
  };
}

export function createArticle(plan) {
  assertDirectory(fileURLToPath(plan.workspace.uri));
  if (realpathSync(fileURLToPath(plan.workspace.uri)) !== plan.workspace.path) {
    throw new Error("Workspace changed while awaiting approval.");
  }
  for (const path of [join(plan.workspace.path, ".wellactually"), join(plan.workspace.path, ".wellactually", "knowledge")]) {
    try { mkdirSync(path); } catch (error) { if (error.code !== "EEXIST") throw error; }
    assertDirectory(path);
    if (realpathSync(path) !== path) throw new Error("Knowledge directory changed or contains a link.");
  }
  const descriptor = openSync(plan.path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    if (!fstatSync(descriptor).isFile()) throw new Error("Knowledge destination is not a regular file.");
    writeFileSync(descriptor, plan.content, "utf8");
  } finally {
    closeSync(descriptor);
  }
  return { uri: pathToFileURL(plan.path).href, path: plan.path };
}