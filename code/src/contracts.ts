import type { ModelInfo } from "@github/copilot-sdk";
// SDK 1.0.13's RPC advertises "none", but its exported model-info enum omits it.
export type ReasoningEffort = "none" | NonNullable<ModelInfo["supportedReasoningEfforts"]>[number];

export interface SdkDriverSource {
  kind?: "sdk";
  directory: string;
  sessionId: string;
  title: string;
}

export interface VscodeChatSource {
  kind: "vscode-chat";
  file: string;
  artifactsDirectory?: string;
  sessionId: string;
  title: string;
}

export type DriverSource = SdkDriverSource | VscodeChatSource;

/** 화면 표시용 기록이며, SDK의 대화 메모리나 검증된 사실을 나타내지는 않는다. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  source?: string;
  partial?: boolean;
}

export type CoachDelta =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; state: "started" | "completed" }
  | { kind: "source"; message: ChatMessage };

export interface CoachRuntime {
  readonly sessionId: string;
  readonly closed: boolean;
  listModels(): Promise<readonly PairModel[]>;
  setModel(selection: ModelSelection): Promise<void>;
  /** 새 질문에 대한 응답 조각과 도구 활동, 읽은 자료를 순차적으로 전달한다. */
  stream(prompt: string, signal: AbortSignal): AsyncIterable<CoachDelta>;
  /** Replace or revoke the selected Driver session tree without resetting the conversation. */
  setDriver(driver: DriverSource | null): Promise<void>;
  /** Stop the current Pair response and wait for its work to settle. */
  cancel(): Promise<void>;
  /** Close Pair-owned resources without affecting the Driver. */
  close(): Promise<void>;
}

export interface ChatState {
  id: string;
  status: "idle" | "working" | "ended";
  messages: readonly ChatMessage[];
}
export interface ModelSelection {
  modelId: string;
  reasoningEffort?: ReasoningEffort;
}

export interface PairModel {
  id: string;
  name: string;
  reasoningEfforts: readonly ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
}

export interface ModelViewState {
  id: string;
  name: string;
  reasoningEffort: ReasoningEffort | null;
  reasoningAvailable: boolean | null;
  busy: boolean;
}
