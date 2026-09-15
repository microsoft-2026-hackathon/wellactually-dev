export interface DriverSource {
  directory: string;
  sessionId: string;
  title: string;
}

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
