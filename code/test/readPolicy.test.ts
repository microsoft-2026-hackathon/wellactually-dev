import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PermissionRequest } from "@github/copilot-sdk";
import { boundedToolText, canonicalPathAllowed, createReadPolicy } from "../src/runtime/readPolicy.js";

test("the complete project tree permits directory listings, hidden files and arbitrary extensions", async () => {
  const root = await mkdtemp(path.resolve(".complete-project-"));
  try {
    await mkdir(path.join(root, ".git"));
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, ".env"), "SYNTHETIC_ONLY");
    await writeFile(path.join(root, ".git", "config"), "SYNTHETIC_ONLY");
    await writeFile(path.join(root, "node_modules", "entry.custom"), "SYNTHETIC_ONLY");
    const policy = await createReadPolicy(root);
    for (const target of [root, ".git", ".env", ".git/config", "node_modules/entry.custom"]) {
      const result = await policy.hooks.onPreToolUse!({
        toolName: "view", toolArgs: { path: target }, sessionId: "coach",
        timestamp: new Date(), workingDirectory: root,
      }, { sessionId: "coach" });
      assert.equal(result?.permissionDecision, "allow", target);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the entire selected session tree is authorized and its extra access is revoked on reconnect", async () => {
  const directory = await mkdtemp(path.resolve(".read-policy-"));
  try {
    const root = path.join(directory, "project");
    const logs = path.join(directory, ".copilot", "session-state");
    await mkdir(root);
    await mkdir(logs, { recursive: true });
    const firstDirectory = path.join(logs, "driver-1");
    const secondDirectory = path.join(logs, "driver-2");
    await mkdir(path.join(firstDirectory, "files"), { recursive: true });
    await mkdir(secondDirectory);
    const first = path.join(firstDirectory, "events.jsonl");
    const second = path.join(secondDirectory, "events.jsonl");
    const artifact = path.join(firstDirectory, "files", "artifact.custom");
    await writeFile(first, '{"text":"synthetic"}\n'.repeat(10_000));
    await writeFile(second, '{"text":"second"}\n');
    await writeFile(artifact, "SYNTHETIC_ARTIFACT");
    await writeFile(path.join(firstDirectory, ".env"), "SYNTHETIC_ONLY");
    const policy = await createReadPolicy(root);
    const invoke = (toolName: string, toolArgs: unknown) => policy.hooks.onPreToolUse!({
      toolName, toolArgs, sessionId: "coach", timestamp: new Date(), workingDirectory: root,
    }, { sessionId: "coach" });
    assert.equal((await invoke("view", { path: first }))?.permissionDecision, "deny");
    await policy.setDriver({ directory: firstDirectory, sessionId: "driver-1", title: "First" });
    const result = await invoke("view", { path: first, view_range: [9_000, 9_010] });
    assert.equal(result?.permissionDecision, "allow");
    assert.deepEqual(result?.modifiedArgs, { path: first, view_range: [9_000, 9_010], forceReadLargeFiles: true });
    assert.equal((await invoke("view", { path: first, view_range: [1, -1] }))?.permissionDecision, "deny");
    assert.equal((await invoke("view", { path: second }))?.permissionDecision, "deny");
    assert.equal((await invoke("grep", { pattern: "text", paths: logs }))?.permissionDecision, "deny");
    for (const target of [firstDirectory, artifact, path.join(firstDirectory, ".env")]) {
      assert.equal((await invoke("view", { path: target }))?.permissionDecision, "allow", target);
    }
    assert.equal((await invoke("grep", { pattern: "text", paths: firstDirectory }))?.permissionDecision, "allow");
    assert.equal((await invoke("grep", { pattern: "text", paths: first }))?.permissionDecision, "allow");
    await policy.setDriver({ directory: secondDirectory, sessionId: "driver-2", title: "Second" });
    assert.equal((await invoke("view", { path: first }))?.permissionDecision, "deny");
    assert.equal((await invoke("view", { path: artifact }))?.permissionDecision, "deny");
    assert.equal((await invoke("view", { path: firstDirectory }))?.permissionDecision, "deny");
    assert.equal((await invoke("view", { path: second }))?.permissionDecision, "allow");
    await policy.setDriver(null);
    assert.equal((await invoke("view", { path: second }))?.permissionDecision, "deny");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("path boundaries constrain symlinks and permission escalation, not filenames or directory searches", async () => {
  const directory = await mkdtemp(path.resolve(".read-restrictions-"));
  try {
    const root = path.join(directory, "project");
    await mkdir(root);
    await writeFile(path.join(root, "safe.ts"), "export const allowed = true;");
    await writeFile(path.join(root, ".env"), "SYNTHETIC_SECRET");
    await writeFile(path.join(root, "privatekey"), "SYNTHETIC_KEY");
    await writeFile(path.join(root, "key.pem"), "SYNTHETIC_KEY");
    await writeFile(path.join(directory, "outside.ts"), "SYNTHETIC_OUTSIDE");
    await symlink(path.join(directory, "outside.ts"), path.join(root, "escape.ts"));
    await symlink(path.join(root, "safe.ts"), path.join(root, "inside.ts"));
    const policy = await createReadPolicy(root);
    const invoke = (toolName: string, toolArgs: unknown) => policy.hooks.onPreToolUse!({
      toolName, toolArgs, sessionId: "coach", timestamp: new Date(), workingDirectory: root,
    }, { sessionId: "coach" });
    for (const target of ["escape.ts", "../outside.ts"]) {
      assert.equal((await invoke("view", { path: target }))?.permissionDecision, "deny", target);
    }
    for (const target of [".env", "privatekey", "key.pem", "inside.ts", "."]) {
      assert.equal((await invoke("view", { path: target }))?.permissionDecision, "allow", target);
    }
    assert.equal((await invoke("bash", { command: "true" }))?.permissionDecision, "deny");
    const search = await invoke("grep", { pattern: ".", paths: root, head_limit: 999_999 });
    assert.deepEqual((search?.modifiedArgs as { paths: string[] }).paths, [root]);
    assert.equal((search?.modifiedArgs as { head_limit: number }).head_limit, 100);
    assert.equal((search?.modifiedArgs as { glob: string }).glob, "**");
    assert.equal((await invoke("grep", { pattern: ".", paths: root, follow: true }))?.permissionDecision, "deny");
    for (const view_range of [[1, -1], [0, 10], [1, 201], [1, 1.5]]) {
      assert.equal((await invoke("view", { path: "safe.ts", view_range }))?.permissionDecision, "deny");
    }
    for (const request of [
      { kind: "read", path: path.join(root, "escape.ts") },
      { kind: "read", path: path.join(root, "safe.ts"), requestSandboxBypass: true },
      { kind: "read", path: path.join(root, "safe.ts"), managedApprovalRequired: true },
      { kind: "shell", fullCommandText: "true" },
      { kind: "write", fileName: path.join(root, "safe.ts") },
      { kind: "future-permission", path: root },
    ]) {
      assert.equal((await policy.onPermissionRequest(request as unknown as PermissionRequest, { sessionId: "coach" })).kind, "reject");
    }
    assert.equal(canonicalPathAllowed(root, `${root}-sibling/a.ts`), false);
    assert.equal(canonicalPathAllowed(root, path.join(root, "safe.ts")), true);
    for (const target of [root, path.join(root, ".env"), path.join(root, "inside.ts")]) {
      assert.equal((await policy.onPermissionRequest({
        kind: "read", path: target, intention: "Read the approved project",
      }, { sessionId: "coach" })).kind, "approved");
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("access is the union of both roots, with no broad parent-directory Driver grant", async () => {
  const root = await mkdtemp(path.resolve(".root-union-"));
  try {
    const directory = path.join(root, "driver");
    await mkdir(directory);
    await writeFile(path.join(directory, "artifact"), "SYNTHETIC");
    const policy = await createReadPolicy(root);
    await policy.setDriver({ directory, sessionId: "driver", title: "Nested session" });
    await policy.setDriver(null);
    assert.deepEqual(await policy.sourceFiles("view", { path: path.join(directory, "artifact") }),
      [path.join(directory, "artifact")]);
    await assert.rejects(policy.setDriver({ directory: root, sessionId: "driver", title: "Too broad" }), /READ_DRIVER_INVALID/);
    assert.equal(policy.driver, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("ordinary Chat shares only its transcript and session-specific editing tree, never sibling chats or indexes", async () => {
  const base = await mkdtemp(path.resolve(".chat-policy-"));
  try {
    const root = path.join(base, "project");
    const store = path.join(base, "workspaceStorage", "workspace");
    const records = path.join(store, "chatSessions");
    const editing = path.join(store, "chatEditingSessions");
    const artifacts = path.join(editing, "chosen");
    await mkdir(root);
    await mkdir(records, { recursive: true });
    await mkdir(artifacts, { recursive: true });
    await mkdir(path.join(editing, "sibling"));
    const file = path.join(records, "chosen.jsonl");
    const sibling = path.join(records, "sibling.jsonl");
    await writeFile(file, "SYNTHETIC_CHAT");
    await writeFile(sibling, "SYNTHETIC_SIBLING");
    await writeFile(path.join(artifacts, "state.json"), "{}");
    await writeFile(path.join(store, "state.vscdb"), "SYNTHETIC_INDEX");
    await symlink(sibling, path.join(artifacts, "escape"));
    const policy = await createReadPolicy(root);
    await policy.setDriver({ kind: "vscode-chat", file, artifactsDirectory: artifacts, sessionId: "chosen", title: "Chosen" });
    for (const allowed of [root, file, artifacts, path.join(artifacts, "state.json")]) {
      assert.deepEqual(await policy.sourceFiles("view", { path: allowed }), [allowed]);
    }
    assert.deepEqual(await policy.sourceFiles("grep", { pattern: ".", paths: [file, artifacts] }), [file, artifacts]);
    for (const denied of [store, records, editing, sibling, path.join(editing, "sibling"),
      path.join(store, "state.vscdb"), path.join(artifacts, "escape")]) {
      await assert.rejects(policy.sourceFiles("view", { path: denied }), /READ_PATH_DENIED/);
    }
    await assert.rejects(policy.setDriver({
      kind: "vscode-chat", file, artifactsDirectory: editing, sessionId: "chosen", title: "Invalid",
    }), /READ_DRIVER_INVALID/);
    await policy.setDriver({ kind: "vscode-chat", file: sibling, sessionId: "sibling", title: "Next" });
    await assert.rejects(policy.sourceFiles("view", { path: file }), /READ_PATH_DENIED/);
    await assert.rejects(policy.sourceFiles("view", { path: artifacts }), /READ_PATH_DENIED/);
    await policy.setDriver(null);
    await assert.rejects(policy.sourceFiles("view", { path: sibling }), /READ_PATH_DENIED/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("bounded tool text preserves multibyte characters and discloses truncation", () => {
  const original = "가🙂".repeat(5_000);
  const result = boundedToolText(original);
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.text) <= 12_000);
  assert.equal(result.text.includes("\uFFFD"), false);
  assert.deepEqual(boundedToolText("small"), { text: "small", truncated: false });
});
