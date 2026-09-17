# Wellactually Custom Agent 제품 설계

## 목적

Wellactually의 첫 제품 형태는 별도 Chat UI나 Agents Window가 아니라 VS Code의
기본 Chat View, Custom Agent와 Agent Host를 사용한다. 제품은 Pair와 Driver의
대화를 분리하면서도, Pair가 Driver의 작업 과정과 사용자가 전달한 구현 지시를
읽고 다음 논의를 이어 갈 수 있게 한다.

## 기본 Chat View와 Agent Host 구성

기본 Chat View의 Sessions 목록에 서로 독립된 Pair와 Driver Agent Host 세션을
둔다.

```text
기본 Chat View / 현재 Workspace
├─ Pair Agent Host 세션
│  └─ 사용자가 Wellactually 페어링 mode를 선택
└─ Driver Agent Host 세션
  ├─ Pair가 독립 세션으로 최초 한 번 생성
  ├─ 사용자가 Wellactually Driver를 선택
  └─ 사용자가 직접 구현 지시를 입력
```

두 세션은 대화 기록, Context Window와 생명주기를 공유하지 않는다. Driver
세션은 Pair가 `relationship: independent`, Pair 세션의 정확한 Workspace 경로,
`worktree: false`로 생성한다. 따라서 두 세션은 같은 실제 Workspace를 직접
사용한다. Driver가 변경한 코드는 Pair가 Workspace에서 확인할 수 있고, Pair는
Agent Host의 세션 관리 도구로 Driver 세션의 최근 대화 맥락도 읽을 수 있다.

사용자는 기본 Chat View의 Sessions 목록에서 Pair와 Driver 세션을 전환한다.
Agents Window, 화면 분할, 동시 표시나 병렬 실행은 제품 흐름에 필요하지 않다.

데이터 접근은 비대칭으로 구성한다.

```text
Pair 세션 ──읽기──> Driver 세션
Driver 세션 ──접근 불가──> Pair 세션
```

Pair는 Driver 세션에 메시지를 보내거나 작업을 위임하지 않는다. Driver에게 어떤
작업을 맡길지 결정하고 실제 구현 지시를 작성하는 주체는 사용자다.

## Driver 세션 생성과 사용 흐름

1. 사용자가 기본 Chat View에서 Pair Agent Host 세션을 시작하고 Pair mode를
   선택해 문제, 방향과 Scope을 논의한다.
2. Pair는 `get_current_session`으로 자신의 정확한 Workspace 경로를 확인한다.
3. Pair는 `create_session`을 `relationship: independent`, 확인한 Workspace 경로,
   `worktree: false`로 호출해 Driver Agent Host 세션을 만든다.
4. `create_session`에는 초기 프롬프트가 필수이므로, 실제 작업을 지시하지 않는
   짧은 안내를 넣는다.

   ```text
   This is a Wellactually Driver session. Do not inspect or modify the workspace yet.
   Wait for the user to select Wellactually Driver and provide a direct implementation instruction.
   ```

5. 생성된 Driver 세션은 기본 Chat View의 Sessions 목록에 나타난다. 사용자는
   해당 세션을 선택한다.
6. `create_session`은 대상 Custom Agent를 지정할 수 없으므로 사용자가
   **Wellactually Driver**를 직접 선택한다.
7. 사용자는 Pair와 논의한 판단을 자신의 말로 구현 지시에 담아 Driver에게
   전달한다.
8. Driver는 국소적인 설계, 구현과 검증을 수행한다.
9. 사용자는 Sessions 목록에서 기존 Pair 세션으로 돌아가 논의를 계속한다.
10. Pair는 생성 시 받은 Driver 세션 식별자로 `get_session_context`를 호출해 사용자
    지시, Driver 응답과 도구 사용 맥락을 읽고, Workspace의 실제 변경도 확인한다.

이 흐름은 필요한 만큼 반복할 수 있다. Pair가 Driver 세션을 다시 만들거나 기존
Driver 세션에 후속 메시지를 보내는 방식으로 반복하지 않는다. 사용자가 같은
Driver 세션에서 다음 구현 지시를 내리고 Pair는 그 결과를 읽는다.

## 1. Custom Agent 본문

### Pair mode

다음 네 개의 Pair Custom Agent를 제공한다.

- Beginner mode
- Easy mode
- Intermediate mode
- Advanced mode

모든 mode는 하나의 Navigator 정체성과 역할 경계를 공유한다. 각 Agent 본문에는
다음과 같은 mode별 차이만 둔다.

- 우선하는 Navigator 상호작용 방식과 사용 빈도
- 질문, 반례와 지식 제공의 명시성 및 구체성
- 개입 기준과 자제할 상황
- 사용자가 스스로 사고하도록 남겨 두는 범위

여섯 가지 상호작용 방식은 기여 방식과 개입 원칙처럼 별도 범주로 나누지 않는다.
하나의 공통 Instructions에서 의미를 정의하고, 모든 Pair mode가 같은 정의를
참조한다. 각 mode는 정의를 다시 만들지 않고 현재 지원 밀도에 맞게 우선순위,
빈도와 개입 기준만 구체화한다.

### Wellactually Driver

Driver Agent 본문에는 다음을 명시한다.

- 사용자가 직접 전달한 구현 지시를 수행한다.
- 구현에 필요한 국소적인 설계, 코드 변경과 검증을 담당한다.
- Pair 세션을 읽거나 Pair를 호출하지 않는다.
- 열린 제품 판단이나 사용자의 의도를 임의로 확정하지 않는다.
- 지시 안에서 결정할 수 없는 중요한 모호함은 사용자에게 돌려준다.

## 2. Frontmatter 설정

Pair mode는 사용자가 직접 선택할 수 있지만 다른 Agent가 자동으로 호출할 수는
없게 한다. Subagent도 사용하지 않는다.

```yaml
---
name: Wellactually Easy
description: "사용자와 함께 설계와 구현 범위를 구체화하는 Wellactually Navigator"
argument-hint: "현재 작업의 문제, 방향 또는 고민을 설명하세요."
tools:
  - read
  - search
  - web
  - get_current_session
  - create_session
  - list_sessions
  - get_session_context
agents: []
user-invocable: true
disable-model-invocation: true
---
```

Driver는 구현에 필요한 도구만 사용한다.

```yaml
---
name: Wellactually Driver
description: "사용자가 정한 범위 안에서 국소 설계, 구현과 검증을 수행하는 Driver"
argument-hint: "구현할 목표, Scope, 유지할 조건과 확인 기준을 지시하세요."
tools:
  - read
  - search
  - edit
  - execute
agents: []
user-invocable: true
disable-model-invocation: true
---
```

Agent Host 내장 도구의 실제 식별자와 Custom Agent에서 선택 가능한 이름은 사용
중인 VS Code 버전의 **Configure Tools**에서 확인한다. 위 이름은 제품 설계상
필요한 기능을 나타낸다.

## 3. Instructions

네 Pair mode가 공유하는 Navigator 정책은 별도 Instructions 파일로 관리하고 각
Agent 본문에서 참조한다.

```text
.github/instructions/wellactually-navigator.instructions.md
```

공통 Instructions에는 다음 내용을 둔다.

- 사용자, Pair와 Driver의 역할 및 소유권
- 여섯 가지 Navigator 상호작용 방식의 공통 정의
- 사용자가 판단과 Driver 지시를 직접 소유한다는 원칙
- Pair가 완성된 설계나 구현 지시를 대신 작성하지 않는다는 경계
- Driver 결과를 채점하거나 승인하지 않는다는 경계
- Driver 세션을 읽는 목적, 시점과 범위
- Driver 세션에 메시지를 보내거나 작업을 위임하지 않는다는 제한
- 수평적인 동료 관계와 mode에 관계없이 유지할 말투

Pair 전용 정책은 `AGENTS.md` 같은 전역 Instructions에 넣지 않는다. 전역 적용 시
Driver에도 Navigator 정책이 섞일 수 있기 때문이다.

여섯 가지 방식을 각각 별도 Instructions, Prompt 또는 Skill로 분리하지 않는다.
이들은 독립 실행하는 Workflow가 아니라 Pair가 매 응답에서 현재 맥락에 맞게
선택하는 기본 행동이기 때문이다. 하나의 짧은 공통 정의를 유지하면 mode마다
같은 용어가 다른 의미로 변하는 것을 막을 수 있다.

## 4. Tools

### Pair 도구

- `read`: 구현 결과와 프로젝트 문서를 읽는다.
- `search`: 관련 코드, 계약과 제약을 찾는다.
- `web`: 현재 판단에 필요한 공식 문서나 공학 지식을 조사한다.
- `get_current_session`: Pair 세션의 정확한 Workspace 경로를 확인한다.
- `create_session`: 같은 Workspace를 직접 사용하는 독립 Driver 세션을 최초 한 번
  만든다.
- `list_sessions`: 관련 Agent Host 세션의 상태와 메타데이터를 확인한다.
- `get_session_context`: 생성한 Driver 세션의 최근 대화를 읽는다.

`get_session_context`는 사용자 프롬프트, Driver 응답과 도구 호출을 제한된 최근
대화 범위에서 반환한다. Pair는 사용자의 프롬프트를 별도로 채점하지 않는다.
Pair와 논의한 의도와 제약이 실제 위임에 어떻게 반영되었는지, 누락이나 Scope
차이가 구현 결과에 영향을 주었는지를 이해하는 보조 맥락으로 사용한다.

Pair에는 코드 편집, 명령 실행, 다른 Agent 호출, 다른 세션으로 메시지를 보내는
도구를 제공하지 않는다.

### Driver 도구

Driver에는 Workspace 읽기와 검색, 코드 편집, 명령 실행 및 검증 도구를 제공한다.
다른 Agent Host 세션을 조회하고 읽고 제어하는 도구는 제공하지 않는다.

## 5. Skills

MVP에서 제공할 주요 Skill은 `knowledge-compile`이다. 사용자가
`/knowledge-compile`을 실행하거나 세션 지식 정리를 명시적으로 요청했을 때만
사용한다.

```yaml
---
name: knowledge-compile
description: "완료한 페어링 경험에서 사용자가 형성한 지식과 판단을 정리할 때 사용"
user-invocable: true
disable-model-invocation: true
---
```

`disable-model-invocation: true`로 설정해 Pair가 임의로 실행하지 못하게 한다.

추후에는 설계 Trade-off 탐색, 디버깅 가설 수립, 마이그레이션 위험 탐색처럼
반복 가능한 공학적 절차를 Skill로 추가할 수 있다. 이러한 Skill은 Pair의 기본
성격을 바꾸지 않고 필요할 때만 지식과 절차를 제공해야 한다.

## 6. MCP

MVP에는 MCP가 필요하지 않다. Driver 세션 접근에는 Agent Host 내장 세션 관리
도구를 사용한다.

GitHub 또는 Azure DevOps 이슈, 사내 Wiki, 운영 로그, API 명세나 데이터베이스
스키마처럼 Workspace 밖의 근거가 실제 Navigator 판단에 필요해질 때 MCP를
검토한다. 도입 시 Pair에는 필요한 읽기 전용 MCP 도구만 개별 허용하고, 서버의
모든 도구를 일괄 허용하지 않는다.

## 7. Prompts와 Hooks

별도 `.prompt.md` 파일은 MVP에 두지 않는다. 사용자가 Driver 작업 프롬프트를
직접 작성하는 과정이 제품 경험의 일부이기 때문이다. Driver 세션 생성 시
사용하는 짧은 초기 문구는 Prompt 파일이 아니라 `create_session`의 필수
`prompt` 인자로 전달한다.

Hooks도 처음부터 도입하지 않는다. 명시적인 도구 허용 목록과 Instructions로
시작하고, 다음 동작이 실제로 반복될 때만 `PreToolUse` Hook으로 강제한다.

- Pair가 Driver 세션을 둘 이상 생성한다.
- 허용하지 않은 세션 제어 동작을 시도한다.
- mode의 역할 경계를 벗어난 도구를 호출한다.

Hooks를 추가할 경우 작은 감사 가능한 스크립트로 유지하고, Agent Host의 Preview
기능 및 VS Code 버전 변화에 따른 동작 차이를 함께 검증한다.

## 기술적 제약과 검증 항목

- `create_session`은 `prompt`와 `title`을 필수로 받고 생성 직후 첫 요청을
  실행한다. 빈 Driver 세션만 만드는 동작은 현재 지원되지 않는다.
- `create_session`은 모델을 지정할 수 있지만 Custom Agent를 지정할 수 없다.
  따라서 사용자가 생성된 Chat에서 Wellactually Driver를 직접 선택해야 한다.
- `get_session_context`는 기본적으로 최근 10개 turn을 반환하고 최대 50개까지
  요청할 수 있다. 전체 원본 대화가 항상 제공되는 계약은 아니다.
- Pair가 특정 Driver 세션을 다시 읽으려면 생성 결과의 세션 식별자 또는
  `openLink`를 유지해야 한다. 식별자를 잃었을 때는 유사한 이름으로 추측하지
  않고 사용자에게 세션을 확인한다.
- 기본 Chat View에서 `relationship: independent`, 동일 Workspace,
  `worktree: false`로 만든 Driver 세션이 Sessions 목록에 나타나고, Pair가 그
  세션의 사용자 프롬프트와 Driver 응답을 읽을 수 있음을 실제 환경에서
  검증했다.
- Agent Host와 세션 관리 기능은 개발 중인 Preview 표면이다. 지원 VS Code
  버전과 필요한 설정을 제품 요구사항으로 명시해야 한다.

## MVP 구성 요약

- 네 개의 Pair mode Custom Agent
- 하나의 Wellactually Driver Custom Agent
- 하나의 공통 Navigator Instructions
- Pair의 읽기 전용 Workspace 및 Agent Host 세션 도구
- Driver의 구현 및 검증 도구
- 사용자가 명시적으로 실행하는 `knowledge-compile` Skill
- 기본 Chat View에서 같은 Workspace를 사용하는 독립 Pair·Driver Agent Host 세션
- 사용자가 직접 수행하는 Driver 선택과 구현 지시
