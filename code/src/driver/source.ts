import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import type { SdkDriverSource } from "../contracts.js";
import { isRecord, text } from "../validation.js";

const MAX_METADATA_BYTES = 64 * 1024;
const sessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

export interface DriverSession extends SdkDriverSource {
  workspace: string;
  modifiedTime: number;
  hasEvents: boolean;
}

export interface DriverSessionList {
  sessions: DriverSession[];
  failures: { sessionId: string; code: string }[];
}

async function readPrefix(filePath: string, entire: boolean): Promise<Buffer> {
  const initial = await lstat(filePath);
  if (!initial.isFile() || initial.isSymbolicLink()) throw new Error("DRIVER_SESSION_FILE_REQUIRED");
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await file.stat();
    if (opened.dev !== initial.dev || opened.ino !== initial.ino) throw new Error("DRIVER_SESSION_CHANGED");
    const buffer = Buffer.alloc(MAX_METADATA_BYTES + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (entire && bytesRead > MAX_METADATA_BYTES) throw new Error("DRIVER_SESSION_METADATA_TOO_LARGE");
    return buffer.subarray(0, Math.min(bytesRead, MAX_METADATA_BYTES));
  } finally { await file.close(); }
}

async function readMetadata(root: string, sessionId: string): Promise<DriverSession> {
  if (!sessionIdPattern.test(sessionId)) throw new Error("DRIVER_SESSION_ID_INVALID");
  const directory = path.join(root, sessionId);
  const initial = await lstat(directory);
  if (!initial.isDirectory() || initial.isSymbolicLink() || await realpath(directory) !== directory) {
    throw new Error("DRIVER_SESSION_DIRECTORY_REQUIRED");
  }
  const metadataPath = path.join(directory, "workspace.yaml");
  const buffer = await readPrefix(metadataPath, true);
  let metadata: unknown;
  try {
    const document = parseDocument(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (document.errors.length || document.warnings.length) throw new Error("Invalid session metadata");
    metadata = document.toJS({ maxAliasCount: 0 });
  } catch { throw new Error("DRIVER_SESSION_METADATA_INVALID"); }
  if (!isRecord(metadata)) throw new Error("DRIVER_SESSION_METADATA_INVALID");
  if (metadata.id !== sessionId) throw new Error("DRIVER_SESSION_ID_MISMATCH");
  const titles = [metadata.name, metadata.summary];
  if (titles.some(value => value !== undefined && value !== null && typeof value !== "string")) {
    throw new Error("DRIVER_SESSION_METADATA_INVALID");
  }
  // An automatically seeded name can be the entire first user message, not the session title.
  const candidates = [metadata.user_named === true ? metadata.name : undefined, metadata.summary];
  const title = text(candidates.find(value => typeof value === "string" && value.trim()) ?? sessionId,
    4096, "DRIVER_SESSION_METADATA_INVALID");
  const workspace = text(metadata.cwd, 4096, "DRIVER_SESSION_METADATA_INVALID");
  if (!path.isAbsolute(workspace)) throw new Error("DRIVER_SESSION_METADATA_INVALID");
  let hasEvents = false;
  let eventsModifiedTime = 0;
  try {
    const events = await lstat(path.join(directory, "events.jsonl"));
    if (!events.isFile() || events.isSymbolicLink()) throw new Error("DRIVER_SESSION_FILE_REQUIRED");
    hasEvents = events.size > 0;
    eventsModifiedTime = events.mtimeMs;
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  const metadataStat = await lstat(metadataPath);
  return {
    directory, sessionId, title, workspace, hasEvents,
    // Metadata timestamps can stay at creation time while a conversation is active.
    modifiedTime: Math.max(eventsModifiedTime, metadataStat.mtimeMs),
  };
}

export async function listDriverSessions(sessionStateDirectory: string): Promise<DriverSessionList> {
  const result: DriverSessionList = { sessions: [], failures: [] };
  let root: string;
  try {
    root = await realpath(sessionStateDirectory);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return result;
    throw new Error("DRIVER_SESSION_LIST_FAILED");
  }
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    try {
      // Discovery reads metadata and file timestamps, never conversation bodies.
      const session = await readMetadata(root, entry.name);
      result.sessions.push(session);
    } catch (error) {
      const code = error instanceof Error && /^DRIVER_[A-Z_]+$/.test(error.message)
        ? error.message : "DRIVER_SESSION_READ_FAILED";
      result.failures.push({ sessionId: entry.name, code });
    }
  }
  result.sessions.sort((a, b) =>
    b.modifiedTime - a.modifiedTime || a.sessionId.localeCompare(b.sessionId));
  return result;
}

export async function inspectDriverSession(sessionStateDirectory: string, sessionId: string): Promise<SdkDriverSource> {
  let session: DriverSession;
  try {
    const root = await realpath(sessionStateDirectory);
    session = await readMetadata(root, sessionId);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
    throw error;
  }
  if (!session.hasEvents) throw new Error("DRIVER_SESSION_NOT_READY");
  const buffer = await readPrefix(path.join(session.directory, "events.jsonl"), false);
  const newline = buffer.indexOf(10);
  if (newline < 0) throw new Error("DRIVER_SESSION_HEADER_INVALID");
  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, newline)));
  } catch { throw new Error("DRIVER_SESSION_HEADER_INVALID"); }
  if (!isRecord(header) || header.type !== "session.start" || !isRecord(header.data) ||
      header.data.sessionId !== sessionId || (header.sessionId !== undefined && header.sessionId !== sessionId)) {
    throw new Error("DRIVER_SESSION_HEADER_INVALID");
  }
  return { directory: session.directory, sessionId, title: session.title };
}
