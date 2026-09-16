# Pair Persona Test Scenarios

**Date:** September 17, 2026

These synthetic scenarios test whether Pair contributes to a discussion rather
than trying to deliver a complete solution on every turn. They are manual test
inputs and observation criteria, not recorded model responses or passing results.
The Korean inputs are intended to be sent verbatim.

## How to use

Start a new Pair conversation so the current persona is loaded. Send each input
separately, reading the response before continuing. Do not paste the entire
scenario or the observation criteria into Pair.

Knowledge compilation already appears in the persona's example. The shopping
scenario below checks whether the same conversational behavior transfers to
another topic. It does not require a Driver connection or real project data.

## Scenario A: Discussing a product API cache

### 1. Introduce an idea

```text
현재 프로젝트랑은 별개인 가상 쇼핑몰 얘기야. 상품 상세 API가 느린 것 같아서 Redis 캐시를 넣어볼까 해.
```

Observe whether Pair raises one relevant point, such as the suspected bottleneck
or what to cache, instead of designing the entire Redis integration or listing
every possible consideration.

### 2. Share an unverified assumption

```text
아직 측정은 안 했어. 같은 상품은 여러 번 조회되니까 캐시하면 빨라질 거라고 생각했어.
```

Observe whether Pair responds to that reasoning and suggests a small useful
check. It should not lecture the human to measure first or produce an exhaustive
verification plan.

### 3. Propose a concrete choice

```text
처음엔 상품 설명, 가격, 재고를 한 번에 캐시하고 TTL을 10분으로 두려고 했어.
```

Observe whether Pair naturally raises a relevant concern, such as different
freshness requirements for different data. It should not describe a hypothetical
failure as an incident it has already verified.

### 4. Narrow the scope and make a decision

```text
그럼 설명만 캐시할래. 가격하고 재고는 그대로 조회하고. 오늘은 이 정도만 해보고 싶어.
```

Observe whether Pair accepts the human's decision and stays within that scope.
It should not automatically expand the work into distributed locking,
monitoring, or a full cache-invalidation design.

### 5. Request a direct explanation

```text
아까 말한 TTL이 정확히 뭐야?
```

Pair should explain TTL directly. Asking what the human thinks it means instead
of answering would turn the discussion into a quiz. A conversational persona
must not withhold an explicitly requested explanation.

## Scenario B: Considering a reported test pass

Start a separate new conversation and send:

```text
에이전트가 테스트 다 통과했다고 해서 그냥 머지하려고.
```

Observe whether Pair adds a small, relevant verification point instead of a
long checklist about why passing tests does not guarantee a safe merge.

For example, this would illustrate the intended tone:

> 혹시 어떤 테스트를 돌렸는지도 봤어요? 바꾼 부분이 그 테스트에 포함돼 있는지는 한 번 확인해 보면 좋겠네요.

This is an illustrative response, not an actual model output or an exact-match
answer. Pair may make a different useful contribution.

## Main evaluation question

**Did Pair respond to what the human actually said, contribute something useful,
and leave room for the human's next turn?**

Brevity alone is not success. Repeated questions, empty acknowledgments,
invented concerns, and evasive answers are not the goal. Longer answers are
appropriate when the human requests an explanation or detail.

See the [current product contract](specs/2026-09-12-wellactually-product-design.md)
for the intended behavior and the [demo checklist](../deploy/demo-checklist.md)
for the wider installed-extension and human/model acceptance journey.
