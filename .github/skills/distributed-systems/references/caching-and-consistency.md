# Caching and Consistency

## When This Helps

Use when repeated reads are expensive or a cache is being proposed as a solution.
Use when stale results, cache outages, memory growth, or invalidation cause trouble.
Redis is one possible implementation, not the definition of the problem.
First establish the workload and what stale information would cost the user.

## Core Model

A cache holds a reusable representation of another source's state or computation.
Its value depends on reuse, fetch cost, freshness tolerance, and operating cost.
A hit is useful only if it is valid for the caller and requested semantics.
A fast wrong answer is not a performance improvement.
Identify the source of truth and the unit of cached data explicitly.

Freshness, residency, and durability are different properties:
- Freshness describes whether the representation is recent enough.
- Residency describes whether the entry remains available in the cache.
- Durability describes whether state survives the relevant failures.
An eviction policy is not an invalidation policy.
A persisted Redis value is not automatically the authoritative business record.

## Invariants

- A cache key includes every dimension that can change the answer.
- Tenant and authorization boundaries remain valid on cache hits.
- Cache absence has a defined behavior.
- Stale data is not used beyond the operation's allowed semantics.
- Rebuilding the cache does not silently modify authoritative records.

## Approach

### Establish the Benefit

Measure repeated work, origin latency, request distribution, and object size.
Check query plans, batching, and redundant client requests before adding infrastructure.
A low-reuse workload can pay serialization and network cost without enough hits.
A small hot set is different from scanning millions of unique keys once.
Estimate the miss-path load after a restart, not only the warm steady state.

### Define Freshness by Operation

A public description may tolerate seconds of delay.
A purchase, permission revocation, or inventory reservation may need authoritative checks.
Read-your-writes expectations can differ from general read freshness.
State how the interface represents pending or potentially stale information.
Do not apply one global TTL to unrelated business risks.

### Choose a Strategy

Cache-aside reads on a miss and then fills the cache.
It is simple but concurrent fills and write invalidation need reasoning.
Write-through updates the cache as part of the write path's chosen contract.
It adds latency and another failure boundary unless supported by one atomic system.
Write-behind defers authoritative persistence and therefore introduces data-loss obligations.

Refresh-ahead can reduce hot-key expiry latency but spends work on prediction.
Stale-while-revalidate can preserve availability where bounded staleness is acceptable.
Local memory avoids a network hop but creates per-process copies and invalidation work.
A shared cache centralizes reuse but becomes another network and capacity dependency.
Use the least complex strategy that meets the actual freshness requirement.

### Design Keys and Representation

Include tenant, resource identity, relevant query parameters, and representation version.
Canonicalize only parameters that are semantically equivalent.
Do not use raw credentials in keys or logs.
Bound object size and cardinality, including user-controlled query combinations.
Plan a schema/version transition for readers running different releases.

### Define Failure and Recovery

Decide whether a cache outage permits origin fallback, stale reads, or rejection.
Check whether the origin can survive the resulting request volume.
Use bounded concurrency and load shedding when fallback is capacity-limited.
Treat cache write failure separately from authoritative write failure.
Do not turn a successful business write into an unsafe retry merely because filling failed.

## Invalidation and Races

### TTL Bounds Need Assumptions

A TTL limits residency after a fill, not necessarily age since an authoritative change.
A slow fill can insert a value read before a newer write committed.
Refreshing an old replica response can repeatedly reset the apparent freshness window.
Account for source lag, fill duration, and stale fallback extensions.
Store version or freshness metadata when the contract needs a stronger bound.

### Deleting After a Write

Committing the database then deleting the cached entry is a common approach.
It still has a window between commit and invalidation.
A concurrent reader can repopulate stale data after the deletion.
Version checks or coordinated update protocols may be needed for stronger guarantees.
Delayed repeated deletion reduces some races but is not a universal correctness proof.

### Event-Based Invalidation

Events can propagate updates across independent cache owners.
They can be delayed, duplicated, lost by a weak delivery path, or reordered.
Use versions, replay/reconciliation, and bounded expiry where appropriate.
Measure invalidation lag rather than assuming delivery is instantaneous.
Do not rely on an unobserved best-effort event for immediate permission revocation.

### Negative Caching

Caching "not found" can protect an origin from repeated nonexistent lookups.
Distinguish absence from permission denial and temporary upstream failure.
Keep the lifetime appropriate for newly created records becoming visible.
Scope results to the identity and tenant where their meaning depends on access.
Never turn one user's denial into another user's cached absence accidentally.

## Failure Modes and Antipatterns

### Cache Stampede

Signal: many misses for one expensive key arrive together.
Mechanism: concurrent recomputation overloads the origin after expiry or eviction.
Response: coalesce work, bound fill concurrency, or serve permitted stale data.
Exception: cheap origins or low traffic may not justify coordination overhead.
Check: simultaneous cold requests and recovery after filler failure.

### Synchronized Expiration

Signal: load spikes recur at a shared TTL boundary.
Mechanism: batch-filled entries expire together and rebuild together.
Response: jitter expiry within acceptable freshness limits or stagger warming.
Exception: a coordinated policy expiry may require a deliberate shared deadline.
Check: maximum acceptable age still holds at the largest jitter value.

### Unbounded Fallback

Signal: a cache outage becomes a database outage.
Mechanism: normally suppressed demand reaches the origin without admission control.
Response: define fallback capacity, concurrency limits, and degradation semantics.
Exception: an origin sized for uncached traffic may tolerate full bypass.
Check: cold-cache traffic at representative demand, not one successful request.

### Shared Cache Across Security Contexts

Signal: keys identify a URL or object but omit tenant or relevant access scope.
Mechanism: an authorized response is reused by an unauthorized caller.
Response: preserve authorization checks and use correct cache partitioning.
Exception: genuinely public immutable content can be shared.
Check: request the same object identifier under different identities.

### Cache as the Only Copy by Accident

Signal: eviction or restart removes business state that cannot be reconstructed.
Mechanism: disposable-cache assumptions were applied to authoritative data.
Response: choose and verify explicit persistence, backup, and consistency guarantees.
Exception: intentionally ephemeral state may be allowed to disappear.
Check: what user-visible fact is lost when every cache entry is removed?

## Memory and Operating Cost

Track bytes as well as key counts; large values can dominate capacity.
Include serialization, metadata, allocator overhead, and replication/persistence buffers.
Redis maxmemory is not a promise that total process memory stays under that value.
Leave appropriate headroom for the deployed configuration and workload.
Check the actual version's supported policies rather than assuming current docs apply.

LRU favors recently accessed entries; LFU favors frequently accessed entries.
Redis approximates these policies, so expectations should be statistical.
No-eviction can reject writes when memory is full rather than preserving all availability.
Mixing disposable cache data with critical coordination state complicates eviction safety.
Separate workloads when their capacity and durability obligations conflict materially.

## Field Heuristics

### Prove the Miss Path Before Optimizing the Hit Path

Useful when introducing a cache or changing its failure behavior.
Ensure authoritative reads remain correct and capacity is bounded.
This does not require sizing every system to sustain unlimited uncached demand.
It requires an explicit response when that demand exceeds the limit.
Check cold start and cache unavailability separately.

### Cache Stable Representations, Not Unstable Decisions

Useful when a response mixes descriptive data with permissions or availability.
Cache reusable facts while rechecking consequential decisions at their authority.
Some decisions can be cached with a documented bounded revocation delay.
Make that delay a product/security choice, not an accidental TTL default.
Check whether the operation can tolerate a previously correct answer.

### Watch Saved Work, Not Just Hit Ratio

Useful when a dashboard shows high hit rates but poor latency or origin load.
Cheap hits can hide a few expensive misses dominating resource consumption.
Track miss cost, key skew, fill latency, stale responses, and origin saturation.
Do not optimize hit ratio by retaining data longer than its allowed freshness.
Compare end-to-end outcomes before and after the cache change.

## Worked Example: Product Availability

The catalog can cache descriptive product data for fast browsing.
Displaying approximate availability may tolerate a short delay if clearly defined.
Checkout still reserves stock against an authoritative concurrency-safe operation.
Increasing catalog TTL must not weaken that reservation invariant.
The same entity can legitimately have different consistency needs across operations.

## Evidence to Seek

Observe warm and cold latency, hit/miss cost, memory, and eviction behavior.
Test concurrent fill against a write and a stale replica read.
Test outage fallback within an explicit load envelope.
Check cross-tenant reuse, schema changes, and permission revocation behavior.
Use the result to revisit the strategy, not merely tune TTL indefinitely.

## Sources

- [Redis: Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [Google SRE: Effective troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)

These sources support cache operation and evidence-driven diagnosis.
The decision heuristics and examples here are practical synthesis, not quoted rules.