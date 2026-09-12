# Well Actually

Wellactually helps AI-native junior developers selectively pair with AI in
their existing projects so they can apply established engineering methods,
design principles, and practical judgment while doing real work.

The Human Navigator decides the problem, direction, scope, constraints, and next
action. An AI Driver researches, implements, and verifies within the human's
instruction. A separate, bounded AI Coach surfaces assumptions, alternatives,
counterexamples, and minimum necessary explanation without making the final
choice or writing the Driver instruction.

The project targets the judged `Hack for Agentic Coding` Executive Challenge
and the corresponding Seoul Venue challenge. Its contribution is an agentic
coding experience that keeps useful implementation automation while giving the
developer a deliberate role in engineering judgment.

## MVP Loop

1. The user voluntarily starts pairing and chooses the Shared Scope.
2. The Human Navigator and AI Coach identify a Session Focus and discuss the
  evidence, assumptions, alternatives, and constraints.
3. The Human Navigator writes and sends an instruction in the existing AI
  Driver UI.
4. The Human Navigator and AI Coach may review selected, provenance-bearing
  Driver results and begin another deliberation loop.
5. The user ends or pauses pairing without affecting Driver work.
6. The user may inspect and save a best-effort static HTML Knowledge Report.

Task completion, report generation, and session activity are not treated as
proof of learning or competence.

## Agent Context

Start with `AGENTS.md`. It defines the repository workflow and the context that
must be loaded before project work. The supporting documents have distinct
roles:

- `CONTEXT.md`: canonical project and event language.
- `docs/hackathon-2026.md`: event rules, dates, judging criteria, and policies.
- `docs/specs/2026-09-12-wellactually-product-design.md`: canonical English
  product and implementation contract.
- `docs/wellactually-product-definition.html`: preserved Korean original source
  artifact. It is intentionally exempt from the English-only policy for new
  repository documentation and must remain byte-for-byte unchanged.
- `docs/ideation/*-kr.*`: preserved Korean discussion artifacts. These source
  copies remain unchanged; their English siblings describe the same material
  for repository readers. Earlier wording is historical context, not a competing
  implementation contract.
- `docs/ideation/product-description.html`: standalone English product overview.
- `docs/ideation/technical-design.md` and `.html`: synchronized English technical
  design, including the file-based MVP and Knowledge Compilation.
- `docs/implementation-plan.md`: the current eight-slice implementation plan.
  GitHub issues track the slices; implementation and live verification run
  locally with GitHub Copilot.
- `docs/plans/`: implementation plans derived from approved specs, created when
  needed.
- `docs/adr/`: consequential architectural decisions, created when needed.

## Delivery Workflow

1. Preserve the Korean source artifacts and maintain the canonical English
  contract with explicitly accepted later decisions.
2. Start with the verified local CLI/SDK session-log format and prove the
  restricted Copilot SDK Coach read/search profile with executable gates.
3. Follow the file-based MVP implementation plan; revisit AHP only when a
  required behavior or supported environment makes the file approach inadequate.
4. Implement one complete pairing loop in TypeScript using test-driven vertical
  slices.
5. Run verification before reporting completion.

The product itself must advance an agentic coding experience. Merely using an
AI coding agent to build an unrelated product is not sufficient challenge fit.

## Repository Layout

- `code/`: TypeScript VS Code extension source and tests.
- `deploy/`: deployment and infrastructure artifacts after the target
  architecture is chosen.
- `.agents/skills/`: repository-local workflows available to coding agents.

The local file probe established retained-record reading and detection of one
new tool result in the current CLI/SDK session; it did not verify every native
harness or the future Coach permission profile. Build and test commands will be
added as the implementation plan is executed. AHP, a dedicated workspace-reader
service, and Azure deployment are not prerequisites for the MVP.