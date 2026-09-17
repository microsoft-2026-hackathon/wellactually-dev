# Design Trade-offs

## When This Helps

Use when several reasonable designs satisfy the functional request.
Use when a new abstraction or dependency is justified by hypothetical growth.
Use when a small implementation choice changes contracts or operational ownership.
Use when the team disagrees because it optimizes different qualities.
Do not reopen a settled local convention without a material reason.

## Core Model

A design allocates complexity, failure, cost, and responsibility.
Removing complexity from application code can move it into operations.
Adding a service can decouple deployment while introducing runtime coupling.
An abstraction can reduce duplication while increasing the cost of understanding.
The useful question is not which pattern is best, but which cost is acceptable here.

Separate essential complexity from complexity introduced by the chosen solution.
Essential complexity follows from the actual problem and constraints.
Accidental complexity follows from mechanisms, interfaces, and implementation choices.
The distinction is contextual: a requirement may disappear when the product scope changes.
Simplification must preserve the required behavior, not merely shorten the code.

## Invariants

- Every candidate respects the same essential correctness constraints.
- Trade-off comparisons use comparable workloads and failure assumptions.
- Ownership exists for each stateful component and recovery operation.
- A rollout can support required old and new consumers during transition.
- A design claim does not exceed the evidence available for it.

## Approach

### Define the Decision Boundary

Name what is being chosen now and what is deliberately left open.
Separate an API promise from a replaceable implementation technique.
Identify consumers, persisted data, deployment boundaries, and external side effects.
Ask which decisions become expensive once this choice is made.
Do not generate a full architecture merely to resolve one local question.

### Establish Quality Priorities

Identify the two or three qualities that dominate this situation.
Examples include correctness, latency, change speed, availability, and cost.
Use concrete conditions rather than unranked adjectives.
For a small team, operational burden may outweigh a theoretical throughput gain.
For a payment boundary, correctness may outweigh a small latency improvement.

### Compare a Small Set of Viable Options

Include the existing design or a smaller change.
Exclude options that violate non-negotiable constraints before scoring preferences.
Describe the mechanism that produces each claimed benefit.
Describe what the option makes harder, including migration and incident response.
Avoid numerical scores whose precision is unsupported by evidence.

### Examine Failure and Change

Walk through one partial failure, one overload condition, and one likely change.
Identify where data or authority can disagree.
Check whether rollback returns the system to a valid state.
Evaluate compatibility across independently deployed versions.
Prefer a targeted probe when a key performance or consistency assumption is unknown.

### Record the Reason to Revisit

Identify what new evidence would justify a different choice.
Examples include sustained saturation, a second consumer, or a new regulatory boundary.
Avoid promising to redesign at an arbitrary user count without a bottleneck model.
Capture accepted consequences with the decision when a record is appropriate.
The decision owner remains the user or team, not the Pair.

## Common Comparisons

### Local Module or Separate Service

A module avoids network failure and distributed deployment coordination.
A separate service can provide independent ownership, scaling, and release cadence.
Its interface, observability, authentication, and on-call burden still need owners.
Shared database access can undermine the supposed isolation.
Choose separation for a concrete boundary, not as a synonym for modern design.

### Synchronous Request or Asynchronous Work

Synchronous work gives the caller a direct result and simpler completion semantics.
Asynchronous work can absorb bursts and decouple caller latency from processing time.
It introduces intermediate states, retries, status reporting, and possible duplication.
Queue acceptance is not business completion.
The product must define how users observe failure and recovery.

### Library or Managed Service

A library keeps control local but leaves lifecycle and operations with the team.
A managed service transfers some operations, not all correctness responsibility.
Check limits, billing shape, failure isolation, export options, and support needs.
Compare the cost of operating it during an incident, not only installing it.
An escape plan need not be implemented fully before the first use.

### General Abstraction or Concrete Implementation

A concrete implementation is easier to change when only one case is understood.
A stable abstraction can isolate real variation across known consumers.
Count independent reasons to change, not repeated lines alone.
Duplicated code with different semantics may be safer than a configurable mega-helper.
Extract when the shared meaning is clear enough to name and test.

### Consistency or Availability During Failure

Start with the exact operation and failure condition.
Some reads can tolerate stale data while some writes must reject uncertainty.
Do not assign one consistency label to an entire product without examining operations.
Describe what the user sees and what reconciliation must repair.
Domain invariants determine where degraded behavior is acceptable.

## Failure Modes and Antipatterns

### Pattern-First Design

Signal: the team selects an architecture before listing constraints.
Mechanism: the problem is reshaped to justify a familiar solution.
Response: compare against a smaller option using the same acceptance criteria.
Exception: an organizational platform can legitimately constrain the option set.
Check: identify a measurable or contractual requirement the pattern uniquely helps.

### Speculative Generality

Signal: many extension points exist without actual alternate implementations.
Mechanism: imagined futures make present changes harder to understand and test.
Response: preserve a narrow boundary without implementing every future variation.
Exception: an already contracted integration can justify advance compatibility work.
Check: name the next known consumer and its actual differing requirement.

### Moving Complexity Off the Diagram

Signal: a box labeled platform, queue, or cache appears to solve the hard part.
Mechanism: operations, recovery, and consistency work disappear from the estimate.
Response: trace responsibility across the new dependency boundary.
Exception: a mature managed service may genuinely remove substantial toil.
Check: who diagnoses failed requests and repairs state at three in the morning?

### Benchmark Without Workload Equivalence

Signal: a synthetic speedup is used to justify production redesign.
Mechanism: data distribution, contention, network cost, or failure rates differ.
Response: test the mechanism under representative conditions and compare tails.
Exception: a microbenchmark can isolate one narrow computational cost.
Check: does the measured operation dominate end-to-end behavior?

### Reversible Code, Irreversible Contract

Signal: rollback is described only as redeploying an earlier binary.
Mechanism: new records, clients, or side effects remain after code rollback.
Response: design compatibility and repair alongside rollout.
Exception: a truly internal stateless change may be rolled back by code alone.
Check: which artifacts survive when the flag is turned off?

### Consensus by Exhaustion

Signal: the option list grows but no decision criterion narrows it.
Mechanism: discussion substitutes for acquiring the missing evidence.
Response: choose one discriminating question or bounded experiment.
Exception: high-consequence irreversible choices deserve deeper consultation.
Check: what answer would actually eliminate a candidate?

## Field Heuristics

### Prefer Familiar Operations Unless There Is a Concrete Payoff

Familiar systems make incident response and maintenance more predictable.
This is useful when the team is small and the new dependency is stateful.
It is not an argument to preserve an unsuitable platform indefinitely.
Check whether a managed service or team expertise changes the operating cost.
Use evidence of the current platform's limits to justify novelty.

### Optimize for the Next Likely Change

Useful when debating how much flexibility to build today.
Look at actual upcoming consumers, requirements, and change history.
Keep a replaceable boundary where uncertainty is high.
Do not claim every future change will become cheap.
Check whether the proposed interface simplifies the next concrete change.

### Small Releases Improve Causal Attribution

Useful when a rollout mixes feature work, migrations, and infrastructure changes.
Smaller independent changes make unexpected behavior easier to attribute.
Some changes must be coordinated to preserve an invariant.
Use expand-and-contract or compatibility windows where coordination can be reduced.
Check whether each intermediate deployment is valid.

### A Temporary Choice Needs an Exit Condition

Useful for spikes, emergency mitigations, and consciously accepted debt.
Identify owner, observed limitation, and condition for replacement or removal.
An expiration date alone does not explain why the temporary choice is unsuitable.
Do not introduce tracking machinery disproportionate to the risk.
Check whether the team can recognize when the exit condition occurs.

## Worked Example: Background Report Generation

Current request: generate a report inside an HTTP request.
Evidence: larger datasets exceed the gateway deadline.
Candidate: a background worker plus a status endpoint.
Benefit: request acceptance can finish before report computation.
New obligations: job identity, access control, duplicate execution, retention, and failure status.

A bounded first version might permit one report per user and dataset version.
A stable idempotency key can prevent duplicate user-visible jobs on retries.
The system still needs to distinguish accepted, processing, failed, and completed.
The user must choose retention and whether stale completed reports are reusable.
This is a trade-off, not simply replacing one function call with a queue.

## Evidence and Stop Conditions

Look for the smallest observation that tests the claimed mechanism.
Use repository history to identify actual change pressure when available.
Use traces to distinguish network delay from computation or queueing.
Use failure injection only in an appropriately isolated, authorized environment.
Treat estimates as estimates and report their assumptions.
Stop exploring when remaining options have equivalent consequences for this scope.
Do not reopen the decision merely because another pattern exists.

## Sources and Scope

These are conditional design heuristics, not a mandatory architecture framework.
Project contracts and operating constraints take precedence over generic examples.

- [Google SRE: Simplicity](https://sre.google/sre-book/simplicity/)
- [AWS: Architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)