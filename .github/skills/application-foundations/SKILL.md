---
name: application-foundations
description: "Use during Wellactually Pair discussions of authentication, authorization, identity, sessions, tokens, tenant isolation, permissions, database modeling, schemas, constraints, indexes, migrations, configuration, environment variables, secrets, feature flags, or environment drift."
user-invocable: false
disable-model-invocation: false
---

# Application Foundations

Reason about the identities, data, and runtime settings that give application behavior meaning.
Prefer explicit contracts at the boundary that owns them.
Do not turn a local question into a full security or database architecture exercise.

## Routing

| Current question | Reference |
| --- | --- |
| Who is acting, and may they perform this action? | [Authentication and authorization](./references/authentication-and-authorization.md) |
| What facts, relationships, constraints, and lifecycle should data express? | [Database modeling](./references/database-modeling.md) |
| Which settings and identities actually control this deployment? | [Configuration and environments](./references/configuration-and-environments.md) |

Start with one reference matching the immediate uncertainty.
Load another only when a concrete dependency requires it.
Tenant-specific uniqueness may connect data modeling to authorization.
Secret rotation may connect configuration to authentication.
Do not read all references merely because a task touches a backend.

## Procedure

1. Identify the operation, actor, authoritative data, or effective setting at issue.
2. Separate intended policy from what the implementation currently enforces.
3. Read the reference for the boundary that controls the decision.
4. Identify one relevant invariant, failure mechanism, or trade-off.
5. Use a concrete example from the user's task to make it inspectable.
6. Name evidence that could disconfirm the current assumption.
7. Return policy, retention, migration, and scope choices to the user.

Use existing framework capabilities and local conventions when they fit.
Prefer proven identity libraries, schema tools, and configuration parsers.
Do not invent cryptographic protocols, migration engines, or policy languages.

## Evidence Discipline

- Authenticated does not mean authorized for every resource.
- A hidden control is not a server-side permission check.
- A schema accepting a row does not prove the business state is valid.
- A declared setting is not evidence that the running process loaded it.
- A secret's presence does not prove its scope, validity, or organization approval.
- Local administrator success does not establish deployed service-identity access.
- A successful migration on empty data does not validate production compatibility.

Distinguish a recommended policy from a verified guarantee.
Use provider and engine documentation for version-sensitive behavior.
Do not ask the user to paste credentials into chat to obtain evidence.
Do not print secrets when a non-sensitive identity or scope check is sufficient.

## Role Boundary

The active Agent and shared Navigator policy remain authoritative for behavior and tools.
Pair can reason about supplied evidence and suggest bounded checks.
Pair does not execute migrations, change permissions, rotate credentials, or run tests.
Do not make security policy or data-retention decisions on the user's behalf.
Do not write Driver instructions or convert discussion into an implementation approval.
Another Agent using this skill retains its own authorized role and scope.

## Applying the Material

Useful contributions include:
- Locating the difference between login and object-level permission.
- Revealing a data relationship that the schema does not preserve.
- Explaining why a default value changes business meaning.
- Identifying a mixed-version migration or configuration failure.
- Clarifying a safe observation that does not expose a secret.

The active Pair mode controls explicitness, frequency, and intervention threshold.
All modes have access to the same knowledge.
Offer vocabulary when the user needs it, not a mandatory lecture.
Keep the next contribution proportional to the actual consequence.

## Adjacent Topics

Use distributed-systems for concurrent updates and cross-system consistency.
Use debugging-and-verification for reproductions and evidence scope.
Use engineering-decisions when the desired policy or business outcome is unclear.
Do not treat these neighboring skills as automatic prerequisites.

## Stopping

Stop when the immediate boundary, risk, and decision-changing evidence are clear.
Keep source-backed principles distinct from conditional field heuristics.
Knowledge use does not trigger Knowledge Compilation or a separate evaluation of the user.