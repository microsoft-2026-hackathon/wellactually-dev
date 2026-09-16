# Agent Operating Instructions

Use the repository's TypeScript build, tests, and local VSIX delivery workflow.
Keep changes focused; do not turn every change into a formal design exercise.

## Context

Before project-specific analysis, planning, implementation, or review, inspect:

1. `README.md` for the product and development workflow.
2. `CONTEXT.md` for canonical domain language.
3. `docs/hackathon-2026.md` for event dates, submission requirements, judging
   criteria, and policy constraints.
4. `docs/specs/2026-09-12-wellactually-product-design.md` for the approved
   product and implementation contract.
5. `code/README.md` for development, authentication, and verification limits.
6. `deploy/README.md` and `deploy/demo-checklist.md` for delivery or demo work.

Do not invent decisions to fill documentation gaps.

`CONTEXT.md` and `docs/hackathon-2026.md` are mandatory context for every
project analysis, plan, implementation, and review. If an event rule conflicts
with the user's latest instruction, surface the conflict instead of guessing.

Write maintained repository documentation and documentation comments in English.
Existing Korean source artifacts are retained byte-for-byte without rewriting:
`docs/wellactually-product-definition.html` and `docs/ideation/*-kr.*`.
Their preserved source text is historical, not a competing current product
contract.

## Hackathon Decision Gate

The project targets both the judged global Executive Challenge and Seoul Venue
Local Judging. Evaluate every product, MVP, documentation, and demo decision
against all five global criteria: Inspiration, Business Value, Customer Focus,
Feasibility, and Make Something.

Treat the Seoul first-round review on September 18 as the working demo deadline.
Do not confuse it with the global Project Video submission deadline on September
21 at 11:59 PM Pacific Time. The non-judged `Hack Your Day Job with Agent Skills`
challenge is a separate optional path, not a requirement for this project.

The team has chosen `Hack for Agentic Coding` as its target judged Executive
Challenge. With Seoul as the venue, the project is automatically enrolled in
the corresponding Seoul challenge and may align with the Korea Special Award
focus on GitHub Copilot agentic coding experiences. The product itself must
advance an agentic coding experience; using an AI coding agent to build an
otherwise unrelated product is not sufficient challenge fit.

## Development Workflow

1. Follow `code/README.md`. Run commands from `code/`; use `npm ci` for initial
   setup or when the lockfile changes or dependencies are missing.
2. Build with `npm run build` or the `wellactually: build` task. Use the
   **Wellactually Extension** F5 configuration for an Extension Development Host.
3. Make complete, focused changes and add relevant regression tests. Run the
   smallest relevant checks, then `npm test` and `npm run package` for delivery.
4. Preserve the persistent read-only SDK conversation, human-triggered Pair
   discussion, and independent Driver. Internal `coach` names and VS Code IDs
   remain for compatibility; the role is Pair / **페어**.
5. Use synthetic data for permission and SDK-tool checks. Follow
   `deploy/demo-checklist.md` for installed-extension and live-model acceptance;
   leave unperformed checks unchecked and report verification limits.

Keep documentation proportional to the decision. Update `CONTEXT.md` when
domain terms stabilize and the canonical spec when approved behavior changes.
Do not add a framework or planning document merely to complete a small change.