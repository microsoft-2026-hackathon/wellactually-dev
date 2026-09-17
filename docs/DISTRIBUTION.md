# Wellactually 배포

## 저장소 역할

Wellactually는 개발 정본과 사용자 배포본을 별도 저장소로 관리한다.

| 저장소                                      | 역할                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `microsoft-2026-hackathon/wellactually-dev` | 제품 문서, 로컬 검증용 Workspace Customization과 패키징 스크립트의 정본 |
| `microsoft-2026-hackathon/wellactually`     | 사용자가 설치하는 Agent Plugin 1.0 배포본                               |

개발 저장소의 `.github/agents`, `.github/instructions`, `.github/skills`를 직접
수정한다. 배포 저장소의 Agent, rule과 Skill은 패키징 스크립트가 생성하며 직접
수정하지 않는다.

## 개발 저장소

개발 저장소는 VS Code가 Workspace Customization으로 자동 발견하는 구조를
사용한다.

```text
wellactually-dev/
├─ .github/
│  ├─ agents/
│  │  ├─ beginner.agent.md
│  │  ├─ easy.agent.md
│  │  ├─ intermediate.agent.md
│  │  ├─ advanced.agent.md
│  │  └─ wellactually-driver.agent.md
│  ├─ instructions/
│  │  └─ wellactually-navigator.instructions.md
│  └─ skills/
│     ├─ engineering-decisions/
│     ├─ debugging-and-verification/
│     ├─ distributed-systems/
│     └─ application-foundations/
├─ packaging/
│  ├─ plugin.json
│  └─ README.md
└─ scripts/
   ├─ package-plugin.mjs
   └─ package-plugin.test.mjs
```

이 구조에서는 개발 저장소를 VS Code로 열기만 하면 Agent 선택기에 변경 사항이
반영된다. 별도 Plugin 설치나 `chat.pluginLocations` 설정이 필요하지 않다.

## 배포 패키지 생성

배포 저장소를 개발 저장소의 sibling directory에 clone한 경우 다음 명령을
실행한다.

```bash
node scripts/package-plugin.mjs ../wellactually-plugin
```

인자는 로컬 배포 저장소의 경로다. 폴더 이름은 자유롭다. 스크립트는 다음 작업을
수행한다.

1. `.github/agents`의 다섯 Agent를 `com.github.copilot/agents`로 복사하고,
   구형 Copilot SDK 호환용 `agents/`에도 생성한다.
2. Agent의 공통 Instructions 참조를 Plugin의 `rules` 경로로 변환한다.
   호환용 Agent는 `../com.github.copilot/rules/`를 참조해 같은 지침을 사용한다.
3. Navigator Instructions를 `com.github.copilot/rules`로 복사한다.
4. `.github/skills`의 네 Skill을 루트 `skills/`로 복사한다. 각 `SKILL.md`와
   `references/`의 원문 및 상대 경로를 유지한다.
5. `packaging/plugin.json`과 `packaging/README.md`를 배포 저장소 루트로 복사한다.
6. manifest, Agent 수, Skill 진입점과 문서의 `./`, `../` 파일 링크를 검증한다.

출력 경로는 개발 저장소의 내부나 상위 디렉터리가 될 수 없다. 출력의
`com.github.copilot/`, `agents/`, `skills/`는 생성 전용으로 매번 다시 만들며 오래된 파일도
제거한다. 이 폴더에 수동 파일을 두지 않는다. 출력 루트의 `.git`과 그 밖의
비관리 파일은 보존하며 `plugin.json`과 `README.md`는 템플릿으로 덮어쓴다.

한국어 사용 설명서의 정본은 [packaging/README.md](../packaging/README.md)다.
설치 패키지 루트의 `README.md`로 포함되며 Plugin의 `homepage`는
[온라인 사용 설명서](https://github.com/microsoft-2026-hackathon/wellactually#readme)를
가리킨다. 모드 선택, Pair·Driver 사용 흐름, 업데이트와 문제 해결 안내는 이
정본에서 함께 관리한다.

생성 결과는 다음과 같다.

```text
wellactually/
├─ plugin.json
├─ README.md
├─ agents/                 # 구형 Copilot SDK 호환용 다섯 Agent
├─ skills/
│  ├─ engineering-decisions/
│  ├─ debugging-and-verification/
│  ├─ distributed-systems/
│  └─ application-foundations/
└─ com.github.copilot/
   ├─ agents/
   │  ├─ beginner.agent.md
   │  ├─ easy.agent.md
   │  ├─ intermediate.agent.md
   │  ├─ advanced.agent.md
   │  └─ wellactually-driver.agent.md
   └─ rules/
      └─ wellactually-navigator.instructions.md
```

각 Skill은 `SKILL.md`와 `references/`를 포함한다. 총 열두 Reference를 제공하며
`user-invocable: false`, `disable-model-invocation: false`로 필요할 때 모델이
선택하도록 설정한다. `knowledge-compile`은 보류하며 현재 패키지에는 없다.

로컬 패키징 검증은 Node.js 20 이상에서 실행한다. 별도 의존성 설치는 필요 없다.

```bash
node --test scripts/package-plugin.test.mjs
```

테스트는 임시 디렉터리에서 원문 보존, 호출 설정, 반복 실행, 오래된 산출물 정리,
잘못된 경로와 링크를 검사한다. 실제 VS Code의 Skill 발견과 대화 중 자료 선택·적용
품질은 별도 시나리오 검증이 필요하다.

### Copilot 세션의 Agent 발견 검사

VS Code의 `Local`과 `Copilot` 세션은 Agent 발견 경로가 다르다. 설치된 Copilot SDK
`1.0.73`은 `com.github.copilot/agents`만 있는 패키지에서 Agent를 발견하지 못했지만,
루트 `agents/`를 함께 생성하면 다섯 Agent를 반환했다. Local 로더는 Agent Plugins
1.0 manifest의 네임스페이스 경로를 사용한다. 두 경로는 하나의 정본에서 생성한다.

SDK가 설치된 환경에서는 `WELLACTUALLY_COPILOT_SDK`에 SDK 진입 파일을 지정해
선택 실행형 발견 검사를 활성화한다. macOS의 기본 VS Code 설치 기준 명령은 다음과 같다.

```bash
ELECTRON_RUN_AS_NODE=1 \
WELLACTUALLY_COPILOT_SDK='/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/copilot/node_modules/@github/copilot/sdk/index.js' \
'/Applications/Visual Studio Code.app/Contents/MacOS/Code' --test scripts/package-plugin.test.mjs
```

일반 Node로 실행한다면 SDK에 맞는 Node 22 이상을 사용한다. 검사는 임시 Workspace와
설정 폴더에서 모델 호출이나 사용자 인증 없이 SDK의 Agent 목록만 조회한다. SDK
경로를 지정하지 않은 기본 테스트에서는 이 검사를 건너뛴다. 목록 발견 성공은 실제
UI 선택, 세션 도구 실행이나 Pair 행동 품질까지 보장하지 않으므로 설치 후 별도로 확인한다.

### 대화 행동 재시험

새 `Copilot` 세션에서 같은 모델, 과제, 코드·데이터 상태로 Easy와 Advanced를
각각 실행한다. Plugin 버전과 과제 원문의 제공 여부를 기록하고, 최종 답변뿐 아니라
도구 탐색을 언제 멈췄는지도 살핀다. 공통 지침의 로딩·문맥 포함 여부가 확인되지
않으면 모드 자체의 문제로 단정하지 않는다.

| 시작 조건 | 확인할 행동 |
| --- | --- |
| 과제 원문이 없고 현재 제품 문서만 있음 | 요구사항이 선택을 좌우하면 좁게 원문을 찾거나 확인을 요청한다. 원문 확보 전에 쓰기 경로와 UI 전체를 조사하거나 설계를 완성하지 않는다. |
| 로컬 과제 파일은 없지만 사용자가 원문을 제공함 | 파일 부재만으로 멈추거나 원문을 다시 요구하지 않는다. 확정된 조건을 활용하며, 예를 들어 현재 재고 반영 요구를 임의로 완화하는 질문을 하지 않는다. |
| 사용자가 필요한 계약·위험을 이미 고려한 방향을 제시함 | Advanced는 새로운 중대한 우려가 없으면 불필요한 제안으로 흐름을 끊지 않는다. Easy도 이미 정한 판단을 반복해서 되묻지 않는다. |
| 사용자가 특정 대안의 상세 비교를 명시적으로 요청함 | 필요한 근거와 설명을 제공한다. 짧게 답하려고 요청을 회피하거나 완성된 구현 지시를 대신 작성하지 않는다. |

Easy의 차이는 함께 판단할 발판을 제공하는 데 있고, Advanced의 차이는 판단을
바꾸는 핵심 조건을 선별하는 데 있다. 고정 문구, 도구 호출 수, 문단 수만으로
합격을 판정하지 않는다. 이 시나리오는 실제 모델 행동 확인용이며 자동 패키징
테스트 통과를 대신할 수도, 그 결과로 자동 통과 처리될 수도 없다.

## Git 저장소에서 직접 설치

초기 사용자 검증과 제한된 배포에는 VS Code의 소스 설치 기능을 사용한다. 사용자가
저장소를 clone하거나 파일을 자신의 프로젝트에 복사할 필요는 없다.

1. VS Code Command Palette를 연다.
2. `Chat: Install Plugin From Source`를 실행한다.
3. 다음 URL을 입력한다.

   ```text
   https://github.com/microsoft-2026-hackathon/wellactually.git
   ```

4. Plugin 내용을 확인하고 설치를 승인한다.
5. Chat의 Agent 선택기에 다섯 Wellactually Agent가 나타나는지 확인한다.
6. Chat 설정의 **Plugins** 또는 Extensions의 **Agent Plugins - Installed**에서
   `wellactually`가 활성화됐는지 확인한다.

배포 저장소는 public이므로 설치 과정에서 저장소 읽기 권한이나 조직 인증이
필요하지 않다.

## Release 절차

개발 저장소 `main`의 다음 경로가 변경되면
`Sync Agent Plugin` GitHub Actions workflow가 자동으로 실행된다.

- `.github/agents/**`
- `.github/instructions/**`
- `.github/skills/**`
- `packaging/**`
- `scripts/package-plugin.mjs`
- `scripts/package-plugin.test.mjs`
- 동기화 workflow 자체

Workflow는 패키징 테스트를 먼저 실행한다. `WELLACTUALLY_PLUGIN_TOKEN` repository secret으로 배포 저장소를
checkout하고, 패키징 스크립트를 실행한 뒤 결과가 달라졌을 때만 배포 저장소
`main`에 commit한다. `git push --dry-run`은 게시 접근 사전 검사이며 실제 갱신 시
적용되는 모든 서버 정책의 통과를 보장하지 않는다. PAT에는 대상 저장소 쓰기 권한과
필요한 조직 승인이 있어야 한다. 개발 저장소의 기본 `GITHUB_TOKEN` 권한은
`contents: read`로 제한한다.

자동 동기화가 필요하지만 관련 파일 변경이 없는 경우에는 GitHub Actions의
**Run workflow**로 `workflow_dispatch` 실행을 시작할 수 있다.

Release는 다음 순서로 진행한다.

1. 개발 저장소에서 Agent, Instructions와 Skill 변경을 완료하고 검증한다.
2. `packaging/plugin.json`의 버전을 Semantic Versioning에 따라 올린다.
3. 변경을 개발 저장소 `main`에 merge한다.
4. `Sync Agent Plugin` workflow가 성공했는지 확인한다.
5. 배포 저장소의 자동 생성 commit과 Plugin 구조를 검토한다.
6. 배포 버전과 같은 immutable Git tag를 생성하고 push한다.
7. 새 VS Code 환경에서 `Chat: Install Plugin From Source`로 smoke test한다.

배포 저장소에서 발견한 문제는 생성 결과를 직접 고치지 않는다. 개발 저장소의
정본을 수정하고 다시 패키징한다.

## Agent Plugin Marketplace 배포

여기서 Marketplace는 `.vsix`를 게시하는 일반 Visual Studio Marketplace가
아니라 VS Code의 `@agentPlugins` 화면이 사용하는 Agent Plugin Marketplace다.
Wellactually에는 Extension 코드가 없으므로 VSIX로 배포하지 않는다.

공개 배포의 첫 대상은 VS Code에 기본 등록된 커뮤니티 Marketplace인
[`github/awesome-copilot`](https://github.com/github/awesome-copilot)이다. 등록되면
사용자는 Extensions에서 `@agentPlugins`를 검색하거나 `Chat: Plugins`를 실행해
Wellactually를 설치할 수 있다.

### 공개 등록 준비

- 배포 저장소 공개 전환을 유지한다.
- 저장소에 배포에 적합한 License를 추가하고 `plugin.json`에 SPDX identifier를
  기록한다.
- 유효한 Semantic Version, immutable release tag와 full commit SHA를 준비한다.
- Plugin 이름, 설명, author, repository와 lowercase keyword를 확인한다.
- 소스 설치 후 다섯 Agent 발견 및 핵심 Pair·Driver 흐름을 검증한다.

저장소 공개 전환은 완료됐다. Marketplace 제출 전 남은 제품·법무 결정은 License
선택과 적용이다.

### 공개 등록 절차

1. `github/awesome-copilot`의 **Adding External Plugins** issue 양식을 연다.
2. 배포 저장소, release tag, full SHA, 버전, License, author와 keyword 정보를
   제출한다.
3. 외부 공개 Plugin은 `plugins/external.json`을 직접 수정하는 PR을 만들지 않는다.
4. 자동 품질 검사와 maintainer review를 통과한다.
5. Marketplace 등록 후 새 환경에서 설치와 업데이트를 smoke test한다.

## Release 체크리스트

- 개발 저장소의 `.github/agents`에 다섯 Agent가 있다.
- 네 Pair mode가 공통 Navigator Instructions를 참조한다.
- 네 공학 Skill과 열두 Reference가 패키지에 원문 그대로 포함된다.
- 패키징 테스트를 통과하고 설치된 환경에서 관련 Skill 발견·선택을 확인했다.
- 배포 저장소의 `plugin.json` 이름과 버전이 release와 일치한다.
- 배포 저장소 Agent의 `../rules` 참조가 유효하다.
- 호환용 `agents/`가 같은 정본에서 생성되며 공통 rule을 참조한다.
- 대상 VS Code의 SDK 발견 검사와 `Local`·`Copilot` 선택기 확인을 구분해 수행했다.
- Pair mode에는 편집, 명령 실행과 세션 메시지 전송 도구가 없다.
- Driver에는 다른 Agent 세션을 조회하거나 제어하는 도구가 없다.
- 기본 Chat View에서 Pair가 독립 Driver 세션을 생성할 수 있다.
- 두 세션이 `worktree: false`로 같은 Workspace를 직접 사용한다.
- Pair가 Driver의 사용자 프롬프트와 응답을 읽을 수 있다.
- 설치, 업데이트, 비활성화와 제거를 새 사용자 환경에서 확인했다.
