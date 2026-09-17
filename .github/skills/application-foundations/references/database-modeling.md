# Database Modeling

## When This Helps

Use for entities, relationships, constraints, query access, lifecycle, and schema changes.
Use when convenient storage makes business states ambiguous or inconsistent.
Begin with the facts the application must preserve and the operations it must support.
An ORM model is an implementation view, not automatically the complete domain model.

## Core Model

A schema expresses identity, relationships, allowed values, and some integrity rules.
Queries express access patterns and the information needed for decisions.
Transactions govern related changes under concurrency.
Migrations change the contract while old code and old data may still exist.
Retention and deletion define how facts stop being available.

Separate authoritative facts from derived views.
Separate current attributes from historical facts that must not change retroactively.
Separate missing, unknown, inapplicable, and empty when their meanings differ.
Choose stable identity independently of mutable display names.
Do not assume every valid business rule fits a single row constraint.

## Invariants

- Important identities and relationships are enforced at authoritative storage where possible.
- Uniqueness has an explicit scope, including tenant and lifecycle state when relevant.
- Stored types preserve the precision and semantics the business needs.
- Derived copies have an update or rebuild owner.
- Migration and deletion behavior preserve the intended data contract.

## Approach

### Start from Operations and Examples

Use concrete create, read, update, and delete scenarios.
Identify which facts change together and which have independent lifetimes.
Include one historical record, one invalid input, and one concurrent operation.
Avoid designing only from the initial form fields.
The user decides ambiguous domain meanings before they become silent defaults.

### Establish Identity and Relationships

Choose stable primary identifiers and separate human-facing labels where appropriate.
Express one-to-many and many-to-many relationships explicitly.
Define whether references are optional and what absence means.
Preserve tenant consistency across related records, not just row-level tenant labels.
Natural keys can be useful when their stability and scope are genuinely contractual.

### Encode Integrity

Use NOT NULL, UNIQUE, foreign keys, and supported checks for rules they can enforce.
Name consequential constraints to make failures diagnosable.
Application validation provides useful errors but is not a concurrency-safe uniqueness guarantee.
Cross-row predicates may need specialized constraints or transaction-level protection.
Check the deployed engine's NULL, collation, and constraint behavior.

### Choose Representation

Use precise monetary or measurement representation with explicit units and rounding policy.
Distinguish instants from local dates, time-of-day values, and recurring schedules.
Use JSON for genuinely variable structure with a clear validation and query strategy.
Avoid encoding core relationships as comma-separated strings or opaque blobs.
Choose normalization from update integrity, then evaluate measured read costs.

### Design Access and Change

List important filters, joins, sorting, and pagination boundaries.
Choose indexes from representative queries and data distribution.
Account for write amplification, storage, and maintenance cost.
Plan schema evolution with mixed application versions and existing records.
Define deletion, archival, and restoration before relying on cascading operations.

## Modeling Trade-offs

### Normalization and Derived Copies

Normalization reduces redundant facts and inconsistent updates.
Denormalization can reduce read cost but creates synchronization obligations.
A historical order price is a fact at purchase time, not necessarily redundant current product data.
Materialized projections need freshness semantics and rebuild procedures.
Do not copy fields merely because joins appear unfamiliar.

### Relational and Document Shapes

Relational constraints suit shared relationships and integrity across records.
Document storage can suit aggregates commonly read and changed together.
Embedding can duplicate independently changing entities or create unbounded documents.
Referencing can require additional reads and cross-document consistency work.
Choose the aggregate boundary and workload before choosing a storage brand.

### Null and Defaults

NULL may mean unknown or inapplicable; make the intended meaning clear.
In PostgreSQL, a CHECK evaluating to NULL does not reject the row.
Add NOT NULL when a value must exist.
Unique constraints' treatment of NULL varies by engine and configuration.
A default can hide missing required input or assign a false historical fact.

### Indexes and Pagination

Index order depends on predicates, ordering, selectivity, and the engine's planner.
PostgreSQL foreign keys do not automatically index referencing columns.
Large offsets can become expensive and unstable under changing data.
Keyset pagination needs deterministic ordering with a tie-breaker and clear mutation semantics.
An index that helps one query may cost writes and fail to help another data distribution.

### Deletion and History

Cascade deletion suits dependent components whose lifetime belongs to the parent.
It can be destructive for independent entities or audit facts.
Soft deletion affects uniqueness, joins, visibility, retention, and restoration.
It is not the same as erasure from backups, exports, or downstream copies.
Choose the lifecycle policy before spreading a deleted flag across the schema.

## Schema Evolution

### Compatible Expansion

Introduce structures that both current and next application versions can tolerate.
Avoid requiring a field before all writers can supply it or a safe backfill exists.
Backfill in bounded units with restartable progress where scale requires it.
Observe lag, errors, and write impact before switching readers.
Only remove the old representation after supported readers and recovery paths no longer need it.

### Data Meaning and Backfills

Do not infer a historical value from today's data unless that meaning is valid.
Distinguish truly unknown values from a convenient default.
Concurrent writes may race with backfill and need version or ownership rules.
Validate representative old records, not just newly inserted fixtures.
Keep a record of unresolved cases rather than silently coercing them.

### Rollback Limits

Reverting code does not recreate dropped columns or recover discarded information.
Old binaries may fail after new values or constraints are introduced.
Backups are useful only with a tested restore path and acceptable recovery objectives.
Forward repair can be safer than reverse migration for some data changes.
The user must understand irreversible loss or downtime before implementation proceeds.

## Failure Modes and Antipatterns

### Every Field Is a String

Signal: sorting, validation, and arithmetic depend on ad hoc conversions.
Mechanism: domain distinctions and invalid states escape storage checks.
Response: use appropriate types and explicit units, formats, and bounds.
Exception: opaque external identifiers can be strings even if they contain digits.
Check: leading zeros, locale formats, overflow, and invalid encodings where relevant.

### Application-Only Uniqueness

Signal: code checks existence before insert without a storage guarantee.
Mechanism: concurrent requests both pass the check and create duplicates.
Response: enforce the scoped unique rule and handle conflict deliberately.
Exception: explicitly approximate duplicate detection is a different requirement.
Check: concurrent creation of the same business key.

### Schema-less as Meaning-less

Signal: JSON fields evolve without owners, versions, or consumer expectations.
Mechanism: incompatible historical shapes fail late in readers.
Response: define validation, supported shapes, and migration/replay behavior.
Exception: archival raw payloads may intentionally preserve opaque external data.
Check: read a representative old payload with the current consumer.

### Index Every Column

Signal: many indexes exist without a known query or integrity purpose.
Mechanism: writes and maintenance become expensive without proportional read benefit.
Response: connect indexes to actual plans and workload evidence.
Exception: constraints may require an index independent of query frequency.
Check: representative plans and write cost before adding or removing indexes.

### Migration Tested Only on an Empty Database

Signal: deployment fails on duplicate, NULL, or old-format records.
Mechanism: fresh schema creation bypassed the transformation of existing data.
Response: test representative populated fixtures and mixed-version compatibility.
Exception: a disposable new environment may genuinely have no migration obligation.
Check: repeat and interrupt the migration where the tooling promises recovery.

## Field Heuristics

### Ask What Must Remain True after a Rename or Merge

Useful for customer, account, and organizational identity design.
Mutable names and business reorganizations expose unstable natural keys.
Not every domain needs surrogate IDs; stable standardized keys can be valid.
Check references, historical reports, and external contracts before choosing.
Separate display changes from identity changes explicitly.

### Model Deletion While Data Is Still Small

Useful before retention and relationship assumptions become entrenched.
Deletion exposes hidden ownership and history requirements.
Do not invent legal retention policy; obtain the applicable requirement.
Include downstream copies and operational recovery in the discussion.
This often clarifies the model more than adding another optional field.

## Worked Example: Team Membership

A membership relates a user and a team with a scoped role and lifecycle.
Uniqueness prevents duplicate active memberships under the chosen policy.
Related resources must not reference a user from an unrelated tenant accidentally.
Removing membership changes authorization but need not erase historical authorship.
The schema, policy, and deletion behavior must agree about these distinct facts.

## Evidence and Sources

Test constraint violations, concurrent writes, historical data, and representative queries.
Use the actual database engine for behavior that an in-memory fake does not preserve.

- [PostgreSQL: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL: Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

The lifecycle and migration heuristics are conditional design synthesis.