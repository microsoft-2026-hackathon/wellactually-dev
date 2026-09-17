# Wellactually 배포

## 저장소 역할

Wellactually는 개발 정본과 사용자 배포본을 별도 저장소로 관리한다.

| 저장소 | 역할 |
| --- | --- |
| `microsoft-2026-hackathon/wellactually-dev` | 제품 문서, 로컬 검증용 Workspace Customization과 패키징 스크립트의 정본 |
| `microsoft-2026-hackathon/wellactually` | 사용자가 설치하는 Agent Plugin 1.0 배포본 |

개발 저장소의 `.github/agents`와 `.github/instructions`를 직접 수정한다. 배포
저장소의 Agent와 rule은 패키징 스크립트가 생성하며 직접 수정하지 않는다.

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
│  └─ instructions/
│     └─ wellactually-navigator.instructions.md
├─ packaging/
│  ├─ plugin.json
│  └─ README.md
└─ scripts/
   └─ package-plugin.mjs
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

1. `.github/agents`의 다섯 Agent를 `com.github.copilot/agents`로 복사한다.
2. Agent의 공통 Instructions 참조를 Plugin의 `rules` 경로로 변환한다.
3. Navigator Instructions를 `com.github.copilot/rules`로 복사한다.
4. `packaging/plugin.json`과 `packaging/README.md`를 배포 저장소 루트로 복사한다.
5. manifest, Agent 수와 상대 rule 링크를 검증한다.

생성 결과는 다음과 같다.

```text
wellactually/
├─ plugin.json
├─ README.md
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

`knowledge-compile`을 구현하면 개발 저장소의 `skills/knowledge-compile`을 배포
저장소의 같은 경로로 복사하도록 스크립트를 확장한다.

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

배포 저장소가 비공개인 동안에는 해당 저장소를 읽을 수 있는 GitHub 인증이
필요하다.

## Release 절차

1. 개발 저장소에서 Agent와 Instructions 변경을 완료하고 검증한다.
2. `packaging/plugin.json`의 버전을 Semantic Versioning에 따라 올린다.
3. 패키징 스크립트를 배포 저장소에 실행한다.
4. 배포 저장소의 diff가 생성된 파일만 포함하는지 검토한다.
5. 배포 저장소 `main`에 commit하고 push한다.
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

- 배포 저장소를 public으로 전환한다.
- 저장소에 배포에 적합한 License를 추가하고 `plugin.json`에 SPDX identifier를
  기록한다.
- 유효한 Semantic Version, immutable release tag와 full commit SHA를 준비한다.
- Plugin 이름, 설명, author, repository와 lowercase keyword를 확인한다.
- 소스 설치 후 다섯 Agent 발견 및 핵심 Pair·Driver 흐름을 검증한다.

License 선택과 저장소 공개 전환은 별도 제품·법무 결정이다. 결정 전에는 비공개
소스 설치까지만 지원한다.

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
- 배포 저장소의 `plugin.json` 이름과 버전이 release와 일치한다.
- 배포 저장소 Agent의 `../rules` 참조가 유효하다.
- Pair mode에는 편집, 명령 실행과 세션 메시지 전송 도구가 없다.
- Driver에는 다른 Agent 세션을 조회하거나 제어하는 도구가 없다.
- 기본 Chat View에서 Pair가 독립 Driver 세션을 생성할 수 있다.
- 두 세션이 `worktree: false`로 같은 Workspace를 직접 사용한다.
- Pair가 Driver의 사용자 프롬프트와 응답을 읽을 수 있다.
- 설치, 업데이트, 비활성화와 제거를 새 사용자 환경에서 확인했다.
