# Wellactually Product Design

**Status:** Approved prototype contract, revised September 16, 2026.
The user approved SDK-first simplification, removed automatic observation and
Knowledge Compilation, and fixed the product language to Korean.
The later September 16 access decision replaces log-file selection with local
Copilot session selection and authorizes the project and selected Driver read-only.
Discovery now includes all compatible client labels and projects in that store.
The approved pairing persona prioritizes shared engineering judgment rather
than generic agent reconnaissance and exhaustive checklist answers.
This supersedes earlier report, language-selection, log-ingestion,
review-context, pairing-stage and persistent recovery requirements.

The [original Korean artifact](../wellactually-product-definition.html) and
every `docs/ideation/*-kr.*` file remain byte-for-byte unchanged as historical
sources. They may describe superseded features; this contract governs current
behavior. The maintained [target audience](../ideation/target-audience.md)
provides customer and problem framing, not a separate implementation contract.

## Customer and Value

The Primary Customer is an AI-native junior developer who can build with
coding agents but has limited experience making engineering judgments.
Wellactually helps examine assumptions, alternatives, constraints, evidence,
and verification criteria in an existing project.

The target is the judged `Hack for Agentic Coding` Executive Challenge and
Seoul Venue judging. Inspiration comes from connecting earlier human reasoning
to actual coding results; Business Value from better-informed delegation;
Customer Focus from a low-friction conversation; Feasibility from SDK reuse;
Make Something from an installed extension and a demonstrable Pair conversation.
The working demo deadline is before September 18 at 09:00 in Seoul. The global
video deadline is September 21 at 11:59 PM Pacific. Follow
[event rules](../hackathon-2026.md); no sensitive demo data or invented learning
claims.

## Roles

- The Human Navigator makes decisions and writes/sends Driver instructions.
- The existing AI Driver researches, edits, executes and verifies independently.
- The separate AI Pair explains, questions and reviews when the human asks.
  It cannot edit, execute commands, delegate, send Driver instructions, approve
  Driver operations, or stop the Driver.

Persona text is not a permission mechanism. The runtime must withhold tools
that exceed the Pair role.

### Pairing behavior

The default discussion goal is one useful contribution, not a completed answer
or solution on every turn. The Pair may notice a case, question an assumption,
raise a plausible concern or suggest a small check, then let the human respond.
Do not preempt their next decision by answering every imagined follow-up.
Carry earlier choices, objections and unresolved points into the next turn.

A hypothesis does not require exhaustive evidence before being mentioned.
Label it as unverified and do not invent risks or claim checks that did not
happen. Relevant facts remain facts, not blanket hedging. Do not turn a casual
discussion into a source audit merely to support every tentative observation.

Direct factual questions and explicit requests for explanations, comparisons,
checklists or verification still receive the needed response within the Pair's
role. Do not withhold answers to force interaction. Questions may stand alone
without an explanation-first rule, but are optional and limited to one focused
question at a time. Do not enforce a word limit, a closing question, a quiz or
a fixed template. General discussion remains general unless the user requests
project-specific work.

Use SDK `customize` for the `identity`, `tone` and `tool_efficiency` sections
rather than appending a Pair label to the default coding-agent identity or
replacing the entire system prompt. Preserve SDK safety/tool-instruction
sections and host-enforced read-only permissions. Load the persona when a new
Pair session starts; evaluate its actual behavior through a multi-turn
human/model conversation, not merely prompt-string tests.

## User Flow

1. Open the right-hand Pair view and start a discussion about a design or
   implementation concern.
2. The first message starts a Pair against the current trusted local project.
   A single workspace folder is selected automatically. For multiple folders,
   use the active editor's project or ask only when ambiguous.
3. Reuse existing authentication where supported. If no usable authentication
   is available, use the public GitHub provider rather than private caches.
   A signed-in account does not necessarily authorize every extension/runtime.
4. Discuss the engineering judgment. The Pair uses its persistent SDK session
   and reads relevant project files with SDK tools.
5. Optionally choose a Driver from the merged local VS Code/Copilot catalog.
   Show its actual title first and project/activity/source details second.
   Sort globally by recent activity without current-project priority.
   Discovery reads existing metadata, not conversation bodies. Selection checks
   the session identity/header but does not ingest subsequent records.
6. Ask the Pair to examine the Driver result. It directly reads/searches the
   selected session's records and artifacts using the ongoing conversation. There is no
   file watcher, automatic message, or background review.
7. Continue naturally. No instruction confirmation or iteration transition
   is required. Stop the current reply or end the conversation at any time.
8. Start a new conversation when needed; it resets the in-memory transcript.

There is no separate Start button, workspace-sharing wizard, mandatory Driver
connection, or report feature. Opening the view alone does not invoke a model.
A missing local project is explained; remote/virtual workspaces are not claimed.

## UI and Language

The transcript dominates the Secondary Side Bar and the composer is pinned.
Settings contain project information and Driver connection. Compact
controls expose stop, end and new chat. No evidence dashboard is required.

The input area follows familiar Copilot Chat placement: one rounded composer
with a read-only Pair role marker, model/reasoning selectors and send/stop
controls. Do not imply Agent execution, attachments or other unsupported modes.
Use SDK model metadata and supported effort levels rather than inventing options.
An idle model change preserves the same SDK conversation, transcript and Driver
scope and affects the next human message. Persist choices per workspace.
Only publish a successful live change after confirming SDK model state; report
unsupported values or unconfirmed switches explicitly. Opening the view remains
lazy; selecting a model can fetch authenticated metadata without model inference.
Changing settings must preserve drafts, caret, scroll and IME behavior.

The empty state uses an AI pair-programming heading and a short product
description, not an invitation to submit questions to an agent. It has no
persistent welcome notice or optional-Driver onboarding sentence.
Use discussion/message wording in the composer. Keep the first-message
project-sharing disclosure and meaningful operational notices/errors.

Product controls, native contribution captions, host messages and Pair
responses are Korean-only, independent of the editor locale. There is no
language preference or selector. Preserve original code, identifiers and
quoted source excerpts; do not translate them in place. Keep drafts, caret,
scroll and history through normal updates.

Enter sends, Shift+Enter adds a line, and IME composition does not send.
Incoming text does not pull the user away from older messages. Basic safe
formatting, keyboard navigation, accessible dialogs, and visible errors remain.
Webview actions are validated once before host execution. Untrusted text never
becomes executable HTML or a command URI.

## SDK and Direct File Access

Use SDK 1.0.13 / bundled CLI 1.0.83, TypeScript, Node's existing test runner and
the current native macOS Apple Silicon package. No new framework, database,
cloud backend or general reader is required.

Reuse one Pair session. Enable Infinite Sessions for compaction; separate
Memory and cross-session search remain disabled. Compaction is not guaranteed
verbatim recall. Ending deletes only owned temporary runtime data after
verified cleanup; arbitrary host-restart continuity is not promised.

Allow read-only `view` and `grep` on the current project and selected Driver.
For SDK sessions, authorize the entire dedicated Driver session directory.
For standard VS Code Copilot Chat, authorize its exact original JSON/JSONL
transcript and session-specific `chatEditingSessions/<sessionId>` tree if present.
Never grant the shared Chat directory, workspace index or sibling conversations.
Allow directory
listings and all files within them, including hidden files, dependencies,
session metadata, records and artifacts. Do not filter by filename, sensitivity
or extension. Actual SDK format support and bounded output still apply.
Resolve symlinks against the union of the two scopes; never authorize a target
outside both. Native recursive tools must not traverse external directory links.
Search may omit Git metadata during recursive traversal; explicit file access
remains authorized.

Keep automatic configuration, skills, MCP and agent discovery disabled.
Changing the connection preserves the Pair conversation and revokes the old
session's additional scope. Paths already inside the project stay readable.
Never resume the Driver session as the Pair.

The local adapter includes ordinary VS Code Copilot Chat indexes across all
saved `User/workspaceStorage` directories plus empty-window chats, using the
indexed title and timing and the original JSON/JSONL record path.
It merges these with the current profile's `agent-host.db` registry
and per-session title/backing metadata and the default and configured
`COPILOT_HOME` SDK session stores. Read discovery metadata via the macOS system
SQLite reader with fixed read-only queries; do not collect conversation bodies,
query credential tables, or expose a command tool to the Pair.
For ordinary Chat, use the indexed title and revalidate the selected record's
snapshot ID. A streaming parser discards unrelated parsed values and stops at
the identity, with a 64 MiB read limit for old JSON snapshots whose ID follows
the requests array. Report format/limit failures explicitly, never reconstruct
or substitute a conversation.
For agent-host sessions, prefer VS Code's `customTitle`; map the visible ID through
`defaultChatProviderData.sdkSessionId`, not by assuming the two IDs match.
For SDK-only entries, use an explicit user name or summary. Never use an
auto-seeded first message as a title. Show untitled entries as untitled.

Do not filter or prioritize by project or client label. Show the total count
and global recent-activity order. Registry entries with unavailable records
remain visible with an explicit status. Revalidate mapping and session header
on selection, without substituting unrelated records.
Use the maintained YAML parser and report unreadable metadata explicitly.
This is a version-dependent local format integration, not a universal remote
chat API or a general home-directory scan. Do not merge arbitrary VS Code
profiles or providers' transcript formats without separate support.

Raw log interpretation belongs to the Pair, not a host event normalizer.
Source permissions, input/output bounds and partial-output disclosure remain
host responsibilities. File changes do not prove execution success. Driver
assertions must not be represented as independently verified outcomes.

Both authorized scopes may contain sensitive material. The first-message and
session-selection UI must make the full read scope clear, including hidden and
sensitive files. Do not grant the parent session store or the whole home
directory, follow unapproved external artifacts, or imply automatic secret
removal. Reading permitted configuration files does not execute their contents.
The working directory is not an OS sandbox.

Only one human-requested turn runs at a time. Stop/end must suppress late
events, settle the owned request and report failures. No automatic scheduler,
cooldown, polling cursor, event ancestry graph or instruction-ownership state
machine is needed. No model-based synthetic preflight runs during ordinary startup.

## Transcript and End

Keep a small bounded transcript for UI, not a second semantic
memory system. Retain original user/Pair text and bounded tool excerpts
actually seen. Source labels and partial flags describe the available record.
Old display entries may be omitted at the transcript limit; the SDK manages
conversation context separately.

Ending stops the current Pair request and closes owned runtime resources.
There is no separate evidence journal, revision hash, human-decision object,
review-context graph, seven-day snapshot store, or restart recovery workflow.

Knowledge Compilation and all associated generation, validation, preview,
export, cache and frozen-input behavior are removed. This is a feature removal,
not a disabled button or hidden code path. Earlier user-exported HTML files
remain untouched. Pair suggestions are not human adoption, and discussion
does not prove learning or competence.

## Verification and Non-Goals

Verify lazy startup, SDK session reuse, whole-store Copilot session discovery
across client labels and projects, visible unstarted sessions,
directory and file access throughout both roots, external-link denial,
old-session denial after reconnect, cancellation/late events, fixed Korean language,
draft/IME behavior, safe text rendering and absence of removed controls/APIs.

Use synthetic files for tool-level tests. Distinguish those from authenticated
model-driven retrieval, compaction continuity, installed-host checks and real
human evaluation. Existing historical SDK gates do not automatically prove the
new flow. No response-speed target or new latency benchmark is required.

Not in scope: Knowledge Compilation/reports, language selection, automatic
observation, Driver control, prompt authorship, quizzes, learning scores, exact
per-reply provenance graphs, all-harness discovery, artifacts outside both
approved roots, persistent exit recovery, marketplace hardening, remote
workspaces, AHP, or a separate Workspace Reader.
