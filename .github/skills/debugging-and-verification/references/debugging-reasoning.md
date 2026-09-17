# Debugging Reasoning

## When This Helps

Use for an observed mismatch, regression, intermittent failure, or unexplained slowdown.
Start with the user's actual failure, not a general survey of the codebase.
Use deeper domain references when the mechanism becomes specific.
Do not force a root-cause investigation when the immediate task is authorized mitigation.

## Core Model

A symptom is what was observed at a boundary.
A hypothesis explains that symptom through a mechanism.
A diagnostic check produces different predictions under competing hypotheses.
A mitigation reduces impact without necessarily establishing the mechanism.
A repair changes the mechanism responsible for the failure.
A regression check protects the behavior after the repair.

Several contributing causes can combine into one incident.
The most recent change can be a trigger without being the only underlying defect.
Confidence grows through discriminating evidence, not through the number of edits.
An inability to reproduce a bug is not proof that it did not occur.

## Safety and Invariants

- Preserve relevant evidence before destructive resets when feasible.
- Do not expose credentials or personal data through debugging output.
- Use production experiments only with explicit authorization and bounded impact.
- Keep mitigation and investigation changes distinguishable.
- A diagnostic probe should not silently become permanent behavior.

## Approach

### Anchor the Failure

Capture the failing operation, expected result, actual result, and timing.
Identify the version, environment, account scope, and data shape involved.
Ask whether the failure is universal or restricted to a cohort.
Find one nearby successful example if available.
The contrast is often more informative than a much larger log dump.

### Find the Earliest Observable Divergence

Trace a request or state transition through actual boundaries.
Compare input, output, and ownership at those boundaries.
Do not assume the component reporting the error caused it.
A timeout at a gateway may originate in connection-pool wait downstream.
An empty UI may result from authorization filtering rather than rendering.

### Build a Small Hypothesis Set

Prefer plausible explanations supported by current architecture and observations.
State each mechanism with a predicted observation.
Include an environment or measurement explanation when the evidence is ambiguous.
Avoid elaborate rare mechanisms before checking common local conditions.
Do not let a familiar past incident substitute for current evidence.

### Choose a Discriminating Check

Pick the cheapest safe observation likely to separate the candidates.
Prefer inspecting a relevant value over running an unrelated full suite.
Use the same identity, network location, and configuration as the failing path.
Success from a laptop does not prove success from a container's service identity.
State what a positive and negative result would imply before interpreting either.

### Change One Causal Factor

Use a narrow reversible probe when existing telemetry is insufficient.
Avoid simultaneously changing retry count, timeout, pool size, and code structure.
If an incident demands multiple mitigations, record their order and uncertainty.
Verify the original symptom under relevant conditions after the change.
Remove temporary probes or give persistent diagnostics a clear purpose.

### Stop at the Right Boundary

If the result falsifies the hypothesis, move toward the actual controlling component.
If it confirms the mechanism but exposes a local defect, repair that same area.
If the check is ambiguous, improve the observation rather than adding speculative code.
Do not widen the task into unrelated cleanup.
Escalate missing access or evidence instead of asserting a cause without support.

## Diagnostic Techniques

### Minimal Reproduction

Remove irrelevant inputs while preserving ordering, concurrency, and state.
A smaller test that no longer fails may have removed the causal condition.
Preserve random seeds, request sequences, and timing controls where possible.
Keep sanitized fixtures representative of the failure mechanism.
Record which simplifications changed the outcome.

### Boundary Bisection

Compare behavior at a middle boundary to narrow the search space.
This works well for pipelines and deterministic transformations.
Stateful feedback loops may not permit simple binary isolation.
Use component contracts to decide what the boundary should contain.
Do not interpret a stubbed success as proof of real integration behavior.

### Temporal Comparison

Correlate onset with deploys, configuration, credentials, traffic, and data growth.
A code freeze does not imply the environment stopped changing.
Check clock skew and telemetry delay before constructing an exact timeline.
Compare affected and unaffected instances under the same period.
Use rollback as evidence cautiously when it also changes caches or process state.

### Resource Decomposition

Separate time spent computing, waiting, transferring, and queueing.
High CPU suggests different questions from idle CPU with growing latency.
Average utilization can hide a saturated partition or one blocked thread.
Inspect tail latency and queue wait, not just service execution time.
Measure after warmup when startup behavior is not the subject of the investigation.

## Failure Modes and Antipatterns

### Random-Walk Editing

Signal: several plausible fixes accumulate without rerunning the original check.
Mechanism: causal attribution is lost and compensating defects can hide each other.
Response: identify one hypothesis and restore a discriminating feedback loop.
Exception: emergency mitigation can prioritize impact reduction over attribution.
Check: which observed result justified each retained change?

### Logging Everything

Signal: large payloads and secrets are dumped in the hope that something helps.
Mechanism: noise, privacy exposure, and logging overhead obscure the signal.
Response: log stable correlation identifiers and selected state transitions.
Exception: isolated synthetic reproductions can support more verbose instrumentation.
Check: which field could change the next decision?

### Raising Timeouts as a Repair

Signal: failures disappear while latency and concurrent in-flight work grow.
Mechanism: resource contention is deferred and overload worsens.
Response: distinguish expected service time from queueing and blocked work.
Exception: an unjustifiably short deadline can itself be the defect.
Check: do latency tails and resource occupancy remain bounded after adjustment?

### Restarting Away the Evidence

Signal: restart helps but recurrence has no useful diagnostic record.
Mechanism: memory state, queue ownership, or leak evidence is discarded.
Response: preserve a small state snapshot when impact allows.
Exception: reducing active harm can justify immediate restart.
Check: what observation can be captured safely before the next recurrence?

### Test Harness Failure Misread as Application Failure

Signal: import errors, missing files, or setup timeouts are reported as a regression.
Mechanism: the behavior under test was never reached.
Response: verify setup, working directory, interpreter, and fixture initialization.
Exception: packaging or setup may itself be the product behavior being tested.
Check: did the assertion or operation relevant to the hypothesis execute?

### Retry Until Green

Signal: a flaky result is accepted after enough reruns.
Mechanism: a probabilistic failure is hidden rather than explained.
Response: retain failed runs, compare conditions, and isolate shared state or timing.
Exception: a known infrastructure interruption can justify a labeled retry.
Check: is the retry a diagnosis, a mitigation, or simply suppressed evidence?

## Field Heuristics

### Compare a Success with a Failure

Useful when only some accounts, records, or instances fail.
Compare identity, data, route, config, version, and timing.
Do not assume the most visible difference is causal.
Use the contrast to generate one testable mechanism.
For universal failures, compare before and after onset instead.

### Negative Evidence Has a Scope

Useful when a check returns nothing suspicious.
Ask whether instrumentation would observe the suspected event if it happened.
Sampling, buffering, permissions, and retention can explain missing records.
A missing log is strong evidence only if the log path and coverage are established.
Avoid converting "not seen" into "cannot happen".

### A Fix Should Explain More than One Coincidence

Useful when an attractive change happens to improve the symptom.
Check whether the proposed mechanism predicts the affected cohort and timing.
Look for a counterexample where the cause exists but the symptom does not.
Do not require exhaustive proof when production impact prevents experimentation.
State probable cause separately from directly demonstrated cause.

## Worked Example: Intermittent Duplicate Jobs

Observation: a user occasionally sees two report jobs after one click.
Hypotheses: double UI submission, client retry, server retry, or queue redelivery.
Useful evidence: request ID, operation key, enqueue count, and consumer attempts.
If one operation key reaches the API twice, UI count alone is insufficient.
If one enqueue leads to two processing attempts, inspect acknowledgment timing.

The first check should distinguish repeated requests from repeated consumption.
Adding a button debounce may reduce symptoms without protecting retry paths.
A durable operation identity can address duplicates at the business boundary.
The user decides how duplicate submissions should be represented.
The Driver implements and verifies the selected boundary.

## Verification After Diagnosis

Reproduce the original condition before claiming the repair resolves it.
Check the directly adjacent failure mode introduced by the change.
For intermittent bugs, describe the conditions and number of attempts honestly.
Record whether the result is deterministic or probabilistic evidence.
Do not infer zero risk from a short successful run.

## Sources

- [Google SRE: Effective troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)
- [Google SRE: Testing for reliability](https://sre.google/sre-book/testing-reliability/)