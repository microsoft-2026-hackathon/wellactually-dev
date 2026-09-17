import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, lstat, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  assertSessionTools, createIsolatedClient, createSessionWithDeadline, deadline,
  ownedRuntimeDirectory, readSessionConfig, stopClient,
} from "../src/runtime/sdkRuntime.js";

test("real SDK reads both complete trees without following links outside them or collecting logs", async t => {
  const directory = await mkdtemp(path.resolve(".sdk-paths-"));
  try {
    const root = path.join(directory, "project");
    const storage = path.join(directory, "storage");
    const logs = path.join(directory, ".copilot", "session-state");
    await mkdir(root);
    await mkdir(storage);
    await mkdir(logs, { recursive: true });
    await symlink(storage, path.join(directory, "alias"));
    const marker = path.join(storage, "host-owned.txt");
    await writeFile(marker, "HOST_OWNED");
    const firstDirectory = path.join(logs, "driver-one");
    const secondDirectory = path.join(logs, "driver-two");
    await mkdir(path.join(firstDirectory, "files"), { recursive: true });
    await mkdir(secondDirectory);
    const first = path.join(firstDirectory, "events.jsonl");
    const second = path.join(secondDirectory, "events.jsonl");
    const artifact = path.join(firstDirectory, "files", "artifact.custom");
    await writeFile(first, '{"text":"synthetic"}\n'.repeat(9_000) + '{"text":"LATE_MARKER"}\n');
    await writeFile(second, '{"text":"SECOND_MARKER"}\n');
    await writeFile(artifact, "ARTIFACT_MARKER");
    await writeFile(path.join(firstDirectory, "workspace.yaml"), "id: driver-one\n");
    await writeFile(path.join(firstDirectory, ".hidden"), "SESSION_HIDDEN_MARKER");
    await writeFile(path.join(root, "safe.ts"), "export const PROJECT_MARKER = true;\n");
    await writeFile(path.join(root, ".env"), "SYNTHETIC_HIDDEN_MARKER");
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "node_modules", "entry.custom"), "DEPENDENCY_MARKER");
    await mkdir(path.join(root, ".git"));
    await writeFile(path.join(root, ".git", "config"), "GIT_MARKER");
    await writeFile(path.join(root, ".gitignore"), "node_modules/\n");
    const outside = path.join(directory, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "OUTSIDE_FILE_MUST_NOT_APPEAR.ts"), "UNSHARED_MARKER");
    await symlink(outside, path.join(root, "escape-dir"));
    await symlink(path.join(outside, "OUTSIDE_FILE_MUST_NOT_APPEAR.ts"), path.join(root, "escape.ts"));
    await symlink(path.join(root, "safe.ts"), path.join(root, "inside.ts"));
    await mkdir(path.join(root, "many"));
    await Promise.all(Array.from({ length: 260 }, (_, index) =>
      writeFile(path.join(root, "many", `${index}.txt`), index === 259 ? "DEEP_MARKER" : "synthetic")));
    const chatRoot = path.join(directory, "workspaceStorage", "synthetic-workspace");
    const chatRecords = path.join(directory, "globalStorage", "emptyWindowChatSessions");
    const chatArtifacts = path.join(chatRoot, "chatEditingSessions", "chosen");
    await mkdir(chatRecords, { recursive: true });
    await mkdir(chatArtifacts, { recursive: true });
    const chatFile = path.join(chatRecords, "chosen.jsonl");
    const otherChat = path.join(chatRecords, "other.jsonl");
    await writeFile(chatFile, JSON.stringify({ kind: 0, v: {
      version: 3, sessionId: "chosen", requests: [{ message: "ORDINARY_CHAT_MARKER" }],
    } }) + "\n");
    await writeFile(otherChat, "UNSELECTED_CHAT_MARKER");
    await writeFile(path.join(chatArtifacts, "state.json"), '{"synthetic":"EDITING_ARTIFACT_MARKER"}');
    const client = await createIsolatedClient(path.join(directory, "alias"));
    const owned = ownedRuntimeDirectory(client);
    try {
      const auth = await client.getAuthStatus();
      t.diagnostic(`Private-base standard SDK auth available: ${auth.isAuthenticated}; no model requested.`);
      const { config, policy } = await readSessionConfig(root, owned, "gpt-5-mini");
      const session = await createSessionWithDeadline(client, config);
      try {
        await assertSessionTools(session);
        const execute = async (name: string, args: Parameters<typeof session.rpc.tools.execute>[0]["arguments"]) => {
          const result = await deadline(session.rpc.tools.execute({
            name, arguments: args, toolCallId: randomUUID(),
          }), 10_000, "PROBE_TOOL_TIMEOUT");
          assert.notEqual(typeof result, "string");
          if (typeof result === "string") throw new Error("PROBE_INVALID_RESULT");
          return result;
        };
        assert.equal((await execute("view", { path: first, view_range: [9_001, 9_001] })).resultType, "denied");
        await policy.setDriver({ directory: firstDirectory, sessionId: "driver-one", title: "First" });
        const read = await execute("view", { path: first, view_range: [9_001, 9_001] });
        assert.equal(read.resultType, "success", read.textResultForLlm);
        assert.match(read.textResultForLlm, /LATE_MARKER/);
        const search = await execute("grep", { pattern: "LATE_MARKER", paths: first, output_mode: "content" });
        assert.equal(search.resultType, "success", search.textResultForLlm);
        assert.match(search.textResultForLlm, /LATE_MARKER/);
        for (const source of [root, firstDirectory, path.join(firstDirectory, "files")]) {
          const listing = await execute("view", { path: source });
          assert.equal(listing.resultType, "success", listing.textResultForLlm);
          assert.doesNotMatch(listing.textResultForLlm, /OUTSIDE_FILE_MUST_NOT_APPEAR|UNSHARED_MARKER/);
        }
        for (const [source, marker] of [
          [artifact, "ARTIFACT_MARKER"],
          [path.join(firstDirectory, ".hidden"), "SESSION_HIDDEN_MARKER"],
          [path.join(root, ".env"), "SYNTHETIC_HIDDEN_MARKER"],
          [path.join(root, "node_modules", "entry.custom"), "DEPENDENCY_MARKER"],
          [path.join(root, ".git", "config"), "GIT_MARKER"],
          [path.join(root, "inside.ts"), "PROJECT_MARKER"],
        ]) {
          const result = await execute("view", { path: source! });
          assert.equal(result.resultType, "success", result.textResultForLlm);
          assert.ok(result.textResultForLlm?.includes(marker!), result.textResultForLlm);
        }
        const projectSearch = await execute("grep", {
          pattern: "(HIDDEN|DEPENDENCY|GIT|DEEP|UNSHARED)_MARKER", paths: root, output_mode: "content",
        });
        assert.equal(projectSearch.resultType, "success", projectSearch.textResultForLlm);
        for (const marker of ["HIDDEN_MARKER", "DEPENDENCY_MARKER", "DEEP_MARKER"]) {
          assert.ok(projectSearch.textResultForLlm?.includes(marker), projectSearch.textResultForLlm);
        }
        assert.doesNotMatch(projectSearch.textResultForLlm!, /UNSHARED_MARKER|OUTSIDE_FILE_MUST_NOT_APPEAR/);
        const gitSearch = await execute("grep", {
          pattern: "GIT_MARKER", paths: path.join(root, ".git", "config"), output_mode: "content",
        });
        assert.equal(gitSearch.resultType, "success", gitSearch.textResultForLlm);
        assert.match(gitSearch.textResultForLlm!, /GIT_MARKER/);
        const sessionSearch = await execute("grep", { pattern: "ARTIFACT_MARKER", paths: firstDirectory, output_mode: "content" });
        assert.equal(sessionSearch.resultType, "success", sessionSearch.textResultForLlm);
        assert.match(sessionSearch.textResultForLlm!, /ARTIFACT_MARKER/);
        for (const source of [logs, secondDirectory, second, path.join(root, "escape.ts"), path.join(root, "escape-dir")]) {
          assert.notEqual((await execute("view", { path: source })).resultType, "success");
        }
        await policy.setDriver({ directory: secondDirectory, sessionId: "driver-two", title: "Second" });
        for (const source of [firstDirectory, first, artifact]) {
          assert.notEqual((await execute("view", { path: source })).resultType, "success");
        }
        assert.match((await execute("view", { path: second })).textResultForLlm, /SECOND_MARKER/);
        await policy.setDriver(null);
        assert.notEqual((await execute("view", { path: second })).resultType, "success");
        await policy.setDriver({
          kind: "vscode-chat", file: chatFile, artifactsDirectory: chatArtifacts, sessionId: "chosen", title: "Synthetic Chat",
        });
        assert.match((await execute("view", { path: chatFile })).textResultForLlm, /ORDINARY_CHAT_MARKER/);
        assert.match((await execute("grep", { pattern: "ORDINARY_CHAT_MARKER", paths: chatFile, output_mode: "content" }))
          .textResultForLlm, /ORDINARY_CHAT_MARKER/);
        assert.match((await execute("view", { path: path.join(chatArtifacts, "state.json") }))
          .textResultForLlm, /EDITING_ARTIFACT_MARKER/);
        for (const denied of [chatRoot, chatRecords, otherChat, path.dirname(chatArtifacts), second]) {
          assert.notEqual((await execute("view", { path: denied })).resultType, "success", denied);
        }
        assert.notEqual((await execute("grep", { pattern: ".", paths: chatRecords })).resultType, "success");
        await policy.setDriver(null);
        assert.notEqual((await execute("view", { path: chatFile })).resultType, "success");
        assert.notEqual((await execute("view", { path: chatArtifacts })).resultType, "success");
        for (const name of ["bash", "edit", "create", "task", "skill", "web_fetch"]) {
          assert.notEqual((await execute(name, {})).resultType, "success", name);
        }
      } finally { await session.disconnect(); }
    } finally { await stopClient(client); }
    await assert.rejects(lstat(owned), { code: "ENOENT" });
    assert.equal(await readFile(marker, "utf8"), "HOST_OWNED");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
