# Agent Operating Instructions

This repository uses a compact skill workflow for hackathon delivery. Load only
the skills relevant to the current task; do not turn every change into a formal
design exercise.

## Context

Before project-specific planning or implementation, inspect these files when
they exist:

1. `README.md` for the product and development workflow.
2. `CONTEXT.md` for canonical domain language.
3. `docs/hackathon-2026.md` for event dates, submission requirements, judging
  criteria, and policy constraints.
4. `docs/adr/` for accepted architectural decisions.
5. `docs/specs/` for approved feature designs.
6. `docs/plans/` for current implementation plans.

Missing documents are not blockers. Do not invent decisions to fill them.

`CONTEXT.md` and `docs/hackathon-2026.md` are mandatory context for every
project analysis, plan, implementation, and review. If an event rule conflicts
with the user's latest instruction, surface the conflict instead of guessing.

Write all repository documentation in English, including Markdown files,
code comments intended as documentation, ADRs, specifications, and plans.

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

## Skill Routing

- New or unclear product work: `brainstorming`; use `grill-with-docs` when the
  idea needs deeper challenge or durable decisions.
- Domain language and durable decisions: `domain-modeling`.
- Module boundaries and public interfaces: `codebase-design`.
- Multi-step implementation: `writing-plans`, followed by `tdd` in vertical
  slices.
- Bugs and failing tests: `systematic-debugging`.
- UI creation and polish: `frontend-design`, then `baseline-ui`; use
  `fixing-accessibility` for interactive controls, forms, and accessibility
  review.
- Before claiming completion: `verification-before-completion`.

Keep documentation proportional to the decision. Update `CONTEXT.md` when
domain terms stabilize and add an ADR only for consequential, hard-to-reverse
choices.