import { homedir } from "node:os";
import path from "node:path";
import { hostText } from "../hostMessages.js";
import { inspectDriverSession, listDriverSessions, type DriverSession, type DriverSessionList } from "./source.js";
import { readVscodeCatalog, type VscodeCatalogPaths } from "./vscodeCatalog.js";
import { inspectChatSession, readWorkspaceChats, type VscodeChatSession } from "./chatCatalog.js";

interface SdkCatalogEntry extends DriverSession {
  vscodeSessionId?: string;
  origin: "vscode" | "copilot";
  unavailable?: boolean;
}

export type DriverCatalogEntry = SdkCatalogEntry | (VscodeChatSession & {
  origin: "vscode-chat";
  unavailable?: boolean;
});

export function copilotSessionStores(
  home = homedir(), environment: NodeJS.ProcessEnv = process.env,
): string[] {
  return [...new Set([
    ...(environment.COPILOT_HOME ? [path.resolve(environment.COPILOT_HOME, "session-state")] : []),
    path.join(home, ".copilot", "session-state"),
  ])];
}

export async function listDriverCatalog(stores: readonly string[], vscode: VscodeCatalogPaths): Promise<{
  sessions: DriverCatalogEntry[];
  failures: DriverSessionList["failures"];
}> {
  if (!stores.length) throw new Error("DRIVER_SESSION_STORE_REQUIRED");
  const [local, registered, chats] = await Promise.all([
    Promise.all(stores.map(store => listDriverSessions(store))),
    readVscodeCatalog(vscode),
    readWorkspaceChats(vscode),
  ]);
  const entries = new Map<string, DriverCatalogEntry>();
  const failures = [...local.flatMap(result => result.failures), ...registered.failures, ...chats.failures];
  const stored = local.flatMap(result => result.sessions);
  for (const session of stored) {
    entries.set(session.directory, { ...session, origin: "copilot" });
  }
  for (const session of registered.sessions) {
    const backing = stored.find(item => item.sessionId === session.sdkSessionId);
    const directory = backing?.directory ?? path.join(stores[0]!, session.sdkSessionId);
    const supported = session.provider === "copilotcli";
    const entry: DriverCatalogEntry = {
      directory,
      sessionId: session.sdkSessionId,
      title: session.title ?? backing?.title ?? session.id,
      workspace: session.workspace ?? backing?.workspace ?? "",
      modifiedTime: session.modifiedTime,
      hasEvents: supported && (backing?.hasEvents ?? false),
      origin: "vscode",
      vscodeSessionId: session.id,
      ...(!supported ? { unavailable: true } : {}),
    };
    if (backing) entries.delete(backing.directory);
    entries.set(`vscode:${session.id}`, entry);
  }
  for (const chat of chats.sessions) {
    if (chat.externalSessionId) {
      const key = `vscode:${chat.externalSessionId}`;
      const existing = entries.get(key);
      if (existing && existing.origin !== "vscode-chat") {
        // Workspace indexes can retain the visible title even when migrated registry metadata cannot.
        entries.set(key, {
          ...existing,
          title: existing.title === existing.sessionId || existing.title === existing.vscodeSessionId
            ? chat.title : existing.title,
          workspace: existing.workspace || chat.workspace,
          modifiedTime: Math.max(existing.modifiedTime, chat.modifiedTime),
        });
      } else {
        entries.set(key, { ...chat, origin: "vscode-chat", unavailable: true });
      }
    } else {
      entries.set(`chat:${chat.location.storageDirectory}:${chat.sessionId}`, { ...chat, origin: "vscode-chat" });
    }
  }
  return {
    sessions: [...entries.values()].sort((a, b) =>
      b.modifiedTime - a.modifiedTime || a.sessionId.localeCompare(b.sessionId)),
    failures,
  };
}

export function driverPickerItem(session: DriverCatalogEntry) {
  const visibleId = session.origin === "vscode-chat" ? session.sessionId : session.vscodeSessionId ?? session.sessionId;
  const untitled = session.title === session.sessionId || session.title === visibleId;
  return {
    label: untitled ? hostText("driverUntitled") : session.title.replace(/\s+/g, " "),
    description: session.workspace ? path.basename(session.workspace) : hostText("driverUnknownProject"),
    detail: [
      hostText(session.origin === "vscode-chat" ? "driverChatSource"
        : session.origin === "vscode" ? "driverVscodeSource" : "driverCopilotSource"),
      session.workspace,
      hostText("driverLastActive", {
        time: new Date(session.modifiedTime).toLocaleString("ko-KR"),
        sessionId: visibleId,
      }),
      ...(session.unavailable ? [hostText("driverSourceUnavailable")]
        : !session.hasEvents ? [hostText("driverNoRecords")] : []),
    ].filter(Boolean).join(" · "),
    session,
  };
}

export async function inspectCatalogSession(session: DriverCatalogEntry, vscode: VscodeCatalogPaths) {
  if (session.unavailable) throw new Error("DRIVER_SESSION_SOURCE_UNAVAILABLE");
  if (session.origin === "vscode-chat") {
    const source = await inspectChatSession(session);
    return { ...source, title: source.title === source.sessionId ? hostText("driverUntitled") : source.title };
  }
  if (session.vscodeSessionId) {
    const current = await readVscodeCatalog(vscode);
    const entry = current.sessions.find(item => item.id === session.vscodeSessionId);
    if (!entry || entry.provider !== "copilotcli" || entry.sdkSessionId !== session.sessionId) {
      throw new Error("DRIVER_SESSION_CHANGED");
    }
  }
  const source = await inspectDriverSession(path.dirname(session.directory), session.sessionId);
  return { ...source, title: driverPickerItem(session).label };
}
