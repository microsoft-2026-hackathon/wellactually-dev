---
name: engineering-decisions
description: "Use during Wellactually Pair discussions of unclear requirements, problem framing, success criteria, scope, architecture alternatives, design trade-offs, coupling, or reversible decisions. Provides decision material, not a finished implementation plan."
user-invocable: false
disable-model-invocation: false
---

# Engineering Decisions

Use this skill when a decision needs more than a generic recommendation.
Its purpose is to clarify the conditions under which a choice is reasonable.
It does not select a solution on the user's behalf.

## Routing

Start with the unresolved decision, not the technology mentioned first.

| Current uncertainty | Reference |
| --- | --- |
| What problem matters, for whom, and what counts as success? | [Problem framing](./references/problem-framing.md) |
| Which design fits the constraints, and what does it cost? | [Design trade-offs](./references/design-tradeoffs.md) |

For a named failure mechanism, prefer its domain reference:
- Cache freshness, retries, queues, or cross-service consistency: distributed-systems.
- Authentication, database modeling, or environment differences: application-foundations.
- An observed bug or uncertain verification evidence: debugging-and-verification.

These neighboring skill names are discovery hints, not requests to load them all.

## Procedure

1. Identify the decision currently being discussed in the conversation.
2. Separate facts already observed from assumptions and preferences.
3. Select the reference that addresses the most consequential unknown.
4. Read that reference; open a second only for a concrete dependency.
5. Find the condition that would change the choice.
6. Relate that condition to an actual example, contract, or constraint.
7. Offer the useful distinction, counterexample, or observation to the user.
8. Let the user decide whether to investigate, choose, or defer.
9. Revisit only when evidence or requirements materially change.

This is a reasoning aid, not a required sequence of questions to ask aloud.
Do not walk the user through every heading of a reference.

## Evidence Discipline

- Prefer current requirements, repository conventions, and observed behavior.
- Identify whose need a proposed improvement serves.
- Do not turn an assumed scale target into a measured constraint.
- Treat pattern popularity as background, not evidence of suitability.
- Include the current design or doing less as a serious comparison option.
- Separate a small reversible choice from a contract that is costly to change.
- State when insufficient evidence leaves more than one reasonable option.
- Cite the relevant source when a specific external claim affects a decision.

References contain authored synthesis and conditional engineering heuristics.
Their source sections support core principles, not every local recommendation.
Consult current official documentation for version-dependent implementation facts.

## Role Boundary

The active Agent and shared Navigator policy still own behavior and permissions.
This skill supplies knowledge; it does not grant tools or change the active role.
In a Pair conversation, suggest observations rather than executing verification.
Do not write the user's Driver prompt, create a full plan, or approve results.
Do not treat a user choosing a different trade-off as a learning failure.

If another Agent encounters this skill, it must retain its own role and scope.
Being discoverable is not an authorization to become the Pair.

## Applying the Material

Connect the selected material to the current decision in ordinary conversation.
Useful outputs include:
- A distinction between the reported problem and a proposed solution.
- A missing constraint that changes which alternative is viable.
- A concrete counterexample to an assumption.
- A cheap observation that separates competing explanations.
- A trade-off the user can explicitly accept or reject.

The active mode controls how explicit and frequent these contributions are.
Do not impose a fixed answer template or mention internal reference routing.
When no new condition matters, do not manufacture another design concern.

## Completion

Stop using this skill when the immediate decision has enough grounds to proceed.
Unresolved questions may remain if they do not block the user's chosen scope.
Do not generate a separate decision record unless the user asks or the task requires it.
Knowledge compilation is a separate, explicitly requested activity.