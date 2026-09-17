# Authentication and Authorization

## When This Helps

Use for login, sessions, tokens, object access, tenant isolation, and service identities.
Use when a successful login is being treated as proof of broad access.
Use when a UI control or Agent tool list is described as a complete security boundary.
Begin with the resource, action, actor, and trusted enforcement point.

## Core Model

Authentication establishes an identity under a particular trust relationship.
Authorization decides whether that identity may perform an action on a resource.
Session management carries identity and security state across requests.
Auditing records security-relevant decisions and effects for later accountability.
These functions support each other but answer different questions.

A token is evidence interpreted under a protocol, not an unconditional permission slip.
A valid signature does not establish intended issuer, audience, lifetime, or resource access.
An identifier locates a resource; it does not necessarily grant permission to it.
A role is one input to policy, often insufficient without ownership or tenant context.
Network location alone does not establish the caller's business authority.

## Invariants

- Every protected entry point enforces the relevant action and object policy.
- A client cannot self-assign trusted tenant, owner, or privilege attributes.
- Missing or failed authorization does not silently grant access.
- Credentials are not exposed through URLs, logs, source, or diagnostics.
- Revocation and expiry have a defined effect on existing sessions and cached decisions.

## Approach

### Identify Trust Boundaries

List browsers, services, identity providers, storage, and administrative paths involved.
Distinguish user identity from the service identity executing downstream work.
Identify which headers or claims are accepted only from a trusted verified source.
Account for direct API access that bypasses the normal UI or gateway.
Do not infer OS-level isolation from a behavioral instruction or omitted tool alone.

### Express the Policy

Describe who can perform each consequential operation on which resources.
Include same-role access to another user's object and cross-tenant access.
Specify public resources explicitly rather than permitting everything by default.
Separate read, write, export, share, delete, and administration where their risks differ.
The user owns policy choices; implementation should not invent them accidentally.

### Choose Established Mechanisms

Use maintained framework and identity-provider integrations for protocol handling.
Configure token validation for the expected issuer, audience, signature, and lifetime.
Use the token type for its intended protocol role; an ID token is not a universal API access token.
Avoid implementing password storage or cryptography from scratch.
Check current provider guidance for the application type and chosen authentication flow.

### Enforce at the Resource Boundary

Keep common authentication and coarse checks consistently applied.
Perform object and action checks where authoritative resource context is available.
Scope queries or mutations so unrelated tenant data is not returned or changed.
Include exports, static files, background jobs, and alternative API routes.
Client-side controls improve usability but do not replace trusted enforcement.

### Define Session Lifecycle

Decide idle and absolute lifetime according to the application's risk.
Rotate session identifiers at relevant authentication or privilege transitions.
Define logout, account disablement, password reset, and privilege revocation behavior.
Self-contained tokens may remain usable until expiry unless an additional revocation mechanism applies.
Document a permitted revocation delay rather than hiding it behind a cache TTL.

### Verify Allowed and Denied Paths

Use distinct accounts, roles, and tenants in isolated tests.
Test direct requests as well as visible UI state.
Check expired, malformed, wrong-audience, and insufficient-permission credentials.
Verify denied requests leave no durable side effect or sensitive response data.
Do not use live user secrets as conversational test fixtures.

## Design Trade-offs

### Server Sessions and Self-Contained Tokens

Server-side sessions centralize revocation but require available session state.
Self-contained tokens can reduce lookup dependency but carry stale claims until their validity ends.
Both require secure issuance, storage, transport, and validation.
Short token lifetimes reduce some exposure while increasing renewal dependencies.
Choose based on deployment, revocation, and client requirements, not a statelessness slogan.

### Roles, Attributes, and Relationships

Roles work well for a small set of stable organizational capabilities.
Attributes support conditions such as tenant, ownership, environment, or resource state.
Relationships express sharing, membership, and resource-specific access.
More expressive policy also needs understandable administration and testing.
Do not introduce a generalized policy engine when a clear local rule is sufficient.

### Browser Credential Storage

HttpOnly cookies reduce direct script access to credentials, but do not eliminate XSS effects.
Cookie authentication needs CSRF defenses suited to the flow, including appropriate SameSite behavior.
Script-accessible tokens carry exposure risks if untrusted script executes.
Secure transport and origin handling remain important with either approach.
Use framework guidance for the selected architecture instead of universal storage prescriptions.

### Service Identity and Delegation

A backend's broad storage credentials do not authorize every caller to use them fully.
Preserve the original caller's permitted scope when a service acts on their behalf.
Use short-lived workload identity where supported and operationally appropriate.
Keep deployment credentials distinct from runtime credentials when their authority differs.
Audit who requested the effect and which service executed it without logging token values.

## Failure Modes and Antipatterns

### Login Check as Object Authorization

Signal: any logged-in user can request a record by changing its identifier.
Mechanism: identity is verified but ownership or tenant permission is not.
Response: enforce action-specific access against authoritative resource context.
Exception: intentionally public resources may be accessible without login.
Check: request another user's valid identifier under the same role.

### Hidden Button as Enforcement

Signal: the UI removes a command while the API still accepts it.
Mechanism: caller-controlled presentation is mistaken for a trusted policy boundary.
Response: enforce on the server and keep the UI consistent with that policy.
Exception: purely local cosmetic actions may not protect a remote resource.
Check: send the operation directly with a restricted test identity.

### Trusting Tenant Input

Signal: a request body or header selects a tenant without membership validation.
Mechanism: untrusted input becomes an authorization fact.
Response: validate the selected tenant against trusted identity and policy.
Exception: an authorized administrator may deliberately act across tenants under audited policy.
Check: replace only the tenant identifier while preserving an otherwise valid request.

### Decoding Instead of Validating a Token

Signal: claims are read from a token payload and immediately trusted.
Mechanism: readable encoding is confused with verified protocol evidence.
Response: use a maintained validator with explicit trust configuration.
Exception: untrusted decoding can be diagnostic if no security decision depends on it.
Check: malformed signature, unexpected issuer/audience, and expired token rejection.

### Authorization Cache without Revocation Semantics

Signal: access persists long after membership removal without an agreed delay.
Mechanism: cached policy is treated as timeless authority.
Response: define validity, invalidation, and authoritative checks for high-risk operations.
Exception: bounded offline capabilities can deliberately remain valid for a stated interval.
Check: revoke access after cache fill, then request the protected action.

### One Shared Administrative Credential

Signal: all services use a credential capable of unrelated administration.
Mechanism: compromise expands across workloads and actions lose attribution.
Response: scope identities by actual duties and environment.
Exception: a documented emergency identity can exist with controlled access and auditing.
Check: verify both needed access and denial of unrelated actions.

## Field Heuristics

### Test a Sibling, Not Only an Administrator

Useful when role tests cover admin versus ordinary user but miss horizontal access.
Two users with the same role often reveal missing resource ownership checks.
Multi-tenant applications need another tenant as well.
Anonymous tests remain useful but do not replace these cases.
Inspect response data and durable effects, not only status codes.

### Follow the Artifact after the Request

Useful for downloads, reports, signed links, and cached exports.
The API may be secure while the generated file is publicly reachable.
Signed URLs are bearer capabilities with their own scope and lifetime.
Deliberately public artifacts are valid if their data classification allows it.
Check who can retrieve the artifact after the creating session ends.

### Remove Authority before Cleaning Up a Leaked Secret

Useful when credentials appear in source, logs, or chat.
Revocation or rotation stops further authorized use of the exposed value.
Deleting the visible copy alone does not remove copies or history.
Coordinate cleanup without automatically rewriting shared Git history.
Use the organization's incident process and preserve necessary non-secret evidence.

## Worked Example: Team Report Download

A user can create reports only for teams they may access.
The worker validates the relevant policy for delayed execution when required.
The final download also checks access or uses an intentionally scoped short-lived capability.
Removing a user from the team has an explicit effect on queued work and existing links.
Authentication success at report creation does not settle all later access decisions.

## Evidence and Sources

Verify direct entry points, cross-tenant cases, privilege changes, and artifact access.
Observe authorization decisions without exposing credentials or unnecessary personal data.
Automated checks supplement, not replace, risk-appropriate security assessment.

- [OWASP: Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP: Secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

Consult the chosen identity provider's current protocol guidance before implementation.