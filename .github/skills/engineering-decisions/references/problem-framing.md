# Problem Framing

## When This Helps

Use when a request names a solution before explaining the need.
Use when completion means only that code exists or a demo runs.
Use when stakeholders describe different versions of the same problem.
Use when a task expands every time implementation reveals a detail.
An explicit, well-understood small fix rarely needs another framing exercise.

## Core Model

A problem statement connects an actor, an unwanted outcome, and a condition.
A solution is one proposed intervention in that situation.
A constraint limits acceptable interventions.
A success criterion describes an observable improvement.
An assumption is a belief that has not yet been established.
A preference can matter without being an external constraint.

For example, "use Redis" is a solution, not a performance requirement.
"Customers wait too long for catalog results during peaks" describes an outcome.
Neither statement establishes the bottleneck, acceptable delay, or load shape.
Those missing facts determine whether caching addresses the problem at all.

## Invariants to Preserve

- The affected user's task remains the reason for the change.
- Existing safety and privacy obligations remain applicable during experiments.
- A metric cannot silently replace the outcome it was intended to represent.
- A narrower delivery scope must not hide a broken essential user journey.
- Unknown requirements are not permission for an Agent to invent product policy.

## Approach

### Locate the Concrete Example

Start from one actual report, trace, workflow, or piece of user feedback.
Ask what happened and what should have happened under those conditions.
Identify the actor affected and the cost of the difference.
Check whether the example is typical, exceptional, or simply the only one known.
Avoid requesting a complete requirements document before understanding one case.

### Separate Observation from Interpretation

"The request took eight seconds" is an observation if measured correctly.
"The database is slow" is an explanation requiring more evidence.
"We need a cache" is a proposed response to that explanation.
Keeping these separate permits changing the solution without losing the goal.
It also prevents an implementation request from laundering an assumption into fact.

### Establish the Current Baseline

Describe how the task is performed today, including manual workarounds.
Include delays, error recovery, operational effort, and abandoned attempts.
Look for an existing feature that partially solves the need.
A workaround can reveal a real requirement, not merely technical debt.
Measure at the user boundary where practical, not only inside one function.

### Name Constraints and Their Owners

Distinguish legal, contractual, product, technical, and scheduling constraints.
Ask who can change a constraint and what evidence supports it.
An inherited library choice may be negotiable; a public contract may not be.
"We have always done it this way" deserves investigation, not automatic rejection.
Record unresolved constraints as unknown instead of quietly relaxing them.

### Choose the Smallest Useful Scope

Follow one user outcome across the necessary boundaries.
Separate essential behavior from optional polish and speculative extension points.
Include the minimum failure and recovery behavior required for safe use.
Do not confuse a small code diff with a small behavioral change.
A two-line authorization change can have a larger scope than a new screen.

### Decide What Would Disconfirm the Direction

Choose one observation that could make the proposed approach inappropriate.
Examples include a different bottleneck, a contradictory contract, or low usage.
Prefer a cheap prototype or measurement when uncertainty dominates implementation cost.
Set a stopping condition so investigation does not become indefinite exploration.
Use results to update the framing, not just to justify the first idea.

## Success Criteria

Specify the outcome, population, conditions, and evidence source.
For latency, identify percentile, traffic shape, and measurement boundary.
For correctness, describe permitted and forbidden state transitions.
For usability, observe task completion and recovery, not just feature clicks.
For reliability, distinguish healthy operation from degraded operation.
For learning goals, separate perceived understanding from independent behavior.

Avoid targets that improve by excluding inconvenient users or failure cases.
For example, reporting only successful requests can hide worsening timeouts.
Use guardrails when optimizing one metric could damage another requirement.
Do not add every imaginable metric; choose those tied to a real decision.

## Scope and Delegation

A useful work unit has a recognizable result and a bounded decision space.
Identify what the Driver may choose locally and what must return to the user.
Preserve the user's ownership of acceptance criteria and product meaning.
Describe boundaries in discussion rather than composing the implementation prompt.
Missing detail may be harmless if it is reversible and within existing conventions.

Consider dependencies that must exist before the result is useful.
A vertical slice can expose integration assumptions early.
A horizontal prerequisite is reasonable when it unlocks several known consumers.
Neither slicing approach is universally superior.
Prefer the slice that provides the earliest discriminating feedback for this task.

## Failure Modes and Antipatterns

### Solution-Shaped Requirements

Signal: every criterion specifies a technology but none describes an outcome.
Mechanism: implementation success becomes independent of solving the original problem.
Response: recover the unwanted outcome and compare the proposed technology against it.
Exception: a mandated integration may itself be a legitimate external requirement.
Check: can someone explain what would improve if the technology were replaced?

### The Happy-Path Demo Becomes the Definition

Signal: the demo works only with prepared data and an operator correcting failures.
Mechanism: essential recovery behavior is treated as an optional later feature.
Response: identify one realistic interruption and the state it leaves behind.
Exception: a clearly labeled throwaway prototype can omit production guarantees.
Check: could a new user complete or safely abandon the task without its author?

### Vague Quality Words

Signal: "fast", "scalable", "secure", or "intuitive" settles a design argument.
Mechanism: participants attach different meanings to apparently shared agreement.
Response: translate the adjective into one condition and an observable outcome.
Exception: early ideation may intentionally defer numeric thresholds.
Check: would two reviewers use the same evidence to decide whether it is met?

### Scope Accumulation

Signal: every adjacent cleanup becomes necessary before the original change ships.
Mechanism: the task loses a stable completion condition and feedback arrives late.
Response: distinguish a true dependency from a nearby improvement.
Exception: an unsafe dependency may genuinely prevent isolated delivery.
Check: explain the failure that occurs if the adjacent change is deferred.

### Proxy Optimization

Signal: the metric improves while complaints or operational work increase.
Mechanism: the measured proxy diverges from the actual user outcome.
Response: inspect excluded cases and add a relevant guardrail.
Exception: a proxy can be useful when its limits are explicit and periodically checked.
Check: can the metric be improved without helping the user?

### Requirements by Implementation Accident

Signal: an Agent's convenient choice becomes a product rule without discussion.
Mechanism: technical defaults silently decide retention, access, ordering, or recovery.
Response: return consequential policy choices to the user.
Exception: established repository conventions can resolve routine local defaults.
Check: would changing this choice surprise users or require data migration?

## Field Heuristics

### Ask for the Last Concrete Occurrence

Useful when a request contains many abstract needs but little evidence.
A concrete occurrence reveals actors, ordering, workarounds, and cost.
It is a starting point, not proof of frequency or population-wide demand.
Countercheck with a contrasting case before generalizing.
For a new product with no usage, label the example as a hypothesis.

### Keep a Non-Goal Close to a Tempting Expansion

Useful when a task borders on a larger platform or reusable framework.
A non-goal helps preserve feedback speed and makes deliberate deferral visible.
It must not excuse ignoring a requirement necessary for the chosen user outcome.
Revisit it when a concrete dependency, not enthusiasm, changes the scope.
Check whether the task still produces something usable without the expansion.

### Uncertainty Can Be the First Deliverable

Useful when an assumption could invalidate most implementation work.
A measured answer or contract clarification may be more valuable than provisional code.
Do not turn every ordinary task into a research phase.
Compare the cost of being wrong with the cost of finding out.
Stop when the evidence is sufficient for the next reversible decision.

### Reversibility Includes People and Data

Useful when a feature flag makes a decision appear easy to undo.
Users may adopt a behavior and external clients may depend on it.
Persisted data and support commitments can outlive the code path.
Check what must be repaired or communicated after disabling the feature.
An internal experiment with disposable data has a different reversal cost.

## Worked Example: "Add Redis"

Observed situation: the catalog endpoint is slow during a campaign.
Unknown: whether time is spent querying, serializing, waiting for a pool, or networking.
Possible condition: anonymous catalog pages can tolerate briefly stale prices.
Conflicting condition: checkout must use authoritative pricing.
Useful first observation: trace one slow request and compare with a typical request.

If query planning dominates, an index may solve the issue without a new dependency.
If repeated computation dominates, bounded caching may be appropriate.
If pool starvation dominates, another cache connection pool may complicate diagnosis.
The framing separates catalog browsing from the checkout correctness boundary.
The user can now choose a scope with an explicit freshness contract.

## What Evidence Changes the Decision?

- A user report from a different role contradicts the assumed workflow.
- Production traffic differs materially from the benchmark population.
- A public API consumer depends on an allegedly internal behavior.
- A measured bottleneck lies outside the proposed component.
- A rollback would preserve incompatible data or irreversible external effects.
- A cheaper existing mechanism satisfies the actual outcome.

Absence of evidence does not mean an assumption is false.
State the remaining uncertainty and its consequence for the next step.
Do not demand certainty where a bounded experiment is sufficient.

## Sources and Scope

This reference is practical synthesis, not a universal requirements methodology.
Use project-specific contracts and user research as primary local evidence.

- [Google SRE: Simplicity](https://sre.google/sre-book/simplicity/)
- [AWS: Architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)