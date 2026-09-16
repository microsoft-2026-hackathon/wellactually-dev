import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isRecord, text } from "../validation.js";

const execute = promisify(execFile);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

export interface VscodeCatalogPaths {
  registry: string;
  sessionData: string;
  workspaceStorage: string;
  globalStorage: string;
}

export interface VscodeSession {
  id: string;
  provider: string;
  sdkSessionId: string;
  title?: string;
  workspace?: string;
  modifiedTime: number;
}

export interface CatalogFailure {
  sessionId: string;
  code: string;
}

export function vscodeCatalogPaths(globalStorageDirectory: string): VscodeCatalogPaths {
  const storage = path.dirname(globalStorageDirectory);
  let user = path.dirname(storage);
  if (path.basename(path.dirname(user)) === "profiles") user = path.dirname(path.dirname(user));
  if (path.basename(user) !== "User") throw new Error("DRIVER_VSCODE_STORAGE_UNRECOGNIZED");
  return {
    registry: path.join(storage, "agent-host.db"),
    sessionData: path.join(path.dirname(user), "agentSessionData"),
    workspaceStorage: path.join(user, "workspaceStorage"),
    globalStorage: path.join(user, "globalStorage"),
  };
}

export async function queryMetadata(database: string, sql: string): Promise<Record<string, unknown>[]> {
  const stat = await lstat(database);
  if (!stat.isFile() || stat.isSymbolicLink() || await realpath(database) !== database) {
    throw new Error("DRIVER_CATALOG_PATH_INVALID");
  }
  // The macOS package uses the system SQLite reader; never expose this host operation to the model.
  const { stdout } = await execute("/usr/bin/sqlite3", [
    "-readonly", "-json", "-cmd", ".timeout 2000", database, sql,
  ], { encoding: "utf8", timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
  const rows: unknown = JSON.parse(stdout || "[]");
  if (!Array.isArray(rows) || !rows.every(isRecord)) throw new Error("DRIVER_CATALOG_INVALID");
  return rows;
}

export async function readVscodeCatalog(paths: VscodeCatalogPaths): Promise<{
  sessions: VscodeSession[];
  failures: CatalogFailure[];
}> {
  const sessions: VscodeSession[] = [];
  const failures: CatalogFailure[] = [];
  let rows: Record<string, unknown>[];
  try {
    rows = await queryMetadata(paths.registry,
      "SELECT session_uri, provider, start_time, modified_time FROM sessions");
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") {
      failures.push({ sessionId: "VS Code", code: "DRIVER_VSCODE_CATALOG_FAILED" });
    }
    return { sessions, failures };
  }
  for (const row of rows) {
    let id = "VS Code";
    try {
      const uri = new URL(text(row.session_uri, 1024, "DRIVER_CATALOG_INVALID"));
      const provider = text(row.provider, 256, "DRIVER_CATALOG_INVALID");
      id = uri.pathname.slice(1);
      if (!idPattern.test(id) || uri.host || uri.search || uri.hash || uri.protocol !== `${provider}:`) {
        throw new Error("DRIVER_CATALOG_INVALID");
      }
      const modifiedTime = row.modified_time || row.start_time;
      if (typeof modifiedTime !== "number" || !Number.isFinite(modifiedTime) || modifiedTime < 0) {
        throw new Error("DRIVER_CATALOG_INVALID");
      }
      const session: VscodeSession = { id, provider, sdkSessionId: id, modifiedTime };
      try {
        const metadata = new Map((await queryMetadata(path.join(paths.sessionData, id, "session.db"),
          "SELECT key, value FROM session_metadata WHERE key IN ('customTitle', 'defaultChatProviderData', 'copilot.workingDirectory')"
        )).map(item => [item.key, item.value]));
        const title = metadata.get("customTitle");
        if (title !== undefined && (typeof title !== "string" || title.trim())) {
          session.title = text(title, 4096, "DRIVER_CATALOG_INVALID");
        }
        const backing = metadata.get("defaultChatProviderData");
        if (backing !== undefined) {
          const data: unknown = JSON.parse(text(backing, 64 * 1024, "DRIVER_CATALOG_INVALID"));
          if (!isRecord(data) || typeof data.sdkSessionId !== "string" || !idPattern.test(data.sdkSessionId)) {
            throw new Error("DRIVER_CATALOG_INVALID");
          }
          session.sdkSessionId = data.sdkSessionId;
        }
        const cwd = metadata.get("copilot.workingDirectory");
        if (cwd !== undefined) {
          session.workspace = fileURLToPath(text(cwd, 4096, "DRIVER_CATALOG_INVALID"));
        }
        sessions.push(session);
      } catch {
        failures.push({ sessionId: id, code: "DRIVER_VSCODE_METADATA_FAILED" });
        // Preserve the registered session without guessing a backing source after a metadata error.
        sessions.push({ ...session, provider: "unavailable" });
      }
    } catch {
      failures.push({ sessionId: id, code: "DRIVER_VSCODE_SESSION_INVALID" });
    }
  }
  return { sessions, failures };
}
