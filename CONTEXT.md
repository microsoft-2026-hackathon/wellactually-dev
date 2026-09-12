# Well Actually Hackathon Context

This is the shared language for the project as it prepares for Microsoft Global
Hackathon 2026 and Seoul Venue judging. Use `docs/hackathon-2026.md` as the
source of truth for event operations. The project's target judged Executive
Challenge is `Hack for Agentic Coding`.

## Language

**Global Hackathon 2026**:
A company-wide global hackathon run by The Garage for Microsoft employees and
interns who are active during the event.
_Avoid_: Korea Hackathon, Seoul Hackathon

**Executive Challenge**:
The official judged category that a project must select exactly one of to enter
global judging.
_Avoid_: Topic Challenge, Local Award

**Hack for Agentic Coding**:
A global Executive Challenge focused on improving engineering experiences with
agentic coding. For a project registered to the Seoul Venue, selecting this
challenge also enrolls the project in the corresponding Seoul challenge.
_Avoid_: Agent Skills Challenge

**Topic Challenge**:
An optional additional topic category. A project may select up to five Topic
Challenges.
_Avoid_: Executive Challenge

**Seoul Venue Local Judging**:
A two-stage local judging process operated by the Seoul Venue separately from
global judging. Do not use this term to mean a preliminary round of global
Executive Challenge judging.
_Avoid_: Global preliminary round, Korea Executive Challenge

**Project Video**:
A video of no more than two minutes required for global Executive Challenge
eligibility. It must explain or demonstrate the project's value to its Primary
Customer.
_Avoid_: Seoul demo, presentation deck

**Primary Customer**:
The clearly identified core audience or customer whose problem and expected
value define the project.
_Avoid_: everyone, generic user

**Agent Skills Challenge**:
The separate non-judged Executive Challenge formally named `Hack Your Day Job
with Agent Skills`. It is not this project's target submission path.
_Avoid_: Korea Special Award, current primary track

**Korea Special Award**:
A local award path separate from global awards. Its 2026 focus is innovation in
agentic coding experiences using GitHub Copilot.
_Avoid_: Hack for Agentic Coding, Agent Skills Challenge

**Izzy**:
The event AI partner available through Innovation Studio and the project Teams
workspace to support idea refinement, planning, development, demos, and
submission preparation. Izzy is neither a required deliverable nor a judging
criterion.

## Product Language

**AI-native Junior Developer**:
A developer who can build and deploy with coding agents but has had limited
opportunity to apply established engineering methods, design principles, and
practical judgment in real work. This is Wellactually's Primary Customer.

**Human Navigator**:
The person who owns the problem, direction, scope, constraints, expected
behavior, and next action. The Human Navigator writes and sends every AI Driver
instruction in their own words.

**AI Driver**:
The coding agent that researches, implements, and verifies within the Human
Navigator's instruction. Its work continues independently of the Pairing
Session.

**AI Coach**:
The bounded conversational partner that surfaces assumptions, alternatives,
counterexamples, constraints, and minimum necessary explanation. It neither
makes the final choice nor authors or sends AI Driver instructions.

**Pairing Session**:
A voluntary, user-initiated period in which the Human Navigator asks the AI
Coach to help examine one or more engineering judgments. It may begin without
an AI Driver connection and may end while AI Driver work continues.

**Shared Scope**:
The task context, conversations, files, results, and other evidence that the
Human Navigator explicitly allows Wellactually to use during a Pairing Session.

**Session Focus**:
The current uncertainty or engineering judgment that the Human Navigator and AI
Coach agree to examine.

**Deliberation Loop**:
A bounded exchange in which the Human Navigator and AI Coach examine evidence,
assumptions, alternatives, and constraints. Sending a Driver Instruction ends
one loop turn but does not end the Pairing Session.

**Driver Instruction**:
The task direction that the Human Navigator writes and sends to the AI Driver in
the existing Driver interface. It records human judgment and is never generated
or rewritten by the AI Coach.

**Driver Result**:
The AI Driver's reported outcome and available supporting evidence for a Driver
Instruction. It may be complete, incomplete, failed, still running, or not yet
verified.

**Result Review**:
The Human Navigator's interpretation of a Driver Result, optionally supported by
the AI Coach, that distinguishes observed evidence from reported or unverified
claims and leads to the next human choice.

**Knowledge Compilation**:
The optional, best-effort process that turns available Pairing Session evidence
into structured retrospective data after the session ends. Failure never blocks
session exit.

**Knowledge Report**:
A static HTML artifact produced from Knowledge Compilation. It records judgment
changes, reusable lenses, limits, open questions, provenance, and missing data;
its existence does not prove learning.

**Verification Level**:
The status that distinguishes what was discussed, explained by the human,
reported by the AI Driver, observed in a tool result, or left unverified.

**Behavior Proxy**:
An observable session event that may support later product evaluation without
being treated as evidence of competence, retention, productivity, code quality,
or long-term learning.
