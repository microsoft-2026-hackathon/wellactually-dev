# Network and Failure

## When This Helps

Use for remote calls, timeouts, retries, uncertain outcomes, and dependency overload.
Use when a fallback or circuit breaker is proposed as a general reliability fix.
Start with one request path and the effect that must remain correct.
Treat remote components as independently failing, not as slow local functions.

## Core Model

A caller can know that an operation succeeded, failed, or has an unknown outcome.
A timeout often puts the caller in the third category.
The server may not have received the request, may still run it, or may have committed it.
The response can be lost independently of the business effect.
Recovery must account for ambiguity instead of inventing certainty.

Latency consumes capacity while requests remain in flight.
Retries add demand to a system that may already be overloaded.
Backoff spreads attempts; jitter reduces synchronization between callers.
A deadline bounds useful waiting across the operation, not just one socket action.
Cancellation is a request to stop work, not proof that remote effects were undone.

## Invariants

- Remote work has a bounded waiting and resource policy.
- Retried effects preserve the operation's intended identity.
- Retry volume cannot grow without a budget.
- Fallback results obey security and business correctness requirements.
- Unknown outcomes remain distinguishable from confirmed failure when material.

## Approach

### Decompose the Request Path

Identify DNS, connection establishment, TLS, pool wait, request execution, and response transfer.
Check which phases the client library's timeout actually covers.
Measure cold connections separately from reused connections.
Include proxy and SDK retries that are invisible in the immediate call site.
Use a proven client rather than composing fragile timers around incomplete phases.

### Allocate a Deadline Budget

Start with the user operation's acceptable completion time.
Reserve time for local work, downstream attempts, and returning an answer.
Propagate remaining budget where supported rather than resetting at each hop.
Choose timeouts from observed latency distributions and acceptable false timeouts.
Internet paths and cold startup may require different margins from same-region calls.

### Classify Failures

Distinguish invalid input, authorization failure, overload, transient transport failure, and unknown effect.
Use the provider's contract instead of assuming all 4xx or all 5xx behave identically.
Honor documented retry guidance and Retry-After where applicable.
Do not repeatedly send unchanged invalid credentials or malformed requests.
Missing newly created data can be propagation delay only if the system actually has that contract.

### Choose Retry Ownership

Prefer a clear layer that understands the operation and its remaining budget.
Account for retries already performed by SDKs, proxies, and job runners.
Cap attempts, elapsed time, and aggregate retry pressure.
Use backoff with jitter appropriate to the service's guidance.
Stop retrying when success is no longer useful or the failure is not recoverable that way.

### Protect the Effect

Use an idempotency key or conditional resource transition when supported.
Scope the key to the caller, operation type, and intended business action.
Require equivalent parameters for a repeated key when appropriate.
Store or query the operation outcome instead of blindly creating another effect.
Define behavior after the provider's idempotency retention window expires.

### Design Degradation Deliberately

Choose whether to reject, return partial data, serve permitted stale data, or defer work.
Check fallback capacity and whether fallback changes the meaning of the result.
Permission checks must not become permissive simply because a dependency is unavailable.
Make degraded results observable where users or operators need to distinguish them.
Avoid a rarely exercised fallback whose complexity exceeds its tested benefit.

## Resilience Mechanisms

### Timeouts

Too short can cause false failures and duplicate load.
Too long can exhaust connections, threads, memory, or caller patience.
A request timeout is not necessarily an end-to-end deadline.
Use monotonic elapsed time locally when measuring durations.
Do not assume synchronized wall clocks across processes.

### Backoff and Jitter

Exponential backoff should have a cap and a stopping condition.
Identical schedules can create repeated synchronized bursts.
Jitter spreads demand but does not reduce the total number of allowed attempts by itself.
Periodic tasks may also need staggering within their timing requirements.
Respect provider-specific retry algorithms when they encode useful service behavior.

### Admission Control and Bulkheads

Bound concurrent work according to the resources it consumes.
Separate critical and optional dependencies where resource isolation matters.
Reject excess demand before expensive work if the contract permits it.
Queue limits need an expiry policy, not just a larger buffer.
An unbounded async promise collection can exhaust resources without blocking threads.

### Circuit Breakers

A breaker can reduce calls to an unhealthy dependency.
It introduces closed, open, and probe/recovery states that must be tested.
Thresholds based on tiny samples can oscillate or block useful work.
Recovery probes need limits so all clients do not flood a recovering service.
Use breakers when their stateful behavior solves a measured need, not as decoration.

### Hedged Requests

Sending a second attempt before the first finishes may improve tail latency.
It also consumes extra capacity and may duplicate effects.
Restrict to suitable idempotent operations with a carefully bounded policy.
Cancellation of the slower attempt may not stop remote work.
Do not hedge an overloaded service without understanding the feedback loop.

## Failure Modes and Antipatterns

### Retry Multiplication

Signal: one user request generates many downstream attempts during failure.
Mechanism: independent retry layers multiply each other's work.
Response: inspect all layers and establish a coordinated budget or owner.
Exception: separate layers may retry different well-defined boundaries deliberately.
Check: count actual downstream attempts for one failed operation.

### Timeout Means Nothing Happened

Signal: a timeout triggers a new charge or resource creation with a new identity.
Mechanism: successful but unacknowledged work is repeated.
Response: preserve operation identity and query or reconcile the uncertain outcome.
Exception: a provider may explicitly certify that a particular rejection had no effect.
Check: drop the response after the server commits.

### Health Check Proves the User Path

Signal: a ping or root endpoint succeeds while real requests fail.
Mechanism: health checks omit identity, dependency, routing, or data conditions.
Response: use a bounded representative probe at the relevant boundary.
Exception: liveness checks intentionally answer only whether a process should restart.
Check: distinguish liveness, readiness, and business-path verification.

### Fallback That Changes Authorization

Signal: permission service failure grants cached or default access without a policy.
Mechanism: an availability feature crosses a trust boundary.
Response: apply an explicit fail-closed or narrowly approved offline policy.
Exception: previously issued offline capabilities can have deliberate bounded validity.
Check: revocation and dependency failure together, not just the normal path.

### Bigger Pools as a Universal Fix

Signal: larger connection pools reduce local wait but overload the server.
Mechanism: queueing is moved downstream and increases contention.
Response: measure throughput, wait time, and server capacity before tuning.
Exception: an unnecessarily small pool can be the actual bottleneck.
Check: end-to-end latency and error rate, not pool acquisition time alone.

## Field Heuristics

### Treat Unknown as a Real State

Useful for payments, resource creation, and other consequential effects.
An explicit pending-resolution state can prevent destructive duplicate retries.
Not every read needs persistent operation tracking.
Use this only when uncertainty changes the business outcome or recovery action.
The user decides how unresolved state should appear in the product.

### Retry Only While It Can Help

Useful when attempts continue after the caller has abandoned the operation.
Check remaining deadline, effect safety, and dependency capacity before another attempt.
Durable background work may have a different lifecycle than an interactive request.
Do not confuse that deliberate lifecycle with accidentally orphaned work.
Observe canceled requests still consuming downstream resources.

### Test Recovery, Not Just Failure Entry

Useful for breakers, failover, and overload controls.
A system can reject correctly but recover too slowly or in a synchronized burst.
Exercise partial recovery and repeated short interruptions.
Use isolated infrastructure and bounded experiments.
Check the path back to normal capacity and normal semantics.

## Worked Example: Payment Timeout

The client times out after sending a request with a stable operation key.
It cannot infer whether the provider charged the account.
Retrying the same operation follows the provider's idempotency contract.
If the outcome remains unknown, status lookup or reconciliation resolves it.
A new key represents new intent and must not be generated merely to bypass uncertainty.

## Evidence and Sources

Measure end-to-end latency, in-flight work, retry volume, and deadline exhaustion.
Exercise cold connections, lost responses, overload, cancellation, and recovery.
Record client version and configuration when interpreting timeout behavior.

- [AWS Builders' Library: Timeouts, retries, and jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Google SRE: Effective troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)

These principles need the actual provider's API contract before implementation.