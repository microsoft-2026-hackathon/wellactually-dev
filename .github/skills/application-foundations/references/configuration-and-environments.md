# Configuration and Environments

## When This Helps

Use for environment variables, secrets, runtime settings, flags, and deployment drift.
Use when the same code behaves differently locally, in CI, or in production.
Use when a configuration-only change is assumed to be low risk.
Start with the effective running configuration, not only the file in source control.

## Core Model

Behavior depends on code, configuration, identity, data, and dependency versions.
Configuration is an input with types, precedence, lifecycle, and security consequences.
Declared configuration is not necessarily the value loaded by the process.
Secret delivery and permission to use the target service are separate requirements.
An environment label is not itself an isolation mechanism.

Distinguish build-time values from startup values and dynamically reloaded values.
A setting embedded in a frontend bundle is visible to its users.
A changed environment variable does not necessarily update an already running process.
A secret reference can remain unchanged while the referenced value rotates.
Rollback must consider the effective configuration and data contract together.

## Invariants

- Required settings are validated before unsafe work begins.
- Precedence and units are explicit where ambiguity changes behavior.
- Secrets do not enter public bundles, source history, or diagnostic output.
- Test and development identities cannot unintentionally mutate production resources.
- Configuration changes can be attributed and their effects observed.

## Approach

### Locate the Loader

Find the code or platform that computes effective settings.
List defaults, files, environment values, command-line arguments, and remote overrides.
Determine precedence without assuming the last visible file wins.
Check the working directory and process identity used by the actual launch path.
Avoid reading every configuration file before finding the owning loader.

### Define a Typed Contract

Parse booleans, integers, URLs, durations, and lists explicitly.
Validate ranges, units, required values, and incompatible combinations.
Reject malformed values with an actionable message that does not expose secrets.
Use a standard parser and existing schema/validation library when suitable.
Keep a safe default only when its semantics are genuinely acceptable.

### Separate Authority and Delivery

Determine which workload identity obtains and uses each secret.
Prefer established secret managers or workload identity where available.
Use narrowly scoped credentials with a clear owner and rotation path.
Verify target permissions under the deployed identity, not a developer administrator account.
Presence in a secret store does not prove validity, approval, or access to the intended repository.

### Establish Change Semantics

Identify which settings require restart or rebuild and which can reload.
Validate a complete new configuration before swapping it into use.
Avoid partial reloads that combine incompatible old and new values.
Define behavior when remote configuration is unavailable at startup or during refresh.
For last-known-good settings, establish age limits and security implications.

### Verify the Target Environment

Confirm non-sensitive account, region, database, endpoint, and version identifiers.
Use a bounded representative operation for the permission being claimed.
Separate connectivity, authentication, authorization, and business-path success.
Check rollback or recovery when the setting can cause material disruption.
Do not dump the entire environment to debug one missing setting.

## Design Trade-offs

### Files, Environment Variables, and Remote Configuration

Files can provide typed structure and reviewable changes when parsed safely.
Environment variables integrate broadly but arrive as strings and may leak through tooling.
Remote configuration supports controlled updates but adds availability and consistency dependencies.
Choose based on deployment needs, not an assumption that one transport validates values.
Keep the logical contract consistent regardless of how values arrive.

### Secrets and Ordinary Settings

An endpoint may be ordinary configuration while its credential is secret.
Connection strings can mix both, so redaction must understand their structure.
Build arguments and container layers can retain values even after later deletion.
Runtime secret delivery reduces artifact exposure but still requires access controls.
Avoid introducing a custom encryption system when the platform already provides secure delivery.

### Startup Failure and Degraded Operation

Missing required database identity should not silently select a different database.
An optional analytics setting can reasonably disable analytics if that is explicit policy.
Security settings need safe failure behavior, usually denying protected operations.
Remote config outages may permit a validated cached configuration under a defined policy.
Choose per dependency rather than applying "fail fast" or "always fallback" indiscriminately.

### Feature Flags

Flags separate release exposure from deployment when the application supports both paths.
They create combinations that need ownership and testing.
A flag is not an authorization system merely because it hides a feature.
Data written under a new flag state may prevent simple rollback.
Remove obsolete flags through normal scoped changes once their purpose has ended.

### Environment Parity

Match the properties that control the risk: versions, identity, schemas, and network paths.
Production-scale infrastructure is not necessary for every local logic test.
An emulator can omit permissions, concurrency, or service limits that matter in deployment.
Do not copy production personal data or secrets merely to make staging realistic.
Use sanitized representative data and explicitly record remaining differences.

## Secret Lifecycle

### Rotation

Plan how producers and consumers transition to the new credential.
Some systems permit overlap; others require coordinated replacement.
Long-lived connections may keep working while new connections fail after rotation.
Test both existing and newly established connections where material.
Do not revoke the only recovery credential before the replacement path is confirmed.

### Exposure

Treat exposed credentials as compromised according to organizational policy.
Revoke or rotate them through an authorized secure channel.
Removing a log line or deleting a file does not invalidate copied credentials.
Preserve needed non-secret incident evidence and coordinate history cleanup.
Never request that a user paste a replacement secret into the conversation.

### Recovery Access

The secret manager itself can become unavailable.
Emergency access must be deliberate, limited, auditable, and tested.
Avoid a circular dependency where recovery requires the unavailable system's only credential.
Backup encryption keys and ordinary API credentials have different retention needs.
Use the established organizational recovery mechanism instead of inventing hidden bypasses.

## Failure Modes and Antipatterns

### Truthy String Booleans

Signal: a value of "false" enables a feature.
Mechanism: a non-empty string is treated as a language boolean.
Response: parse an explicit accepted representation and reject ambiguity.
Exception: a presence-only flag can be valid if documented and intentionally implemented.
Check: absent, empty, false, true, and malformed values.

### Silent Production Defaults

Signal: missing configuration connects a test process to a shared production endpoint.
Mechanism: convenience defaults select a dangerous authority or environment.
Response: require explicit target selection and use restricted test identities.
Exception: a harmless local-only default may improve ergonomics.
Check: launch with the relevant setting absent and inspect the resolved non-secret target.

### Secret Dump as Diagnosis

Signal: logs print all environment variables or a full connection string.
Mechanism: diagnostic convenience creates durable credential exposure.
Response: log selected non-sensitive metadata and structured redacted errors.
Exception: there is no need to reveal a real credential merely to prove it is present.
Check: exercise setup failures and inspect logs and generated artifacts for exposure.

### Config Change without Release Discipline

Signal: a live timeout or flag change bypasses validation because code did not change.
Mechanism: behavior and load can change across the whole fleet immediately.
Response: validate, bound rollout, observe outcomes, and keep an appropriate recovery path.
Exception: urgent mitigation may use an authorized emergency process with recorded evidence.
Check: identify the effective revision and affected instances after the change.

### Local Success as Deployment Permission Proof

Signal: a developer's authenticated command is used to certify CI write access.
Mechanism: identities, token scopes, organization approval, and branch policies differ.
Response: verify the relevant operation under the actual deployment identity.
Exception: a local check can still isolate public connectivity or syntax problems.
Check: distinguish public read, authenticated read, dry-run, and actual permitted write.

## Field Heuristics

### Expose Effective Metadata, Not Secret Values

Useful when source files and running behavior disagree.
Report application revision, config revision, selected region, and enabled non-sensitive modes.
Even metadata can be sensitive; choose fields according to the environment.
Do not log hashes of low-entropy secrets as a substitute for safe identification.
Use secret version identifiers supplied by the manager when appropriate.

### Make the Safe Path the Easy Local Path

Useful when developers repeatedly need production credentials for routine tests.
Provide representative fixtures, restricted identities, and explicit local endpoints.
Some integrations still require authorized live verification.
Keep that exceptional path distinguishable and bounded.
Convenience should reduce accidental authority rather than hide it.

## Worked Example: CI Publish Failure

Packaging succeeds, public clone succeeds, but publishing returns a permission denial.
This narrows the question to the publish identity and relevant server-side policy.
A secret existing in CI does not prove its organization approval or repository write scope.
Inspect non-secret identity and permission evidence through authorized channels.
Do not change unrelated packaging logic or substitute a broader credential without authorization.

## Evidence and Sources

Test parsing, precedence, missing settings, redaction, and supported reload behavior.
Use deployment checks for identity and environment-specific assumptions.

- [OWASP: Secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Google SRE: Testing for reliability](https://sre.google/sre-book/testing-reliability/)

Platform-specific reload and identity behavior must be checked for the actual deployment.