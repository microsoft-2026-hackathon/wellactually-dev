import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createArticle, planArticle } from "./save.mjs";

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), "knowledge-save-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const workspacePath = join(root, "workspace");
  mkdirSync(workspacePath);
  const workspace = realpathSync(workspacePath);
  const roots = [{ uri: pathToFileURL(workspace).href }];
  return { root, workspace, roots };
}

const article = { title: "Why polling?", markdown: "# Polling\n\nImplementation is not yet tested.", tags: ["trade-offs"] };

test("planning is read-only; creation writes frontmatter and never overwrites", (context) => {
  const { workspace, roots } = fixture(context);
  const plan = planArticle(article, roots);
  assert.equal(existsSync(join(workspace, ".wellactually")), false);
  const saved = createArticle(plan);
  assert.equal(readFileSync(saved.path, "utf8"), plan.content);
  assert.throws(() => createArticle(plan), { code: "EEXIST" });
  assert.equal(readFileSync(saved.path, "utf8"), plan.content);
  assert.notEqual(planArticle(article, roots).path, saved.path);
});

test("rejects missing, ambiguous and arbitrary workspace roots", (context) => {
  const { roots } = fixture(context);
  assert.throws(() => planArticle(article, []), /workspace/);
  assert.throws(() => planArticle(article, [...roots, ...roots]), /workspace/);
  assert.throws(() => planArticle({ ...article, workspaceUri: "file:///outside" }, roots), /workspace/);
  assert.throws(() => planArticle(article, [{ uri: "https://example.com" }]), /workspace/);
  assert.equal(planArticle({ ...article, workspaceUri: roots[0].uri }, roots).workspace.uri, roots[0].uri);
});

test("title cannot choose a path; invalid or oversized content is rejected", (context) => {
  const { workspace, roots } = fixture(context);
  const plan = planArticle({ ...article, title: "../../escape" }, roots);
  assert.ok(plan.path.startsWith(join(workspace, ".wellactually", "knowledge") + sep));
  for (const changes of [{ title: "bad\ntitle" }, { markdown: "" }, { markdown: "x".repeat(200_001) }, { tags: ["../escape"] }]) {
    assert.throws(() => planArticle({ ...article, ...changes }, roots), /Provide/);
  }
});

test("rejects symlink or junction directories before and after planning", (context) => {
  const { root, workspace, roots } = fixture(context);
  const outside = join(root, "outside");
  mkdirSync(outside);
  const plan = planArticle(article, roots);
  symlinkSync(outside, join(workspace, ".wellactually"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => planArticle(article, roots), /links/);
  assert.throws(() => createArticle(plan), /links/);
  assert.equal(existsSync(join(outside, "knowledge")), false);
  unlinkSync(join(workspace, ".wellactually"));
  mkdirSync(join(workspace, ".wellactually"));
  symlinkSync(outside, join(workspace, ".wellactually", "knowledge"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => planArticle(article, roots), /links/);
  assert.throws(() => createArticle(plan), /links/);
});