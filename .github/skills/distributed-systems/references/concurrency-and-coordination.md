# Concurrency and Coordination

## When This Helps

Use when multiple actors can update the same state or perform the same effect.
Use for lost updates, overselling, duplicate work, locks, leases, and leader ownership.
Begin with the invariant that must survive overlap.
Do not begin by selecting Redis or adding a global mutex.

## Core Model

Concurrency means operations may overlap in time.
Correctness depends on which interleavings are allowed to become observable.
An atomic operation is indivisible within a particular system's contract.
That scope does not automatically include another database or external API.
Serialization can be enforced at storage, ownership, or an application boundary.

Safety means a forbidden state does not occur.
Liveness means work can eventually make progress under stated assumptions.
A lock without expiry may preserve exclusion but block progress after a crash.
A lease with expiry improves recovery but permits an old actor to resume late.
Both properties matter, and neither follows from the word "distributed".

## Invariants

- Identify the resource and exact state transition being protected.
- Every participating writer must obey the protection mechanism.
- Ownership loss must not authorize a stale actor to commit effects.
- Lock release must not remove a later owner's lock.
- Retries must preserve business correctness, not merely reacquire permission.

## Approach

### Locate the Authority

Find where the protected state is committed.
A unique constraint may solve duplicate creation more directly than an external lock.
A conditional update may protect a version without serializing unrelated work.
A database transaction may already provide the required local boundary.
Keep the guarantee near the resource whenever its native primitives suffice.

### Write a Failing Interleaving

Describe two actors reading, checking, writing, and acknowledging.
Mark pauses, crashes, retries, and ownership expiry between those actions.
Identify the first point where both can believe an action is valid.
Use this schedule to evaluate mechanisms and design a test.
A sequential happy-path test cannot establish overlap safety.

### Choose the Smallest Adequate Mechanism

Atomic updates suit a single counter or conditional transition.
Optimistic concurrency suits conflicts that are rare and retryable.
Pessimistic locking suits short critical sections with manageable contention.
Single-owner partitioning can remove overlap within a resource group.
Distributed leases require explicit failure assumptions and stale-owner handling.

### Bound Waiting and Recovery

Set an acquisition budget consistent with the caller's deadline.
Handle contention differently from service unavailability where useful.
Keep protected work short and avoid unrelated network calls under locks.
Define retry budgets, backoff, fairness needs, and cancellation behavior.
Measure contention and wait time instead of guessing from thread count.

### Verify the Protected Effect

Test the invariant at the durable resource, not only the lock client's return value.
Pause an owner past lease expiry and allow another owner to proceed.
Resume the old owner and verify its stale effect is rejected or harmless.
Test crash recovery and duplicate delivery where the operation spans a queue.
Use a proven library or storage primitive instead of inventing a locking protocol.

## Mechanism Trade-offs

### Optimistic Concurrency

Read a version and condition the write on that same version still being current.
Treat a zero-row update or conflict result as a business-relevant outcome.
Re-read and recompute after conflict rather than resubmitting a stale calculation.
High contention can create repeated wasted work and poor tail latency.
Use versions with semantics that do not accidentally repeat across replacement records.

### Pessimistic Database Locks

Acquire the lock within the transaction protecting the mutation.
Use consistent resource ordering when multiple locks are required.
Handle deadlock victims and transaction aborts explicitly.
Isolation and lock behavior depend on the engine, statement, and access path.
Do not assume a lock on one row protects an absence or a cross-row predicate.

### Single-Owner Processing

Route all work for a key to one active owner or ordered partition.
This simplifies sequencing but shifts correctness into routing and ownership transfer.
Rebalances, retries, and failover still require duplicate and stale-owner handling.
A hot partition can limit throughput even when total capacity is ample.
Check whether global ordering is necessary or only per-resource ordering matters.

### Leases and Fencing

A lease grants ownership for a limited interval under the system's assumptions.
Process pauses and delayed requests can outlive that interval.
A fencing token increases with each new ownership epoch.
The protected resource must reject operations with obsolete tokens atomically.
Merely carrying a token in logs does not enforce fencing.

A random ownership token supports safe compare-and-delete release.
It is not the same as a monotonically ordered fencing token.
The token authority must preserve ordering across failover and recovery.
Not every external service supports fencing; redesign or idempotent effects may be needed.
Extending leases reduces some expiry risk but does not eliminate stale execution.

## Failure Modes and Antipatterns

### Check Then Act

Signal: code reads "available" and later writes "reserved" without a shared guard.
Mechanism: two actors observe the same precondition before either commits.
Response: atomic conditional mutation, constraint, or an appropriate transaction.
Exception: advisory checks can be useful for UI feedback before authoritative validation.
Check: make both actors complete the read before allowing either write.

### Process-Local Lock for Multi-Instance State

Signal: a mutex fixes local tests but duplicates appear after scaling out.
Mechanism: each process has its own lock and all can enter simultaneously.
Response: enforce the invariant at shared storage or a genuine shared owner.
Exception: process-local resources only need process-local protection.
Check: run competing operations from separate processes.

### Lease Expiry Treated as Cancellation

Signal: a new owner starts while an old paused owner can still write.
Mechanism: expiry changes coordination state, not the old process's execution.
Response: fence effects or make repeated/stale work harmless at the resource.
Exception: duplicate computation may be acceptable if only one valid result can publish.
Check: resume the first owner after the second commits.

### Unconditional Unlock

Signal: any finishing worker deletes a named lock key.
Mechanism: an expired owner can delete a replacement owner's lock.
Response: release only when the stored ownership token matches atomically.
Exception: an explicitly authorized administrative recovery is a different operation.
Check: delay release until after expiry and reacquisition by another owner.

### Replication Mistaken for Exclusive Ownership

Signal: primary failover is assumed to preserve every acquired lock.
Mechanism: asynchronous replication can lose the acquisition before promotion.
Response: evaluate the actual coordination protocol and resource protection.
Exception: occasional duplicate work may be acceptable for efficiency-only locks.
Check: distinguish cost-saving exclusion from correctness-critical exclusion.

### Locking Around Slow External Effects

Signal: a lease covers a payment call, file upload, and notification together.
Mechanism: latency and uncertain outcomes exceed the assumed critical-section bounds.
Response: use durable operation state and idempotent external contracts where available.
Exception: a tightly bounded local operation may fit a short lock safely.
Check: what happens when the effect succeeds but the acknowledgment is lost?

## Field Heuristics

### Name What Overlap Costs

Useful before choosing a distributed lock.
Duplicate cache fills waste resources; duplicate charges violate a business invariant.
Efficiency-only coordination can tolerate failure modes correctness locks cannot.
Do not promote a best-effort optimization into the only integrity barrier.
Ask what the system does if two holders exist.

### Prefer a Constraint over a Conversation Between Writers

Useful when the rule fits one authoritative datastore.
A unique key or conditional update protects against all conforming access paths.
Some cross-system invariants cannot fit that boundary.
Then make the broader workflow and reconciliation obligations explicit.
Avoid external coordination that adds failures without strengthening the resource guarantee.

### Contention Is Often a Modeling Signal

Useful when one lock dominates latency.
Investigate whether unrelated resources share an unnecessarily broad key.
Partitioning can improve concurrency only if the invariant is partitionable.
Do not split a global integrity rule merely to improve a benchmark.
Measure hot-key distribution and transaction duration before changing granularity.

### Deadlocks Are an Expected Outcome to Handle

Useful when multiple transactional actors acquire overlapping resources.
Consistent ordering reduces risk but does not excuse missing abort handling.
Retry the full transaction when required by the engine contract.
Keep irreversible external effects outside automatically retried transaction bodies.
Bound retries so conflict does not become overload.

## Worked Example: Inventory Reservation

Two requests both read one remaining item and each attempt to reserve it.
A conditional decrement that requires positive stock can reject the second mutation.
The affected-row result determines whether the reservation succeeded.
If the reservation also creates an order row, keep their local invariant atomic.
If payment is remote, model its outcome separately rather than extending a DB lock.

## Evidence to Seek

Use controlled schedules, barriers, or storage-level concurrency tests.
Assert final quantities, versions, and unique business effects.
Cover acquisition failure, conflict, expiry, crash, and resumed stale work.
Document engine/version and timing assumptions for the chosen primitive.
Passing a stress test is supporting evidence, not proof of every possible schedule.

## Sources

- [Redis: Distributed locks and consistency disclaimer](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [Google SRE: Testing for reliability](https://sre.google/sre-book/testing-reliability/)

Redis's page describes a specific algorithm with assumptions and links to its debate.
It is not evidence that every lease implementation preserves every business invariant.