import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectChatSession, readChatIndex, readWorkspaceChats, type ChatCatalogLocation } from "../src/driver/chatCatalog.js";
import { driverPickerItem, inspectCatalogSession, listDriverCatalog } from "../src/driver/catalog.js";
import type { VscodeCatalogPaths } from "../src/driver/vscodeCatalog.js";
import { createReadPolicy } from "../src/runtime/readPolicy.js";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
function sql(file: string, command: string) {
  execFileSync("/usr/bin/sqlite3", [file, command], { stdio: "pipe" });
}

async function fixture() {
  const directory = await mkdtemp(path.resolve(".chat-catalog-"));
  const paths: VscodeCatalogPaths = {
    registry: path.join(directory, "agent-host.db"),
    sessionData: path.join(directory, "agentSessionData"),
    globalStorage: path.join(directory, "globalStorage"),
    workspaceStorage: path.join(directory, "workspaceStorage"),
  };
  await mkdir(paths.workspaceStorage);
  await mkdir(paths.globalStorage);
  async function workspace(id: string, folder: string | undefined) {
    const storageDirectory = folder === undefined ? paths.globalStorage : path.join(paths.workspaceStorage, id);
    await mkdir(storageDirectory, { recursive: true });
    if (folder) await writeFile(path.join(storageDirectory, "workspace.json"), JSON.stringify({ folder: pathToFileURL(folder).href }));
    sql(path.join(storageDirectory, "state.vscdb"), "CREATE TABLE ItemTable(key TEXT PRIMARY KEY, value TEXT); INSERT INTO ItemTable VALUES('not-the-chat-index', 'UNRELATED_PRIVATE_CONTENT');");
    const location: ChatCatalogLocation = {
      storageDirectory,
      recordsDirectory: path.join(storageDirectory, folder === undefined ? "emptyWindowChatSessions" : "chatSessions"),
      workspace: folder ?? "",
    };
    await mkdir(location.recordsDirectory);
    return location;
  }
  function index(location: ChatCatalogLocation, entries: Record<string, unknown>) {
    sql(path.join(location.storageDirectory, "state.vscdb"),
      `INSERT OR REPLACE INTO ItemTable VALUES('chat.ChatSessionStore.index', ${quote(JSON.stringify({ version: 1, entries }))});`);
  }
  function entry(id: string, title: string, modifiedTime: number) {
    return { sessionId: id, title, lastMessageDate: Math.max(0, modifiedTime - 5), timing: { created: 1, lastRequestEnded: modifiedTime } };
  }
  async function transcript(location: ChatCatalogLocation, id: string, extension = ".jsonl", content?: string) {
    const file = path.join(location.recordsDirectory, id + extension);
    const snapshot = { version: 3, sessionId: id, customTitle: "Stored old title", requests: [{ message: "BODY_NOT_A_PICKER_TITLE".repeat(6000) }] };
    await writeFile(file, content ?? (extension === ".jsonl" ? JSON.stringify({ kind: 0, v: snapshot }) + "\n" : JSON.stringify(snapshot)));
    return file;
  }
  return { directory, paths, workspace, index, entry, transcript };
}

test("ordinary Copilot Chat is discovered across every workspace and empty windows, using index titles", async () => {
  const f = await fixture();
  try {
    const research = await f.workspace("research-hash", "/workspace/research");
    const kt = await f.workspace("kt-hash", "/workspace/kt-aionet");
    const global = await f.workspace("global", undefined);
    f.index(research, { "research-chat": f.entry("research-chat", "테스트용 채팅", 500) });
    f.index(kt, { "kt-chat": f.entry("kt-chat", "Network discussion", 400) });
    f.index(global, { "empty-window": f.entry("empty-window", "Standalone discussion", 100) });
    const researchFile = await f.transcript(research, "research-chat");
    await f.transcript(kt, "kt-chat", ".json");
    await f.transcript(global, "empty-window");
    const before = await readFile(researchFile);
    const result = await listDriverCatalog([path.join(f.directory, "missing-sdk-store")], f.paths);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.sessions.map(item => item.sessionId), ["research-chat", "kt-chat", "empty-window"]);
    const items = result.sessions.map(driverPickerItem);
    assert.equal(items[0]?.label, "테스트용 채팅");
    assert.equal(items[0]?.description, "research");
    assert.match(items[0]!.detail, /VS Code Copilot Chat/);
    assert.ok(items[0]?.detail.includes("/workspace/research"));
    assert.doesNotMatch(JSON.stringify(items), /BODY_NOT_A_PICKER_TITLE|Stored old title|UNRELATED_PRIVATE_CONTENT/);
    const editing = path.join(research.storageDirectory, "chatEditingSessions", "research-chat");
    await mkdir(editing, { recursive: true });
    await writeFile(path.join(editing, "state.json"), '{"synthetic":true}');
    assert.deepEqual(await inspectCatalogSession(result.sessions[0]!, f.paths), {
      kind: "vscode-chat", file: researchFile, artifactsDirectory: editing, sessionId: "research-chat", title: "테스트용 채팅",
    });
    assert.equal((await inspectCatalogSession(result.sessions[1]!, f.paths)).kind, "vscode-chat");
    assert.deepEqual(await readFile(researchFile), before);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("new conversations and renamed titles appear on the next catalog read and deleted entries cannot connect", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    f.index(location, {});
    assert.equal((await readWorkspaceChats(f.paths)).sessions.length, 0);
    f.index(location, { fresh: f.entry("fresh", "Fresh title", 100) });
    await f.transcript(location, "fresh");
    const entry = (await readWorkspaceChats(f.paths)).sessions[0]!;
    assert.equal(entry.title, "Fresh title");
    f.index(location, { fresh: f.entry("fresh", "Renamed title", 200) });
    assert.equal((await inspectChatSession(entry)).title, "Renamed title");
    f.index(location, {});
    await assert.rejects(inspectChatSession(entry), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("empty-window Chat binds editing artifacts from its separate workspace storage without granting siblings", async () => {
  const f = await fixture();
  try {
    const global = await f.workspace("global", undefined);
    f.index(global, { standalone: f.entry("standalone", "Standalone", 10) });
    const file = await f.transcript(global, "standalone");
    const editing = path.join(f.paths.workspaceStorage, "empty-window-id", "chatEditingSessions");
    const artifacts = path.join(editing, "standalone");
    const sibling = path.join(editing, "another-session");
    await mkdir(artifacts, { recursive: true });
    await mkdir(sibling);
    await writeFile(path.join(artifacts, "state.json"), '{"synthetic":true}');
    const catalog = await listDriverCatalog([path.join(f.directory, "sdk")], f.paths);
    assert.deepEqual(catalog.failures, []);
    const selected = await inspectCatalogSession(catalog.sessions[0]!, f.paths);
    assert.deepEqual(selected, {
      kind: "vscode-chat", file, sessionId: "standalone", title: "Standalone", artifactsDirectory: artifacts,
    });
    const project = path.join(f.directory, "project");
    await mkdir(project);
    const policy = await createReadPolicy(project);
    await policy.setDriver(selected);
    assert.deepEqual(await policy.sourceFiles("view", { path: path.join(artifacts, "state.json") }),
      [path.join(artifacts, "state.json")]);
    for (const target of [editing, sibling, f.paths.workspaceStorage, path.dirname(file)]) {
      await assert.rejects(policy.sourceFiles("view", { path: target }), /READ_PATH_DENIED/);
    }
    await policy.setDriver(null);
    await assert.rejects(policy.sourceFiles("view", { path: artifacts }), /READ_PATH_DENIED/);
    const duplicate = path.join(f.paths.workspaceStorage, "other-window-id", "chatEditingSessions", "standalone");
    await mkdir(duplicate, { recursive: true });
    const refreshed = await listDriverCatalog([path.join(f.directory, "sdk")], f.paths);
    await assert.rejects(inspectCatalogSession(refreshed.sessions[0]!, f.paths), /DRIVER_CHAT_ARTIFACTS_AMBIGUOUS/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("selected Chat identity is validated before the large message body without accepting nested or wrong IDs", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    f.index(location, { chat: f.entry("chat", "Title", 1) });
    const file = await f.transcript(location, "chat");
    const entry = (await readChatIndex(location)).sessions[0]!;
    assert.equal((await inspectChatSession(entry)).sessionId, "chat");
    for (const body of [
      '{"kind":0,"v":{"sessionId":"wrong","requests":[]}}\n',
      '{"kind":1,"v":{"sessionId":"chat"}}\n',
      '{"kind":0,"v":{"requests":[{"sessionId":"chat"}]}}\n',
      '{"kind":0,/*not valid JSON*/"v":{"sessionId":"chat"}}\n',
      '{"kind":0,"v":{"sessionId":',
    ]) {
      await writeFile(file, body);
      await assert.rejects(inspectChatSession(entry), /DRIVER_CHAT_HEADER_INVALID/);
    }
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("legacy JSON identity after a large requests array is checked without a header-size false rejection", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    f.index(location, { legacy: f.entry("legacy", "Legacy discussion", 1) });
    const file = await f.transcript(location, "legacy", ".json", JSON.stringify({
      version: 3, requests: Array.from({ length: 500 }, () => ({ message: "Synthetic text".repeat(100) })),
      sessionId: "legacy",
    }));
    const entry = (await readChatIndex(location)).sessions[0]!;
    assert.equal((await inspectChatSession(entry)).sessionId, "legacy");
    await writeFile(file, JSON.stringify({ version: 3, requests: [{ sessionId: "legacy" }], sessionId: "different" }));
    await assert.rejects(inspectChatSession(entry), /DRIVER_CHAT_HEADER_INVALID/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("bad workspace indexes are reported, while missing records stay listed and unsafe paths never connect", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    const broken = await f.workspace("broken", "/broken");
    await writeFile(path.join(broken.storageDirectory, "state.vscdb"), "NOT_SQLITE");
    f.index(location, { absent: f.entry("absent", "Absent records", 2), safe: f.entry("safe", "Safe", 1) });
    const file = await f.transcript(location, "safe");
    const result = await readWorkspaceChats(f.paths);
    assert.deepEqual(new Set(result.sessions.map(item => item.sessionId)), new Set(["absent", "safe"]));
    assert.deepEqual(result.failures.map(item => item.code), ["DRIVER_CHAT_INDEX_FAILED"]);
    const absent = result.sessions.find(item => item.sessionId === "absent")!;
    assert.equal(absent.hasEvents, false);
    await assert.rejects(inspectChatSession(absent), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
    const safe = result.sessions.find(item => item.sessionId === "safe")!;
    const outside = path.join(f.directory, "outside.jsonl");
    await writeFile(outside, '{"kind":0,"v":{"sessionId":"safe"}}');
    await rm(file);
    await symlink(outside, file);
    await assert.rejects(inspectChatSession(safe), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
    assert.ok((await readChatIndex(location)).failures.some(item => item.code === "DRIVER_CHAT_PATH_INVALID"));
    f.index(location, { "../escape": f.entry("../escape", "Escape", 3) });
    assert.equal((await readChatIndex(location)).failures[0]?.code, "DRIVER_CHAT_PROVIDER_UNSUPPORTED");
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("workspace-index references to agent-host sessions enrich titles without duplicate or guessed bindings", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    const external = "agent-host-copilotcli:/visible";
    f.index(location, { [external]: { ...f.entry(external, "Indexed agent title", 5), isExternal: true } });
    sql(f.paths.registry, "CREATE TABLE sessions(session_uri TEXT, provider TEXT, start_time INTEGER, modified_time INTEGER); INSERT INTO sessions VALUES('copilotcli:/visible','copilotcli',1,2);");
    const data = path.join(f.paths.sessionData, "visible");
    await mkdir(data, { recursive: true });
    sql(path.join(data, "session.db"), "CREATE TABLE session_metadata(key TEXT PRIMARY KEY, value TEXT);");
    const result = await listDriverCatalog([path.join(f.directory, "sdk")], f.paths);
    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0]?.title, "Indexed agent title");
    assert.equal(result.sessions[0]?.origin, "vscode");
    assert.equal(result.sessions[0]?.hasEvents, false);
    await assert.rejects(inspectCatalogSession(result.sessions[0]!, f.paths), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("unsupported subchat references stay visible but never grant their parent session's access", async () => {
  const f = await fixture();
  try {
    const location = await f.workspace("workspace", "/project");
    const resource = "agent-host-copilotcli:/parent?subagentChatResource=child#subagent/child";
    f.index(location, { [resource]: { ...f.entry(resource, "Subchat title", 200), isExternal: true } });
    const result = await listDriverCatalog([path.join(f.directory, "sdk")], f.paths);
    assert.deepEqual(result.failures, []);
    assert.equal(result.sessions[0]?.title, "Subchat title");
    assert.equal(result.sessions[0]?.unavailable, true);
    await assert.rejects(inspectCatalogSession(result.sessions[0]!, f.paths), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
