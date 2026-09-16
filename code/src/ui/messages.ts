import type { ChatState, DriverSource } from "../contracts.js";

export const MAX_MESSAGE_BYTES = 16 * 1024;

type ChatAction =
  | "newChat"
  | "stopReply"
  | "end"
  | "selectDriver"
  | "disconnectDriver";

// UI 명령은 호스트가 처리하는 작업이며, 모델에 전달하는 자연어 지시가 아니다.
export type ViewCommand =
  | { type: "ready"; requestId: string }
  | { type: "message"; requestId: string; chatId: string; text: string }
  | { type: ChatAction; requestId: string; chatId: string };

export interface ViewState {
  type: "state";
  chat: ChatState;
  driver: DriverSource | null;
  workspaceLabel: string;
  notice: string;
  starting: boolean;
  selectingDriver: boolean;
}

export type ViewEvent =
  | ViewState
  | { type: "replyStart"; requestId: string; chatId: string }
  | { type: "replyDelta"; requestId: string; text: string }
  | { type: "replyEnd"; requestId: string }
  | { type: "tool"; requestId: string; name: string; state: "started" | "completed" }
  | { type: "error"; requestId?: string; message: string };

const chatActions = new Set<string>([
  "newChat", "stopReply", "end", "selectDriver", "disconnectDriver",
]);

/** 웹뷰 명령 검증 실패를 공통 오류 코드와 상세 사유로 전달한다. */
function invalid(message: string): never {
  throw new Error(`INVALID_VIEW_COMMAND: ${message}`);
}

/** 요청·대화 식별자가 허용된 문자와 길이 범위를 지키는지 확인한다. */
function identifier(value: unknown, name: string, maxLength = 256): asserts value is string {
  if (typeof value !== "string" || value.length > maxLength || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    invalid(`${name} must be a bounded identifier.`);
  }
}

/** 브라우저에서 온 명령의 종류, 식별자, 질문 크기와 필드 구성을 검증해 호스트 명령으로 변환한다. */
export function parseViewCommand(value: unknown): ViewCommand {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid("Expected a Pair action.");
  }
  const record = value as Record<string, unknown>;
  identifier(record.requestId, "requestId", 128);
  const type = record.type;
  let keys: readonly string[];
  if (type === "ready") {
    keys = ["type", "requestId"];
  } else if (type === "message" || (typeof type === "string" && chatActions.has(type))) {
    identifier(record.chatId, "chatId");
    keys = ["type", "requestId", "chatId"];
    if (type === "message") {
      keys = [...keys, "text"];
      if (typeof record.text !== "string" || !record.text.trim()) invalid("Enter a message for Pair.");
      if (record.text.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(record.text).byteLength > MAX_MESSAGE_BYTES) {
        invalid("Keep your message within 16 KiB of UTF-8 text.");
      }
    }
  } else {
    invalid("This Pair action is not supported.");
  }
  const ownKeys = Object.keys(record);
  if (ownKeys.length !== keys.length || ownKeys.some(key => !keys.includes(key))) {
    invalid("Unexpected or missing action fields.");
  }
  return { ...record } as ViewCommand;
}
