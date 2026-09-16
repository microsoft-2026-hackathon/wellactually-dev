import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSONParser } from "@streamparser/json";
import type { VscodeChatSource } from "../contracts.js";
import { isRecord, text } from "../validation.js";
import { queryMetadata, type CatalogFailure, type VscodeCatalogPaths } from "./vscodeCatalog.js";

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const MAX_HEADER_BYTES = 64 * 1024;
const MAX_IDENTITY_SCAN_BYTES = 64 * 1024 * 1024;

export interface ChatCatalogLocation {
  storageDirectory: string;
  recordsDirectory: string;
  workspace: string;
  editingStorageDirectories?: readonly string[];
}

export interface VscodeChatSession {
  sessionId: string;
  title: string;
  workspace: string;
  modifiedTime: number;
  hasEvents: boolean;
  file?: string;
  location: ChatCatalogLocation;
  externalSessionId?: string;
  unavailable?: boolean;
}

async function missingFile(file: string) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || await realpath(file) !== file) {
      throw new Error("DRIVER_CHAT_PATH_INVALID");
    }
    return stat;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readHeader(file: string): Promise<Buffer> {
  const original = await missingFile(file);
  if (!original) throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (stat.dev !== original.dev || stat.ino !== original.ino) throw new Error("DRIVER_SESSION_CHANGED");
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }
}

async function workspaceLabel(directory: string): Promise<string> {
  const file = path.join(directory, "workspace.json");
  if (!await missingFile(file)) return "";
  const metadata: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readHeader(file)));
  if (!isRecord(metadata)) throw new Error("DRIVER_CHAT_WORKSPACE_INVALID");
  const uri = metadata.folder ?? metadata.workspace;
  if (uri === undefined) return "";
  const value = text(uri, 4096, "DRIVER_CHAT_WORKSPACE_INVALID");
  return value.startsWith("file:") ? fileURLToPath(value) : value;
}

export async function readChatIndex(location: ChatCatalogLocation): Promise<{
  sessions: VscodeChatSession[];
  failures: CatalogFailure[];
}> {
  const result: { sessions: VscodeChatSession[]; failures: CatalogFailure[] } = { sessions: [], failures: [] };
  const db = path.join(location.storageDirectory, "state.vscdb");
  if (!await missingFile(db)) return result;
  const rows = await queryMetadata(db, "SELECT value FROM ItemTable WHERE key = 'chat.ChatSessionStore.index'");
  if (!rows.length) return result;
  const index: unknown = JSON.parse(text(rows[0]?.value, 4 * 1024 * 1024, "DRIVER_CHAT_INDEX_INVALID"));
  if (!isRecord(index) || index.version !== 1 || !isRecord(index.entries)) throw new Error("DRIVER_CHAT_INDEX_INVALID");
  for (const [key, value] of Object.entries(index.entries)) {
    try {
      if (!isRecord(value) || value.sessionId !== key) throw new Error("DRIVER_CHAT_INDEX_INVALID");
      const external = /^agent-host-copilotcli:\/([A-Za-z0-9][A-Za-z0-9._:-]{0,255})$/.exec(key);
      const unavailable = !idPattern.test(key) && !external;
      if (unavailable) {
        try { new URL(text(key, 4096, "DRIVER_CHAT_PROVIDER_UNSUPPORTED")); }
        catch { throw new Error("DRIVER_CHAT_PROVIDER_UNSUPPORTED"); }
      }
      const id = external?.[1] ?? key;
      const timing = isRecord(value.timing) ? value.timing : {};
      const times: number[] = [];
      for (const time of [timing.created, timing.lastRequestStarted, timing.lastRequestEnded, value.lastMessageDate]) {
        if (time === undefined) continue;
        if (typeof time !== "number" || !Number.isFinite(time) || time < 0) throw new Error("DRIVER_CHAT_INDEX_INVALID");
        times.push(time);
      }
      if (!times.length) throw new Error("DRIVER_CHAT_INDEX_INVALID");
      const modifiedTime = Math.max(...times);
      if (value.title !== undefined && value.title !== null && typeof value.title !== "string") {
        throw new Error("DRIVER_CHAT_INDEX_INVALID");
      }
      let file: string | undefined;
      let hasEvents = false;
      if (!external && !unavailable) {
        for (const extension of [".jsonl", ".json"]) {
          const candidate = path.join(location.recordsDirectory, id + extension);
          const stat = await missingFile(candidate);
          if (stat) { file = candidate; hasEvents = stat.size > 0; break; }
        }
      }
      result.sessions.push({
        sessionId: id,
        title: typeof value.title === "string" && value.title.trim()
          ? text(value.title, 4096, "DRIVER_CHAT_INDEX_INVALID") : id,
        workspace: location.workspace,
        modifiedTime,
        hasEvents,
        location,
        ...(file ? { file } : {}),
        ...(external ? { externalSessionId: id } : {}),
        ...(unavailable ? { unavailable: true } : {}),
      });
    } catch (error) {
      result.failures.push({ sessionId: key, code: error instanceof Error &&
        /^DRIVER_[A-Z_]+$/.test(error.message) ? error.message : "DRIVER_CHAT_ENTRY_FAILED" });
    }
  }
  return result;
}

export async function readWorkspaceChats(paths: VscodeCatalogPaths): Promise<{
  sessions: VscodeChatSession[];
  failures: CatalogFailure[];
}> {
  const sessions: VscodeChatSession[] = [];
  const failures: CatalogFailure[] = [];
  const locations: ChatCatalogLocation[] = [{
    storageDirectory: paths.globalStorage,
    recordsDirectory: path.join(paths.globalStorage, "emptyWindowChatSessions"),
    workspace: "",
  }];
  try {
    for (const entry of await readdir(paths.workspaceStorage, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        failures.push({ sessionId: entry.name, code: "DRIVER_CHAT_PATH_INVALID" });
      } else if (entry.isDirectory()) {
        const directory = path.join(paths.workspaceStorage, entry.name);
        locations.push({ storageDirectory: directory, recordsDirectory: path.join(directory, "chatSessions"), workspace: "" });
      }
    }
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") {
      failures.push({ sessionId: "VS Code Chat", code: "DRIVER_CHAT_STORAGE_FAILED" });
    }
  }
  // Empty-window transcripts are global, but VS Code still stores their edits under workspace storage.
  locations[0]!.editingStorageDirectories = locations.slice(1).map(location => location.storageDirectory);
  let next = 0;
  // Read independent workspace indexes with bounded concurrency, not hundreds of SQLite children at once.
  await Promise.all(Array.from({ length: Math.min(4, locations.length) }, async () => {
    for (;;) {
      const location = locations[next++];
      if (!location) return;
      try {
        const index = await readChatIndex(location);
        if (index.sessions.length) {
          try { location.workspace = await workspaceLabel(location.storageDirectory); }
          catch { failures.push({ sessionId: path.basename(location.storageDirectory), code: "DRIVER_CHAT_WORKSPACE_INVALID" }); }
          sessions.push(...index.sessions.map(session => ({ ...session, workspace: location.workspace })));
        }
        failures.push(...index.failures);
      } catch (error) {
        failures.push({ sessionId: path.basename(location.storageDirectory), code: error instanceof Error &&
          /^DRIVER_[A-Z_]+$/.test(error.message) ? error.message : "DRIVER_CHAT_INDEX_FAILED" });
      }
    }
  }));
  return { sessions, failures };
}

async function verifyChatIdentity(file: string, sessionId: string): Promise<void> {
  const initial = await missingFile(file);
  if (!initial) throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  const jsonl = file.endsWith(".jsonl");
  const parsedIdentity = Symbol("identity");
  let kind: unknown;
  let identity: unknown;
  try {
    const opened = await handle.stat();
    if (opened.dev !== initial.dev || opened.ino !== initial.ino) throw new Error("DRIVER_SESSION_CHANGED");
    // Legacy JSON puts sessionId after requests. Stream past them without retaining a conversation tree.
    const parser = new JSONParser({
      paths: jsonl ? ["$.kind", "$.v.sessionId"] : ["$.sessionId"],
      keepStack: false, stringBufferSize: MAX_HEADER_BYTES,
    });
    parser.onValue = ({ key, value }) => {
      if (key === "kind") kind = value;
      else if (key === "sessionId") {
        identity = value;
        throw parsedIdentity;
      }
    };
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    let scanned = 0;
    try {
      while (scanned < MAX_IDENTITY_SCAN_BYTES) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (!bytesRead) {
          parser.end();
          break;
        }
        scanned += bytesRead;
        parser.write(buffer.subarray(0, bytesRead));
      }
    } catch (error) {
      if (error !== parsedIdentity) throw new Error("DRIVER_CHAT_HEADER_INVALID");
    }
    if (identity === undefined && scanned >= MAX_IDENTITY_SCAN_BYTES) throw new Error("DRIVER_CHAT_IDENTITY_LIMIT");
    if (identity !== sessionId || (jsonl && kind !== 0)) throw new Error("DRIVER_CHAT_HEADER_INVALID");
  } finally { await handle.close(); }
}

export async function inspectChatSession(session: VscodeChatSession): Promise<VscodeChatSource> {
  if (session.externalSessionId || session.unavailable) throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
  const current = (await readChatIndex(session.location)).sessions.find(item => item.sessionId === session.sessionId);
  if (!current?.file) throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
  if (!current.hasEvents) throw new Error("DRIVER_SESSION_NOT_READY");
  if (session.file && current.file !== session.file) throw new Error("DRIVER_SESSION_CHANGED");
  await verifyChatIdentity(current.file, current.sessionId);
  let artifactsDirectory: string | undefined;
  for (const directory of session.location.editingStorageDirectories ?? [session.location.storageDirectory]) {
    const artifacts = path.join(directory, "chatEditingSessions", session.sessionId);
    try {
      const stat = await lstat(artifacts);
      if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(artifacts) !== artifacts) {
        throw new Error("DRIVER_CHAT_PATH_INVALID");
      }
      if (artifactsDirectory) throw new Error("DRIVER_CHAT_ARTIFACTS_AMBIGUOUS");
      artifactsDirectory = artifacts;
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
    }
  }
  return {
    kind: "vscode-chat", file: current.file, sessionId: current.sessionId, title: current.title,
    ...(artifactsDirectory ? { artifactsDirectory } : {}),
  };
}
