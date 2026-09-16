import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, utimes } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { copilotSessionStores, driverPickerItem, inspectCatalogSession, listDriverCatalog } from "../src/driver/catalog.js";
import { readVscodeCatalog, vscodeCatalogPaths, type VscodeCatalogPaths } from "../src/driver/vscodeCatalog.js";

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
function sql(file: string, statement: string): void {
  execFileSync("/usr/bin/sqlite3", [file, statement], { stdio: "pipe" });
}

async function fixture() {
  const directory = await mkdtemp(path.resolve(".driver-catalog-"));
  const stores = [path.join(directory, "custom", "session-state"), path.join(directory, "home", ".copilot", "session-state")];
  const vscode: VscodeCatalogPaths = {
    registry: path.join(directory, "agent-host.db"), sessionData: path.join(directory, "agentSessionData"),
    workspaceStorage: path.join(directory, "workspaceStorage"), globalStorage: path.join(directory, "globalStorage"),
  };
  await Promise.all([...stores, vscode.sessionData].map(folder => mkdir(folder, { recursive: true })));
  sql(vscode.registry, "CREATE TABLE sessions(session_uri TEXT, provider TEXT, start_time INTEGER, modified_time INTEGER);");
  async function local(id: string, cwd: string, modified: number, metadata: Record<string, unknown> = {}, store = stores[0]!) {
    const sessionDirectory = path.join(store, id);
    await mkdir(sessionDirectory);
    const yaml = path.join(sessionDirectory, "workspace.yaml");
    const events = path.join(sessionDirectory, "events.jsonl");
    await writeFile(yaml, stringify({ id, cwd, name: "FIRST_MESSAGE_MUST_NOT_BE_A_TITLE", user_named: false, ...metadata }));
    await writeFile(events, JSON.stringify({ type: "session.start", data: { sessionId: id } }) + "\nUNREAD_BODY");
    await utimes(yaml, modified / 1000, modified / 1000);
    await utimes(events, modified / 1000, modified / 1000);
    return sessionDirectory;
  }
  async function registered(id: string, sdkId: string, title: string | undefined, modified: number, workspace = "/other") {
    const folder = path.join(vscode.sessionData, id);
    await mkdir(folder);
    const file = path.join(folder, "session.db");
    sql(file, "CREATE TABLE session_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE private_content(value TEXT); INSERT INTO private_content VALUES('DO_NOT_READ_CONVERSATION_CONTENT');");
    const values = [
      ["defaultChatProviderData", JSON.stringify({ sdkSessionId: sdkId })],
      ["copilot.workingDirectory", `file://${workspace}`],
      ...(title === undefined ? [] : [["customTitle", title]]),
    ];
    for (const [key, value] of values) {
      sql(file, `INSERT INTO session_metadata VALUES(${quote(key!)},${quote(value!)});`);
    }
    sql(vscode.registry,
      `INSERT INTO sessions VALUES(${quote(`copilotcli:/${id}`)},'copilotcli',1,${modified});`);
    return file;
  }
  return { directory, stores, vscode, local, registered };
}

test("global catalog combines VS Code registrations and both SDK stores using real titles and global recency", async () => {
  const f = await fixture();
  try {
    const backing = await f.local("sdk-main", "/hackathon", 9000);
    await f.local("other-project", "/kt-aionet", 8000, { summary: "Network design" }, f.stores[1]);
    await f.local("named-cli", "/third", 6000, { name: "User title", user_named: true, summary: "Old summary" });
    await f.local("untitled-cli", "/third", 5000);
    const metadataDb = await f.registered("visible-main", "sdk-main", "VS Code session title", 7000, "/hackathon");
    await f.registered("missing", "missing-backing", "Older registered discussion", 1000);
    const before = await readFile(metadataDb);
    const result = await listDriverCatalog(f.stores, f.vscode);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.sessions.map(item => item.sessionId),
      ["other-project", "sdk-main", "named-cli", "untitled-cli", "missing-backing"]);
    assert.equal(result.sessions[1]?.title, "VS Code session title");
    const visible = result.sessions[1];
    assert.ok(visible && visible.origin !== "vscode-chat");
    assert.equal(visible.directory, backing);
    assert.equal(visible.vscodeSessionId, "visible-main");
    assert.equal(result.sessions[1]?.modifiedTime, 7000);
    assert.equal(result.sessions[4]?.hasEvents, false);
    const items = result.sessions.map(driverPickerItem);
    assert.equal(items[0]?.label, "Network design");
    assert.equal(items[1]?.label, "VS Code session title");
    assert.equal(items[1]?.description, "hackathon");
    assert.equal(items[2]?.label, "User title");
    assert.equal(items[3]?.label, "제목 없는 세션");
    assert.ok(items[0]?.detail.includes("/kt-aionet"));
    assert.doesNotMatch(JSON.stringify(items), /FIRST_MESSAGE_MUST_NOT_BE_A_TITLE|DO_NOT_READ_CONVERSATION_CONTENT/);
    assert.deepEqual(await readFile(metadataDb), before);
    const connected = await inspectCatalogSession(result.sessions[1]!, f.vscode);
    assert.deepEqual(connected, { sessionId: "sdk-main", directory: backing, title: "VS Code session title" });
    await assert.rejects(inspectCatalogSession(result.sessions[4]!, f.vscode), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("catalog title changes are read fresh and changed backing identities are not connected", async () => {
  const f = await fixture();
  try {
    await f.local("sdk-main", "/project", 100);
    const file = await f.registered("visible-main", "sdk-main", "Original title", 200);
    const before = await listDriverCatalog(f.stores, f.vscode);
    sql(file, "UPDATE session_metadata SET value='Renamed title' WHERE key='customTitle';");
    assert.equal((await listDriverCatalog(f.stores, f.vscode)).sessions[0]?.title, "Renamed title");
    sql(file, `UPDATE session_metadata SET value=${quote(JSON.stringify({ sdkSessionId: "different" }))} WHERE key='defaultChatProviderData';`);
    await assert.rejects(inspectCatalogSession(before.sessions[0]!, f.vscode), /DRIVER_SESSION_CHANGED/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("a VS Code registration without a backing mapping cannot absorb or connect a same-ID SDK record", async () => {
  const f = await fixture();
  try {
    await f.local("same-id", "/project", 100, { summary: "Independent SDK session" });
    const file = await f.registered("same-id", "same-id", "Visible VS Code session", 200);
    const before = await listDriverCatalog(f.stores, f.vscode);
    sql(file, "DELETE FROM session_metadata WHERE key='defaultChatProviderData';");
    const result = await listDriverCatalog(f.stores, f.vscode);
    const registered = result.sessions.find(item => item.origin === "vscode")!;
    const standalone = result.sessions.find(item => item.origin === "copilot")!;
    assert.equal(result.sessions.length, 2);
    assert.equal(registered.title, "Visible VS Code session");
    assert.equal(registered.unavailable, true);
    assert.equal(registered.hasEvents, false);
    assert.equal(standalone.title, "Independent SDK session");
    assert.equal(standalone.hasEvents, true);
    await assert.rejects(inspectCatalogSession(registered, f.vscode), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
    await assert.rejects(inspectCatalogSession(before.sessions[0]!, f.vscode), /DRIVER_SESSION_CHANGED/);
    assert.equal((await inspectCatalogSession(standalone, f.vscode)).sessionId, "same-id");
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("distinct visible sessions sharing a backing source are not dropped and blank titles are not errors", async () => {
  const f = await fixture();
  try {
    await f.local("shared-sdk", "/project", 100, { summary: "SDK summary" });
    await f.registered("first-visible", "shared-sdk", "First session title", 300);
    await f.registered("second-visible", "shared-sdk", "", 200);
    const result = await listDriverCatalog(f.stores, f.vscode);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.sessions.map(item => item.origin !== "vscode-chat" ? item.vscodeSessionId : undefined),
      ["first-visible", "second-visible"]);
    assert.deepEqual(result.sessions.map(item => item.title), ["First session title", "SDK summary"]);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("missing and malformed catalogs are distinguished and never silently treated as a complete list", async () => {
  const f = await fixture();
  try {
    await f.local("local", "/project", 100);
    assert.deepEqual(await readVscodeCatalog({ ...f.vscode, registry: path.join(f.directory, "absent.db") }),
      { sessions: [], failures: [] });
    await writeFile(f.vscode.registry, "NOT_SQLITE");
    const result = await listDriverCatalog(f.stores, f.vscode);
    assert.equal(result.sessions.length, 1);
    assert.deepEqual(result.failures, [{ sessionId: "VS Code", code: "DRIVER_VSCODE_CATALOG_FAILED" }]);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("unsafe metadata paths and malformed backing IDs cannot authorize another session", async () => {
  const f = await fixture();
  try {
    const file = await f.registered("visible", "sdk-main", "Title", 100);
    sql(file, `UPDATE session_metadata SET value=${quote(JSON.stringify({ sdkSessionId: "../outside" }))} WHERE key='defaultChatProviderData';`);
    const result = await listDriverCatalog(f.stores, f.vscode);
    assert.equal(result.failures[0]?.code, "DRIVER_VSCODE_METADATA_FAILED");
    assert.equal(result.sessions[0]?.unavailable, true);
    await assert.rejects(inspectCatalogSession(result.sessions[0]!, f.vscode), /DRIVER_SESSION_SOURCE_UNAVAILABLE/);
    await rm(file);
    await symlink(f.vscode.registry, file);
    assert.equal((await readVscodeCatalog(f.vscode)).failures[0]?.code, "DRIVER_VSCODE_METADATA_FAILED");
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("session catalogs derive from the actual VS Code profile and respect explicit Copilot home", () => {
  assert.deepEqual(vscodeCatalogPaths("/app/Code/User/globalStorage/wellactually-local.wellactually"), {
    registry: "/app/Code/User/globalStorage/agent-host.db", sessionData: "/app/Code/agentSessionData",
    workspaceStorage: "/app/Code/User/workspaceStorage", globalStorage: "/app/Code/User/globalStorage",
  });
  assert.deepEqual(vscodeCatalogPaths("/app/Code/User/profiles/profile-id/globalStorage/wellactually-local.wellactually"), {
    registry: "/app/Code/User/profiles/profile-id/globalStorage/agent-host.db", sessionData: "/app/Code/agentSessionData",
    workspaceStorage: "/app/Code/User/workspaceStorage", globalStorage: "/app/Code/User/globalStorage",
  });
  assert.throws(() => vscodeCatalogPaths("/unknown/storage/extension"), /DRIVER_VSCODE_STORAGE_UNRECOGNIZED/);
  assert.deepEqual(copilotSessionStores("/home/synthetic", { COPILOT_HOME: "/custom" }),
    ["/custom/session-state", "/home/synthetic/.copilot/session-state"]);
  assert.deepEqual(copilotSessionStores("/home/synthetic", { COPILOT_HOME: "/home/synthetic/.copilot" }),
    ["/home/synthetic/.copilot/session-state"]);
});
