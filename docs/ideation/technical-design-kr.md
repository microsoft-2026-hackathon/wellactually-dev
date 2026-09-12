# Wellactually · 기술 설계와 데이터 흐름

<a id="top"></a>

개정일: 2026-09-12 · 파일 기반 해커톤 MVP 반영

**기존 Driver를 유지하고, Coach는 SDK의 기본 읽기 도구로 코드와 선택한 로컬 작업 기록을 활용합니다.**

Coach와 먼저 논의하고, 사람이 Driver에 지시할 때 한 작업 회전을 닫습니다. 관찰한 결과를 공동 리뷰에 연결하고, 페어링 종료 시 고정된 기록으로 Knowledge Compilation 보고서를 생성합니다.

파일 기반 해커톤 MVP · 현재 CLI/SDK 로그 읽기·증분 감지 확인 · Coach 읽기 전용 프로필은 검증 전 · Voice Mode 제외 · 코드 예시: 내부 계약과 연결 지점

2026-09-12 파일 접근 실험과 해커톤 범위 결정을 반영했습니다. AHP 연결이나 별도 Workspace Reader를 먼저 만들지 않습니다. 실측은 현재 Copilot CLI/SDK 세션에 한정되며, 다른 하네스와 앞으로 만들 Coach의 권한·실제 SDK 통합까지 검증한 것은 아닙니다. 코드 블록은 구현할 계약·핵심 로직의 예시입니다.

도표는 Mermaid로 표현하며, 코드와 데이터 계약은 문서에 직접 포함합니다.

<a id="direction"></a>

## 1. 설계 범위

타깃은 코딩 에이전트로 개발을 시작했지만 문제 정의, 설계 판단, 작업 위임을 충분히 경험하지 못한 개발자입니다. 요청 전달이나 테스트 실행의 수고를 줄이는 것보다, 사람이 판단하고 지시하는 과정을 유지하는 것이 중요합니다.

그대로 사용할 것

### 기본 Copilot의 작업 경험

- Driver와 대화하는 입력창과 응답 화면
- 조사·구현·검증을 수행하는 에이전트 하네스
- 해당 하네스의 도구 승인·변경 확인 UI
- 사용자가 직접 선택하는 모델과 작업 요청

wellactually가 만들 것

### 사람과 Coach의 대화 기능

- Driver Custom Agent와 별도 Coach UI
- Driver 연결 전에도 시작할 수 있는 Coach 대화
- 작업 위임 시 선택한 Driver 로컬 로그의 경로·세션 확인
- SDK 기본 파일 읽기·목록·검색 도구의 읽기 전용 설정
- 관련 문맥 구성과 선제적 Coach 호출
- 권한 제한, 중복 질문 억제, 연결·비용 상태 표시
- 페어링 상태와 종료 후 지식 정리·HTML 저장

**MVP에서 줄이는 것:** 전용 Workspace Reader와 범용 세션 Reader 프레임워크는 만들지 않습니다. 코드·로그 읽기는 기존 SDK 도구를 재사용하고, 정확한 회전 추적과 자동 개입에 필요한 경로 확인·변경 알림·JSONL 증분 처리는 작은 보조 함수로 시작합니다. 모든 원문을 별도 DB에 복제하지 않습니다.

**사람이 Driver에게 직접 지시합니다.**

Coach는 빠진 조건을 지적하거나 선택지를 설명할 수 있습니다. 그러나 최종 지시문을 대신 완성해서 전달하거나, 승인만 받으면 실행하는 대리 요청자가 되지 않습니다. Coach의 동의도 작업 실행의 필수 조건이 아닙니다.

### “확인됨”과 “구현 가능성이 있음”을 구분합니다

공식 문서에 기능이 있거나 공개 소스에 경로가 있다는 사실만으로, 현재 설치된 VS Code에서 제품 연결까지 동작한다고 볼 수는 없습니다.

**이 문서의 상태 표현**

| 표현 | 의미 | 현재 해당하는 내용 |
|----|----|----|
| 로컬 실측 | 현재 세션의 실제 파일을 읽고 새 출력을 감지했습니다. | JSONL 기록 읽기, toolCallId 연결, 출력 후 약 249ms 감지, 감시 종료 후 재조회 |
| MVP 설계 | 실측을 바탕으로 선택한 구현 방향입니다. | SDK 기본 읽기·검색, 선택한 Driver 로그, 최소 변경 트리거, 별도 동결 보고서 입력 |
| 검증 필요 | 이번 실험으로 보장되지 않은 부분입니다. | 읽기 전용 도구·경로 권한, 다른 Copilot 하네스, 큰 출력·로그 회전·Host 재시작 |

<a id="system-overview"></a>

## 2. 시스템 아키텍처 개요

기존 Driver의 로컬 기록과 현재 코드 워크스페이스를 재사용합니다. 파일 변경은 코칭의 트리거이고, 실제 읽기는 SDK 도구와 필요한 최소 증분 처리로 수행합니다. 종료 후 Compiler의 입력은 별도로 고정합니다.

``` mermaid
flowchart TB
    subgraph existing["기본 VS Code / Copilot"]
      ui["기존 Copilot Driver UI<br/>사람이 직접 입력·전송·승인"]
      driver["기존 Driver 런타임<br/>실측: Copilot CLI / SDK"]
      log["events.jsonl<br/>선택한 세션의 요청·응답·도구 인자·결과"]
      workspace["현재 코드 워크스페이스<br/>SDK 기본 읽기·검색 도구"]
      ui <-->|"기존 UI·세션 연결"| driver
      driver -->|"로컬 기록 저장"| log
    end
    subgraph extension["Wellactually 확장 · UI + Host"]
      controller["Coach UI · Session Controller<br/>WebviewView + Extension Host"]
      trigger["파일 변경 트리거 · 문맥 정리<br/>최소 증분 처리 / 중복·호출 억제"]
      journal["대화·관찰·결정 기록 묶음<br/>Driver 기록 + 읽은 코드 + 대화·결정"]
      trigger -->|"관련 문맥 → 코칭 평가"| controller
      trigger -->|"관찰 기록"| journal
      controller -->|"대화 기록"| journal
    end
    subgraph runtimes["별도 AI 세션 + 보고서 산출물"]
      coach["독립 Coach 세션<br/>SDK 기본 파일 읽기·검색 + 역할 지침"]
      compiler["Knowledge Compiler<br/>구조화된 보고서 데이터 반환"]
      report["HTML Report<br/>확장의 검증·템플릿·선택 저장"]
      compiler -->|"구조 검증"| report
    end
    log -->|"파일 변경·증분"| trigger
    controller <--> coach
    coach -->|"허용 범위의 SDK 읽기·검색"| workspace
    coach -->|"공유한 로그 읽기"| log
    journal -->|"종료 시 고정한 근거"| compiler
```

그림은 Coach의 데이터 접근 경로를 중심으로 표시합니다. Driver의 코드 변경·실행은 기존 UI와 권한 체계를 유지합니다. 현재 로그 파일 읽기·변경 감지는 확인했지만, 새 Coach 읽기 프로필과 다른 하네스 지원은 검증 전입니다.

Coach → Driver 실행 경로는 없으며 편집·셸·Driver 제어 도구를 제외합니다. 별도 Reader 없이 SDK 도구를 재사용하고, AHP는 후속 대안으로 둡니다.

현재 파일 접근 PoC만 확인했으며 읽기 전용 프로필은 추가 검증합니다. 일시 중지·종료 시 자동 개입을 멈추고 기록 누락·연결 실패를 명시합니다.

<a id="architecture"></a>

## 3. 모듈과 데이터 계약

기존 Driver의 실행은 복제하지 않습니다. SDK 기본 도구로 워크스페이스를 읽고, 선택한 로컬 세션 로그의 필요한 기록과 읽기 결과를 Journal에 연결합니다. Controller는 상태·트리거를 관리하고, Compiler에는 종료 시 고정한 입력만 제공합니다.

``` mermaid
flowchart TB
    subgraph native["기존 Driver"]
      chat["Native Copilot Chat<br/>사용자 직접 지시·승인"]
      driver["기존 Driver Runtime<br/>실측: Copilot CLI / SDK"]
      workspace["Workspace<br/>코드 변경·테스트"]
      chat <--> driver
      driver --> workspace
    end
    subgraph extension["Wellactually 제공 모듈"]
      controller["Pairing Controller<br/>상태·회전·바인딩·종료"]
      log["선택한 Driver 로그<br/>events.jsonl · 필요한 새 구간"]
      view["Coach WebviewView<br/>입력·응답·상태 표시"]
      journal["Evidence Journal / Store<br/>출처·순서·버전·확인된 결정"]
      scheduler["Context Builder / Scheduler<br/>근거 선별·요청 우선순위·예산"]
      coach["Coach Runtime / Policy<br/>기본 읽기 도구·읽기 범위·Lease"]
      frozen["Frozen EvidenceSnapshot<br/>종료 시점의 불변 입력"]
      compiler["Knowledge Compiler<br/>스냅샷 → 구조화된 데이터"]
      exporter["Validator / Renderer / Export<br/>검증 → HTML → 사용자 선택 저장"]
      view <--> controller
      controller -->|"선택·변경 감지"| log
      controller --> journal
      log --> journal
      journal --> scheduler
      scheduler --> coach
      journal -->|"사용자 종료 → Journal @ cutoff"| frozen
      frozen --> compiler
      compiler --> exporter
    end
    driver -->|"로컬 파일 기록"| log
    coach -->|"SDK 기본 읽기·검색"| workspace
```

선은 주요 데이터·제어 전달 경로입니다. 시간순 요청·응답은 [07 시퀀스](#experience)에서 구분합니다. Webview는 UI, Controller·관찰·스케줄링·저장은 Extension Host 책임이며, SDK는 별도 Copilot 런타임에 연결합니다.

파일 접근 PoC만 확인했습니다. SDK 읽기 프로필은 검증이 필요하며 AHP / Workspace Reader는 MVP에 추가하지 않습니다.

**제안 디렉터리 · 의존성 방향**

``` text
src/
  extension.ts                 # 의존성 조립·등록·dispose
  domain/pairing.ts             # SDK에 의존하지 않는 상태·회전
  ui/coachView.ts               # Webview 메시지 검증·렌더링
  pairing/controller.ts        # 세션별 직렬화·Lease·종료
  driver/localLog.ts          # 선택 로그·증분 커서·변경 알림의 작은 보조 함수
  context/journal.ts           # 순서·중복·출처
  context/snapshots.ts         # 불변 스냅샷·범위·해시
  coach/scheduler.ts           # 직접 질문 우선·단일 실행
  coach/runtime.ts             # SDK 생성·도구·취소·이벤트
  compilation/compiler.ts     # 고정 입력 → 보고서 데이터
  compilation/schema.ts       # 보고서 JSON Schema·타입 정의
  compilation/validate.ts     # 스키마·출처·상태 검사
  compilation/render.ts       # 고정 HTML 템플릿
  compilation/export.ts       # 저장 대화상자·선택 경로 쓰기

UI → Controller → domain / ports
워크스페이스 읽기는 SDK 기본 도구 재사용
AHP 어댑터·별도 Workspace Reader는 MVP에서 제외
Compiler → FrozenSnapshot (읽기), Driver client 접근 없음
```

이 경로들은 구현할 모듈의 설계이며, 현재 저장소에 생성된 소스 파일이 아닙니다.

**TypeScript · 핵심 도메인 DTO (Wellactually 내부 계약)**

``` typescript
type PairingStatus =
  | "active" | "paused" | "closing" | "closed" | "close_failed";
type IterationStage = "discussing" | "driver_pending" | "reviewing";

interface DriverBinding {
  bindingId: string;
  generation: number;
  workspaceUri: string;
  logFileUri: string;
  sdkSessionId: string;
  format: "copilot-sdk-events-jsonl";
}

interface PairingSession {
  pairingId: string;
  status: PairingStatus;
  stage: IterationStage;
  iteration: number;
  epoch: number;
  revision: number;  // 외부 입력·변경 버전. 본인 도구 결과 추가와 분리
  driver: DriverBinding | null;  // Coach는 연결 없이 시작 가능
}

interface Evidence {
  id: string;
  source: "human" | "coach" | "driver" | "tool" | "file";
  sourceRef: string;
  sourceVersion: string;
  recordedAt: string;
  completeness: "complete" | "partial" | "in_progress";
  text: string;
}

interface Decision {
  id: string;
  status: "proposed" | "human_confirmed" | "revised";
  choice: string;
  reason: string;
  evidenceIds: readonly string[];
}

interface EvidenceSnapshot {
  readonly snapshotId: string;
  readonly pairingId: string;
  readonly revision: number;
  readonly cutoff: number;  // 확장 Journal의 마지막 포함 순번
  readonly sha256: string;
  readonly coverage: {
    readonly driver: "unbound" | "current" | "partial";
    readonly gaps: readonly string[];
  };
  readonly evidence: readonly Readonly<Evidence>[];
  readonly decisions: readonly Readonly<Decision>[];
}
```

`pairingId`는 로그의 SDK sessionId와 다릅니다. 선택 파일의 세션 메타데이터를 확인한 뒤 연결하며, 파일 이름만으로 현재 Driver라고 판단하지 않습니다. `cutoff`는 우리 Journal의 포함 경계입니다. 파일의 바이트 커서와도 구분합니다.

### 스냅샷 불변성

복사한 DTO를 검증·직렬화한 뒤 읽기 전용 저장소에 넣습니다. 타입의 `readonly`만으로 런타임 불변성이 생기지 않습니다. 해시는 입력 무결성용이며, 내용의 사실성을 보증하지 않습니다.

### 상태의 독립성

페어링 상태, Driver 작업 상태, 보고서 Job 상태를 각각 관리합니다. Driver 완료는 페어링 종료가 아니고, Compiler 실패도 Native 작업 실패가 아닙니다.

### 검증한 환경과 지원할 환경

파일 접근은 현재 대화의 **Copilot CLI/SDK 세션**에서 확인했습니다. 다른 Native Copilot 하네스도 같은 경로·형식·보존 범위를 가진다고 가정하지 않습니다. 해커톤은 검증한 실행 방식에 먼저 맞추고, 기존 Driver UI는 그대로 둡니다. 지원 환경을 넓힐 때 파일 접근과 AHP를 다시 비교합니다. [\[1\]](#source-01)

화면: 기존 Driver UI 실측: Copilot CLI/SDK 역할: wellactually Driver 모델: 사용자가 선택
<a id="driver"></a>

## 4. Driver 연결과 지시 경계

Driver는 일부러 약하게 만든 에이전트가 아닙니다. 맡은 범위에서는 유능하게 조사·구현하되, 중요한 제품 정책과 작업 범위 변경을 사람에게 돌려주는 역할입니다.

### 확장에 Driver 에이전트를 포함합니다

`contributes.chatAgents`로 확장 패키지의 에이전트 파일을 제공할 수 있습니다. 프로젝트마다 파일을 복사하게 하는 방식만 있는 것은 아닙니다. 아래는 앞으로 만들 패키지 구성의 일부이며, 현재 적용된 설정은 아닙니다. [\[2\]](#source-02)

``` json
{
  "contributes": {
    "chatAgents": [
      { "path": "./agents/driver.agent.md" }
    ]
  }
}
```

역할 본문은 Driver 페르소나의 지침을 기반으로 구성합니다. Coach 지침을 프로젝트 공통 지침에 섞어 Driver에게 함께 적용하지 않습니다.

**Coach-first:** 사용자는 Coach에 작업 맥락과 공유 범위를 먼저 전달합니다. Driver에게 작업을 맡길 때 선택한 세션의 로그 경로를 연결합니다. 기존 기록은 초기 문맥으로 읽되, 이전 지시를 이번 회전의 새 전송으로 처리하지 않습니다.

**Driver의 역할과 설정 경계**

| 항목 | 설계 | 주의점 |
|----|----|----|
| 작업 요청 | 사람이 기본 Chat 입력창에서 작성·전송합니다. | wellactually에 별도 Driver 전송 버튼을 만들지 않습니다. |
| 구현 재량 | 목표를 바꾸지 않는 구현 세부는 Driver가 처리합니다. | 중요한 설계·정책 변경까지 일일이 대신 정하지 않습니다. |
| 도구와 승인 | 선택한 하네스의 도구 설정과 승인 체계를 사용합니다. | 페르소나만으로 파일·명령 권한을 강제할 수는 없습니다. |
| Coach와의 관계 | Coach의 별도 대화를 Driver 지침으로 자동 주입하지 않습니다. | Handoff, 추가 문맥, 공용 지침 파일로 우회 전달하지 않습니다. |

**빈 도구 목록을 “모든 도구 금지”라고 가정하면 안 됩니다.**

확인한 Copilot Agent Host 변환 소스에서는 Custom Agent의 빈 `tools: []`가 전체 도구 허용을 뜻하는 값으로 변환됩니다. Local과 Agent Host의 설정 해석이 같다고 가정하지 말고 실제 노출 도구를 시험해야 합니다. 아래에서 다루는 SDK 세션의 `availableTools` 설정과도 다른 층위입니다. [\[3\]](#source-03)

<a id="session-access"></a>

## 5. 로컬 세션 기록과 파일 실험

프로젝트 코드와 Driver의 세션 기록은 다른 자료입니다. 코드·diff는 구현 상태를, 선택한 세션의 JSONL은 요청·응답·도구 실행을 설명합니다. 해커톤은 이 두 파일 입력을 먼저 사용하고, 부족한 경우에만 AHP 같은 다른 연결을 검토합니다.

### 2026-09-12 실제 파일 테스트

**현재 Copilot CLI/SDK 세션에 한정한 관찰 결과**

| 확인 항목 | 실측 | 해석 |
|----|----|----|
| 기존 기록 읽기 | 약 19.7MB, JSONL 2,720개 레코드, 파싱 오류 0개. 현재 사용자 요청 확인 | 처음부터 감시하지 않았어도 보존된 대화 기록을 파일로 읽을 수 있었음 |
| 작업 내역 | user.message, assistant.message, tool.execution_start / complete 확인 | 도구 인자와 result의 content·detailedContent 필드가 존재하며 toolCallId로 연결 가능 |
| 새 출력 감지 | 실행 시 생성한 UUID 문자열을 출력. 100ms 주기 파일 감시에서 약 249ms 후 완료 결과 검출 | 새 결과를 파일 변경으로 감지할 수 있었음. 한 번의 측정이며 지연 보장이 아님 |
| 감시 종료 후 재조회 | 파일을 다시 열어 같은 toolCallId의 원래 인자·결과 확인 | 임시 알림만 받은 것이 아니라 파일에 남은 결과를 읽었음 |
| 사용한 경로 | Node 파일 읽기·변경 감지만 사용. AHP 연결·DB 조회 없음 | 현재 환경에서 파일 기반 접근의 가능성을 확인한 것이지 Coach 권한 설정까지 시험한 것은 아님 |

**검증하지 않은 것:** 다른 Native Copilot 하네스의 저장 경로·형식, 읽기 전용 Coach의 실제 파일 접근, 큰 출력의 외부 파일 참조, 로그 회전, Host 재시작 후 복원입니다. 시스템·인증 내용을 모델에 보내는 시험도 하지 않았습니다. 원문 대신 구조와 무해한 테스트 출력만 확인했고 임시 감시 프로세스·스크립트는 정리했습니다.

**JSON · 파일 실험 결과 요약**

``` json
{
  "scope": "current Copilot CLI/SDK session",
  "recordsRead": 2720,
  "invalidJsonLines": 0,
  "toolStartCorrelated": true,
  "toolResultMarkerFound": true,
  "detectedAfterEmitMs": 249,
  "pollIntervalMs": 100,
  "retainedAfterWatcherExit": true,
  "ahpConnectionUsed": false,
  "databaseRead": false,
  "coachReadOnlyProfileTested": false
}
```

실측의 요약이지 SDK 이벤트 payload가 아닙니다. 세션 경로·식별자·로그 본문은 공유 문서에 넣지 않았습니다. 시간 값은 이 한 번의 실행 결과입니다.

### 최소 연결 절차

1.  ### 선택한 로그의 식별

    처음에는 사용자가 지정하거나 검증된 환경의 알려진 경로를 선택합니다. session.start 메타데이터로 SDK sessionId와 작업 맥락을 확인하고 Coach 자신의 로그를 연결하지 않습니다. 모든 세션 디렉터리를 검색·공유하는 기능부터 만들지 않습니다.

2.  ### 과거 문맥과 새 지시 구분

    기존 기록을 초기 문맥으로 사용하고 완전한 줄 경계에 읽기 커서를 둡니다. 이후의 새 사용자 요청만 현재 논의 회전에 연결합니다.

3.  ### 읽기와 호출 트리거 분리

    SDK 읽기 도구를 허용한다고 Coach가 자동으로 새 파일을 확인하는 것은 아닙니다. 파일 변경 알림을 묶어 필요한 구간을 읽고, 결과가 준비됐을 때 Scheduler가 Coach를 호출합니다.

4.  ### 필요한 근거만 보관

    선택한 요청·응답·도구 결과와 실제 사용한 코드 읽기 결과를 Journal에 연결합니다. 원본 로그 전체를 매 요청마다 보내거나 별도 DB에 통째로 복제하지 않습니다.

### 파일 기반 내부 계약

아래는 작은 JSONL 보조 함수가 사용할 내부 타입입니다. AHP wire나 범용 Reader 인터페이스가 아닙니다. 원본 SDK 이벤트의 data는 런타임에서 검사하고, 필요한 필드만 증거로 투영합니다.

**TypeScript · 선택 로그와 증분 처리**

``` typescript
interface DriverLogRecord {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface LogCheckpoint {
  bindingId: string;
  generation: number;
  fileIdentity: string;
  completeOffset: number;  // 마지막 완전한 JSONL 줄의 다음 바이트
  lastEventId?: string;
}

type DriverLogChange =
  | {
      kind: "changed";
      size: number;
      modifiedAt: string;
    }
  | { kind: "reset_required"; reason: string };
```

SDK 이벤트의 id와 toolCallId, 바이트 위치, Journal 순번은 서로 다른 식별자입니다. 파일 회전·삭제·줄 중간 쓰기를 “완료된 새 이벤트”로 처리하지 않습니다. 다른 하네스의 형식을 억지로 이 타입에 맞추지 않습니다.

**Node.js · 선택 로그 변경 트리거 예시**

``` javascript
import { statSync, watchFile, unwatchFile } from "node:fs";

function watchDriverLog(logFile, intervalMs, onChange) {
  if (!Number.isFinite(intervalMs) || intervalMs < 100) {
    throw new Error("INVALID_LOG_POLL_INTERVAL");
  }
  const initial = statSync(logFile);
  if (!initial.isFile()) throw new Error("LOG_FILE_REQUIRED");
  let size = initial.size;
  let modified = initial.mtimeMs;
  const listener = current => {
    if (current.dev !== initial.dev || current.ino !== initial.ino ||
        current.size < size ||
        (current.size === size && current.mtimeMs !== modified)) {
      unwatchFile(logFile, listener);
      onChange({ kind: "reset_required", reason: "log_replaced_or_rewritten" });
      return;
    }
    if (current.size > size) {
      size = current.size;
      modified = current.mtimeMs;
      onChange({
        kind: "changed", size,
        modifiedAt: current.mtime.toISOString()
      });
    }
  };
  watchFile(logFile, { interval: intervalMs }, listener);
  return () => unwatchFile(logFile, listener);
}
```

파일 변경 신호일 뿐 새 JSONL 레코드 파싱·모델 호출 완료를 뜻하지 않습니다. 경로는 사전 확인된 단일 로그이며, 콜백에서 필요한 증분 처리와 Scheduler 호출을 연결합니다. 100ms는 이번 실험 설정이고 실제 호출 빈도는 별도로 제한합니다.

선택한 JSONL의 새 구간→ 세션·줄 경계 확인→ Record 정규화·중복 제거→ Journal commit→ EvidenceSnapshot

**관찰 처리 규칙 · 데이터 오류를 정상 완료로 바꾸지 않음**

| 입력 | 처리 | Coach·회전에 미치는 영향 |
|----|----|----|
| 초기 기록 | 선택한 세션의 기존 기록을 문맥으로 읽고 완전한 줄 위치를 기준선으로 설정 | 과거 사용자 요청을 새 작업 지시로 세지 않음 |
| 중복 읽기 | binding·generation·SDK event id로 멱등 반영. toolCallId는 호출·결과 연결에 사용 | 반복 알림·회전 중복 종료·증거 중복 생성 방지 |
| 부분 줄·진행 중 결과 | 완전한 JSONL 줄이 될 때까지 커밋을 미룸. 이벤트의 완료 상태와 파일 쓰기 완료를 구분 | 단순 파일 변경을 도구 성공으로 해석하지 않음 |
| 삭제·회전·쓰기 중단 | 자동 평가 보류 → 파일·세션 재확인 → 필요한 기준선 재설정 | 복원되지 않은 범위를 표시. 다른 로그로 조용히 바꾸지 않음 |
| 다른 binding / 이전 generation | 반영 거부·진단. 연결 교체 시 generation 증가 | 다른 워크스페이스·이전 대화의 결과가 현재 Coach에 섞이지 않음 |

**JSON · 정규화 후 Journal 항목 예시**

``` json
{
  "journalSeq": 42,
  "pairingId": "pair-001",
  "bindingId": "binding-002",
  "generation": 2,
  "eventKey": "binding-002:g2:sdk-event-42",
  "evidence": {
    "id": "ev-42",
    "source": "tool",
    "sourceRef": "sdk-session-A/toolCall-3",
    "sourceVersion": "sdk-event-42",
    "recordedAt": "2026-09-12T06:30:00Z",
    "completeness": "complete",
    "text": "언어에 따라 설명 가공 결과가 달라짐"
  }
}
```

가상 데이터입니다. `eventKey` 형식·Evidence ID·로컬 순번은 우리가 정의합니다. 실제 읽은 SDK 이벤트·toolCallId에서 생성하며, 모델이 출처를 만들어 넣지 않습니다.

**파일이 있다는 것과 전체 기록을 완전히 복원한다는 것은 다릅니다.**

큰 출력은 별도 파일 참조일 수 있고, 중간 상태가 모두 보존된다고 보장할 수 없습니다. SDK 읽기 도구에 공유할 경로·구간·필드를 확인하고, 필요한 기록만 문맥으로 사용합니다. 원문 전체의 무조건적인 모델 전송은 이번 실험에서 검증한 동작이 아닙니다.

### 파일 기반 MVP의 범위

코드 파일만으로 Driver의 의도와 조사 과정을 추측하지 않습니다. 반대로 세션 로그만으로 현재 코드 전체를 안다고 가정하지도 않습니다.

**읽을 자료와 남은 확인**

| 자료 | 용도 | 주의 |
|----|----|----|
| 현재 워크스페이스 | 구현·참조 관계·검토할 코드 읽기 | SDK 기본 읽기·검색을 재사용. 초기 범위는 저장된 파일이며 미저장 편집 버퍼를 포함한다고 가정하지 않음 |
| 선택한 Driver 로그 | 요청·응답·실행 인자·결과와 회전 연결 | 검증한 JSONL 형식부터 지원. 일부 필드·큰 출력의 원문은 추가 확인 필요 |
| Coach의 도구 결과·대화 | 실제로 읽은 코드·사용자가 설명한 이유를 기록 | Driver 로그에 자동으로 합쳐지지 않음. Driver 감시 대상에 Coach 자신의 로그를 넣지 않음 |
| Journal·종료 스냅샷 | 사용한 근거·결정·관찰 범위를 보고서 입력으로 고정 | 모든 원본의 복제본이 아니라 필요한 기록·참조·당시 내용만 보관 |

**AHP는 필수가 아니라 후속 선택지입니다.**

파일 방식으로 필요한 실행 상태를 얻지 못하거나, 원격·여러 하네스 지원과 안정적인 조회 계약이 필요해질 때 비교합니다. 이번 실험은 파일 접근의 가능성을 확인한 것이며, 하네스 전체의 완전한 기록 복원을 보장하지 않습니다.

<a id="coach"></a>

## 6. Coach 실행과 개입 스케줄링

Coach는 별도 Copilot SDK 런타임과 대화를 사용하는 구성을 제안합니다. 기존 모델·도구 호출 루프를 활용하되, Native Driver의 인증·도구·대화가 자동으로 공유된다고 가정하지 않습니다.

### 페르소나, 작업 문맥, 실행 권한을 나눕니다

**Coach에 전달할 세 종류의 정보**

| 종류 | 내용 | 처리 방식 |
|----|----|----|
| 역할 지침 | 문제 정의·설계 논증·위임 설계, 필요시 탐색·디버깅·반례 논의 | 기존 Coach 페르소나를 별도 역할 지침으로 추가합니다. |
| 작업 문맥 | 사람의 요청, Driver 관찰 정보, 관련 코드, 확인한 결정 | 출처·세션·턴·파일 버전과 함께 제공합니다. 인용된 코드를 실행 지시로 취급하지 않습니다. |
| 실행 권한 | 읽을 수 있는 정보와 호출 가능한 도구 | 확장과 런타임 설정에서 제한합니다. 페르소나의 “수정하지 마”에만 맡기지 않습니다. |

### Coach는 SDK 기본 읽기·검색 도구를 재사용합니다

Coach의 작업 디렉터리는 실제 프로젝트로 지정합니다. 대상 SDK에서 확인한 파일 읽기·목록·검색 도구만 allowlist에 넣고, 공유할 Driver 로그의 경로·범위를 제한합니다. `read_context_snapshot`은 기존 결정과 선별된 기록을 읽는 보조 도구로 남기되, Coach를 이 도구 하나에만 가두지 않습니다.

**Coach와 Compiler의 읽기 정책 분리**

| 구분 | Coach | Knowledge Compiler |
|----|----|----|
| 작업 디렉터리 | 선택한 프로젝트 | 분리된 런타임 상태 경로 |
| 파일 접근 | 검증한 SDK 기본 읽기·검색 + 명시적으로 공유한 로그 자료 | 새 파일 읽기·탐색 없음. 종료 시점의 스냅샷 하나 |
| 변경·실행 | 편집·셸·Driver 전송 도구 제외 | 내장 도구 전체 제외, 결과 데이터 제출만 허용 |
| 상태 저장 | 프로젝트와 분리된 baseDirectory | Job별 문맥·기억 분리 |

**SDK v1.0.13 · 읽기 도구와 독립 Coach 세션 생성**

``` javascript
import { CopilotClient, RuntimeConnection, defineTool } from "@github/copilot-sdk";

function createOwnedClient(host) {
  return new CopilotClient({
    connection: RuntimeConnection.forStdio(),
    mode: "empty",
    baseDirectory: host.isolatedDirectory,
    workingDirectory: host.isolatedDirectory,
    env: host.controlledRuntimeEnv,
    useLoggedInUser: false,
    gitHubToken: host.approvedToken
  });
}

async function createCoachSession(client, host) {
  const readTools = host.readOnlyBuiltinTools;
  if (!Array.isArray(readTools) || readTools.length === 0 ||
      !readTools.every(name => typeof name === "string" &&
        /^builtin:[a-z0-9_.-]+$/i.test(name)) ||
      typeof host.readOnlyPermissionHandler !== "function" ||
      typeof host.workspaceDirectory !== "string" ||
      host.workspaceDirectory.length === 0) {
    throw new Error("VERIFIED_READ_PROFILE_REQUIRED");
  }
  const readSnapshot = defineTool("read_context_snapshot", {
    description: "Read the context snapshot pinned by the host.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    defer: "never",
    skipPermission: true,
    handler: (args, invocation) => {
      if (args === null || typeof args !== "object" ||
          Array.isArray(args) || Object.keys(args).length !== 0) {
        throw new Error("EMPTY_ARGUMENT_OBJECT_REQUIRED");
      }
      invocation.signal?.throwIfAborted();
      return {
        resultType: "success",
        textResultForLlm: host.readPinnedSnapshotJson()
      };
    }
  });

  return client.createSession({
    model: host.model,
    systemMessage: { mode: "append", content: host.coachPolicy },
    workingDirectory: host.workspaceDirectory,
    configDirectory: host.isolatedDirectory,
    enableConfigDiscovery: false,
    skipCustomInstructions: true,
    enableOnDemandInstructionDiscovery: false,
    enableFileHooks: false,
    enableHostGitOperations: false,
    enableSkills: false,
    mcpServers: {},
    customAgents: [],
    skillDirectories: [],
    pluginDirectories: [],
    instructionDirectories: [],
    tools: [readSnapshot],
    availableTools: ["custom:read_context_snapshot", ...readTools],
    excludedTools: ["mcp:*"],
    onPermissionRequest: host.readOnlyPermissionHandler,
    memory: { enabled: false },
    enableSessionStore: false,
    skipEmbeddingRetrieval: true,
    embeddingCacheStorage: "in-memory",
    mcpOAuthTokenStorage: "in-memory",
    infiniteSessions: { enabled: false },
    enableSessionTelemetry: false,
    largeOutput: { enabled: false }
  });
}
```

`host.readOnlyBuiltinTools`는 대상 SDK에서 실제 이름·동작을 확인한 목록이고, `readOnlyPermissionHandler`는 허용 경로의 읽기만 승인하고 나머지를 거절하는 내부 구현입니다. 두 값이 없으면 시작을 거절합니다. 이 프로필의 실제 SDK 실행은 아직 검증 전입니다. 보조 도구의 `readPinnedSnapshotJson()`은 해당 요청의 고정 문맥만 반환합니다. [\[9\]](#source-09) [\[11\]](#source-11) [\[17\]](#source-17)

**읽기 권한은 설정만으로 검증 완료가 아닙니다.** 작업 디렉터리는 접근 통제 경계가 아닙니다. 읽기 도구명·경로 판단·권한 callback 동작을 실제로 확인하고, 편집·셸·위임 도구는 allowlist에 넣지 않습니다. Coach에서는 내장 읽기 도구도 필요하므로 `builtin:*` 전체 제외를 제거합니다. Compiler에는 전체 제외를 유지합니다. `skipPermission: true`는 Host 메모리를 반환하는 보조 도구에만 적용합니다.

일반 파일 읽기 권한은 JSONL 내부 필드를 구분해 주지 않습니다. 실제 로그를 모델에 제공하기 전 비공유 지침·인증 정보 등의 포함 여부와 외부 전송 범위를 확인해야 합니다. 처음에는 통제된 테스트 세션을 사용하고, 필요한 필드·구간만 추리는 작은 보조 함수로 자료를 준비할 수 있습니다. SDK 상태 디렉터리 전체를 공유하지 않습니다.

이 예시는 확장이 소유하는 stdio 런타임입니다. OS 샌드박스나 무저장을 보장하지 않습니다. `enableSessionStore: false`는 공유 세션 저장소를 끄는 옵션이지 모든 일반 대화 기록을 없애는 옵션이 아닙니다. 생성·복원에서 도구와 권한 정책을 재등록하고 저장·삭제 정책을 별도로 적용합니다.

**실제 SDK 생명주기 API · 지정 버전 기준**

| 호출 / 이벤트 | 의미 | 런타임 책임 |
|----|----|----|
| `send()` | 메시지 ID 반환 | 응답 완료로 취급하지 않음 |
| `sendAndWait()` | session.idle 또는 session.error까지 대기 | 동일 세션 요청 직렬화. 반환값은 assistant 메시지가 없으면 undefined일 수 있음 |
| `on()` | 이벤트 구독, 해제 함수 반환 | 전송 전에 등록하고 요청 종료·disconnect 시 구독 정리 |
| `abort()` | 소유한 SDK 요청 취소 접수 | 접수와 작업 정착을 구분. 취소·idle 확인 전 다음 pin/요청을 겹치지 않음 |
| `disconnect()` | 세션 detach·로컬 핸들러 정리, 디스크 기록 보존 | 공개 정리 메서드는 disconnect이며 session.close가 아님 |
| `client.stop()` | 소유한 SDK 런타임 종료·연결 정리, 오류 배열 반환 | 반환 오류를 확인. Native Driver Host를 종료하는 데 사용하지 않음 |
| `resumeSession(id, config)` | 기존 SDK 세션 재연결 | 도구·핸들러·제한 재등록. Compiler에 과거 Coach 대화를 resume하지 않음 |

`sendAndWait`의 기본 타이머는 send 반환 뒤 시작하는 60초이며, 전체 요청 deadline이나 자동 취소가 아닙니다. Host가 전체 deadline과 취소·정리 상태를 별도로 관리해야 합니다. SDK의 `hooks.onSessionEnd`도 제품의 pairing.end나 논의 회전 종료를 대신하지 않습니다. [\[10\]](#source-10)

### Coach가 먼저 말하는 과정

확장이 언제 평가를 요청할지 정하고, Coach가 질문의 필요성과 내용을 판단합니다. “캐시”라는 단어에 정해진 문장을 붙이는 규칙만으로 대체하지 않습니다.

새 요청·결과·조건 관찰→ 문맥 구성·중복 억제→ Coach 평가→ 질문·설명 또는 개입 없음

- 짧은 시간의 이벤트를 묶고, 자동 점검은 Coach 세션당 한 번에 하나만 실행합니다.
- 사용자의 직접 질문을 자동 점검보다 우선합니다.
- 이미 답했거나 보류한 질문은 근거가 달라지지 않으면 반복하지 않습니다.
- 자동 평가가 실패한 경우와 “개입할 필요 없음”이라는 판단을 구분합니다.
- 설명 길이를 일괄 제한하지 않습니다. 짧은 질문 뒤에 긴 설명과 후속 대화가 이어질 수 있습니다.

**JavaScript · 늦게 도착한 Coach 응답 차단**

``` javascript
function decideReply(session, lease, reply, audit) {
  if (reply.snapshotId !== lease.snapshotId) {
    throw new Error("REPLY_SNAPSHOT_MISMATCH");
  }
  const current =
    session.status === "active" &&
    session.pairingId === lease.pairingId &&
    session.epoch === lease.epoch &&
    session.revision === lease.revision;

  if (!current) {
    audit({ type: "coach.reply.discarded", reason: "superseded" });
    return { kind: "discarded", reason: "superseded" };
  }
  return {
    kind: "publish",
    pairingId: lease.pairingId,
    epoch: lease.epoch,
    revision: lease.revision,
    text: reply.text
  };
}
```

`lease`는 요청 시작 시의 `{ pairingId, epoch, revision, snapshotId }`입니다. snapshotId는 기본 대화 문맥을 식별하며, 이 요청에서 SDK가 추가로 읽은 파일 근거는 별도로 Journal에 연결합니다. 자신의 도구 결과를 기록했다는 이유로 입력 revision을 올리면 모든 읽기 응답을 폐기하게 되므로 구분해야 합니다. revision은 사용자 입력·Driver 새 결과·알려진 외부 문맥 변경 때 갱신합니다. 판정과 commit은 같은 직렬화 구간에서 수행합니다.

**Scheduler 정책 · 지연·쿨다운·호출 예산은 튜닝할 설정값**

| 상황 | 실행 규칙 | 상태 처리 |
|----|----|----|
| 직접 질문 | 자동 평가보다 우선. 같은 SDK 세션에는 한 요청만 실행 | 자동 요청을 취소·정리한 뒤 시작. 아직 종료되지 않은 요청과 섞지 않음 |
| 연속 Driver 로그 변경 | 완전한 새 레코드를 묶고 중복 제거 → 평가 1건 | 입력 revision이 달라진 이전 응답은 폐기. Coach 자신의 로그·읽기 결과로 재호출하지 않음 |
| 개입 불필요 | 정상적인 모델 판단으로 구분 | 오류·시간 초과를 “할 말 없음”으로 바꾸지 않음 |
| pause / end / binding 교체 | epoch 증가, 대기 Job 무효화, 소유한 Coach 요청 취소 | 늦은 응답 게시 금지. Driver 작업은 취소하지 않음 |

SDK가 읽는 코드는 도구 호출 시점의 파일입니다. 해커톤 MVP에서 전체 워크스페이스의 원자적 스냅샷을 보장하지 않습니다. 실제 사용한 읽기 결과·시점·가능한 버전을 기록하고, 그 뒤 변경을 알게 되면 새 문맥으로 재검토합니다. 종료 보고서만 동결 입력으로 제한합니다.

**주요 대화는 문제 정의 → 설계 논증 → 작업 위임 설계입니다.**

작업 중 코드와 오류도 근거로 사용하지만, 매 diff마다 리뷰를 붙이는 것이 핵심은 아닙니다. 모든 작은 요청에 세 단계 질문을 의무적으로 반복하지도 않습니다.

<a id="experience"></a>

## 7. 페어링 상태와 실행 시퀀스

논의 Loop의 회전과 페어링 전체 수명을 따로 관리합니다. 아래 메시지 이름은 내부 작업명입니다. Driver 요청은 사람이 기존 UI에서 직접 보내며, 선택한 로그의 새 요청·결과를 연결합니다. Coach의 코드 읽기는 SDK 기본 도구로 수행합니다.

``` mermaid
sequenceDiagram
    actor User as 사람 / UI
    participant Controller as Controller / Log
    participant Coach as Coach Runtime
    participant Driver as Driver / 세션 로그
    participant Store as Journal / Snapshot
    User->>Controller: start + 공유 맥락
    Controller->>Store: 사용자 입력 commit → snapshot S1
    Controller->>Coach: run(lease, S1)
    Coach-->>Controller: 응답 → Lease 확인 → UI
    Note over User,Store: 사람의 지시 전송으로 논의 Loop 한 회전 종료
    User->>Controller: Driver 로그 선택
    Controller->>Driver: 로그 기준선 확인·변경 감지 시작
    User->>Driver: 사람이 기존 Driver UI에서 직접 지시 전송
    Driver-->>Controller: 파일: 새 요청 / 출처·회전 연결
    Controller->>Store: iteration N → driver_pending
    Driver-->>Controller: 로그에 기록된 응답·도구 결과 읽기
    Controller->>Store: Evidence commit → snapshot S2
    Controller->>Coach: review(lease, S2)
    Coach-->>Controller: 리뷰 질문·설명 → UI
    User->>Controller: 다음 작업 → iteration N+1
```

Driver / 세션 로그 레인은 기존 실행과 그 저장 기록을 묶어 표시합니다. 공동 리뷰는 같은 Driver 근거를 참조하며, Coach의 추가 코드 읽기와 해석은 별도 출처로 기록합니다. S1·S2는 기본 대화 문맥이며 워크스페이스 전체의 원자적 복제본이 아닙니다.

Coach와 사용자는 같은 S2의 Driver 근거를 참조합니다. 결과 관찰만으로 다음 지시를 자동 전송하지 않습니다.

### 페어링 수명과 회전 상태

``` mermaid
stateDiagram-v2
    direction LR
    active --> paused: pause
    paused --> active: resume
    active --> closing: end
    paused --> closing: end
    closing --> closed: 정리 성공
    closing --> close_failed: 정리 실패
    close_failed --> closing: 재시도
    note right of active
      Driver 미연결 허용
      stage는 별도 관리:
      discussing → driver_pending → reviewing
      리뷰 후 다음 논의 시작 시 iteration 증가
    end note
    note right of closing
      cutoff 고정·신규 입력 차단
    end note
```

**Controller가 처리할 내부 이벤트**

| 이벤트 | 상태·데이터 변경 | 주의 |
|----|----|----|
| `pairing.start` | 새 pairingId, active·discussing, driver=null, iteration=1 | 기존 SDK/Driver sessionId를 pairingId로 재사용하지 않음 |
| `driver.bind` | 선택 로그·SDK sessionId 확인, generation·epoch 증가, 초기 완전 줄 기준선 설정 | 경로를 검증하고 Coach 자신의 로그·다른 세션을 연결하지 않음 |
| `directive.confirmed` | 실제 새 Native 요청을 회전에 연결. discussing → driver_pending | 초안·과거 메시지·Coach의 제안은 제외. 작성 주체·회전이 불명확하면 사용자 확인 전 미분류 |
| `driver.result` | 같은 binding의 근거 commit, 공동 리뷰 snapshot 생성 | 결과 존재가 성공 판정이나 사용자 이해를 뜻하지 않음 |
| `iteration.begin` | 사람이 다음 작업을 선택하면 reviewing → discussing, iteration+1 | 모든 메시지마다 회전 수를 늘리지 않음. 모델이 임의로 새 목표를 확정하지 않음 |
| `pairing.pause` | epoch 증가·대기 Job 무효화. 초기 정책 제안: 로그 감시와 자동 코칭을 함께 중지 | 재개 시 파일·세션·커서 확인. 복원하지 못한 구간은 coverage=partial |
| `pairing.end` | closing → freeze → 파일 감시·Coach 정리 → closed 또는 close_failed | Driver 완료를 기다리지 않음. 파일 감지 실패나 SDK idle을 end로 해석하지 않음 |

**JavaScript · 종료의 실행 순서 (내부 포트 예시)**

``` javascript
async function closePairing(pairingId, services) {
  const frozen = await services.controller.freezeForClose(pairingId);
  // 같은 잠금에서 closing, epoch 증가, cutoff·snapshot 확정.
  services.scheduler.stop(pairingId);

  const operations = ["logWatch.stop", "coach.closeOwnedRuntime"];
  const cleanup = await Promise.allSettled([
    Promise.resolve().then(() => services.logWatch.stop(pairingId)),
    Promise.resolve().then(() => services.coach.closeOwnedRuntime(pairingId))
  ]);
  const failures = cleanup.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ operation: operations[index], error: result.reason }]
      : []
  );

  await services.controller.finishClose(
    pairingId, frozen.closeToken, failures
  );
  const reportJob = await services.reports.enqueueOnce({
    pairingId,
    snapshotId: frozen.snapshotId,
    compilerVersion: "knowledge-v1"
  });
  return { snapshotId: frozen.snapshotId, reportJob };
}
```

`freezeForClose`는 입력 차단·epoch·Journal cutoff와 보고서용 불변 입력을 확정하는 내부 포트입니다. 실패하면 close_failed를 표시하고 같은 cutoff로 재시도합니다. `logWatch.stop`은 선택 파일의 우리 감시만 해제합니다. `closeOwnedRuntime`은 소유한 Coach만 정리하고, `finishClose`는 실패를 표시합니다. Driver 실행이나 원본 로그를 중단·삭제하지 않습니다.

**종료 경계:** closing 이후의 Driver 출력과 늦은 Coach 응답은 닫힌 스냅샷에 추가하지 않습니다. 콜백은 pairingId·epoch·generation을 검사합니다. 새 자료로 보고서를 갱신하려면 새 snapshotId와 Job을 만듭니다. 보고서 실패는 이미 닫힌 페어링을 다시 열지 않습니다.

**전송된 요청을 읽는 것과 미전송 초안을 읽는 것은 다릅니다.**

기존 Driver 입력창의 미전송 초안을 가로채지 않습니다. 전송 전 논의는 Coach와 하고, Driver에 전송한 이후 저장된 요청·결과를 로그로 확인합니다. 로그 형식이나 쓰기 지연 때문에 아직 보이지 않는 정보는 확인된 것으로 처리하지 않습니다.

<a id="knowledge"></a>

## 8. 지식 컴파일과 HTML 산출물

종료한 페어링의 기록을 학습 보고서로 변환하는 별도 Job입니다. 입력은 고정된 EvidenceSnapshot 하나, 모델 출력은 구조화된 데이터입니다. 모델에 HTML·파일 작성·Driver 제어를 맡기지 않습니다.

``` mermaid
flowchart LR
    snapshot["FrozenSnapshot<br/>snapshotId / cutoff / hash"]
    compiler["Compiler<br/>구조화된 데이터만 반환"]
    validator["Validator<br/>스키마 / 출처 ID / 확인 수준"]
    renderer["HTML Renderer<br/>고정 템플릿 + escape"]
    exporter["Save Dialog / Export<br/>사용자가 선택한 경로"]
    snapshot --> compiler
    compiler --> validator
    validator --> renderer
    validator -->|"검증 실패 → 같은 입력으로 제한된 재시도"| compiler
    renderer -->|"ready"| exporter
```

LLM 입력: 허용된 증거 + 확정/미정 결정 + 생성 지침. 모델이 추가 증거를 임의로 조회하거나 외부 파일을 수정하지 않습니다.

닫힌 스냅샷은 변경하지 않습니다. 저장 실패는 export만 재시도하며 보고서 실패가 Driver 작업을 막지 않습니다.

### 입력 고정

포함 범위는 `journalSeq <= cutoff`입니다. 종료 뒤 도착한 결과는 제외하며 진행 중 도구·관찰 누락을 coverage에 남깁니다. snapshotId에 매핑된 내용을 바꾸지 않습니다.

### 실행 분리

초기 제안은 보고서 Job별 독립 SDK 세션입니다. 기존 Coach 대화를 그대로 이어 쓰지 않고, 고정 스냅샷만 읽게 합니다. 같은 스냅샷·Compiler 버전의 중복 요청은 동일 Job으로 연결합니다.

**SDK · 구조화 결과 제출 도구**

``` javascript
import { defineTool } from "@github/copilot-sdk";

function createReportOutputTool(reportJsonSchema, snapshot, job) {
  return defineTool("emit_session_report", {
    description: "Submit the report for this frozen snapshot.",
    parameters: reportJsonSchema,
    defer: "never",
    skipPermission: true,
    isTerminal: true,
    handler: (args, invocation) => {
      invocation.signal?.throwIfAborted();
      const report = validateKnowledgeReport(args, snapshot);
      job.acceptReportOnce(report);
      return "accepted";
    }
  });
}
```

`reportJsonSchema`와 `job.acceptReportOnce`는 내부 구현입니다. 전자는 아래 DTO와 같은 스키마이며 제품 코드에서는 런타임 검증과 단일 정의로 관리합니다. 후자는 Job 상태·snapshotId를 확인하고 중복·취소 후 제출을 거부합니다. 이 도구는 파일을 쓰지 않고 검증된 데이터를 Host 메모리에 제출합니다.

**SDK · Compiler 전용 도구 allowlist**

``` javascript
function createCompilerSession(
            client, isolationConfig, compilerPolicy, readFrozenSnapshot, emitReport,
            isolatedDirectory
          ) {
            if (typeof isolatedDirectory !== "string" || isolatedDirectory.length === 0) {
              throw new Error("COMPILER_ISOLATED_DIRECTORY_REQUIRED");
            }
            return client.createSession({
              ...isolationConfig,
              workingDirectory: isolatedDirectory,
              configDirectory: isolatedDirectory,
              systemMessage: { mode: "append", content: compilerPolicy },
    tools: [readFrozenSnapshot, emitReport],
    availableTools: [
      "custom:read_context_snapshot",
      "custom:emit_session_report"
    ],
    excludedTools: ["builtin:*", "mcp:*"],
    onPermissionRequest: () => ({ kind: "reject" })
  });
}
```

`isolationConfig`는 06의 주변 설정 비활성화·메모리/저장 제한을 재사용합니다. 다만 Compiler는 프로젝트 작업 디렉터리와 Coach의 읽기 권한을 물려받지 않도록 위에서 명시적으로 덮어씁니다. read 도구는 종료 스냅샷 하나만 캡처하며 live 파일·과거 Coach SDK 세션을 재사용하지 않습니다.

**모델 텍스트를 성공 조건으로 삼지 않습니다.** 지정 SDK 소스에서는 `response_format` 계열의 세션 옵션을 확인하지 못했으므로 사용하지 않습니다. 성공한 terminal tool이 턴을 끝낼 수 있어 assistant 메시지는 없을 수도 있습니다. 세션 완료 후 수락된 report 객체가 있는지 확인하고, 없으면 `NO_REPORT_SUBMITTED`로 실패 처리합니다. [\[9\]](#source-09) [\[10\]](#source-10)

동결된 데이터도 신뢰할 수 있는 지시문은 아닙니다. Driver 응답·코드·로그에 들어 있는 지시를 수행하지 않고 근거로만 사용합니다. Compiler의 `skipPermission` 예외는 스냅샷 읽기와 Host 메모리 제출에만 한정합니다.

**TypeScript · 보고서 데이터와 Job 계약**

``` typescript
type KnowledgeBasis =
  | "discussed"
  | "human_explained"
  | "execution_observed"
  | "unverified";

interface KnowledgeItem {
  title: string;
  before: string;
  after: string;
  why: string;
  appliesWhen: string;
  limits: readonly string[];
  basis: KnowledgeBasis;
  evidenceIds: readonly string[];
}

interface KnowledgeReport {
  schemaVersion: 1;
  pairingId: string;
  snapshotId: string;
  title: string;
  items: readonly KnowledgeItem[];
  openQuestions: readonly string[];
}

interface ReportJob {
  jobId: string;
  snapshotId: string;
  compilerVersion: string;
  attempt: number;
  state:
    | "queued" | "generating" | "validating"
    | "ready" | "failed" | "cancelled" | "no_material";
  error?: {
    stage: "generate" | "validate" | "render";
    code: string;
  };
}
```

모두 내부 계약입니다. Export는 별도 상태로 관리합니다. 저장 오류가 생겨도 검증된 ReportJob은 ready를 유지하고, 모델을 다시 호출하지 않습니다.

**확인 수준의 의미 · 학습 인증과 구분**

| basis | 필요한 근거 | 뜻하지 않는 것 |
|----|----|----|
| `discussed` | 사람–Coach 대화에서 해당 내용을 다룸 | 설명했다는 이유만으로 사용자가 습득했다고 확정하지 않음 |
| `human_explained` | 사용자가 자신의 이유·조건을 표현한 기록 | 동의 버튼·“응”만으로 독립 이해를 판단하지 않음 |
| `execution_observed` | 완결된 도구 실행 결과를 실제로 관찰 | 테스트 실행을 관찰한 것과 전체 목표 달성은 다름 |
| `unverified` | 설명·보고는 있으나 실제 확인은 남아 있음 | Driver의 성공 선언만으로 검증 완료로 올리지 않음 |

**JSON · 컴파일 결과 예시**

``` json
{
  "schemaVersion": 1,
  "pairingId": "pair-001",
  "snapshotId": "snapshot-042",
  "title": "캐시 키와 최신성 판단",
  "items": [{
    "title": "결과를 바꾸는 입력을 캐시 키에 반영",
    "before": "상품 ID만 키로 사용하려고 함",
    "after": "상품 ID와 요청 언어를 함께 사용",
    "why": "요청 언어에 따라 설명 가공 결과가 달라짐",
    "appliesWhen": "가공 결과를 입력 조합별로 재사용할 때",
    "limits": ["인증·사용자별 결과가 있는지는 별도 확인"],
    "basis": "human_explained",
    "evidenceIds": ["ev-08", "ev-42"]
  }],
  "openQuestions": ["캐시 항목 상한과 제거 정책"]
}
```

가상 스냅샷의 ev-08은 사용자 발화, ev-42는 도구 결과를 가리키는 예시입니다. 실제 Job에서는 허용된 Evidence ID 집합에 없는 인용을 거부합니다.

**JavaScript · 스키마·출처·확인 수준 검증**

``` javascript
function requireObject(value, keys) {
  if (value === null || typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error("REPORT_SCHEMA_INVALID");
  }
}

function requireText(value, max = 2000) {
  if (typeof value !== "string" ||
      value.trim().length === 0 || value.length > max) {
    throw new Error("REPORT_TEXT_INVALID");
  }
}

function requireTextList(value, max) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error("REPORT_LIST_INVALID");
  }
  value.forEach(text => requireText(text));
}

function validateKnowledgeReport(value, snapshot) {
  requireObject(value, [
    "schemaVersion", "pairingId", "snapshotId",
    "title", "items", "openQuestions"
  ]);
  if (value.schemaVersion !== 1 ||
      value.pairingId !== snapshot.pairingId ||
      value.snapshotId !== snapshot.snapshotId) {
    throw new Error("REPORT_INPUT_MISMATCH");
  }
  requireText(value.title, 200);
  requireTextList(value.openQuestions, 24);
  if (!Array.isArray(value.items) ||
      value.items.length === 0 || value.items.length > 24) {
    throw new Error("REPORT_ITEMS_INVALID");
  }
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const bases = new Set([
    "discussed", "human_explained", "execution_observed", "unverified"
  ]);

  for (const item of value.items) {
    requireObject(item, [
      "title", "before", "after", "why", "appliesWhen",
      "limits", "basis", "evidenceIds"
    ]);
    for (const key of ["title", "before", "after", "why", "appliesWhen"]) {
      requireText(item[key]);
    }
    requireTextList(item.limits, 12);
    requireTextList(item.evidenceIds, 24);
    if (!bases.has(item.basis) || item.evidenceIds.length === 0 ||
        new Set(item.evidenceIds).size !== item.evidenceIds.length) {
      throw new Error("REPORT_BASIS_INVALID");
    }
    const refs = item.evidenceIds.map(id => {
      const ref = evidence.get(id);
      if (!ref) throw new Error("UNKNOWN_EVIDENCE_ID");
      return ref;
    });
    const completeHuman = refs.some(ref =>
      ref.source === "human" && ref.completeness === "complete");
    const completeTool = refs.some(ref =>
      ref.source === "tool" && ref.completeness === "complete");
    const conversation = refs.some(ref =>
      ref.source === "human" || ref.source === "coach");
    if ((item.basis === "human_explained" && !completeHuman) ||
        (item.basis === "execution_observed" && !completeTool) ||
        (item.basis === "discussed" && !conversation)) {
      throw new Error("EVIDENCE_BASIS_MISMATCH");
    }
  }
  return structuredClone(value);
}
```

상한 값은 초기 설계 예시입니다. JSON을 받기 전 응답 바이트 상한도 적용합니다. 입력 스냅샷은 Store에서 타입·Evidence ID 유일성·해시를 검증한 불변 객체여야 합니다. 이 검사는 구조·ID·출처 종류를 확인할 뿐, 문장이 근거에서 논리적으로 따라오는지나 사용자의 학습 여부까지 증명하지는 않습니다. 검증 오류는 Job 실패로 표시합니다.

**JavaScript · 고정 템플릿 HTML 렌더링**

``` javascript
function escapeHtml(value) {
  const entities = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

function renderKnowledgeReport(raw, snapshot) {
  const report = validateKnowledgeReport(raw, snapshot);
  const usedIds = [...new Set(report.items.flatMap(item => item.evidenceIds))];
  const numbers = new Map(usedIds.map((id, index) => [id, index + 1]));
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const labels = {
    discussed: "대화에서 다룸",
    human_explained: "사용자가 설명함",
    execution_observed: "실행 근거 있음",
    unverified: "보고·설명됨 / 미검증"
  };
  const list = values => values.map(text =>
    `<li>${escapeHtml(text)}</li>`).join("");

  const sections = report.items.map(item => {
    const refs = item.evidenceIds.map(id =>
      `<a href="#e-${numbers.get(id)}">[${numbers.get(id)}]</a>`).join(" ");
    return `<section><h2>${escapeHtml(item.title)}</h2>
      <p>${labels[item.basis]} · ${refs}</p>
      <p>처음: ${escapeHtml(item.before)}</p>
      <p>변경: ${escapeHtml(item.after)}</p>
      <p>이유: ${escapeHtml(item.why)}</p>
      <p>적용 조건: ${escapeHtml(item.appliesWhen)}</p>
      <ul>${list(item.limits)}</ul></section>`;
  }).join("");

  const sources = usedIds.map(id => {
    const ref = evidence.get(id);
    return `<li id="e-${numbers.get(id)}">
      ${escapeHtml(ref.sourceRef)} · ${escapeHtml(ref.sourceVersion)}
      <pre>${escapeHtml(ref.text)}</pre></li>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>${escapeHtml(report.title)}</title>
    <style>body{max-width:900px;margin:auto;padding:24px;font:16px/1.8 sans-serif}
    pre{white-space:pre-wrap;overflow-wrap:anywhere}
    section{border-top:1px solid #ddd;margin-top:24px}</style>
    </head><body><h1>${escapeHtml(report.title)}</h1>
    <p>Snapshot: ${escapeHtml(snapshot.snapshotId)} / cutoff: ${snapshot.cutoff}</p>
    <p>Driver 관찰 범위: ${escapeHtml(snapshot.coverage.driver)}</p>
    <ul>${list(snapshot.coverage.gaps)}</ul>
    ${sections}<h2>미정 사항</h2><ul>${list(report.openQuestions)}</ul>
    <h2>근거</h2><ol>${sources}</ol></body></html>`;
}
```

최소 템플릿 예시입니다. 근거 링크는 검증한 Evidence ID에서 만든 내부 앵커뿐입니다. 모델이 제공한 HTML·URL·명령 링크를 삽입하지 않습니다. 원문 인용을 포함하는 내보내기는 선택한 공유·저장 정책을 다시 확인합니다.

**실패·재시도·저장 계약**

| 상황 | 상태와 동작 | 재시도 범위 |
|----|----|----|
| 정리할 자료 없음 | no_material과 사유 표시. 모델 호출 생략 | 새로운 자료가 있어야 새 스냅샷으로 생성 |
| 생성·검증 실패 | failed(stage, code). 초안을 정상 보고서로 표시하지 않음 | 같은 스냅샷으로 제한된 attempt. prompt·schema·model 설정은 compilerVersion에 연결 |
| 사용자 취소 | 해당 Compiler 요청만 취소, cancelled 표시 | 명시적 재요청. Native Driver에는 영향 없음 |
| HTML 준비 완료 | ready. 미리보기와 저장 동작 제공 | 저장 취소·실패 시 HTML을 유지하고 export만 재시도 |
| 저장 경로 선택 | 확장의 저장 대화상자 사용. 덮어쓰기 확인 후 선택 경로만 쓰기 | 권한·경로 오류 표시. 모델이 지정한 경로로 저장하지 않음 |
| 나중에 Driver 결과 도착 | 기존 snapshot·보고서 유지. 뒤늦은 자료를 조용히 합치지 않음 | 사용자가 갱신할 때 새 snapshotId와 생성 이력 |

<a id="boundaries"></a>

## 9. 권한·오류·저장 경계

파일을 읽을 수 있다는 사실만으로 적절한 읽기 전용 권한이 검증된 것은 아닙니다. Coach의 도구 allowlist, 허용 경로, 로그에서 모델에 보낼 범위를 각각 확인합니다. AHP를 사용하지 않는다고 이 경계가 없어지는 것은 아닙니다.

**확장 연결부와 Coach에 적용할 경계**

| 대상 | 허용 | 차단·주의 |
|----|----|----|
| 로그 보조 함수 | 선택한 파일의 메타데이터·필요한 증분·변경 감지 | 다른 세션 탐색, 원본 수정·삭제, Driver 전송·취소·승인 없음 |
| Coach 도구 | 검증한 SDK 기본 읽기·검색과 보조 문맥 읽기 | 편집·셸·위임·Driver 제어 도구 제외. 일반 읽기 권한이 로그 내부의 민감 필드까지 구분해 주지는 않음 |
| Compiler 도구 | 종료 스냅샷 읽기·검증된 보고서 데이터 제출 | 모든 내장 도구 제외. live 워크스페이스·Driver 로그를 새로 탐색하지 않음 |
| UI와 콘텐츠 | 질문·설명·출처·연결 상태 표시 | 모델 Markdown의 HTML·명령 링크를 실행하지 않음. 임의 Webview 메시지를 승인으로 취급하지 않음 |
| 공유 자료 | 선택한 Driver 대화와 관련 파일 | 다른 세션, 비밀 파일, 토큰, 환경 변수 전체를 자동으로 첨부하지 않음 |

작업 디렉터리 설정은 OS 샌드박스가 아닙니다. 워크스페이스 밖의 세션 기록은 선택한 경로만 따로 허용하며, 심볼릭 링크·경로 우회와 SDK 권한 callback의 실제 동작을 시험해야 합니다. 로그의 비공유 지침·인증 정보는 모델 입력·일반 로그·보고서에서 제외합니다.

### 기록과 문맥에 출처를 남깁니다

- 사람의 요청, Driver의 응답, 외부 파일 변경, Coach의 제안을 서로 다른 출처로 기록합니다.
- 실제로 읽은 파일 내용·범위·시점과 가능한 버전·해시를 기록합니다. MVP의 SDK 파일 읽기가 미저장 편집 버퍼까지 포함한다고 표시하지 않습니다.
- 파일 변경 주체가 확인되지 않으면 Driver가 바꿨다고 단정하지 않습니다.
- Coach의 제안을 자동으로 “합의된 결정”으로 저장하지 않습니다. 사람의 확인과 연결합니다.

### 실패는 정상 상태와 구분해서 표시합니다

로그 읽기·변경 감지 실패가 Driver 실행을 막아서는 안 됩니다. 실패한 원본 경로와 누락 범위를 알리고, Driver 재전송이나 취소로 복구하지 않습니다.

**대표 실패 상황과 처리**

| 상황 | 처리 | 하지 않는 일 |
|----|----|----|
| 로그 읽기 실패·교체 | 자동 평가 중지, 마지막 읽기 위치 표시. 파일·세션을 다시 확인하고 누락 범위 기록 | Driver 요청 재전송, 다른 로그로 조용히 전환 |
| 기록·결과 일부 없음 | 누락 범위를 알리고 가능한 범위에서만 논의 | 잘린 요약을 전체 세션이라고 표현 |
| Coach 오류·사용량 제한 | 오류와 자동 개입 중지 상태 표시. Driver는 독립 사용 | 오류를 “할 말 없음”으로 숨김 |
| 권한 판단 실패 | 명시적으로 거부하고 진단 기록 | 예외를 던지기만 하면 차단된다고 가정 |
| Coach 중단·재시작 | Coach 작업·연결만 정리. 복원 시 도구와 정책 재등록 | Native Driver 중단·삭제, 이전 승인 재사용 |

확인한 SDK에서는 권한 핸들러 생략 시 요청이 대기할 수 있고, 도구 Hook 예외가 명시적 거부로 처리되지 않을 수 있습니다. 또한 `sendAndWait()` 시간 초과는 자동 취소가 아닙니다. 오류·취소·완료를 별도 상태로 처리합니다. [\[9\]](#source-09) [\[10\]](#source-10)

### 코드 공유와 호출 비용을 안내합니다

Native Driver에서 이미 사용한 자료라도 별도 Coach 호출에 다시 전달하는 동작을 알립니다. 모델 호출은 외부 서비스를 사용하며 자동 점검도 사용량을 소비합니다. 호출을 묶고 역할별 사용량과 중지 기능을 제공하되, 로컬 집계만으로 정확한 청구액이나 절대 과금 상한을 보장하지 않습니다.

기본 Copilot 로그인 상태가 독립 SDK Coach에 자동 적용된다고 가정하지 않습니다. 지원되는 인증 경로를 사용하고 비공개 토큰을 추출하지 않습니다. 인증 정보는 Webview나 일반 로그에 전달하지 않습니다. [\[13\]](#source-13)

<a id="implementation"></a>

## 10. 구현 순서와 검증 기준

파일 접근의 기초 PoC는 현재 CLI/SDK 세션에서 확인했습니다. 다음 검증 대상은 읽기 전용 Coach가 필요한 코드·기록을 실제로 읽고, 수정·명령 실행은 하지 못하는지입니다. AHP 구현을 선행 조건으로 두지 않습니다.

### 초기 지원 범위

**VS Code Desktop, 신뢰된 로컬 단일 워크스페이스, 검증한 CLI/SDK 로그 형식의 Driver 한 세션, SDK 읽기 전용 Coach**부터 시작합니다. 정확한 SDK 도구·권한 프로필은 추가 검증합니다. 음성·자동 테스트 작성·다중 Driver·원격 환경은 초기 범위에서 제외합니다.

Workspace Trust는 모델로 자료를 보내는 동의와 별개입니다. 다른 Native Copilot 하네스나 Remote SSH·WSL·Dev Containers에서는 파일 위치·접근 가능성·형식을 새로 확인해야 합니다. 그때 필요하면 AHP를 비교합니다. [\[16\]](#source-16)

### 확장 모듈 구성

TypeScript 확장·WebviewView·Copilot SDK와 작은 파일 보조 함수로 시작합니다. 아래는 책임 구분이지 각각을 독립 서비스로 만들라는 뜻은 아닙니다. AHP 클라이언트, 전용 Workspace Reader, 별도 클라우드 서버·DB는 MVP에 추가하지 않습니다.

**확장이 직접 구현할 모듈**

| 모듈 | 책임 | 경계 |
|----|----|----|
| Driver Agent Package | 역할 지침 기여와 사용 안내 | Driver UI·실행 루프를 복제하지 않음 |
| 로컬 로그 보조 함수 | 선택 경로·SDK sessionId 확인, 변경 알림, 필요한 JSONL 증분 처리 | 범용 Reader 프레임워크·Driver 제어 API를 만들지 않음 |
| Context Builder / Journal | 사용한 로그 구간·코드 읽기 결과·대화·결정·관찰 범위를 연결 | 원문 전체를 복제하지 않음. 본인 tool 결과와 외부 문맥 변경을 구분 |
| Coach Scheduler | 이벤트 묶기, 직접 질문 우선, 중복 억제, 호출 예산 | 질문 내용은 Coach가 판단 |
| Coach Runtime / Policy | SDK 기본 읽기·검색 도구, 경로 권한, 페르소나, 중단·복원 | 변경·셸·Driver 제어 도구 제외. 실제 프로필 확인 전에는 시작 거절 |
| Coach View | 대화, 근거 링크, 연결·자동 개입 상태 표시 | SDK·인증은 Webview가 아닌 Host에서 처리 |
| Pairing Controller | Coach-first 시작, 회전 연결, pause/end, epoch·cutoff 관리 | 세션별 직렬화. Native 세션 수명과 분리 |
| Knowledge Compiler | 고정 스냅샷에서 구조화 보고서 생성·검증·Job 재시도 | 새 파일·다른 대화 탐색이나 코드 수정 없음 |
| Report Renderer / Export | 고정 템플릿·이스케이프·미리보기·선택 저장 | 저장 실패 시 재컴파일하지 않음. 모델 지정 경로 금지 |

초기 SDK 검토 기준은 GitHub 릴리스 `v1.0.13`입니다. 실제 패키지·런타임·Extension Host Node 호환성을 고정해서 시험해야 합니다. SDK의 플랫폼 런타임 자산이 VSIX에 포함되는지도 확인합니다. JavaScript 번들만 포함하면 충분하다고 가정하지 않습니다. [\[8\]](#source-08) [\[12\]](#source-12)

### 단계마다 다음으로 넘어갈 조건을 둡니다

**구현 단계와 통과 기준 — 아직 실행하지 않은 계획**

| 단계 | 만드는 것 | 통과 기준 |
|----|----|----|
| 0\. 파일 접근 PoC | 현재 세션의 요청·응답·도구 인자·결과 읽기와 새 출력 감지 | **현재 CLI/SDK 환경에서 확인.** 다른 하네스·큰 출력·재시작까지 검증된 것은 아님 |
| 1\. SDK 읽기 프로필 | 실제 읽기·검색 도구명, 프로젝트 경로·선택 로그, 권한 callback | 코드·필요한 기록 읽기는 가능. 쓰기·셸·위임·비공유 경로는 허용되지 않음 |
| 2\. 최소 페어링·공동 리뷰 | Coach-first, 로그 변경 트리거, 최소 Journal·회전·Lease | 새 지시·결과를 정확히 연결. 자신의 읽기 결과가 무한 재호출을 만들지 않음 |
| 3\. 종료·지식 정리 | freeze, Compiler, Validator, Renderer, Export | cutoff 이후 자료 제외, 출처 위조 거부, 공유 범위 준수, HTML 문자 이스케이프, 저장 오류 분리 |
| 4\. 신뢰성·배포 | 권한 부정 시험, 중단·복원, 호출량, 패키징 | 오류·재시작 시 정책 유지. Native Driver 작업에 부작용 없음 |
| 5\. 실제 작업 평가 | 실제 프로젝트에서 선택적 사용 관찰 | 질문이 판단을 도왔는지, 직접 지시했는지, 보고서의 확인 수준과 실제 근거가 일치하는지 확인 |

### 다음 SDK 읽기 검증에서 확인할 시나리오

- Coach가 SDK 기본 도구로 저장된 프로젝트 파일을 읽고 필요한 코드를 검색합니다.
- 선택한 Driver의 허용된 기록만 읽고, 다른 세션·인증 파일·비공유 자료에 접근하지 않습니다.
- 수정·셸·위임 도구가 노출되지 않고 예상 밖 권한 요청은 거절됩니다.
- 실제 도구 결과에 들어오는 파일 내용·로그 구간·큰 출력의 참조 형태를 확인합니다.
- Driver 로그와 Coach 로그를 분리하고, 자신의 읽기/응답으로 자동 개입이 반복되지 않습니다.
- Compiler는 Coach보다 더 제한된 설정으로 새 파일을 읽지 않고 종료 입력만 사용합니다.

**파일 방식으로 충분한지 실제 자료로 판단합니다.**

필요한 상태·결과가 없거나 형식·접근 문제로 요구를 충족하지 못하면 지원 환경을 좁히거나 AHP·Hook을 비교합니다. 실패를 숨기거나 권한을 넓혀 억지로 통과시키지 않습니다. AHP를 만들었다는 사실 자체가 목표는 아닙니다.

**회귀 테스트 매트릭스 · 앞으로 구현할 자동화 기준**

| 입력 / 조작 | 기대 결과 | 검증 계층 |
|----|----|----|
| Driver 미연결 start | active·discussing, Coach 응답 가능, Driver 포트 미호출 | Controller 단위 |
| 과거 사용자 턴·동일 이벤트 재생 | 기준선·중복으로 처리, 회전 수 불변 | Normalizer + Journal |
| 확인된 새 직접 지시 | 로그의 새 SDK 이벤트를 현재 회전에 한 번만 연결, driver_pending | 로그 보조 함수 → Controller |
| 결과 이후 공동 리뷰 | 사용자·Coach의 근거 snapshotId 동일 | 통합·UI |
| 대기 중 pause / end / 문맥 교체 | 이전 Lease의 응답 폐기·진단, Native cancel 호출 0회 | Scheduler + Runtime |
| end와 결과 이벤트가 동시 도착 | 직렬화 경계 기준으로 cutoff 포함/제외 결정, 기존 snapshot 내용 불변 | Controller + Store |
| 잘못된 snapshotId·없는 Evidence ID | 보고서 검증 실패, 정상 보고서로 노출하지 않음 | Validator 단위 |
| Coach 발화만 인용한 실행 확인 주장 | EVIDENCE_BASIS_MISMATCH | Validator 단위 |
| 모델·원문에 HTML·명령 링크 포함 | 텍스트로 출력, 실행·외부 요청 없음 | Renderer + 브라우저 |
| 저장 취소·권한 오류 | Export 상태만 변경, ready 데이터 유지, 모델 재호출 0회 | Export 통합 |
| 읽기 프로필 없음·와일드카드 도구명 | Coach 생성 거절. 전체 내장 도구로 대체하지 않음 | SDK 설정 단위 |
| Coach 프로필을 Compiler에 재사용 | Compiler가 작업 디렉터리·권한·도구를 명시적으로 제한 | Compiler 설정 단위 |

<a id="alternatives"></a>

## 11. 후속 대안과 미검증 항목

필수 요구는 Driver의 작업 맥락과 현재 코드를 Coach가 활용하는 것입니다. AHP 자체가 요구사항은 아닙니다. 해커톤은 실측한 로컬 파일 방식부터 시작하고, 부족한 기능과 지원 환경을 확인한 뒤 대안을 선택합니다.

**검토한 구성과 현재의 판단**

| 구성 | 장점과 제약 | 현재 판단 |
|----|----|----|
| 로컬 로그 + SDK 읽기·검색 | 현재 CLI/SDK 세션에서 기록 읽기·새 출력 감지 확인. 경로·형식·권한은 환경에 종속 | **해커톤 MVP 우선안.** 실제 Coach 읽기 전용 프로필부터 추가 검증 |
| 기존 Driver + AHP + 별도 Coach | Host의 구조화된 상태 조회·구독·재연결 계약 활용. endpoint·인증·호환성 확인 필요 | 파일에 필요한 상태가 없거나 원격·여러 하네스 지원이 필요할 때 후속 검토 |
| 기존 Driver + Hook | 특정 제출·도구 이벤트를 가벼운 트리거로 사용할 수 있으나 하네스별 차이가 있음 | 필요한 이벤트가 확인되면 파일 변경 감지의 대안·보완으로 검토 |
| Driver·Coach 모두 별도 SDK | 입력·세션 제어가 쉬워지지만 Driver UI와 실행 연결을 다시 만들어야 함 | 기본 UI 유지 요구를 충족하지 않아 우선안에서 제외 |
| 두 Custom Agent만 등록 | 역할별 수동 대화 시험은 간단함. 자동 세션 관찰·개입 기능은 생기지 않음 | 페르소나 시험용. 제품 구성 전체를 대체하지 않음 |

### AHP를 선택할 때의 경계

AHP는 저장소가 아니라 Host 상태의 조회·구독 프로토콜입니다. 보존된 과거 턴을 snapshot·fetchTurns로 읽고 새 변경을 구독할 수 있지만, 모든 원본 이벤트의 영구 보존을 보장하지 않습니다. 선택한 채널의 serverSeq를 연속 +1로 가정하지 않으며 재연결은 replay 또는 snapshot으로 처리합니다. 이 경로는 현재 MVP 코드 계약이 아니라 후속 참고입니다. [\[6\]](#source-06) [\[18\]](#source-18) [\[19\]](#source-19)

AHP를 써야만 읽기 권한을 관리할 수 있는 것은 아닙니다. AHP 자체에도 실행·승인 기능이 있으므로 별도 제한이 필요합니다. 기존 Host endpoint 연결과 서버가 강제하는 읽기 전용 권한은 아직 검증 전입니다. [\[4\]](#source-04) [\[5\]](#source-05) [\[7\]](#source-07)

### 아직 결정하지 않은 항목

- 실제 Coach용 SDK 기본 읽기·검색 도구 이름, 경로 권한과 거절 동작
- 지원할 CLI/SDK·Native Copilot 실행 방식별 로그 위치·형식·결과 완전성
- 선택한 Driver 로그의 식별 UX와 큰 출력·로그 회전·재시작 처리
- Coach·Compiler 모델, 개입 빈도·호출 예산·검증 재시도 한도
- 문맥 보관 기간, 원문 저장 범위, 삭제 방식
- 로그의 모델 공유 범위·민감 필드 필터, 실제 사용한 코드 근거의 수집 방식
- 일시 중지 시 수집 중지 정책, 원격 환경 지원 범위, 보고서의 원문 인용·보관·삭제 정책

테스트 작성 보조나 원격 지원은 후속 기능입니다. 기본 읽기·검색을 위해 전용 Workspace Reader부터 만들거나, AHP 연결 성공에 MVP 전체를 종속시키지 않습니다. 기존 Driver를 파일로 관찰하는 것과 Driver를 확장 소유 SDK로 새로 만드는 것은 다른 선택입니다.

<a id="sources"></a>

## 12. 공식 자료와 관련 문서

링크는 설명의 근거입니다. 소스에서 경로를 확인한 것과 해당 기능을 현재 환경에서 실행해 본 것은 구분했습니다. 이 HTML은 외부 스크립트·폰트·이미지 없이 열 수 있으며, 출처 확인 시에만 외부 사이트로 이동합니다.

1.  <a id="source-01"></a>[VS Code · Agent harnesses](https://code.visualstudio.com/docs/agents/run/agent-harnesses)

    Local과 Agent Host 기반 Copilot, 화면과 실행 하네스의 구분.

2.  <a id="source-02"></a>[VS Code · Contribution Points](https://code.visualstudio.com/api/references/contribution-points)

    확장이 패키지의 Custom Agent를 제공하는 기여 지점.

3.  <a id="source-03"></a>[VS Code 소스 · Copilot Custom Agent 변환](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/src/vs/platform/agentHost/node/copilot/copilotPluginConverters.ts)

    에이전트 설정의 SDK 전달과 빈 tools 배열 처리. Stable 1.137.0 기준 소스.

4.  <a id="source-04"></a>[VS Code · Introducing the Agent Host](https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture)

    별도 Host의 세션 소유, 다중 클라이언트, AHP와 외부 클라이언트 구현.

5.  <a id="source-05"></a>[VS Code 소스 · Agent endpoints](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/cli/src/commands/agent_endpoints.rs)

    에디터·독립 Host의 연결 지점을 신뢰된 도구에 제공하는 명시적 발견 경로. 확장용 읽기 전용 권한 API는 아님.

6.  <a id="source-06"></a>[AHP 사양 · Chat channel](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/chat-channel.md)

    채팅 상태, 과거 턴 조회, 실시간 변경과 선택적 초안 동기화.

7.  <a id="source-07"></a>[AHP 사양 · Authentication](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/authentication.md)

    연결과 제공자 인증. 전체 통합의 권한 제한을 별도로 시험해야 하는 근거.

8.  <a id="source-08"></a>[GitHub Copilot SDK · v1.0.13 릴리스](https://github.com/github/copilot-sdk/releases/tag/v1.0.13)

    SDK 예시의 검토 기준. npm 현재 latest를 직접 확인한 결과는 아님.

9.  <a id="source-09"></a>[Copilot SDK 소스 · 설정과 권한 타입](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/types.ts)

    시스템 지침, 도구 목록, 승인, 기억·세션 저장소와 자동 발견 설정.

10. <a id="source-10"></a>[Copilot SDK 소스 · Session](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/session.ts)

    이벤트·전송·대기·취소·Hook과 오류 처리.

11. <a id="source-11"></a>[Copilot SDK 소스 · Client](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/client.ts)

    런타임 연결, 빈 모드 기본값, 세션 생성과 resume 동작.

12. <a id="source-12"></a>[Copilot SDK · Bundled runtime](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/setup/bundled-cli.md)

    대응 런타임과 플랫폼 자산 배포. 패키징 시 실제 버전과 파일 포함 여부 검증 필요.

13. <a id="source-13"></a>[Copilot SDK · Authentication](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/auth/authenticate.md) · [Usage and billing](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/features/usage-and-billing.md)

    지원되는 인증과 모델 호출 사용량. Native 로그인 자동 공유나 무료 자동 점검을 가정하지 않음.

14. [VS Code 소스 · Session server tools](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/src/vs/platform/agentHost/node/shared/sessionServerTools.ts)

    세션 문맥 조회의 잘림과 도구 결과 누락. 전체 기록 구독과의 차이.

15. [VS Code · Hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference)

    관찰 가능한 Hook 이벤트와 하네스별 제약. 전체 세션 접근 계약과는 다름.

16. <a id="source-16"></a>[Webview API](https://code.visualstudio.com/api/extension-guides/webview) · [Remote Extensions](https://code.visualstudio.com/api/advanced-topics/remote-extensions) · [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust)

    독립 UI, Extension Host 실행 위치와 신뢰 경계.

17. <a id="source-17"></a>[Copilot SDK · 생성 RPC 타입](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/generated/rpc.ts)

    지정 버전의 명시적 권한 거절 kind: reject. SDK 소유 세션과 Native Driver의 제어 권한은 별개입니다.

18. <a id="source-18"></a>[AHP · Subscriptions](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/subscriptions.md)

    subscribe의 channel·view·delivery, snapshot 및 action notification, 서버 순번 계약.

19. <a id="source-19"></a>[AHP · Connection lifecycle](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/lifecycle.md)

    reconnect의 replay·snapshot 응답, missing 채널과 재생하지 않는 notification.

2026-09-12 파일 실험 이후 MVP를 파일 기반으로 개정했습니다. 실측은 현재 Copilot CLI/SDK 세션이며 실제 Coach 읽기 프로필과 모든 Native 하네스를 검증한 것은 아닙니다. SDK 예시의 문서 기준은 v1.0.13 커밋 f13e4a2입니다. VS Code 1.137.0 관련 소스와 AHP 커밋 0d6d983은 후속 대안 참고이며 최신 버전이라는 뜻은 아닙니다. 문서 타입·로직 검증, 파일 실측, 실제 SDK 통합 검증을 구분합니다.

**Wellactually · 기술 설계와 데이터 흐름** — 2026.09.12 개정. 내부 계약과 코드 예시를 포함한 구현 전 설계 문서입니다.

제품 정의와 완성된 사용자 흐름 페어링 유형과 작업 진행 방식 타깃 정의 Driver 페르소나 Coach 페르소나 이전 SDK 중심 설계 노트

기존 Driver + 로컬 로그 + SDK 기본 읽기 도구를 MVP 우선안으로 삼습니다. Coach-first 진입, 회전·세션 수명 분리, 종료 후 동결 입력 기반 Knowledge Compilation을 유지합니다. AHP와 전용 Reader는 필수 구성에서 제외했습니다. 외부 스크립트·폰트·이미지 없이 읽을 수 있습니다.

[문서 처음으로](#top)
