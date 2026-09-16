# Wellactually

Wellactually helps AI-native junior developers selectively pair with AI in
their existing projects so they can apply established engineering methods,
design principles, and practical judgment while doing real work.

The Human Navigator decides the problem, direction, scope, constraints, and next
action. An AI Driver researches, implements, and verifies within the human's
instruction. A separate, bounded AI Pair surfaces assumptions, alternatives,
counterexamples, and minimum necessary explanation without making the final
choice or writing the Driver instruction.

The project targets the judged `Hack for Agentic Coding` Executive Challenge
and the corresponding Seoul Venue challenge. Its contribution is an agentic
coding experience that keeps useful implementation automation while giving the
developer a deliberate role in engineering judgment.

## MVP Loop

1. The user opens Pair (**페어** in the Korean UI) and starts a discussion about
   a design or implementation concern.
2. The Human Navigator and AI Pair identify a Session Focus and discuss the
   evidence, assumptions, alternatives, and constraints.
3. The Human Navigator writes and sends an instruction in the existing AI
   Driver UI.
4. Optionally select a Driver from the global local-session catalog, which
   combines ordinary VS Code Copilot Chat, agent-host registrations and Copilot
   SDK records across projects.
   When asked, the Pair reads its original records and artifacts and discusses
   the results in the persistent SDK conversation. There is no automatic reaction.
5. The user stops a response or ends the conversation without affecting Driver work.

The product interface and Pair answers are Korean-only. There is no language
selector or Knowledge Compilation/report feature in the current prototype.
Read-only access covers the current project and the selected Driver's records
and artifacts. Standard Chat shares its exact transcript and session-specific
editing directory, not the shared folder containing other chats.
There is no separate log collection or file picker.

Task completion and session activity are not treated as
proof of learning or competence.

## Agent Context

Start with [AGENTS.md](AGENTS.md). It defines the repository workflow and the
context that must be loaded before project work. The supporting documents have
distinct roles:

- [Project context](CONTEXT.md): canonical project and event language.
- [Hackathon guide](docs/hackathon-2026.md): event rules, dates, judging criteria,
  and policies.
- [Product design](docs/specs/2026-09-12-wellactually-product-design.md):
  canonical product and implementation contract.
- [Target audience](docs/ideation/target-audience.md): maintained customer and
  problem framing; effectiveness remains a hypothesis.
- [User guide](docs/user-guide.md): current text-only usage instructions.
- [Code reading guide](docs/code-review.md): implementation structure and
  verification boundaries.

The [original Korean product definition](docs/wellactually-product-definition.html)
and every `docs/ideation/*-kr.*` file are preserved historical sources and must
remain byte-for-byte unchanged. They may describe superseded features; they are
not current product contracts.

## Delivery Workflow

Follow [code/README.md](code/README.md) for prerequisites, authentication,
development-host launch, and focused checks. From a fresh checkout:

```sh
cd code
npm ci
npm test
npm run package
```

Use the `wellactually: build` task and **Wellactually Extension** F5 launch
configuration, or `npm run build` from `code/`. Make focused TypeScript changes,
add relevant regression tests, and update the current contract when an approved
product decision changes it. Reuse SDK conversation/compaction and restricted
direct file reads rather than rebuilding session memory or Driver log ingestion.

Follow [local VSIX delivery](deploy/README.md) for package installation and
[the demo checklist](deploy/demo-checklist.md) for installed-extension and
human/model acceptance. Synthetic tests and browser fixtures do not establish
authenticated model retrieval, compaction recall, conversational quality, or
learning. Record only checks actually performed.

The product itself must advance an agentic coding experience. Merely using an
AI coding agent to build an unrelated product is not sufficient challenge fit.

## Repository Layout

- `code/`: TypeScript VS Code extension source and tests.
- `docs/`: current context, contract and guides, plus clearly historical sources.
- `deploy/`: local VSIX delivery instructions and the demo acceptance checklist.

AHP, a dedicated workspace reader, automatic observation, and Azure deployment
are not MVP prerequisites.