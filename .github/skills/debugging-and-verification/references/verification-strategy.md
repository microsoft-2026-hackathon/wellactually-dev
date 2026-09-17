# Verification Strategy

## When This Helps

Use when the team must decide what evidence is sufficient for a change.
Use when tests pass but the user-facing behavior remains uncertain.
Use when mocks, staging, and production disagree.
Use when a test suite is expensive but still misses consequential failures.
Start from the risk or contract, not from a desired test count.

## Core Model

A test observes selected behavior under controlled conditions.
Its oracle defines what result counts as correct.
Its fixture and environment determine which conditions were actually exercised.
Its assertions determine what failures are detectable.
Passing establishes evidence within those limits, not universal correctness.

Verification has several independent dimensions:
- Functional correctness under specified inputs.
- Compatibility across component and schema versions.
- Safety when dependencies fail or authorization is absent.
- Performance under a representative workload.
- Recoverability after interruption or partial progress.
- Product suitability and user understanding, assessed separately.

## Invariants

- A meaningful test can fail for the defect it is intended to catch.
- The oracle does not merely repeat the implementation's assumptions.
- Asynchronous work is awaited before outcomes are asserted.
- Test data and credentials cannot affect unrelated users or production state.
- Reported verification identifies what ran and what did not.

## Approach

### Start with the Claim

Translate "works" into an observable statement at a specific boundary.
For example, repeated order submission must not create a second charge.
Identify who observes the result and which durable state matters.
Include the conditions under which the claim is expected to hold.
Do not begin by choosing unit or integration tests before locating the contract.

### Map Risks to Evidence

Identify the failure with the largest relevant consequence.
Choose the cheapest test that can expose its actual mechanism.
A pure transformation usually needs a local behavioral check.
A transaction or SQL constraint needs evidence from a real database engine.
A deployed permission requires an execution identity equivalent to production.

### Establish the Oracle

Use an explicit expected outcome, invariant, or independent model.
Derive boundary cases from contracts, not merely from existing branches.
For round-trip tests, consider whether encoder and decoder can share the same bug.
For snapshots, review meaning instead of automatically accepting updates.
For generated text, separate structural contracts from semantic quality.

### Exercise Relevant Variation

Select a normal path, a boundary, and a consequential failure where applicable.
Add concurrency, cancellation, or recovery when the changed mechanism requires it.
Avoid multiplying cases that differ only cosmetically.
Use parameterized or property-based tests for true input families.
Preserve a readable minimal case for known regressions.

### Interpret Results Before Expanding

Confirm that the test reached the intended behavior.
Classify failure as setup, infrastructure, assertion, or product behavior.
Repair the same slice if a check exposes a local defect.
Expand only when a shared contract or broader risk requires it.
Stop after meaningful gates are met; more identical passing runs add little evidence.

## Choosing the Boundary

### Unit-Level Evidence

Good for transformations, branching rules, parsers, and deterministic state transitions.
Control dependencies explicitly without mocking every internal function.
Assert observable behavior rather than incidental call ordering.
Fast feedback helps developers test discriminating hypotheses repeatedly.
It does not establish a real service's limits or consistency semantics.

### Integration Evidence

Good for serialization, database constraints, transaction behavior, and adapters.
Use the actual versioned dependency when its semantics are the risk.
Keep test state isolated and clean it without relying on execution order.
Verify failures at the boundary, not just successful connection.
An in-memory substitute may not reproduce locks, collations, or query plans.

### End-to-End Evidence

Good for critical user journeys and wiring across real components.
Use a small set of high-value flows with stable data and observable completion.
Avoid testing all internal permutations through the slowest interface.
One successful journey does not cover authorization for other users or roles.
UI visibility and server-side permission enforcement need distinct assertions.

### Deployment Evidence

Good for identity, configuration, network policy, packaging, and rollout compatibility.
Use a non-destructive smoke check that exercises the important boundary.
Separate public read access from authenticated write access.
A dry-run may not exercise server-side hooks or branch protection on real updates.
State when an actual bounded write and cleanup are required for confidence.

## Failure Modes and Antipatterns

### Coverage as Correctness

Signal: a high percentage is used to dismiss missing failure cases.
Mechanism: execution coverage says little about assertion quality or relevant inputs.
Response: identify which behavior would fail if the implementation were wrong.
Exception: coverage remains useful for locating unexercised branches.
Check: intentionally alter the behavior locally or use mutation testing where appropriate.

### Mocks That Ratify the Assumption

Signal: the fake returns exactly what the caller expects without contract checks.
Mechanism: both sides of an integration bug are replaced by a cooperative fixture.
Response: add a real boundary or provider contract check for the risky assumption.
Exception: mocks are appropriate for isolating stable, already-tested boundaries.
Check: who maintains evidence that the mock still represents the provider?

### String Presence as Behavioral Proof

Signal: tests look for prose, headings, or source strings to claim semantic correctness.
Mechanism: expected words can exist while loading, delivery, or reasoning is wrong.
Response: test parsing, references, packaging, and invocation contracts structurally.
Evaluate model behavior using scenarios and evidence separately.
Exception: required identifiers or section headings can be legitimate format contracts.

### Sleeps Instead of Conditions

Signal: a longer delay fixes intermittent test failures.
Mechanism: elapsed time is mistaken for successful completion.
Response: await a specific state, event, or bounded observable condition.
Exception: time itself can be the behavior under test, using controlled clocks.
Check: does timeout report the missing condition rather than a vague delay failure?

### Test Data That Never Challenges the Plan

Signal: every query uses tiny, uniform, freshly created data.
Mechanism: selectivity, skew, retention, and historical schema states remain invisible.
Response: include representative distributions and relevant old records.
Exception: tiny fixtures are useful for deterministic logic tests.
Check: is scale or data history part of the claim being made?

### Updating Expectations to Match a Bug

Signal: a changed snapshot or output is accepted because the implementation changed.
Mechanism: the expected result ceases to be independent evidence.
Response: return to the contract and explicitly decide whether behavior should change.
Exception: intentional contract changes require updating tests and consumers together.
Check: can the user explain the new expectation without citing the implementation?

## Field Heuristics

### Test the Moment Between Two Effects

Useful for DB writes followed by messages, files, or external requests.
Interrupt after the first effect and observe what recovery can reconstruct.
The hardest defects often occupy this untested interval.
Use isolated test infrastructure, not unapproved production disruption.
Check both retries and abandoned work.

### A Regression Test Should Fail Before the Fix

Useful when repairing a deterministic known bug.
It checks whether the test actually captures the reported behavior.
Some incidents cannot be reproduced safely or economically.
In that case label the evidence as a model or partial reconstruction.
Do not rewrite history by claiming an unobserved red test.

### Use a Small Real Boundary Before a Large Fake World

Useful when an integration assumption is driving many unit tests.
A focused real database or service check can eliminate a broad uncertainty cheaply.
Live dependencies can be costly or unstable, so keep their scope narrow.
Use provider-maintained emulators only within their documented fidelity limits.
Check the difference between contract evidence and uptime dependence.

### No-Op and Repeat Runs Are Product Behaviors

Useful for installers, migrations, packaging, and synchronization tools.
Verify an unchanged input does not create unnecessary commits or duplicate effects.
Verify a repeat run preserves unrelated state and removes only owned stale outputs.
Do not limit the assertion to exit code zero.
Check resulting files, records, identities, and ownership boundaries.

## Worked Example: Plugin Packaging

Claim: four Skills and their resources reach the installable package unchanged.
Useful structural evidence: parse each manifest and verify local links resolve.
Useful behavioral evidence: package into a temporary target and compare bytes.
Repeat packaging and compare the resulting file inventory and contents.
Remove a source Skill in an isolated fixture and check stale packaged files disappear.

These checks do not prove the model chooses the right Skill in conversation.
That requires scenario-based evaluation in the actual Agent environment.
Likewise, deployment to Git does not prove VS Code discovers every customization.
Keep loading, distribution, and reasoning claims separate.
Each needs evidence from the boundary that controls it.

## Reporting Confidence

Name the checks that ran and their relevant scope.
Report environment prerequisites and skipped live integrations.
Separate established behavior from assumptions retained for further testing.
Do not call a formatting check a security review or model-quality evaluation.
Leave a concise next check when a meaningful uncertainty remains.

## Sources

- [Google SRE: Testing for reliability](https://sre.google/sre-book/testing-reliability/)
- [Google SRE: Effective troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)