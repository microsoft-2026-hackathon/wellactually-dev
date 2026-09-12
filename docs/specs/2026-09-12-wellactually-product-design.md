# Wellactually Product Design

**Status:** Approved implementation contract  
**Date:** September 12, 2026  
**Revision:** File-based local MVP decisions accepted September 12, 2026
**Original source artifact:** [Korean product definition](../wellactually-product-definition.html)  
**Source SHA-256:** `b64e0ca20f608f86efdb971f267727cf7afa3ebb38e3680905529ca40cd39601`

This document is the canonical English contract for implementation. The Korean
HTML is the original product-definition artifact and must remain byte-for-byte
unchanged. This contract incorporates later accepted integration decisions
without rewriting that source. Korean discussion copies under
`docs/ideation/*-kr.*` are also preserved artifacts; their English siblings
provide maintained explanations. Where historical artifacts or explanatory
copies differ, this contract controls the product behavior implemented in the
repository.

## Product Definition

Wellactually helps AI-native junior developers selectively pair with AI in
their existing projects so they can apply established engineering methods,
design principles, and practical judgment while doing real work.

It does not provide a separate educational project or attempt to teach a full
curriculum. A user's personal, learning, or company project supplies the
context. The product adds a bounded pairing experience when the user encounters
an unfamiliar or consequential decision.

## Primary Customer

The Primary Customer is an AI-native junior developer who can build and deploy
software with coding agents but has had limited opportunity to apply established
engineering methods, design principles, and practical judgment in real work.

Not every junior developer has this problem. Experienced developers may also
benefit in unfamiliar domains, but their needs do not set the initial product
standard.

## Problem

The problem is a capability-formation gap, not the decay of an existing skill.
A developer may complete a task while gaining too little experience deciding:

- what evidence to inspect before choosing a solution;
- why one approach fits the current constraints better than another;
- which assumptions, exceptions, and change effects require review;
- what to delegate to an agent and what to verify personally.

Task completion, test success, and generated code are observable outcomes.
They do not by themselves demonstrate understanding, independent judgment, or
long-term learning.

## Product Principles

1. **Keep using AI.** The product does not pursue learning by withholding useful
   coding agents or making the AI Driver intentionally ineffective.
2. **Leave consequential judgment with the human.** The human understands the
   reasons and constraints, chooses the direction, and writes the instruction.
3. **Pair selectively.** The user starts pairing when a decision merits the
   additional time. There is no required frequency, streak, quiz, completion
   gate, or surveillance-first mode.
4. **Teach only what the current decision needs.** The Coach asks one important
   question at a time and gives the minimum explanation needed to proceed.
5. **Separate evidence from inference.** The product records what was discussed,
   stated, reported, or verified without treating those records as proof of
   learning.
6. **Make exit unconditional.** The user can stop because understanding is
   sufficient or simply pause because of time, fatigue, or uncertainty.

## Roles and Authority

### Human Navigator

The Human Navigator owns the problem, direction, scope, constraints, expected
behavior, and next action. They write and send every AI Driver instruction in
their own words, interpret the result, and decide whether to continue or end.

The Human Navigator is not an approval button or a relay between two AIs.
Existing code, logs, and results may be shared to reduce transfer work, but the
product must preserve the human's judgment and authorship.

### AI Driver

The AI Driver researches, implements, and verifies competently within the Human
Navigator's instruction. It asks the human before making a consequential policy
or scope change. It continues to use its existing interface, tools, permissions,
and approval flow.

### AI Coach

The AI Coach surfaces assumptions, alternatives, counterexamples, constraints,
and useful engineering lenses. It may provide a bounded explanation or ask a
question when the user requests coaching. During an active, user-initiated
Pairing Session, relevant new evidence may also trigger a bounded coaching
evaluation. This is not always-on surveillance or a gate on Driver execution.

The AI Coach does not make the final choice, write or rewrite a finished Driver
instruction, send messages to the Driver, edit code, execute commands, approve
tools, or cancel Driver work. Persona text alone is not an adequate authority
boundary; the implementation must withhold those capabilities structurally.

## Pairing Experience

A Pairing Session follows this adaptable sequence. Steps may be skipped,
repeated, or ended according to the user's need.

1. **Choose pairing and Shared Scope.** The user starts a Coach conversation and
   chooses which task context and artifacts may be shared. Connecting a Driver
   is not required to begin. The product does not collect unrelated chats or
   materials.
2. **Set the Session Focus.** The user describes the current uncertainty, such as
   not knowing whether a cache design fits. The Coach helps identify the
   judgment under review and distinguishes current evidence from unknowns.
3. **Run a Deliberation Loop.** The Human Navigator and Coach examine evidence,
   assumptions, alternatives, and constraints. The Human Navigator determines
   scope and completion criteria.
4. **Author the Driver Instruction.** When delegation is useful, the Human
   Navigator writes and sends the instruction in the existing Driver UI. This
   ends one deliberation turn; it does not end the Pairing Session.
5. **Review the Driver Result.** If pairing continues, the Human Navigator and
   Coach review selected, provenance-bearing results. They distinguish passed,
   failed, and unverified claims, then choose another loop or exit.
6. **End or pause.** Ending stops Coach observation and intervention. It never
   cancels, approves, completes, or otherwise mutates Driver work. The product
   shows when the Driver may still be running.
7. **Optionally compile knowledge.** The user may inspect and save a static HTML
   Knowledge Report, then return to normal work.

## Coach Interaction Rules

The Coach uses the mode needed by the current decision rather than forcing a
fixed curriculum:

| Mode | Coach surfaces | Human practices |
| --- | --- | --- |
| Problem definition | Problem evidence and improvement goal | Separating observations from assumptions |
| Design reasoning | Alternatives, constraints, tradeoffs, and operating cost | Choosing a direction and reconsideration conditions |
| Delegation design | Scope, preserved behavior, and verification criteria | Writing a bounded instruction directly |
| Exploration and debugging | Observations that discriminate between hypotheses | Requesting evidence and revising a hypothesis |
| Specification and counterexamples | Boundary inputs, concurrency, and failure order | Deciding expected behavior and validation criteria |

The Coach asks one important question at a time, avoids repeating established
facts, explains only what is necessary, and does not repeat the same objection
without new evidence. The user may reject its suggestions and request sources or
clarification. The Coach must state uncertainty and correct unsupported claims.

Direct questions take priority over automatic evaluation. Reuse a warm Coach
session, batch relevant log changes, stream useful responses, and discard stale
responses after context, binding, pause, or exit changes. Do not turn every
filesystem event into a model call or let the Coach's own read results trigger
an evaluation loop. Measure queue, context, tool, and model latency separately;
the time to detect a log update is not the time to a useful Coach response.

## Knowledge Compilation

Knowledge Compilation is a best-effort process performed after session exit. It
uses only available, user-approved Coach conversation, Human Navigator decision
records, selected Driver evidence, and code evidence actually used during the
session. Capture those inputs in a frozen snapshot at an explicit cutoff.
Compiler execution must not reread the live workspace or acquire the Coach's
file permissions. It produces structured data which the extension validates
and renders into a static HTML Knowledge Report with:

- the session scope and exit state;
- the Human Navigator's initial position and later judgment changes;
- reusable engineering lenses and their applicability limits;
- verification levels that distinguish discussion, human explanation, Driver
  report, observed tool result, and unverified work;
- open questions, omitted evidence, and incomplete or disconnected context;
- provenance linking claims to available sessions, turns, files, or results.

The report is a retrospective and reuse aid. Reading, saving, or generating it
does not prove learning. Compilation failure never blocks session exit; the
product reports the failure or omission and may offer retry or later export.

## Evidence and Evaluation Boundaries

Research evidence, product hypotheses, and observable product behavior must stay
distinct in product copy, telemetry, reports, demos, and submissions.

The initial research supports a possible gap between task completion and
understanding under some conditions. It does not establish that all AI use harms
learning, that all junior developers share the gap, or that Wellactually closes
it. Human pair-programming research does not prove the effectiveness of an AI
Coach, and retrospective research does not prove that an HTML report transfers
skill.

For the MVP, report only session-level Behavior Proxies, such as:

- pairing was started voluntarily;
- the human stated a decision or uncertainty;
- a human-authored Driver Instruction was recorded;
- selected Driver evidence was reviewed;
- the human stated a next choice;
- a report was generated with explicit completeness and provenance.

Do not infer retention, competence, productivity, code quality, or long-term
learning from those proxies. Long-term transfer requires a later study with
repeated, unaided tasks.

## MVP Scope

The MVP is a TypeScript VS Code extension that demonstrates one complete loop:

`user starts pairing -> Coach discussion -> human-authored Driver instruction -> selected Driver Result -> joint review -> user ends -> optional HTML report`

The extension provides a dedicated Coach `WebviewView`; the Extension Host owns
session state, selected-log identity, Coach calls, and report export.

### File-based integration first

The accepted hackathon path is:

- Preserve the existing Driver interface and runtime rather than creating a
  second extension-owned Driver.
- Read one explicitly selected local CLI/SDK JSONL session log for retained
  context and new-result detection. A small file-change and complete-record
  helper may project the required events; do not build a general reader
  framework or copy all sessions into a database.
- Let the independent Copilot SDK Coach use verified built-in file-read,
  directory-list, and search tools for saved workspace code. No separate
  Workspace Reader service is required. Unneeded editing, shell, delegation,
  and Driver-control tools remain unavailable.
- Authorize only verified read operations within Shared Scope. Deny unknown
  permission requests and operations; the working directory is not a sandbox.
  Keep SDK state/configuration separate from the project.
- Record selected evidence and provenance for joint review. Historical log
  records do not count as new Driver Instructions. File changes alone do not
  prove a tool succeeded or that a human authored a particular action.

A local probe read approximately 19.7 MB / 2,720 JSONL records from the current
Copilot CLI/SDK session, correlated a harmless tool-output marker by
`toolCallId`, detected its persisted completion after approximately 249 ms with
100 ms polling, and reopened the result after stopping the watcher. It used no
AHP connection or database query. This was one observation, not a latency SLA or
proof that all native Copilot harnesses share the same storage format.

The next blocking integration gate verifies the actual Coach read/search
profile, path restrictions, supported authentication, and runtime compatibility.
Large referenced outputs, log rotation, and restart recovery also need scoped
verification. Do not use unrelated real sessions or credentials as test data.

### Alternatives and failure handling

AHP is a future alternative if required state cannot be obtained from files or
broader/remote harness support requires a structured host interface. It is not a
prerequisite for the file-based MVP and does not itself guarantee read-only
credentials. Reconsider the integration boundary explicitly if a gate fails;
do not silently enable broad tools or substitute a different architecture.

A manual sharing, fixture, replay, or deterministic recovery path may be used
only with its limitations clearly identified. It must not be presented as live
observation, successful SDK integration, or equivalent evidence that the
file-based contract passed.

## Safety, Privacy, and Trust

- Driver context is read-only and limited to explicit Shared Scope. Unsent
  drafts and hidden model reasoning are out of scope.
- Prompts, turns, tool output, source excerpts, paths, reports, and credentials
  are sensitive. Keep active evidence in memory where practical; bounded
  checkpoints and frozen report inputs may be persisted in a separate local
  extension-state directory for exit/recovery. Disclose what is retained and
  support deletion. This is distinct from the user's explicit HTML export and
  from the Driver runtime's own logs. Do not persist all raw logs or put private
  state in the repository.
- Project and log read access is limited to explicitly approved paths and
  fields. Raw logs may contain private instructions or credentials; filesystem
  permission alone does not filter their contents. Use controlled fixtures and
  selected projections, and verify exclusions for read and search tools.
- Restricted Mode may show product guidance and disconnected Coach UI, but it
  disables workspace/log-derived context and live SDK work until the workspace
  is trusted. Any later AHP connection must obey the same trust boundary.
- The Webview uses typed message validation, output escaping or sanitization,
  restrictive local-resource roots, and a `default-src 'none'` Content Security
  Policy with nonce-bound external scripts and styles.
- Authentication tokens are never written to repository files, reports, logs,
  or persisted extension state.

## Non-Goals

The MVP does not include automatic current-chat discovery, outside-session work
surveillance, blocking Driver execution on Coach approval, generated or
rewritten Driver instructions, automatic Driver messaging, a separate
curriculum, learning scores, streaks, organization analytics, multi-harness
orchestration, Azure deployment, marketplace hardening, voice input,
unsent-draft interception, a dedicated workspace-reader service, or a claim of
demonstrated learning effectiveness. Bounded automatic evaluation during an
active voluntary session is in scope; it stops on pause or exit.

## Acceptance Criteria

The implementation is acceptable when it can demonstrate the complete MVP loop
while preserving every authority and evidence boundary above. In particular:

1. A user can begin and end pairing without connecting a Driver or receiving
   Coach approval.
2. Only the Human Navigator authors and sends Driver instructions.
3. Ending pairing cannot mutate or stop Driver activity.
4. Driver evidence has visible provenance, completeness, connection, and
   verification state; manual or replay data is unmistakably labeled.
5. Coach failure and Knowledge Compilation failure do not block normal Driver
   work or Pairing Session exit.
6. The optional report escapes untrusted content, identifies missing evidence,
   and makes no learning inference.
7. The cache scenario from the source can demonstrate an initial Redis
   assumption, freshness separation, a scoped investigation, language-dependent
   cache keys, revised criteria, result review, and an optional report.
8. Product copy and demo narration frame effectiveness and learning transfer as
   hypotheses, not established outcomes.
9. The declared supported environment can read approved workspace files and
   selected Driver evidence while rejecting forbidden operations; mock tests
   alone do not satisfy the live read-profile gate.
10. Direct input takes priority, stale output is not presented as current, and
    real response latency is measured with sample counts and failures.
11. Exit fixes the report's evidence cutoff. Later file/log changes cannot
    silently alter an existing report, and Compiler isolation is tested.

## Implementation Tracking

Use `docs/implementation-plan.md` for eight verifiable implementation milestones.
GitHub issues track those milestones, while development and live tests run
locally with GitHub Copilot. An issue may span several work sessions; do not
assume one prompt, one uninterrupted model run, or a hosted coding-agent
environment can satisfy every gate.
