---
name: distributed-systems
description: "Use during Wellactually Pair discussions of caching, Redis, stale reads, invalidation, concurrency, locks, leases, transactions, isolation, consistency, queues, async messaging, outbox, idempotency, retries, timeouts, partial failures, or overload."
user-invocable: false
disable-model-invocation: false
---

# Distributed Systems

Reason about state, time, ownership, and failure across independently failing components.
Select a reference from the concrete operation and its invariant.
Do not equate a product or pattern name with a correctness guarantee.

## Routing

| Current uncertainty | Reference |
| --- | --- |
| Reuse, freshness, TTL, invalidation, cache failure | [Caching and consistency](./references/caching-and-consistency.md) |
| Overlapping writers, locks, leases, stale owners | [Concurrency and coordination](./references/concurrency-and-coordination.md) |
| Atomic changes, isolation, dual writes, reconciliation | [Transactions and consistency](./references/transactions-and-consistency.md) |
| Delivery, acknowledgment, duplicates, ordering, replay | [Async messaging](./references/async-messaging.md) |
| Deadlines, retry safety, uncertain outcomes, overload | [Network and failure](./references/network-and-failure.md) |

Read one reference first.
A second is useful only when a concrete dependency crosses its boundary.
For example, a queue consumer making a payment may require retry semantics.
A cache choice does not automatically require a distributed lock investigation.

## Procedure

1. Identify the user-visible operation and authoritative state.
2. State the invariant and the cost if it fails.
3. Locate independently failing boundaries and ownership transitions.
4. Read the reference controlling the immediate decision.
5. Walk one normal execution and one relevant interrupted execution.
6. Distinguish guarantees supplied by infrastructure from application obligations.
7. Compare a small set of mechanisms against those obligations.
8. Name the evidence that could change the recommendation.
9. Leave product trade-offs and scope decisions with the user.

Do not require a full architecture diagram before making a useful local contribution.
Use actual code, configuration, service versions, and observed behavior when available.
Label absent details as assumptions rather than filling them with a familiar architecture.

## Important Distinctions

- A timeout means the caller stopped waiting, not that the effect did not occur.
- A broker acknowledgment does not necessarily mean a business effect completed.
- Idempotency depends on operation identity, storage, scope, and retention.
- A lease expiring does not stop an old process from running.
- A cache TTL does not by itself guarantee end-to-end freshness.
- A transaction protects only the participants and semantics it actually covers.
- Eventual convergence requires a mechanism, not merely patience.

These distinctions are reminders, not a mandatory list to recite.
Apply only the ones that affect the current decision.

## Evidence and Sources

Check the deployed service version and configuration before relying on a guarantee.
Prefer official contracts and proven implementations over handwritten protocols.
Source links support core mechanisms; field heuristics are conditional synthesis.
Describe a concrete failure schedule when a slogan hides important assumptions.
Do not invent stress-test results, failover behavior, or provider guarantees.

## Role Boundary

The active Agent and shared Navigator instructions control behavior and tools.
Pair explains risks, alternatives, and useful observations without executing experiments.
Do not operate infrastructure, edit code, or send implementation prompts to Driver.
Do not choose acceptable data loss, staleness, or business compensation for the user.
Another Agent loading this skill retains its own authorized role and scope.

## Mode Adaptation

All Pair modes use the same engineering material.
The mode changes frequency, explicitness, and the threshold for intervention.
Use an example when terminology is blocking the user's reasoning.
For an experienced user, surface the missing assumption or consequential counterexample.
Do not turn reversible local choices into mandatory architecture reviews.

## Stopping

Stop when the immediate invariant, trade-off, and meaningful uncertainty are clear.
Avoid adding queues, locks, caches, or services merely because this skill describes them.
Use engineering-decisions when the desired business outcome remains unclear.
Use debugging-and-verification when the next question is how to obtain evidence.
Knowledge use does not initiate Knowledge Compilation.