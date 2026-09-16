import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm, symlink, utimes } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { inspectDriverSession, listDriverSessions } from "../src/driver/source.js";

async function session(root: string, id: string, metadata: Record<string, unknown> = {}, time = 1000): Promise<string> {
  const directory = path.join(root, id);
  await mkdir(directory);
  const files = [
    ["workspace.yaml", stringify({ id, client_name: "vscode-agent-host", name: id, user_named: true, cwd: "/project", ...metadata })],
    ["events.jsonl", JSON.stringify({ type: "session.start", data: { sessionId: id } }) + "\nNOT_PARSED_BY_HOST"],
  ];
  for (const [name, content] of files) {
    const file = path.join(directory, name!);
    await writeFile(file, content!);
    await utimes(file, time, time);
  }
  return directory;
}

test("all local Copilot sessions are listed across clients and projects without log ingestion", async () => {
  const root = await mkdtemp(path.resolve(".driver-sessions-"));
  try {
    await session(root, "old-project", { name: "Older project session" }, 1000);
    const active = await session(root, "active-project", { name: "A title: with\nmultiple lines", cwd: "/project/src" }, 500);
    await utimes(path.join(active, "events.jsonl"), 2000, 2000);
    await session(root, "other-project", { cwd: "/project-sibling" }, 3000);
    await session(root, "cli", { client_name: "github/cli" }, 4000);
    await session(root, "sdk", { client_name: "custom-sdk-client", cwd: "/another-project" }, 5000);
    await session(root, "legacy", {
      client_name: undefined, name: "", summary: "Legacy session", cwd: "/legacy-project",
    }, 6000);
    const empty = await session(root, "empty", { name: "", summary: "", cwd: "/unstarted-project" }, 7000);
    await rm(path.join(empty, "events.jsonl"));
    const result = await listDriverSessions(root);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.sessions.map(item => item.sessionId),
      ["empty", "legacy", "sdk", "cli", "other-project", "active-project", "old-project"]);
    assert.equal(result.sessions[5]?.title, "A title: with\nmultiple lines");
    assert.equal(result.sessions[5]?.modifiedTime, 2_000_000);
    assert.equal(result.sessions[5]?.directory, active);
    assert.equal(result.sessions.find(item => item.sessionId === "legacy")?.title, "Legacy session");
    assert.equal(result.sessions.find(item => item.sessionId === "empty")?.title, "empty");
    assert.equal(result.sessions.find(item => item.sessionId === "empty")?.hasEvents, false);
    assert.equal(result.sessions.find(item => item.sessionId === "cli")?.hasEvents, true);
    assert.deepEqual(await listDriverSessions(path.join(root, "missing")), { sessions: [], failures: [] });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("selecting a session revalidates its identity and authorizes its directory, not only events.jsonl", async () => {
  const root = await mkdtemp(path.resolve(".driver-selection-"));
  try {
    const directory = await session(root, "driver-one", { name: "Selected title" });
    await mkdir(path.join(directory, "files"));
    await writeFile(path.join(directory, "files", "artifact.custom"), "SYNTHETIC_ARTIFACT");
    assert.deepEqual(await inspectDriverSession(root, "driver-one"), {
      directory, sessionId: "driver-one", title: "Selected title",
    });
    const events = path.join(directory, "events.jsonl");
    for (const content of [
      '{"type":"session.start"',
      '{"type":"session.start","data":{"sessionId":"wrong"}}\n',
      '{"type":"session.start","sessionId":"wrong","data":{"sessionId":"driver-one"}}\n',
    ]) {
      await writeFile(events, content);
      await assert.rejects(inspectDriverSession(root, "driver-one"), /DRIVER_SESSION_HEADER_INVALID/);
    }
    const cli = await session(root, "cli", { client_name: "github/cli" });
    assert.deepEqual(await inspectDriverSession(root, "cli"), { directory: cli, sessionId: "cli", title: "cli" });
    const legacy = await session(root, "legacy", { client_name: undefined });
    assert.deepEqual(await inspectDriverSession(root, "legacy"), { directory: legacy, sessionId: "legacy", title: "legacy" });
    await assert.rejects(inspectDriverSession(root, "../driver-one"), /DRIVER_SESSION_ID_INVALID/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("sessions without conversation records remain discoverable but cannot connect until ready", async () => {
  const root = await mkdtemp(path.resolve(".driver-unstarted-"));
  try {
    const missing = await session(root, "missing-log");
    const empty = await session(root, "empty-log");
    await rm(path.join(missing, "events.jsonl"));
    await writeFile(path.join(empty, "events.jsonl"), "");
    const result = await listDriverSessions(root);
    assert.deepEqual(new Set(result.sessions.map(item => item.sessionId)), new Set(["missing-log", "empty-log"]));
    assert.ok(result.sessions.every(item => !item.hasEvents));
    assert.deepEqual(result.failures, []);
    await assert.rejects(inspectDriverSession(root, "missing-log"), /DRIVER_SESSION_NOT_READY/);
    await assert.rejects(inspectDriverSession(root, "empty-log"), /DRIVER_SESSION_NOT_READY/);
    await writeFile(path.join(missing, "events.jsonl"),
      JSON.stringify({ type: "session.start", data: { sessionId: "missing-log" } }) + "\n");
    assert.equal((await inspectDriverSession(root, "missing-log")).sessionId, "missing-log");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("invalid metadata and unsafe session paths are reported instead of silently disappearing", async () => {
  const root = await mkdtemp(path.resolve(".driver-discovery-failures-"));
  try {
    await session(root, "valid");
    await session(root, "mismatch", { id: "different" });
    const broken = await session(root, "broken");
    await writeFile(path.join(broken, "workspace.yaml"), "id: [broken");
    const oversized = await session(root, "oversized");
    await writeFile(path.join(oversized, "workspace.yaml"), "x".repeat(65_537));
    const duplicate = await session(root, "duplicate");
    await writeFile(path.join(duplicate, "workspace.yaml"), "id: duplicate\nid: replacement\n");
    await symlink(path.join(root, "valid"), path.join(root, "linked"));
    const result = await listDriverSessions(root);
    assert.deepEqual(result.sessions.map(item => item.sessionId), ["valid"]);
    assert.deepEqual(new Map(result.failures.map(item => [item.sessionId, item.code])), new Map([
      ["mismatch", "DRIVER_SESSION_ID_MISMATCH"],
      ["broken", "DRIVER_SESSION_METADATA_INVALID"],
      ["oversized", "DRIVER_SESSION_METADATA_TOO_LARGE"],
      ["duplicate", "DRIVER_SESSION_METADATA_INVALID"],
      ["linked", "DRIVER_SESSION_DIRECTORY_REQUIRED"],
    ]));
    await assert.rejects(inspectDriverSession(root, "linked"), /DRIVER_SESSION_DIRECTORY_REQUIRED/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a session cannot connect through symlinked metadata or a replaced event file", async () => {
  const root = await mkdtemp(path.resolve(".driver-session-files-"));
  try {
    const first = await session(root, "first");
    const second = await session(root, "second");
    const metadata = path.join(first, "workspace.yaml");
    await rm(metadata);
    await symlink(path.join(second, "workspace.yaml"), metadata);
    await assert.rejects(inspectDriverSession(root, "first"), /DRIVER_SESSION_FILE_REQUIRED/);
    await rm(metadata);
    await writeFile(metadata, stringify({ id: "first", client_name: "vscode-agent-host", cwd: "/project" }));
    const events = path.join(first, "events.jsonl");
    await rm(events);
    await symlink(path.join(second, "events.jsonl"), events);
    await assert.rejects(inspectDriverSession(root, "first"), /DRIVER_SESSION_FILE_REQUIRED/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
