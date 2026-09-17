# Async Messaging

## When This Helps

Use when producers and consumers run independently or work continues after a request.
Use for queues, event streams, background processing, duplicates, ordering, and replay.
First decide whether delayed completion is acceptable for the actual user operation.
A queue can absorb bursts; it cannot create unlimited downstream capacity.

## Core Model

A command asks an owner to do something.
An event states that something happened.
A message is the transport representation of either.
Publication, broker acceptance, delivery, processing, and durable effect are separate steps.
Each acknowledgment refers to a specific step under the provider's contract.

At-most-once delivery can lose work without redelivery.
At-least-once delivery permits repeated delivery.
An exactly-once feature applies to a defined boundary and configuration.
It does not automatically include arbitrary external effects or unlimited replay history.
Inspect the actual consumer and resource guarantees before making a business claim.

## Invariants

- Accepted durable work has a recoverable representation.
- Message identity remains stable across delivery attempts of the same event.
- Duplicate processing cannot violate the selected business invariant.
- Acknowledgment follows the durable boundary it is intended to certify.
- Poison messages and expired work have explicit outcomes.

## Approach

### Define Completion

Separate request accepted, processing started, effect committed, and user notified.
Expose an operation identity when the caller needs later status.
Specify who owns cancellation, expiry, and retry decisions.
Do not return completed success for merely enqueued work.
Avoid adding a persistent job model to tasks that do not need delayed tracking.

### Choose the Transport Semantics

Identify durability, retention, ordering scope, acknowledgment, and redelivery rules.
Decide whether competing consumers or independent subscribers are intended.
Check message-size limits and the handling of large payload references.
Use versioned provider documentation and actual client settings.
Do not infer semantics from a generic "queue" abstraction name.

### Connect State and Publication

If an event must represent a committed database change, protect publication intent.
An outbox or suitable change stream can close the local dual-write gap.
The relay still needs progress tracking and duplicate tolerance.
If work is intentionally best-effort, document that rather than pretending durability.
Check what survives a producer crash at every acknowledgment point.

### Make Processing Repeatable

Choose an idempotency boundary based on the business effect.
Keep deduplication state atomic with a local effect when possible.
For external effects, use provider-supported operation identity or reconciliation.
Separate duplicate events from two legitimate user operations with identical payloads.
Use payload equivalence checks when reusing a key with different intent is invalid.

### Bound Backlog and Recovery

Measure arrival rate, processing rate, oldest age, and available storage.
Choose admission control, concurrency, and retry budgets from downstream capacity.
Define what happens when work becomes too old to be useful.
Plan controlled replay instead of treating a dead-letter queue as permanent storage.
Test recovery speed as well as steady-state throughput.

## Delivery and Ordering

### Acknowledgment Timing

Acknowledging before durable processing can lose work after a crash.
Acknowledging after processing permits redelivery if the acknowledgment is lost.
This trade-off is why idempotent effects matter.
A database marker written before a non-atomic effect can suppress unfinished work.
A marker written afterward can leave a duplicate window.

### Visibility and Ownership

A visibility timeout hides work temporarily; it does not stop an old consumer.
Long processing may require renewal or smaller work units.
Renewal failure means ownership can become uncertain.
Do not assume only one process is executing because only one delivery is visible.
Protect final effects against overlapping attempts where correctness requires it.

### Ordering Scope

Global order restricts parallelism and may exceed the business need.
Per-account or per-order sequencing often matches the actual invariant.
Multiple consumers, retries, and separate publication paths can change observed order.
Use versions to reject stale projections where appropriate.
Buffering missing events needs limits and a recovery path.

### Schema Evolution

Old messages can outlive the producer release that created them.
Consumers need to handle supported historical versions during replay.
Prefer compatible additive changes where semantics allow.
Do not reuse a field name for a different meaning without explicit versioning.
Treat removal and retention windows as a cross-release contract.

## Failure Modes and Antipatterns

### Exactly-Once by Marketing Label

Signal: no duplicate-effect handling exists because a broker advertises exactly-once behavior.
Mechanism: the advertised guarantee ends before an external resource or after a retention window.
Response: identify the precise protected boundary and remaining uncertain intervals.
Exception: a supported transactional consume-transform-produce pipeline may cover its own scope.
Check: crash after the business effect but before consumer progress commits.

### Deduplication by Payload Alone

Signal: two identical purchases are treated as one operation.
Mechanism: identical data is confused with identical user intent.
Response: use an operation identifier with explicit scope and lifecycle.
Exception: content-addressed immutable artifacts can intentionally deduplicate equal content.
Check: submit the same payload twice as two separate authorized actions.

### Infinite Poison-Message Retry

Signal: one invalid message cycles while queue age rises.
Mechanism: permanent failure consumes capacity intended for recoverable work.
Response: classify failure, bound attempts, quarantine, and expose a repair path.
Exception: an important temporarily unavailable dependency may justify longer bounded retention.
Check: can unrelated work progress while this message remains unresolved?

### Dead-Letter Queue as Disposal

Signal: failures are moved out of sight without ownership or alarms.
Mechanism: the operational system reports health while business work remains incomplete.
Response: monitor age and count, assign an owner, and validate replay procedures.
Exception: explicitly discardable telemetry can have a documented drop policy.
Check: can the team explain the user outcome for one quarantined message?

### Unbounded Consumer Parallelism

Signal: scaling workers increases downstream errors and end-to-end latency.
Mechanism: a backlog is converted into simultaneous pressure on a weaker dependency.
Response: cap concurrency by resource capacity and use backpressure.
Exception: independent CPU-bound partitions may scale well until another limit appears.
Check: observe downstream saturation and retry volume during scaling.

### Replay Without Context

Signal: historical events trigger new emails, charges, or obsolete state transitions.
Mechanism: replayed facts are treated as fresh commands without policy distinctions.
Response: define replay modes, compatible handlers, and effect suppression or identity.
Exception: rebuilding a pure projection is often intentionally repeatable.
Check: replay a historical sample against an isolated target and inspect durable effects.

## Field Heuristics

### Watch Oldest Age Before Celebrating Throughput

Useful when a queue drains many messages but users still wait.
Hot partitions or repeated failures can strand a small old cohort.
Depth alone ignores variable message cost and the age of unprocessed work.
For uniformly cheap tasks, depth remains a useful supporting metric.
Tie the completion objective to user waiting time.

### Retention Defines a Recovery Budget

Useful when choosing message and deduplication retention.
Recovery must finish before the source needed for replay disappears.
Deduplication records may need to outlive automatic retries and manual replay windows.
Longer retention has storage, privacy, and schema-support costs.
Decide what happens to work outside the supported recovery interval.

### Start with Fewer Semantic Boundaries

Useful when a small application proposes many event types and independent services.
Every subscriber adds compatibility and recovery obligations.
A local background worker may meet the need without a distributed event architecture.
Independent ownership or scale can justify stronger separation.
Choose based on a concrete need for decoupling, not on anticipated sophistication.

## Worked Example: Report Generation

The API accepts a report request with a stable operation identity.
The worker may receive the work more than once.
Rendering can repeat if publishing the result is conditional on valid operation state.
Artifact naming and final state must not allow an old attempt to overwrite a newer result.
Notification is another effect with its own duplicate and failure semantics.

The user-visible state distinguishes pending, complete, failed, and expired where needed.
The system can recover accepted work after worker restart.
Replay checks supported input/schema versions before executing old requests.
Worker count is bounded by rendering and storage capacity.
These obligations matter more than the particular broker brand.

## Evidence and Sources

Test duplicate delivery, lost acknowledgments, slow consumers, and expired ownership.
Test incompatible messages and controlled dead-letter replay.
Observe oldest age, processing latency, redelivery, quarantine, and effect counts.

- [AWS: Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
- [AWS Builders' Library: Timeouts, retries, and jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

Verify transport-specific guarantees against the chosen provider and configuration.