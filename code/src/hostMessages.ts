import { formatMessage, type MessageValues } from "./format.js";

const messages = {
  authDetail: "기존 SDK 인증을 사용할 수 없습니다. 별도 페어가 GitHub 계정을 사용하도록 허용하세요. 인증 정보는 대화에 포함되지 않습니다.",
  chooseWorkspace: "이 대화에서 참고할 열린 프로젝트를 선택하세요",
  noWorkspace: "페어가 코드를 참고할 수 있도록 로컬 프로젝트 폴더를 여세요.",
  chooseDriver: "최근 VS Code 드라이버 세션 선택",
  driverSessionScope: "선택한 세션 폴더의 모든 기록과 파일을 페어와 공유합니다. 현재 프로젝트의 세션이 먼저 표시됩니다.",
  driverLastActive: "최근 활동: {time} · 세션: {sessionId}",
  noDriverSessions: "연결할 VS Code Copilot 세션이 없습니다. VS Code에서 Copilot 세션을 시작한 뒤 다시 선택하세요.",
  driverSessionsSkipped: "세션 {count}개의 정보를 읽을 수 없어 목록에서 제외했습니다. Wellactually 출력에서 오류를 확인하세요.",
  driverConnected: "드라이버 세션을 연결했습니다. 논의에 필요할 때 페어가 세션 폴더 전체를 읽을 수 있으며 기록을 복사하거나 자동 감시하지 않습니다.",
  driverDisconnected: "드라이버 연결을 해제했습니다. 이미 논의한 발췌는 대화에 남습니다.",
  connecting: "가능한 기존 인증을 사용해 페어를 연결하고 있습니다...",
  ended: "대화를 종료했습니다. 드라이버는 계속 작업할 수 있습니다. 새 대화에서 논의를 시작하세요.",
  workspaceChanged: "열린 프로젝트가 바뀌었습니다. 현재 프로젝트를 사용하려면 새 대화를 시작하세요.",
  failed: "작업을 완료하지 못했습니다: {code}. 드라이버에는 영향이 없습니다.",
} as const;

export type HostMessage = keyof typeof messages;

/** 호스트 알림 문구의 자리표시자를 전달된 값으로 치환하며, 필요한 값이 없으면 오류를 발생시킨다. */
export function hostText(key: HostMessage, values?: MessageValues): string {
  return formatMessage(messages[key], values);
}
