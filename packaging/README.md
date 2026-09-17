# Wellactually

AI와 함께 개발하면서 자신의 공학적 판단을 만들어 가는 VS Code 페어 프로그래밍
플러그인입니다. **Pair와 생각을 나누고, Driver에게 직접 구현을 요청합니다.**

이 문서는 플러그인에 함께 포함되는 한국어 사용 설명서입니다.
설치 후 **Extensions → Agent Plugins - Installed → wellactually**를 선택하면
플러그인 상세 화면에서 읽을 수 있습니다.
설치 후에도 [온라인 사용 설명서](https://github.com/microsoft-2026-hackathon/wellactually#readme)에서
다시 볼 수 있습니다.

## 설치 후 시작하기

1. 개발할 프로젝트 폴더를 VS Code로 엽니다.
2. 기본 **Chat View**에서 Copilot Agent Host 세션을 열고 Agent 선택기에서
	**Wellactually Easy**를 선택합니다. 더 구체적인 설명이 필요하면 Beginner로 시작해도 됩니다.
3. 만들고 싶은 것, 현재 문제, 고민 중인 선택을 자신의 말로 이야기합니다.
4. 구현할 범위를 정했으면 Pair에게 **"이 범위로 구현할게. Driver 세션을 만들어줘."**라고 요청합니다.
5. 기본 Chat View의 **Sessions** 목록에서 생성된 **Wellactually Driver** 세션을 선택합니다.
6. 그 세션의 Agent를 **Wellactually Driver**로 직접 선택한 뒤 구현을 요청합니다.
	세션 이름만으로 Agent가 자동 선택되지는 않습니다.
7. 변경된 코드와 Driver의 검증 결과를 직접 살펴보고, 기존 Pair 세션으로 돌아와 대화를 이어 갑니다.

Pair와 Driver는 같은 프로젝트 파일을 사용하지만 대화는 별도 세션에 남습니다.
별도 창이나 두 채팅의 동시 표시가 필요하지 않습니다. 기본 Chat View에서 세션을
번갈아 선택하면 코드를 보면서 작업할 수 있습니다.

## 누가 무엇을 하나요?

| 참여자 | 맡는 일 |
| --- | --- |
| 사용자 | 문제와 의도, 제품 방향, 판단, 작업 범위, Driver에게 보낼 지시를 소유합니다. |
| Pair | 전통적인 Navigator 역할로 함께 탐색하고, 중요한 위험·반례·관련 지식을 대화에 더합니다. |
| Driver | 사용자가 직접 전달한 범위 안에서 세부 구현을 설계하고 코드를 수정하며 검증합니다. |

Pair는 완성된 설계나 Driver 프롬프트를 대신 작성하지 않습니다. 코드를 수정하거나
검증을 실행하지도 않습니다. 사용자를 시험하거나 Driver의 결과를 채점·승인하는
역할이 아니라, 새로 드러난 사실을 놓고 다시 생각하는 동료입니다.

## Pair 모드 선택

모드는 실력 등급이나 통과해야 할 단계가 아닙니다. 지금 작업에서 원하는 지원의
정도에 맞춰 선택합니다. 익숙한 분야와 낯선 분야에서 다른 모드를 써도 됩니다.

| Agent | 이런 지원이 필요할 때 |
| --- | --- |
| **Wellactually Beginner** | 무엇을 질문해야 할지부터 막힐 때. 의도 확인, 구체적인 선택지와 관련 개념 설명을 더 자주 받습니다. |
| **Wellactually Easy** | 함께 적극적으로 탐색하되 대화의 흐름은 가볍게 유지하고 싶을 때. 선택지와 느슨한 체크포인트를 활용합니다. |
| **Wellactually Intermediate** | 직접 범위와 방향을 이끌면서 중요한 위험, 바뀐 가정과 반례를 짚고 싶을 때. |
| **Wellactually Advanced** | 대체로 스스로 진행하되 놓치기 쉬운 중대한 문제에만 짧게 개입받고 싶을 때. |

네 모드는 같은 여섯 가지 방식을 사용합니다. **능동적 공동 탐색, 위험 기반 개입,
미러링, 반례와 안티 케이스, 느슨한 체크포인트, 맥락에 맞는 지식 제공**입니다.
방식의 정의나 지식 수준이 달라지는 것이 아니라 우선순위, 빈도, 구체성과 개입
기준이 달라집니다. Pair 세션에서 모드를 바꿔도 구현은 별도 Driver 세션에서 진행합니다.

## 한 작업 안에서 반복하기

Pair 대화는 구현 전 한 번만 거치는 절차가 아닙니다. 구현 중 새로운 제약이 생기거나
예상과 다른 결과가 나오면 같은 Pair와 Driver 세션을 오가며 이어 갑니다.

**Pair에서 시작할 때**

> 상품 목록이 느린데 캐시가 필요한지, 쿼리부터 봐야 할지 모르겠어.

관찰한 문제와 원하는 결과부터 이야기하면 됩니다. 아직 선택지나 기술 용어를
정리하지 못했어도 괜찮습니다. 이미 정한 범위나 바꾸지 않을 조건은 함께 알려 줍니다.

**Driver로 이동할 때**

Pair 대화가 Driver에게 자동 전달되지는 않습니다. 무엇을 바꿀지, 유지할 조건,
확인하고 싶은 동작을 사용자가 직접 전달합니다. Driver는 구현 중 제품 방향이나
범위를 바꾸는 판단이 필요하면 사용자에게 돌아옵니다.

**Pair로 돌아왔을 때**

> Driver 대화를 읽고 이어서 얘기하자. 조회는 빨라졌는데 변경 직후 값이 늦게 보이는 게 마음에 걸려.

Pair는 연결된 Driver 세션의 사용자 지시, 응답과 도구 활동을 읽어 새 맥락을
이해합니다. 결과를 승인받는 과정이 아니라, 드러난 제약과 다음 선택을 논의하는
과정입니다. 추가 구현은 기존 Driver 세션에서 다시 직접 요청합니다.

## 필요한 공학 지식

네 공학 Skill과 열두 Reference가 포함되어 있습니다. Pair는 대화 주제에 맞는
자료를 필요할 때 읽습니다. 별도 Slash command를 실행하거나 자료 전체를 미리
읽을 필요는 없습니다.

| Skill | 다루는 주제 |
| --- | --- |
| `engineering-decisions` | 문제 정의, 성공 기준, 범위와 설계 Trade-off |
| `debugging-and-verification` | 관찰과 가설의 구분, 디버깅, 검증 범위와 근거의 한계 |
| `distributed-systems` | 캐시, 동시성, 트랜잭션, 메시징, 재시도와 네트워크 실패 |
| `application-foundations` | 인증·인가, 데이터 모델링, 설정과 환경 차이 |

자료는 접근 방법, 불변식, 대안, 실패 메커니즘, 안티패턴과 조건·예외가 있는
실전 휴리스틱을 다룹니다. 네 모드가 같은 지식을 사용하며, 자료를 읽어도 역할과
도구 권한은 바뀌지 않습니다. `Chat: Configure Skills`에서 설치된 Skill을 확인할 수 있습니다.

**Knowledge Compilation과 `/knowledge-compile`은 아직 제공하지 않습니다.**
공학 지식을 사용했다고 대화를 자동으로 정리하거나 지식 문서를 생성하지 않습니다.

## 설치와 업데이트

Agent Plugins를 지원하는 최신 VS Code, GitHub Copilot 사용 권한, Copilot Agent Host의
세션 관리 기능이 필요합니다. 조직 정책에 따라 플러그인이나 도구 사용이 제한될 수 있습니다.

처음 설치할 때는 Command Palette에서 `Chat: Install Plugin From Source`를 실행하고
다음 URL을 입력합니다. 별도 clone이나 조직의 저장소 읽기 권한 요청은 필요하지 않습니다.

```text
https://github.com/microsoft-2026-hackathon/wellactually.git
```

설치 상태는 Chat의 설정 메뉴에서 **Plugins**, 또는 Extensions의
**Agent Plugins - Installed**에서 확인합니다. `wellactually`가 현재 Workspace에서
활성화되어 있어야 합니다.

업데이트 확인은 Command Palette의 `Extensions: Check for Extension Updates`로
실행합니다. 업데이트 후에도 이전 설정이 보이면 새 Chat 세션에서 확인합니다.
VS Code 버전에 따라 메뉴와 표시 방식이 다를 수 있습니다.

## 문제가 생겼을 때

| 증상 | 확인할 내용 |
| --- | --- |
| Agent 선택기에 Wellactually가 없음 | 플러그인이 설치·활성화되어 있는지, `chat.plugins.enabled`가 켜져 있는지 확인합니다. 업데이트 후 새 Chat 세션에서도 확인합니다. |
| Driver 세션을 만들 수 없음 | 현재 세션이 필요한 Agent Host 세션 도구를 제공하는지 확인합니다. **Configure Tools**에서 세션 관리 도구와 조직 정책을 확인합니다. |
| Driver가 구현하지 않고 기다림 | 생성된 세션에서 Agent를 **Wellactually Driver**로 직접 선택하고 구현 지시를 보냈는지 확인합니다. 생성 직후 대기는 정상입니다. |
| Pair가 어떤 Driver인지 모름 | 기존 Driver 세션의 식별 정보를 알려 줍니다. Pair가 비슷한 이름의 세션을 임의로 고르도록 하지 않습니다. |
| 오래된 Driver 대화를 읽지 못함 | 세션 조회는 최근 대화 중심이며 전체 원문을 보장하지 않습니다. 필요한 사용자 지시나 결과를 직접 제공해 이어 갑니다. |
| 공학 Skill이 Slash command에 없음 | 정상입니다. 네 Skill은 모델이 필요할 때 선택하도록 설정되어 있습니다. |

해결되지 않으면 [이슈](https://github.com/microsoft-2026-hackathon/wellactually-dev/issues)에
VS Code 버전, Plugin 버전, 선택한 Agent, 재현 과정과 민감정보를 제거한 오류를
남겨 주세요. 비밀번호, 토큰이나 비공개 대화 전체를 게시하지 마세요.

## 알아둘 경계

Pair가 읽는 Driver 대화에는 사용자가 직접 작성한 구현 지시도 포함됩니다.
이는 의도와 범위를 이해하기 위한 맥락이지 프롬프트 품질을 채점하는 기능이 아닙니다.
Driver에는 다른 세션의 조회·제어 도구가 없고 다른 Chat에 접근하지 않도록 지시되어
있지만, 이러한 역할·도구 제한이 운영체제 수준의 격리를 보장하지는 않습니다.

AI 응답은 틀릴 수 있습니다. 중요한 데이터·보안·외부 계약 관련 판단과 변경된
코드는 직접 확인하고, 실행한 검증과 아직 확인하지 않은 부분을 구분하세요.

## 개발과 참고

이 저장소는 설치용 생성 패키지입니다. 개발 정본은
[wellactually-dev](https://github.com/microsoft-2026-hackathon/wellactually-dev)에 있습니다.
사용자는 프로젝트에 Agent 파일을 복사하거나 배포본을 직접 수정할 필요가 없습니다.
설치·관리 기능의 최신 안내는 [VS Code Agent Plugins 문서](https://code.visualstudio.com/docs/agent-customization/agent-plugins)를 참고하세요.
