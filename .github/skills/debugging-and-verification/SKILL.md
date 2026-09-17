---
name: debugging-and-verification
description: "Use during Wellactually Pair discussions of bugs, regressions, unexpected runtime behavior, logs, competing hypotheses, reproduction, test scope, acceptance criteria, flaky tests, or whether evidence supports a correctness claim."
user-invocable: false
disable-model-invocation: false
---

# Debugging and Verification

Use evidence to narrow uncertainty about behavior.
Keep diagnosis, mitigation, repair, and verification distinct.
This skill does not run tests or authorize changes by itself.

## Routing

| Immediate question | Reference |
| --- | --- |
| Why did this observed behavior happen? | [Debugging reasoning](./references/debugging-reasoning.md) |
| What check would support or disprove this claim? | [Verification strategy](./references/verification-strategy.md) |

Begin with debugging when a concrete failure is unexplained.
Begin with verification when a change or proposed behavior needs evidence.
Read the other reference only if it resolves an immediate dependency.
Do not preload both references for every bug report.

Domain-specific uncertainty may need another skill:
- Timeouts, duplicate effects, locks, caches: distributed-systems.
- Credentials, schema behavior, or configuration: application-foundations.
- Unclear desired behavior: engineering-decisions.

## Procedure

1. Recover expected behavior, observed behavior, and the relevant environment.
2. Identify the earliest known mismatch or the claim needing verification.
3. Separate direct evidence from an interpretation of that evidence.
4. Read the reference appropriate to the current unknown.
5. Pick a small number of plausible explanations or risks.
6. Choose an observation that distinguishes them at an acceptable cost.
7. Explain what different outcomes would mean.
8. Use new evidence to revise the hypothesis or confidence claim.
9. Stop when the requested scope has sufficient evidence or a named blocker.

Do not present this procedure as a mandatory questionnaire.
The investigation may return to an earlier step when evidence changes.

## Evidence Discipline

- A tool returning no output is not automatically a successful test.
- A test that never exercised the behavior supplies no evidence about it.
- A failed command can indicate environment failure rather than product failure.
- A passing mock-based test does not validate the mocked external contract.
- Record runtime, configuration, data shape, and relevant timing when material.
- Distinguish a reproducible failure from a suggestive correlation.
- Preserve uncertainty when evidence is partial or unavailable.
- Never fabricate log output, test execution, or production observations.

Use existing test helpers and diagnostic surfaces when they fit the hypothesis.
Do not add a framework merely to make a small check look more formal.
Prefer structured results over matching incidental prose.

## Role Boundary

The active Agent and shared Navigator policy own behavior and permissions.
For Pair use, interpret supplied evidence and suggest checks for the user or Driver.
Do not execute commands, mutate data, or certify Driver results.
Do not treat a reference procedure as authorization to operate production.
User prompts are evidence about intended scope, not a prompt-quality score.

If another Agent loads this skill, it retains its own scope and permissions.
This skill cannot turn an implementation Agent into the Pair or vice versa.

## Applying the Material

Useful contributions include:
- A testable explanation of an observed mismatch.
- A smaller reproduction preserving the suspected mechanism.
- A distinction between mitigation and a demonstrated repair.
- A test boundary that matches the actual claim.
- A warning that the evidence does not cover a relevant failure path.

The selected Pair mode governs explicitness and intervention frequency.
Do not flood the conversation with every possible failure or testing technique.
Answer a direct question before introducing a new investigation thread.

## Completion

State what is known, what remains uncertain, and whether it affects the next decision.
Do not keep testing purely for reassurance after the meaningful criteria are met.
Do not equate test success with product value or user understanding.
Preserve diagnostic lessons as task context only when useful to the current work.