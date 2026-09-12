# Well Actually

Well Actually is an early-stage Microsoft Global Hackathon 2026 project. The
team is targeting the judged `Hack for Agentic Coding` Executive Challenge and
the corresponding Seoul Venue challenge. The product idea is still being
defined; do not infer a customer, solution, architecture, or technology stack
until those decisions are recorded.

## Agent Context

Start with `AGENTS.md`. It defines the repository workflow and the context that
must be loaded before project work. The supporting documents have distinct
roles:

- `CONTEXT.md`: canonical project and event language.
- `docs/hackathon-2026.md`: event rules, dates, judging criteria, and policies.
- `docs/specs/`: approved product and feature designs, created when needed.
- `docs/plans/`: implementation plans derived from approved specs, created when
  needed.
- `docs/adr/`: consequential architectural decisions, created when needed.

## Delivery Workflow

1. Use `brainstorming` to define the customer, problem, value, and product
   design.
2. Record approved designs in `docs/specs/`.
3. Use `writing-plans` to create an executable plan in `docs/plans/`.
4. Implement in vertical slices using `tdd` where executable behavior exists.
5. Use `verification-before-completion` before reporting completion.

The product itself must advance an agentic coding experience. Merely using an
AI coding agent to build an unrelated product is not sufficient challenge fit.

## Repository Layout

- `code/`: application source and tests after the product and stack are chosen.
- `deploy/`: deployment and infrastructure artifacts after the target
  architecture is chosen.
- `.agents/skills/`: repository-local workflows available to coding agents.

Build, test, and deployment commands will be added after the technology and
architecture decisions are approved. Python and JavaScript or TypeScript are
the expected implementation languages; frameworks and package managers remain
undecided.