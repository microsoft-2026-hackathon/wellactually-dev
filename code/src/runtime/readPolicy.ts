import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { PermissionHandler, SessionHooks } from "@github/copilot-sdk";
import type { DriverSource } from "../contracts.js";

export const MAX_TOOL_TEXT = 12_000;
export const READ_TOOLS = ["view", "grep"] as const;
const MAX_SEARCH_PATHS = 256;

/** UTF-8 바이트 상한 안에서 문자 경계를 보존해 도구 출력을 자르고, 잘림 여부를 함께 반환한다. */
export function boundedToolText(value: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(value, "utf8") <= MAX_TOOL_TEXT) return { text: value, truncated: false };
  let bytes = 0;
  let end = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > MAX_TOOL_TEXT) break;
    bytes += size;
    end += character.length;
  }
  return { text: value.slice(0, end), truncated: true };
}

/** 도구 인수가 배열이나 원시값이 아닌 객체인지 검사해 경로·옵션 검증에 넘긴다. */
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("READ_ARGUMENTS_INVALID");
  return value as Record<string, unknown>;
}

export interface ReadPolicy {
  readonly root: string;
  readonly driver: DriverSource | null;
  readonly hooks: SessionHooks;
  readonly onPermissionRequest: PermissionHandler;
  /** Resolve the authorized file or directory operands, not every file below them. */
  sourceFiles(tool: string, args: unknown): Promise<readonly string[]>;
  /** Replace the second authorized tree without resetting the conversation. */
  setDriver(driver: DriverSource | null): Promise<void>;
}

/** 이미 정규화된 절대 경로끼리 비교해 후보가 기준 디렉터리 자체이거나 그 내부인지 판단한다. */
export function canonicalPathAllowed(root: string, candidate: string): boolean {
  if (!path.isAbsolute(root) || !path.isAbsolute(candidate)) return false;
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

/** Read-only access is the union of the project tree and the selected session tree. */
export async function createReadPolicy(workspaceDirectory: string): Promise<ReadPolicy> {
  const root = await realpath(workspaceDirectory);
  if (root === path.parse(root).root || !(await lstat(root)).isDirectory()) throw new Error("READ_ROOT_INVALID");
  let driver: DriverSource | null = null;

  async function safePath(input: unknown): Promise<string> {
    if (typeof input !== "string" || !input || input.includes("\0")) throw new Error("READ_PATH_DENIED");
    const absolute = path.resolve(root, input);
    const roots = [root];
    if (driver?.kind === "vscode-chat") {
      if (driver.artifactsDirectory) roots.push(driver.artifactsDirectory);
    } else if (driver) roots.push(driver.directory);
    const allowed = (candidate: string): boolean => roots.some(scope => canonicalPathAllowed(scope, candidate)) ||
      (driver?.kind === "vscode-chat" && candidate === driver.file);
    if (!allowed(absolute)) throw new Error("READ_PATH_DENIED");
    const canonical = await realpath(absolute);
    if (!allowed(canonical)) throw new Error("READ_PATH_DENIED");
    const stat = await lstat(canonical);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error("READ_FILE_KIND_DENIED");
    return canonical;
  }

  async function searchPaths(input: unknown): Promise<string[]> {
    const inputs = input === undefined ? [root] : Array.isArray(input) ? input : [input];
    if (!inputs.length || inputs.length > MAX_SEARCH_PATHS) throw new Error("READ_SEARCH_LIMIT");
    return [...new Set(await Promise.all(inputs.map(inputPath => safePath(inputPath))))];
  }

  async function sourceFiles(tool: string, args: unknown): Promise<readonly string[]> {
    const toolArguments = object(args);
    if (tool === "view") return [await safePath(toolArguments.path)];
    if (tool === "grep") return searchPaths(toolArguments.paths);
    throw new Error("READ_TOOL_DENIED");
  }

  const hooks: SessionHooks = {
    /** 실행 직전 도구·옵션·경로를 검사하고 읽기 범위와 검색 결과 수가 제한된 인수로 교체한다. */
    async onPreToolUse(input) {
      try {
        if (!(READ_TOOLS as readonly string[]).includes(input.toolName)) throw new Error("READ_TOOL_DENIED");
        const args = object(input.toolArgs);
        const files = await sourceFiles(input.toolName, args);
        if (input.toolName === "view") {
          if (Object.keys(args).some(key => !["path", "view_range", "forceReadLargeFiles"].includes(key))) {
            throw new Error("READ_ARGUMENTS_INVALID");
          }
          const range = args.view_range ?? [1, 200];
          if (!Array.isArray(range) || range.length !== 2 || !range.every(n => Number.isSafeInteger(n)) ||
              range[0] < 1 || range[1] < range[0] || range[1] - range[0] >= 200) {
            throw new Error("READ_ARGUMENTS_INVALID");
          }
          return {
            permissionDecision: "allow",
            modifiedArgs: {
              path: files[0],
              view_range: range,
              forceReadLargeFiles: true,
            },
          };
        }
        if (typeof args.pattern !== "string" || args.pattern.length < 1 || args.pattern.length > 512 ||
            Object.keys(args).some(key => !["pattern", "paths", "output_mode", "glob", "type", "-i", "-A", "-B", "-C", "-n", "head_limit", "multiline"].includes(key))) {
          throw new Error("READ_ARGUMENTS_INVALID");
        }
        for (const key of ["-A", "-B", "-C"]) {
          if (args[key] !== undefined && (!Number.isSafeInteger(args[key]) || (args[key] as number) < 0 || (args[key] as number) > 10)) {
            throw new Error("READ_ARGUMENTS_INVALID");
          }
        }
        // Native grep does not follow directory symlinks; callers cannot enable that option.
        return {
          permissionDecision: "allow",
          modifiedArgs: {
            ...args,
            paths: files,
            glob: args.glob ?? "**",
            head_limit: 100,
            "-n": true,
          },
        };
      } catch (error) {
        const code = error instanceof Error && /^READ_[A-Z_]+$/.test(error.message) ? error.message : "READ_CHECK_FAILED";
        return { permissionDecision: "deny", permissionDecisionReason: `WELLACTUALLY_READ_POLICY_DENIED:${code}` };
      }
    },
    /** 모델에 전달할 결과가 문자열인지 확인하고, 출력 크기를 제한하며 잘림 표시를 붙인다. */
    onPostToolUse(input) {
      const result = input.toolResult;
      const text = result.textResultForLlm;
      if (typeof text !== "string") {
        return { modifiedResult: { resultType: "failure", textResultForLlm: "WELLACTUALLY_TOOL_RESULT_INVALID" } };
      }
      const bounded = boundedToolText(text);
      return {
        modifiedResult: {
          resultType: result.resultType,
          textResultForLlm: bounded.truncated ? `${bounded.text}\n[WELLACTUALLY_TRUNCATED]` : bounded.text,
        },
      };
    },
  };
  /** 별도 예외 승인이 필요 없는 읽기 요청만 경로를 재검증한 뒤 허용한다. */
  const onPermissionRequest: PermissionHandler = async request => {
    // 읽기 승인이 쓰기, 관리 정책 예외 또는 샌드박스 우회까지 허용해서는 안 된다.
    if (request.kind !== "read" || request.managedApprovalRequired || request.requestSandboxBypass) return { kind: "reject" };
    try {
      await safePath(request.path);
      return { kind: "approved" };
    } catch {
      return { kind: "reject" };
    }
  };
  return {
    root,
    /** 외부 코드가 내부 연결 정보를 직접 바꾸지 못하도록 드라이버 정보를 복사해 반환한다. */
    get driver() {
      return driver ? { ...driver } : null;
    },
    hooks,
    onPermissionRequest,
    sourceFiles,
    async setDriver(next) {
      if (next) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(next.sessionId)) throw new Error("READ_DRIVER_INVALID");
        if (next.kind === "vscode-chat") {
          const extension = path.extname(next.file);
          if (![".jsonl", ".json"].includes(extension) ||
              path.basename(next.file, extension) !== next.sessionId ||
              !path.isAbsolute(next.file) || path.normalize(next.file) !== next.file ||
              await realpath(next.file) !== next.file || !(await lstat(next.file)).isFile()) {
            throw new Error("READ_DRIVER_INVALID");
          }
          if (next.artifactsDirectory) {
            const artifacts = next.artifactsDirectory;
            if (!path.isAbsolute(artifacts) || path.normalize(artifacts) !== artifacts ||
                path.basename(artifacts) !== next.sessionId || path.basename(path.dirname(artifacts)) !== "chatEditingSessions" ||
                await realpath(artifacts) !== artifacts || !(await lstat(artifacts)).isDirectory()) {
              throw new Error("READ_DRIVER_INVALID");
            }
          }
        } else if (!path.isAbsolute(next.directory) || path.normalize(next.directory) !== next.directory ||
            path.basename(next.directory) !== next.sessionId ||
            await realpath(next.directory) !== next.directory ||
            !(await lstat(next.directory)).isDirectory()) throw new Error("READ_DRIVER_INVALID");
      }
      driver = next ? { ...next } : null;
    },
  };
}
