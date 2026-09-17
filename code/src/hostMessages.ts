import { formatMessage, type MessageValues } from "./format.js";

const messages = {
  authDetail: "기존 SDK 인증을 사용할 수 없습니다. 별도 페어가 GitHub 계정을 사용하도록 허용하세요. 인증 정보는 대화에 포함되지 않습니다.",
  chooseWorkspace: "이 대화에서 참고할 열린 프로젝트를 선택하세요",
  noWorkspace: "페어가 코드를 참고할 수 있도록 로컬 프로젝트 폴더를 여세요.",
  chooseDriver: "드라이버 세션 선택 · 전체 {count}개",
  driverSessionScope: "일반 Copilot Chat과 에이전트 세션을 전체 프로젝트에서 찾습니다. 제목이나 프로젝트로 검색하세요. 선택한 세션만 페어와 공유합니다.",
  driverLastActive: "최근 활동: {time} · 세션: {sessionId}",
  noDriverSessions: "저장된 Copilot 세션이 없습니다. 세션을 만든 뒤 다시 선택하세요.",
  driverNoRecords: "로컬 대화 기록 없음",
  driverSessionNotReady: "선택한 세션의 대화 기록이 아직 준비되지 않았습니다 ({code}). 해당 세션에서 대화를 시작한 뒤 다시 선택하세요.",
  driverUntitled: "제목 없는 세션",
  driverUnknownProject: "프로젝트 정보 없음",
  driverVscodeSource: "VS Code 에이전트 세션",
  driverChatSource: "VS Code Copilot Chat",
  driverCopilotSource: "Copilot 저장소",
  driverSourceUnavailable: "연결 가능한 로컬 기록을 확인할 수 없습니다",
  driverSessionSourceUnavailable: "선택한 세션의 로컬 기록을 찾거나 확인할 수 없습니다 ({code}). VS Code에서 원래 세션을 확인하세요. 다른 세션의 기록으로 대신 연결하지 않습니다.",
  driverSessionsSkipped: "세션 정보 {count}건을 읽지 못했습니다. 일부 제목이나 세션이 누락될 수 있습니다. Wellactually 출력에서 오류를 확인하세요.",
  driverConnected: "드라이버 세션을 연결했습니다. 논의에 필요할 때 페어가 선택한 세션의 기록과 파일을 읽을 수 있으며 기록을 복사하거나 자동 감시하지 않습니다.",
  driverDisconnected: "드라이버 연결을 해제했습니다. 이미 논의한 발췌는 대화에 남습니다.",
  connecting: "가능한 기존 인증을 사용해 페어를 연결하고 있습니다...",
  ended: "대화를 종료했습니다. 드라이버는 계속 작업할 수 있습니다. 새 대화에서 논의를 시작하세요.",
  workspaceChanged: "열린 프로젝트가 바뀌었습니다. 현재 프로젝트를 사용하려면 새 대화를 시작하세요.",
  failed: "작업을 완료하지 못했습니다: {code}. 드라이버에는 영향이 없습니다.",
  cleanupFailed: "실행 자원 정리를 확인하지 못했습니다 ({code}). 새 대화를 다시 시도하고, 계속 실패하면 진행 중인 작업을 확인한 뒤 VS Code 창을 다시 로드하세요.",
  chooseModel: "페어 모델 선택",
  modelRecommendation: "복잡한 설계 논의에는 최신 고성능(프론티어) 모델을 권장합니다. 응답 속도와 사용량도 고려하세요.",
  chooseReasoning: "추론 수준 선택",
  modelNextMessage: "대화와 드라이버 연결은 유지하고 다음 메시지부터 적용합니다.",
  selectedOption: "현재 선택",
  reasoningNone: "사용 안 함", reasoningLow: "낮음", reasoningMedium: "보통", reasoningHigh: "높음",
  reasoningXhigh: "매우 높음", reasoningMax: "최대",
  reasoningUnavailable: "이 모델은 선택 가능한 추론 수준을 제공하지 않습니다 ({code}). 모델의 기본 설정을 사용합니다.",
  modelSwitchFailed: "모델 변경을 확인하지 못해 현재 대화를 종료했습니다 ({code}). 새 대화에서 다시 선택하세요.",
  modelSaveFailed: "모델은 이번 대화에 적용됐지만 다음 대화를 위한 설정을 저장하지 못했습니다 ({code}).",
} as const;

export type HostMessage = keyof typeof messages;

/** 호스트 알림 문구의 자리표시자를 전달된 값으로 치환하며, 필요한 값이 없으면 오류를 발생시킨다. */
export function hostText(key: HostMessage, values?: MessageValues): string {
  return formatMessage(messages[key], values);
}

export function hostFailureText(code: string): string {
  const key = code === "COACH_CLEANUP_FAILED" ? "cleanupFailed"
    : code === "COACH_REASONING_UNAVAILABLE" ? "reasoningUnavailable"
    : code === "COACH_MODEL_SWITCH_FAILED" ? "modelSwitchFailed"
    : code === "COACH_MODEL_PREFERENCE_SAVE_FAILED" ? "modelSaveFailed"
    : code === "DRIVER_SESSION_NOT_READY" ? "driverSessionNotReady"
    : code === "DRIVER_SESSION_SOURCE_UNAVAILABLE" ? "driverSessionSourceUnavailable" : "failed";
  return hostText(key, { code });
}
