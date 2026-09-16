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

**AI Pair**:
The bounded conversational partner that surfaces assumptions, alternatives,
counterexamples, constraints, and minimum necessary explanation. It neither
makes the final choice nor authors or sends AI Driver instructions.
In discussion, it contributes a useful observation, question, tentative concern
or small suggested check, then returns the conversational turn to the human.
It need not complete a solution or provide a self-contained explanation each
time. Plausible concerns can be raised without exhaustive evidence, but remain
clearly distinguished from verified facts. It carries the human's responses,
choices and objections forward rather than anticipating every follow-up.
General discussion stays general; repository inspection is not a default ritual.
Questions are optional, not an interview. Direct answers, comprehensive
explanations and evidence-based verification remain available when requested.

**Pairing Session**:
A voluntary, user-initiated period in which the Human Navigator asks the AI
Pair to help examine one or more engineering judgments. It may begin without
an AI Driver connection and may end while AI Driver work continues.

**Shared Scope**:
The task context, conversations, files, results, and other evidence that the
Human Navigator allows Wellactually to use: the current project when sending
the first Pair message, plus one Driver session selected in settings.
The scopes are the complete project tree and the selected session's records
and artifacts. SDK sessions use a dedicated directory; ordinary VS Code Chat
uses an exact transcript file and its session-specific editing directory.
The shared parent containing unrelated chats is not included.
No separate start or repeated workspace-consent wizard is required.

**Session Focus**:
The current uncertainty or engineering judgment that the Human Navigator and AI
Pair agree to examine.

**Deliberation Loop**:
A bounded exchange in which the Human Navigator and AI Pair examine evidence,
assumptions, alternatives, and constraints. Sending a Driver Instruction ends
one loop turn but does not end the Pairing Session.

**Driver Instruction**:
The task direction that the Human Navigator writes and sends to the AI Driver in
the existing Driver interface. It records human judgment and is never generated
or rewritten by the AI Pair.

**Driver Result**:
The AI Driver's reported outcome and available supporting evidence for a Driver
Instruction. It may be complete, incomplete, failed, still running, or not yet
verified.

**Result Review**:
The Human Navigator's interpretation of a Driver Result, optionally supported by
the AI Pair, that distinguishes observed evidence from reported or unverified
claims and leads to the next human choice.

**Knowledge Compilation**:
A historical idea for a post-conversation retrospective, removed from the
prototype on September 16. It is not an optional current feature; there is no
Compiler or report generation.

**Knowledge Report**:
A historical HTML export from earlier versions. Existing exported files are
user-owned and remain untouched; the current prototype does not create reports.

**Verification Level**:
The status that distinguishes what was discussed, explained by the human,
reported by the AI Driver, observed in a tool result, or left unverified.

**Behavior Proxy**:
An observable session event that may support later product evaluation without
being treated as evidence of competence, retention, productivity, code quality,
or long-term learning.

## Current Integration Decision

The September 16 prototype uses one persistent Copilot SDK Pair.
The first message starts it against the current trusted local project.
Existing SDK or VS Code authentication is reused when available; interactive
account access is only a fallback, not a mandatory onboarding step.

The Pair has two read-only scopes: the current project and the selected Driver.
An SDK Driver shares its complete dedicated session directory.
A standard VS Code Copilot Chat shares its original JSON/JSONL transcript and,
when present, its `chatEditingSessions/<sessionId>` directory. It does not grant
the shared `chatSessions` parent, workspace index, or sibling conversations.
Directory listings and files within authorized trees remain permitted without
filename exclusions. Paths and symlinks outside the authorized scope remain denied.
Tool output limits and supported formats are not extra permission scopes.

The human selects from a global local-session catalog by session title, project
and activity time, not a log file or first-message preview. Discovery includes
ordinary Copilot Chat indexes from every saved workspace under the current
VS Code user-data root plus the default profile's empty-window Chat index.
`chat.ChatSessionStore.index` provides titles and timing; original transcripts
remain in `chatSessions/<sessionId>.jsonl` or legacy `.json` files.
It also combines VS Code's profile-level `agent-host.db` registrations with Copilot records in
`~/.copilot/session-state` and `COPILOT_HOME/session-state` when configured.
VS Code `customTitle` and `defaultChatProviderData.sdkSessionId` metadata supply
the displayed title and the backing SDK conversation identity. SDK records use
an explicit user name or summary, never the automatically seeded first-message
name. Untitled sessions are identified as such rather than summarized by a model.

The list is globally newest-first with no current-project priority, client filter
or project filter. Registered sessions whose local records are missing remain
visible but cannot connect; stale metadata does not grant another session's
access. Catalog failures are reported. The host reads existing SQLite metadata
read-only using the macOS system reader, never conversation tables or credentials.
This is a version-dependent local adapter, not an all-provider/remote chat API.
Agent mode in an ordinary Chat panel does not imply agent-host storage.
Selection revalidates the current index and record identity: an SDK session
header, or a standard Chat snapshot's session ID. Legacy JSON is streamed to
the identity without retaining a parsed conversation or creating a copy.
the Pair then reads the original records and artifacts directly.
The host does not watch, copy,
normalize, correlate, or automatically react to Driver records. The human asks
when to review results. The SDK maintains conversational context and performs
compaction; separate cross-session Memory and search are not required.

The host owns a small chat lifecycle, streaming/cancellation, path permissions,
and a bounded transcript for display. There is no application-level
deliberation state machine, evidence journal, review-context graph, instruction
confirmation, automatic scheduler, or persistent exit-snapshot recovery.
Deliberation Loop and Result Review remain conversational concepts, not stages
the UI forces the user to advance.

Both shared trees can contain secrets; there is no automatic sensitive-file
exclusion or sanitization. Share only projects and sessions appropriate for the
Pair's model service, and use synthetic data for demonstrations.

The Secondary Side Bar contains the transcript and pinned composer. Settings
contain project information and Driver connection only. Product controls,
host messages and Pair responses use Korean; there is no language selector or
language preference. Code, identifiers and quoted source excerpts are unchanged.
The composer exposes model and reasoning selectors using the SDK's actual
inventory and model-specific supported levels. An idle conversation can switch
models without resetting its transcript or Driver connection; the next message
uses the chosen settings. Choices are remembered per workspace. Opening the view
does not invoke a model or fetch the catalog; opening a selector may require
authentication for metadata access. Unsupported reasoning levels are not offered.
The opening screen introduces AI pair programming with a product description
and read-only project-sharing disclosure, not a persistent welcome notice or
Driver-connection onboarding sentence.

Ending stops only the Pair and cleans up owned runtime resources. There is no
Knowledge Compilation, frozen report input, HTML renderer/exporter or report
cache. A new chat resets the in-memory display transcript. Prior exported HTML
and Driver logs are not deleted. Conversation activity cannot establish learning.

Direct native SDK reads of synthetic external JSONL files were demonstrated
before this revision, including late-range reads and search. A very long
single-line record was truncated. These observations do not establish
model-driven retrieval quality, universal harness support, or complete recall
after compaction. Workspace paths alone are not an authorization boundary.
