import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import {
  CopilotClient, RuntimeConnection, type CopilotClientOptions, type CopilotSession, type SessionConfig,
} from "@github/copilot-sdk";
import { canonicalPathAllowed, READ_TOOLS, createReadPolicy, isReadToolInventory, type ReadPolicy } from "./readPolicy.js";
import type { PairModel, ReasoningEffort } from "../contracts.js";
import { DEFAULT_PAIR_MODEL, pairModels } from "./models.js";

export interface RuntimeAuth {
  githubToken?: string;
}

const ownedDirectories = new WeakMap<object, string>();
const shutdowns = new WeakMap<object, Promise<void>>();
const unverifiedShutdowns = new WeakSet<object>();

/** 이 모듈이 생성해 소유권을 기록한 SDK 클라이언트의 전용 저장 디렉터리를 반환한다. */
export function ownedRuntimeDirectory(client: CopilotClient): string {
  const owned = ownedDirectories.get(client);
  if (!owned) throw new Error("COACH_RUNTIME_NOT_OWNED");
  return owned;
}

/** 비동기 작업에 제한 시간을 적용하고, 시간 초과 후 획득한 자원은 지정된 정리 함수에 넘긴다. */
export async function deadline<T>(
  operation: Promise<T>, milliseconds: number, code: string,
  disposeLate?: (value: T) => Promise<void>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  let expired = false;
  const guarded = operation.then(async value => {
    // 시간 초과만으로 자원 생성이 취소되지는 않으므로 늦게 도착한 자원도 정리한다.
    if (expired && disposeLate) {
      await disposeLate(value);
      throw new Error(code);
    }
    return value;
  });
  try {
    return await Promise.race([
      guarded,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error(code));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

/** SDK 세션 생성을 20초로 제한하고, 제한 시간 이후 만들어진 세션과 클라이언트도 정리한다. */
export async function createSessionWithDeadline(
  client: CopilotClient, config: SessionConfig, code = "COACH_CREATE_TIMEOUT",
): Promise<CopilotSession> {
  return deadline(client.createSession(config), 20_000, code,
    async session => {
      try {
        await deadline(session.disconnect(), 3_000, "COACH_DISCONNECT_TIMEOUT");
      } finally {
        shutdowns.delete(client);
        await stopClient(client);
      }
    });
}

/** 중복 종료를 합치고 정상 종료가 확인된 경우에만 전용 저장소를 삭제하며, 불확실한 종료는 실패로 남긴다. */
export async function stopClient(client: Pick<CopilotClient, "stop" | "forceStop">): Promise<void> {
  const existing = shutdowns.get(client);
  if (existing) return existing;
  const shutdown = (async () => {
    try {
      if (unverifiedShutdowns.has(client)) throw new Error("COACH_CLEANUP_FAILED");
      const errors = await deadline(client.stop(), 5_000, "COACH_STOP_TIMEOUT");
      if (errors.length) throw new Error("COACH_STOP_FAILED");
    } catch {
      unverifiedShutdowns.add(client);
      try {
        await deadline(client.forceStop(), 3_000, "COACH_FORCE_STOP_TIMEOUT");
      } finally {
        // SDK 1.0.13의 forceStop은 종료 신호 오류를 숨기고 자식 프로세스 종료를 기다리지 않는다.
        // 따라서 호출 완료만으로 안전한 종료를 확정하거나 저장 상태를 삭제할 수 없다.
        throw new Error("COACH_CLEANUP_FAILED");
      }
    }
    const owned = ownedDirectories.get(client);
    if (owned) {
      // 이 클라이언트용으로 만든 디렉터리만 삭제하며 사용자의 Copilot 홈은 건드리지 않는다.
      await deadline(rm(owned, { recursive: true, force: true }), 5_000, "COACH_STORAGE_CLEANUP_TIMEOUT");
      ownedDirectories.delete(client);
    }
  })();
  shutdowns.set(client, shutdown);
  try {
    await shutdown;
  } catch {
    shutdowns.delete(client);
    throw new Error("COACH_CLEANUP_FAILED");
  }
}

/** Clean up failed startup and expose only the Pair runtime's diagnostic codes. */
export async function withClientCleanupOnFailure<T>(
  client: Pick<CopilotClient, "stop" | "forceStop">,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    try {
      await stopClient(client);
    } catch {
      throw new Error("COACH_CLEANUP_FAILED");
    }
    const message = error instanceof Error ? error.message : "";
    throw new Error(/^COACH_[A-Z_]+$/.test(message) ? message : "COACH_STARTUP_FAILED");
  }
}

/** SDK 실행 환경과 임시 저장소를 분리하고, 인증 토큰은 SDK의 전용 전달 경로로만 설정한다. */
export function isolatedClientOptions(
  canonical: string, auth?: RuntimeAuth, environment: NodeJS.ProcessEnv = process.env,
): CopilotClientOptions {
  if (auth?.githubToken !== undefined &&
      (typeof auth.githubToken !== "string" || !auth.githubToken.trim() || /[\r\n\0]/.test(auth.githubToken))) {
    throw new Error("COACH_AUTH_INVALID");
  }
  const env: Record<string, string | undefined> = {};
  // 인증 정보는 SDK의 gitHubToken으로 전달하며 자식 프로세스 환경 변수에 중복하지 않는다.
  for (const name of ["PATH", "HOME", "USER", "SHELL", "LANG"]) {
    if (environment[name]) env[name] = environment[name];
  }
  const scratch = path.join(canonical, "scratch");
  env.TMPDIR = scratch;
  env.TMP = scratch;
  env.TEMP = scratch;
  const explicitToken = auth?.githubToken ?? (
    environment.COPILOT_GITHUB_TOKEN || environment.GH_TOKEN || environment.GITHUB_TOKEN
  );
  // 전용 COPILOT_HOME만으로 CLI 기본 계정 재사용이 보장되지는 않는다.
  // 기존 환경 인증을 우선 시도하고, 호스트 인증 재사용은 getToken에 맡긴다.
  return {
    connection: RuntimeConnection.forStdio(),
    mode: explicitToken ? "empty" : "copilot-cli",
    workingDirectory: canonical,
    baseDirectory: path.join(canonical, "state"),
    env,
    useLoggedInUser: !explicitToken,
    ...(explicitToken ? { gitHubToken: explicitToken } : {}),
    logLevel: "none",
    builtinPluginDirectories: [],
  };
}

/** 클라이언트 전용 임시 디렉터리와 SDK 프로세스를 만들고 시작 실패 시 소유한 자원을 정리한다. */
export async function createIsolatedClient(isolatedDirectory: string, auth?: RuntimeAuth): Promise<CopilotClient> {
  const selectedDirectory = path.resolve(isolatedDirectory);
  await mkdir(selectedDirectory, { recursive: true, mode: 0o700 });
  const parent = await realpath(selectedDirectory);
  const canonical = await mkdtemp(path.join(parent, "sdk-"));
  let client: CopilotClient;
  try {
    const options = isolatedClientOptions(canonical, auth);
    await mkdir(path.join(canonical, "scratch"), { recursive: true, mode: 0o700 });
    client = new CopilotClient(options);
  } catch (error) {
    try {
      await rm(canonical, { recursive: true, force: true });
    } catch {
      throw new Error("COACH_CLEANUP_FAILED");
    }
    if (error instanceof Error && error.message === "COACH_AUTH_INVALID") throw error;
    throw new Error("COACH_STARTUP_FAILED");
  }
  ownedDirectories.set(client, canonical);
  return withClientCleanupOnFailure(client, async () => {
    await deadline(client.start(), 30_000, "COACH_START_TIMEOUT", async () => {
      shutdowns.delete(client);
      await stopClient(client);
    });
    return client;
  });
}

export async function getHostGitHubToken(
  signal: AbortSignal,
  getSession: (interactive: boolean) => Promise<{ accessToken: string } | undefined>,
): Promise<string | undefined> {
  if (signal.aborted) return undefined;
  const existing = await getSession(false);
  if (signal.aborted) return undefined;
  if (existing) return existing.accessToken;
  const session = await getSession(true);
  if (signal.aborted) return undefined;
  return session?.accessToken;
}

/** 기존 인증을 먼저 확인하고, 사용할 수 없을 때만 호스트 토큰을 받아 새 클라이언트를 연다. */
export async function authenticateClient<T extends Pick<CopilotClient, "getAuthStatus" | "stop" | "forceStop">>(
  open: (auth?: RuntimeAuth) => Promise<T>, getToken?: () => Promise<string | undefined>,
): Promise<T> {
  /** 제한 시간 내 인증 상태를 조회하고, 조회 자체가 실패하면 해당 클라이언트를 정리한다. */
  function isAuthenticated(client: T): Promise<boolean> {
    return withClientCleanupOnFailure(client, async () => {
      const status = await deadline(client.getAuthStatus(), 10_000, "COACH_AUTH_TIMEOUT");
      return status.isAuthenticated;
    });
  }

  const existing = await open();
  if (await isAuthenticated(existing)) return existing;
  // 호스트 인증으로 새 프로세스를 열기 전에 인증되지 않은 기존 자식 프로세스를 종료한다.
  await stopClient(existing);
  let token: string | undefined;
  try {
    token = await getToken?.();
  } catch {
    throw new Error("COACH_AUTH_REQUIRED");
  }
  if (!token) throw new Error("COACH_AUTH_REQUIRED");
  const client = await open({ githubToken: token });
  if (await isAuthenticated(client)) return client;
  await stopClient(client);
  throw new Error("COACH_AUTH_REQUIRED");
}

/** 격리된 클라이언트 생성과 기존 인증·호스트 인증 재시도 절차를 하나의 진입점으로 제공한다. */
export function createAuthenticatedClient(
  directory: string, getToken?: () => Promise<string | undefined>,
): Promise<CopilotClient> {
  return authenticateClient(auth => createIsolatedClient(directory, auth), getToken);
}

export async function listPairModels(
  directory: string, getToken: () => Promise<string | undefined>, signal: AbortSignal,
): Promise<readonly PairModel[]> {
  signal.throwIfAborted();
  const client = await createAuthenticatedClient(directory, getToken);
  try {
    signal.throwIfAborted();
    const models = pairModels(await deadline(client.listModels(), 15_000, "COACH_MODEL_LIST_TIMEOUT"));
    signal.throwIfAborted();
    return models;
  } finally { await stopClient(client); }
}

/** Check storage isolation and configure the Pair's read-only tools, permissions and persona. */
export async function readSessionConfig(
  workspaceDirectory: string, isolatedDirectory: string, model = DEFAULT_PAIR_MODEL,
  reasoningEffort?: Exclude<ReasoningEffort, "none">,
): Promise<{ config: SessionConfig; policy: ReadPolicy }> {
  const policy = await createReadPolicy(workspaceDirectory);
  const isolated = await realpath(isolatedDirectory);
  if (canonicalPathAllowed(policy.root, isolated) || canonicalPathAllowed(isolated, policy.root)) {
    throw new Error("COACH_ISOLATION_OVERLAPS_WORKSPACE");
  }
  const [identity, tone, toolEfficiency] = await Promise.all([
    readFile(new URL("../../../src/policies/coach.md", import.meta.url), "utf8"),
    readFile(new URL("../../../src/policies/coach-tone.md", import.meta.url), "utf8"),
    readFile(new URL("../../../src/policies/coach-tools.md", import.meta.url), "utf8"),
  ]);
  return {
    policy,
    config: {
      clientName: "wellactually-coach",
      model,
      ...(reasoningEffort ? { reasoningEffort } : {}),
      streaming: true,
      workingDirectory: policy.root,
      additionalDirectories: [],
      configDirectory: path.join(isolated, "config"),
      systemMessage: {
        mode: "customize",
        sections: {
          identity: { action: "replace", content: identity },
          tone: { action: "replace", content: tone },
          tool_efficiency: { action: "replace", content: toolEfficiency },
        },
        content: `Approved workspace directory: ${JSON.stringify(policy.root)}\nThe current host source context refreshes the authorized read-only roots for each question. Use absolute paths or project-relative paths. This role is Pair, not Driver.`,
      },
      availableTools: [...READ_TOOLS],
      tools: [],
      commands: [],
      customAgents: [],
      excludedTools: ["bash", "read_bash", "stop_bash", "list_bash", "create", "edit", "glob", "task", "skill", "web_fetch", "read_agent", "write_agent", "list_agents"],
      enableConfigDiscovery: false,
      enableOnDemandInstructionDiscovery: false,
      skipCustomInstructions: true,
      instructionDirectories: [],
      skillDirectories: [],
      pluginDirectories: [],
      includedBuiltinSkills: [],
      enableSkills: false,
      enableFileHooks: false,
      enableHostGitOperations: false,
      enableManagedSettings: false,
      enableSessionTelemetry: false,
      enableSessionStore: false,
      // 같은 세션의 맥락 압축은 영구 메모리나 다른 세션 검색과 별개로 사용한다.
      memory: { enabled: false },
      infiniteSessions: { enabled: true },
      embeddingCacheStorage: "in-memory",
      skipEmbeddingRetrieval: true,
      mcpOAuthTokenStorage: "in-memory",
      mcpServers: {},
      disabledMcpServers: ["*"],
      largeOutput: { enabled: false },
      coauthorEnabled: false,
      manageScheduleEnabled: false,
      onPermissionRequest: policy.onPermissionRequest,
      hooks: policy.hooks,
    },
  };
}

/** 초기화된 SDK의 실제 도구 목록이 허용한 읽기 도구 목록과 정확히 일치하는지 검증한다. */
export async function assertSessionTools(session: CopilotSession): Promise<void> {
  // 허용 목록을 설정했다는 사실만으로 호환성을 보장할 수 없어 실제 노출 목록을 확인한다.
  await deadline(session.rpc.tools.initializeAndValidate(), 10_000, "COACH_TOOL_INIT_TIMEOUT");
  const metadata = await deadline(session.rpc.tools.getCurrentMetadata(), 10_000, "COACH_TOOL_LIST_TIMEOUT");
  const tools = metadata.tools?.map(tool => tool.name).sort();
  if (!isReadToolInventory(tools)) {
    throw new Error("COACH_SESSION_TOOL_MISMATCH");
  }
}
