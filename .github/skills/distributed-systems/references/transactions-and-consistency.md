# Transactions and Consistency

## When This Helps

Use when related changes must succeed together or readers observe conflicting facts.
Use when a database write and external effect can disagree.
Use for isolation choices, transaction retries, outbox design, and reconciliation.
Start with the business invariant and the systems that hold its state.

## Core Model

Atomicity concerns which changes commit together.
Isolation concerns the observable interaction of concurrent transactions.
Durability concerns survival after the system's specified failures.
Business consistency concerns whether committed states obey domain rules.
These properties are related but not interchangeable.

A transaction cannot enforce a rule that the code and schema never express.
A local transaction does not automatically include a remote request.
Serializable execution does not make every external read globally up to date.
Eventual consistency needs a defined propagation and conflict-resolution mechanism.
The operation's required visibility may differ from another operation on the same entity.

## Invariants

- State the records and effects that must agree at commit.
- Do not publish uncommitted facts as durable external events.
- Retried transaction bodies must not duplicate irreversible external effects.
- Consumers must tolerate the delivery semantics of the actual publication path.
- Recovery has an owner and an observable completion condition.

## Approach

### Draw the Commit Boundary

List each durable write, message, file, and remote effect.
Identify which share one atomic commit facility.
Do not confuse a framework annotation with participation by every dependency.
Find where acknowledgments can be lost after a commit.
Use a short failure timeline to expose the unprotected interval.

### Express Local Integrity Locally

Use constraints for uniqueness, references, and valid row states where supported.
Use conditional updates or appropriate locking for state transitions.
Keep related local mutations in one transaction when the invariant requires it.
Avoid broad transactions around unrelated work or user interaction.
Schema and application checks complement each other; neither eliminates the other.

### Choose Isolation from an Anomaly

Describe the bad interleaving the application must reject.
Check the deployed engine's actual isolation behavior.
Do not choose solely from the isolation level's familiar name.
Stronger isolation can simplify reasoning but may introduce aborts and overhead.
Weaker isolation requires explicit protection for the relevant conflicts.

### Model Cross-System Progress

When one commit cannot cover all participants, represent intermediate states explicitly.
Choose whether delayed completion, compensation, or manual resolution is acceptable.
An outbox protects durable intent to publish, not atomic completion by all consumers.
A saga coordinates local steps with domain-specific compensations.
Neither mechanism removes the need to explain partial progress to users and operators.

### Verify Interruptions

Stop execution before commit, after commit, after publication, and before acknowledgment.
Check what survives and what a retry does at each point.
Verify recovery from the stored state, not from in-memory callbacks alone.
Check mixed-version readers during schema or event changes.
Keep tests within authorized isolated environments.

## Isolation in Practice

### Read Committed

In PostgreSQL, ordinary statements generally obtain a new committed snapshot per statement.
Two reads in one transaction can therefore see another transaction's intervening commit.
Simple atomic updates may work well at this level.
Complex read-check-write predicates need careful conflict handling.
Do not generalize PostgreSQL statement behavior to every engine without checking.

### Repeatable Read and Snapshot Isolation

A stable snapshot helps consistent multi-query reads.
It does not universally prevent write skew across different records.
PostgreSQL Repeatable Read can abort conflicting updates and requires retry handling.
Other engines may give different guarantees under the same label.
Ask whether the rule depends on a set of rows or an absence, not just one row version.

### Serializable

Committed participating transactions behave as if executed in a serial order.
PostgreSQL can enforce this through conflict detection and transaction aborts.
Applications must retry the entire transaction when required, including its decisions.
All relevant access paths must respect the chosen integrity strategy.
External services and stale replicas remain outside that local guarantee.

### Commit Outcome Can Be Unknown

A connection can fail after the database commits but before the client learns it.
Blindly rerunning a creation operation can create a second business record.
Use stable operation identity, uniqueness, and result lookup when the contract needs it.
Distinguish known rollback from an ambiguous commit outcome.
Sequence gaps in PostgreSQL are not proof of lost committed rows; sequence changes do not roll back.

## Outbox and Reconciliation

### Durable Publication Intent

Commit domain state and an outbox record in the same local transaction.
A relay later publishes committed records to the broker.
If the process crashes after commit, the relay can still find the intent.
If it crashes after publish but before marking progress, it may publish again.
Consumers therefore need an appropriate duplicate-effect strategy.

### Ordering and Retention

Choose the ordering scope, often one aggregate rather than the entire application.
Timestamps or allocation IDs alone may not represent concurrent commit order.
Concurrent relays can reorder publication unless the protocol prevents or tolerates it.
Retain records long enough for recovery and operational investigation.
Bound table growth and make backlog age visible.

### Compensation Is Not Rollback

A refund does not erase the fact that a charge occurred.
Inventory release may fail or be invalid after another state transition.
Define compensating actions with their own identity, retries, and authorization.
Some effects require manual resolution rather than a fictional automatic inverse.
The user owns the business policy for partially completed work.

### Reconciliation Closes Gaps

Compare authoritative records and expected downstream state using stable identities.
Distinguish missing work from delayed work before repairing it.
Repairs must be idempotent and bounded, with an audit trail where needed.
Do not scan and rewrite unrelated state just because a discrepancy is possible.
Test the recovery mechanism itself, including interruption during repair.

## Failure Modes and Antipatterns

### Database Commit Then Best-Effort Publish

Signal: events are sent only from a post-commit in-memory callback.
Mechanism: a crash loses the publication intent after the business record exists.
Response: persist intent atomically or use a suitable transactional change stream.
Exception: explicitly best-effort analytics may tolerate lost notifications.
Check: kill the process after commit and before the callback executes.

### Remote Call Inside an Automatically Retried Transaction

Signal: serialization failure retries the body containing payment or email delivery.
Mechanism: external effects survive the database rollback and are repeated.
Response: separate durable intent or use a verified idempotent external contract.
Exception: pure reads may be repeatable, but still increase lock duration and load.
Check: force an abort after the remote effect.

### Eventual Consistency as an Excuse for Lost Work

Signal: stale state has no lag bound, replay source, or reconciliation owner.
Mechanism: permanent divergence is labeled temporary.
Response: define propagation, retry, retention, and observable recovery.
Exception: a deliberately approximate view may have weaker completeness requirements.
Check: what event or process makes the two views converge after an outage?

### Stronger Isolation Without Abort Handling

Signal: enabling Serializable produces user errors under normal contention.
Mechanism: expected conflict resolution reaches callers as unhandled exceptions.
Response: retry the full safe transaction within a bounded budget.
Exception: surfacing an optimistic conflict can be the intended collaborative-editing UX.
Check: run two conflicting transactions and verify the chosen outcome.

## Field Heuristics

### Keep Integrity Smaller than the Workflow

Useful when a long user journey appears to require one transaction.
Protect immediate local facts atomically and model later steps explicitly.
Do not split an invariant merely to shorten a transaction.
Separate stages only when their intermediate states are valid business states.
Check what another user is allowed to observe between stages.

### Ask Who Repairs the Half-Finished State

Useful before approving a cross-system design.
A retry queue is insufficient without ownership, retention, and outcome visibility.
Low-volume systems may use a deliberate manual recovery process.
That process still needs enough evidence to identify and repair the correct operation.
Avoid infrastructure added without an operational user.

## Worked Example: Order and Notification

Order creation and its publication intent commit together.
The relay publishes an order-created event and may repeat after a crash.
The consumer records its local effect and duplicate marker atomically where possible.
If email delivery is external, its uncertain result needs separate handling.
The outbox alone does not promise that exactly one email reaches the recipient.

## Evidence and Sources

Verify durable state after each interruption and retry point.
Use real engine semantics for concurrency checks rather than a cooperative mock.
Inspect backlog age, conflict rates, unresolved states, and reconciliation outcomes.

- [PostgreSQL: Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [AWS: Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

Provider examples illustrate mechanisms, not universal end-to-end guarantees.