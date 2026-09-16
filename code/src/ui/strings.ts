import { formatMessage, type MessageValues } from "../format.js";

export const uiMessages = {
  title: "Wellactually 페어",
  settings: "설정", openSettings: "설정 열기", closeSettings: "설정 닫기",
  sessionActions: "대화 작업",
  startConversation: "AI와 함께하는 페어 프로그래밍",
  startConversationHelp: "Wellactually는 AI와 함께 설계와 구현 방향을 논의하는 페어 프로그래밍 파트너입니다. 메시지를 보내면 현재 프로젝트 폴더 전체를 읽기 전용으로 공유합니다.",
  readyShort: "준비됨", connectingShort: "페어 연결 중", workingShort: "페어 응답 중", endedShort: "대화가 종료되었습니다",
  composerHint: "Enter로 전송 · Shift+Enter로 줄바꿈",
  composerPlaceholder: "설계나 구현에 대한 고민을 함께 논의해 보세요...",
  connecting: "확장에 연결하는 중...",
  busyComposer: "응답을 기다리거나 중단한 뒤 논의를 이어가세요.",
  closedComposer: "새로운 논의는 새 대화에서 시작하세요. 드라이버 작업은 계속할 수 있습니다.",
  newMessages: "새 메시지", thinking: "응답을 준비하는 중...", readingContext: "프로젝트 맥락을 읽는 중...",
  newChat: "새 대화", end: "대화 종료",
  conversationAria: "사용자와 페어의 대화", currentReply: "현재 페어 응답",
  askLabel: "페어와 논의할 내용", ask: "메시지 보내기", stopReply: "응답 중단",
  roleHuman: "사용자", roleCoach: "페어", sourceRead: "읽은 자료: {source}", toolSource: "도구 출력",
  partialSource: "일부 발췌", partialReply: "일부 응답",
  driverTitle: "드라이버 연결", noDriver: "선택한 드라이버 세션이 없습니다.",
  selectingDriver: "드라이버 세션 선택이 끝날 때까지 연결 변경이나 해제를 기다려 주세요.",
  selectDriver: "드라이버 세션 선택", changeDriver: "드라이버 세션 변경", disconnectDriver: "연결 해제",
  driverSession: "세션: {sessionId}",
  settingsConnectionHelp: "선택한 세션의 기록과 파일을 읽기 전용으로 공유합니다. 일반 Copilot Chat은 해당 대화 파일과 전용 편집 자료만 공유하며 다른 대화에는 접근하지 않습니다. 원본을 복사하거나 감시하지 않으며 민감한 내용도 자동 제외되지 않습니다.",
  projectTitle: "현재 프로젝트", noProject: "열린 로컬 프로젝트가 없습니다.",
  projectHelp: "첫 메시지를 보내면 프로젝트 폴더 전체를 읽기 전용으로 공유합니다. 숨김 파일과 민감한 파일도 포함됩니다. 파일 수정이나 드라이버 제어는 할 수 없습니다.",
  emptyQuestion: "논의할 내용을 입력하세요.",
  questionLimit: "메시지는 UTF-8 기준 16 KiB 이내로 입력하세요.",
  transportFailed: "확장에 작업을 전달하지 못했습니다. 페어 화면을 다시 열어 시도하세요.",
  invalidAction: "올바르지 않은 페어 작업입니다.",
  actionFailed: "작업을 완료하지 못했습니다. 대화를 확인하고 다시 시도하세요.",
};

export type UiMessage = keyof typeof uiMessages;

/** 웹뷰 UI 문구의 자리표시자를 전달된 값으로 치환하며, 필요한 값이 없으면 오류를 발생시킨다. */
export function uiText(key: UiMessage, values: MessageValues = {}): string {
  return formatMessage(uiMessages[key], values);
}
