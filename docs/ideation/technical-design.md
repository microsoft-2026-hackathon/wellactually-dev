# Wellactually · Technical Design and Data Flow

<a id="top"></a>

Revised September 12, 2026 · File-based hackathon MVP

**Keep the existing Driver. The Coach uses built-in SDK read tools to work with code and selected local work records.**

Discuss with the Coach first; close one deliberation turn when the human instructs the Driver. Bring observed results into joint review, then generate a Knowledge Compilation report from frozen records when pairing ends.

File-based hackathon MVP · Current CLI/SDK log reading and incremental detection verified · Coach read-only profile not yet verified · Voice Mode excluded · Code examples: internal contracts and integration points

This revision reflects the September 12, 2026 file-access probe and hackathon scope decisions. We do not build an AHP connection or a separate Workspace Reader first. Measurements apply only to the current Copilot CLI/SDK session; they do not verify other harnesses, the future Coach's permissions, or its actual SDK integration. Code blocks illustrate contracts and core logic to implement.

Diagrams use Mermaid; code and data contracts are included directly in this document.

<a id="direction"></a>

<a id="direction-title"></a>

## 1. Design Scope

The target is developers who started building with coding agents but have had limited experience defining problems, making design judgments, and delegating work. Preserving human judgment and instruction matters more than reducing the effort of relaying requests or running tests.

KEEP AS IS

### Native Copilot Experience

- The input and response UI for talking to the Driver
- The agent harness that researches, implements, and verifies
- The harness's tool-approval and change-review UI
- Models and work requests chosen directly by the user

WELLACTUALLY'S SCOPE

### Human–Coach Conversation

- A Driver Custom Agent and a separate Coach UI
- Coach conversation that can begin before Driver binding
- Path and session verification for the selected local Driver log when delegating work
- A read-only configuration for built-in SDK file-read, listing, and search tools
- Relevant context construction and proactive Coach invocation
- Permission limits, duplicate-question suppression, and connection and cost status
- Pairing state, post-session knowledge compilation, and HTML saving

**MVP reductions:** No dedicated Workspace Reader or general-purpose session Reader framework. Reuse existing SDK tools for code and log reads; start with small helpers for path verification, change notifications, and incremental JSONL processing needed for precise turn tracking and automatic interventions. Do not duplicate all raw content in a separate database.

**The human instructs the Driver directly.**

The Coach may point out missing conditions or explain options. It does not complete and forward a final instruction, or become a proxy requester that executes after approval. Coach agreement is not a prerequisite for execution.

### Verification and Feasibility

A feature in official documentation or a path in public source code does not by itself establish that the product integration works in the currently installed VS Code.

**Status terms in this document**

| Term | Meaning | Current scope |
|----|----|----|
| Local measurement | Read the current session's actual file and detected new output. | JSONL record reading, toolCallId correlation, detection about 249ms after output, and rereading after watcher exit |
| MVP design | An implementation direction selected on the basis of measurements. | Built-in SDK read/search, selected Driver log, minimal change trigger, and separately frozen report input |
| Verification needed | Not established by this probe. | Read-only tool and path permissions, other Copilot harnesses, large outputs, log rotation, and Host restart |

<a id="system-overview"></a>

<a id="system-overview-title"></a>

## 2. System Overview

Reuse the existing Driver's local records and the current code workspace. File changes trigger coaching; actual reads use SDK tools and only the incremental processing needed. Freeze post-session Compiler input separately.

``` mermaid
flowchart TB
    subgraph existing["Native VS Code / Copilot"]
      ui["Existing Copilot Driver UI<br/>Human input, sending, and approval"]
      driver["Existing Driver Runtime<br/>Measured: Copilot CLI / SDK"]
      log["events.jsonl<br/>Selected-session requests, responses, tool arguments and results"]
      workspace["Current Code Workspace<br/>Built-in SDK read/search tools"]
      ui <-->|"Existing UI and session link"| driver
      driver -->|"Local record storage"| log
    end
    subgraph extension["Wellactually extension · UI + Host"]
      controller["Coach UI · Session Controller<br/>WebviewView + Extension Host"]
      trigger["File Trigger · Context Builder<br/>Minimal increments / deduplication / call limits"]
      journal["Conversation · Evidence · Decisions<br/>Driver records + code reads + conversation and decisions"]
      trigger -->|"Relevant context → coaching check"| controller
      trigger -->|"Observed evidence"| journal
      controller -->|"Conversation"| journal
    end
    subgraph runtimes["Separate AI sessions + report artifacts"]
      coach["Independent Coach Session<br/>SDK file read/search + role instructions"]
      compiler["Knowledge Compiler<br/>Returns structured report data"]
      report["HTML Report<br/>Extension validation, template, optional save"]
      compiler -->|"Schema check"| report
    end
    log -->|"File change / increment"| trigger
    controller <--> coach
    coach -->|"Authorized SDK read/search"| workspace
    coach -->|"Shared-log reads"| log
    journal -->|"Evidence frozen at exit"| compiler
```

The diagram emphasizes the Coach's data-access paths. Driver code changes and execution keep their existing UI and permissions. Current log-file reading and change detection are verified; the new Coach read profile and other harness support are not.

There is no Coach → Driver execution path; exclude edit, shell, and Driver-control tools. Reuse SDK tools without a separate Reader; keep AHP as a future alternative.

Only the current file-access PoC is verified; the read-only profile still needs verification. Pause and exit stop automatic interventions; disclose missing records and connection failures.

<a id="architecture"></a>

<a id="architecture-title"></a>

## 3. Modules and Data Contracts

Do not duplicate existing Driver execution. Read the workspace with built-in SDK tools, and attach needed records from the selected local session log and actual read results to the Journal. The Controller manages state and triggers; the Compiler receives only input frozen at exit.

``` mermaid
flowchart TB
    subgraph native["Existing Driver"]
      chat["Native Copilot Chat<br/>Direct human instruction and approval"]
      driver["Existing Driver Runtime<br/>Measured: Copilot CLI / SDK"]
      workspace["Workspace<br/>Code changes and tests"]
      chat <--> driver
      driver --> workspace
    end
    subgraph extension["Wellactually modules"]
      controller["Pairing Controller<br/>State, turns, binding, and exit"]
      log["Selected Driver Log<br/>events.jsonl · needed new segments"]
      view["Coach WebviewView<br/>Input, responses, and status"]
      journal["Evidence Journal / Store<br/>Source, order, version, confirmed decisions"]
      scheduler["Context Builder / Scheduler<br/>Evidence, request priority, and budget"]
      coach["Coach Runtime / Policy<br/>Built-in read tools, read scope, and Lease"]
      frozen["Frozen EvidenceSnapshot<br/>Immutable input at exit"]
      compiler["Knowledge Compiler<br/>Snapshot → structured data"]
      exporter["Validator / Renderer / Export<br/>Validate → HTML → user-selected save"]
      view <--> controller
      controller -->|"Select / detect changes"| log
      controller --> journal
      log --> journal
      journal --> scheduler
      scheduler --> coach
      journal -->|"User exit → Journal @ cutoff"| frozen
      frozen --> compiler
      compiler --> exporter
    end
    driver -->|"Local file records"| log
    coach -->|"Built-in SDK read/search"| workspace
```

Lines show major data and control paths. See [07 Sequences](#experience) for time-ordered requests and responses. The Webview owns UI; the Extension Host owns the Controller, observation, scheduling, and storage. The SDK connects to a separate Copilot runtime.

Only the file-access PoC is verified. The SDK read profile still needs verification; do not add AHP or a Workspace Reader to the MVP.

Proposed directories · dependency direction

``` text
src/
  extension.ts                 # Dependency assembly, registration, disposal
  domain/pairing.ts             # SDK-independent state and turns
  ui/coachView.ts               # Webview message validation and rendering
  pairing/controller.ts        # Per-session serialization, Lease, and exit
  driver/localLog.ts          # Small helpers: selected log, cursor, change notices
  context/journal.ts           # Ordering, deduplication, provenance
  context/snapshots.ts         # Immutable snapshots, scope, hashes
  coach/scheduler.ts           # Direct-question priority, single flight
  coach/runtime.ts             # SDK creation, tools, cancellation, events
  compilation/compiler.ts     # Frozen input → report data
  compilation/schema.ts       # Report JSON Schema and type definitions
  compilation/validate.ts     # Schema, provenance, and status checks
  compilation/render.ts       # Fixed HTML template
  compilation/export.ts       # Save dialog and write to the selected path

UI → Controller → domain / ports
Reuse built-in SDK tools for workspace reads
Exclude AHP adapters and a separate Workspace Reader from the MVP
Compiler → FrozenSnapshot (read); no Driver client access
```

These paths describe proposed modules, not source files already created in the repository.

TypeScript · core domain DTOs (Wellactually internal contract)

``` typescript
type PairingStatus =
  | "active" | "paused" | "closing" | "closed" | "close_failed";
type IterationStage = "discussing" | "driver_pending" | "reviewing";

interface DriverBinding {
  bindingId: string;
  generation: number;
  workspaceUri: string;
  logFileUri: string;
  sdkSessionId: string;
  format: "copilot-sdk-events-jsonl";
}

interface PairingSession {
  pairingId: string;
  status: PairingStatus;
  stage: IterationStage;
  iteration: number;
  epoch: number;
  revision: number;  // External input/change version; separate from own tool results
  driver: DriverBinding | null;  // The Coach can start without a binding
}

interface Evidence {
  id: string;
  source: "human" | "coach" | "driver" | "tool" | "file";
  sourceRef: string;
  sourceVersion: string;
  recordedAt: string;
  completeness: "complete" | "partial" | "in_progress";
  text: string;
}

interface Decision {
  id: string;
  status: "proposed" | "human_confirmed" | "revised";
  choice: string;
  reason: string;
  evidenceIds: readonly string[];
}

interface EvidenceSnapshot {
  readonly snapshotId: string;
  readonly pairingId: string;
  readonly revision: number;
  readonly cutoff: number;  // Last included sequence number in the extension Journal
  readonly sha256: string;
  readonly coverage: {
    readonly driver: "unbound" | "current" | "partial";
    readonly gaps: readonly string[];
  };
  readonly evidence: readonly Readonly<Evidence>[];
  readonly decisions: readonly Readonly<Decision>[];
}
```

`pairingId` differs from the log's SDK sessionId. Bind only after checking the selected file's session metadata; a filename alone does not identify the current Driver. `cutoff` is the inclusion boundary in our Journal, distinct from a file byte cursor.

### Snapshot Immutability

Validate and serialize copied DTOs, then place them in read-only storage. A type-level `readonly` does not provide runtime immutability. The hash checks input integrity, not factual truth.

### Independent States

Manage pairing, Driver work, and report Job states separately. Driver completion does not end pairing; Compiler failure is not Native work failure.

### Verified and Supported Environments

File access was verified in the current conversation's **Copilot CLI/SDK session**. Do not assume other Native Copilot harnesses share its paths, format, or retention coverage. Target the verified execution mode first for the hackathon and keep the existing Driver UI. Recompare file access and AHP when widening support. <a href="#source-01" aria-label="Source 1: harness distinctions">[1]</a>

UI: existing Driver UI · Measured: Copilot CLI/SDK · Role: wellactually Driver · Model: user-selected

<a id="driver"></a>

<a id="driver-title"></a>

## 4. Driver Binding and Instruction Boundaries

The Driver is not deliberately weakened. It researches and implements competently within the delegated scope, while returning consequential product-policy and scope changes to the human.

### Packaged Driver Agent

`contributes.chatAgents` can provide an agent file from the extension package; users need not copy it into each project. The following is part of a future package configuration, not a setting currently applied. <a href="#source-02" aria-label="Source 2: Custom Agent contribution">[2]</a>

``` json
{
  "contributes": {
    "chatAgents": [
      { "path": "./agents/driver.agent.md" }
    ]
  }
}
```

Base the role body on the Driver persona instructions. Do not mix Coach instructions into shared project instructions that also apply to the Driver.

**Coach-first:** The user first shares task context and scope with the Coach. Bind the selected session's log path when delegating to the Driver. Read existing records as initial context, but do not treat old instructions as new sends in the current turn.

**Driver role and configuration boundaries**

| Item | Design | Caution |
|----|----|----|
| Work request | The human writes and sends it in the native Chat input. | No separate Driver-send button in wellactually. |
| Implementation discretion | The Driver handles implementation details that do not change the goal. | It does not also decide consequential design or policy changes for the human. |
| Tools and approval | Use the selected harness's tool settings and approval system. | Persona text alone cannot enforce file or command permissions. |
| Coach relationship | Do not automatically inject the separate Coach conversation as Driver instructions. | No indirect forwarding through Handoff, additional context, or shared instruction files. |

**Do not assume an empty tool list means “deny every tool.”**

In the inspected Copilot Agent Host conversion source, a Custom Agent's empty `tools: []` becomes a value allowing all tools. Do not assume Local and Agent Host interpret settings identically; test the tools actually exposed. This is also a different layer from the SDK session's `availableTools` setting discussed below. <a href="#source-03" aria-label="Source 3: Custom Agent conversion">[3]</a>

<a id="session-access"></a>

<a id="session-access-title"></a>

## 5. Local Session Logs and File Probe

Project code and Driver session records are different materials. Code and diffs describe implementation state; the selected session's JSONL describes requests, responses, and tool execution. Use these two file inputs first for the hackathon; consider other connections such as AHP only if they prove insufficient.

### September 12, 2026 File Probe

**Observations limited to the current Copilot CLI/SDK session**

| Check | Measurement | Interpretation |
|----|----|----|
| Existing records | About 19.7MB, 2,720 JSONL records, zero parse errors. Current user request found | Retained conversation records were readable without having watched from the start |
| Work history | Observed user.message, assistant.message, and tool.execution_start / complete | Tool arguments and result content/detailedContent fields exist and can be correlated by toolCallId |
| New output detection | Printed a UUID generated during execution. Detected the completion result about 249ms later with 100ms file polling | File changes exposed a new result. One measurement, not a latency guarantee |
| Reread after watcher exit | Reopened the file and found the original arguments and result for the same toolCallId | Read a retained file result, not merely a transient notification |
| Access method | Only Node file reading and change detection. No AHP connection or database query | Established file-access feasibility in this environment, not the Coach permission configuration |

**Not verified:** Other Native Copilot harnesses' storage paths and formats, actual file access by a read-only Coach, external file references for large outputs, log rotation, and recovery after Host restart. The probe did not send system or authentication content to a model. It inspected structure and harmless test output rather than raw content; temporary watcher processes and scripts were cleaned up.

JSON · file-probe result summary

``` json
{
  "scope": "current Copilot CLI/SDK session",
  "recordsRead": 2720,
  "invalidJsonLines": 0,
  "toolStartCorrelated": true,
  "toolResultMarkerFound": true,
  "detectedAfterEmitMs": 249,
  "pollIntervalMs": 100,
  "retainedAfterWatcherExit": true,
  "ahpConnectionUsed": false,
  "databaseRead": false,
  "coachReadOnlyProfileTested": false
}
```

A measurement summary, not an SDK event payload. Session paths, identifiers, and log bodies are omitted from this shared document. Timings describe this single run.

### Minimal Binding Procedure

1.  ### Selected Log Identity

    Initially, the user specifies a log or selects a known path in a verified environment. Check the SDK sessionId and task context in session.start metadata; do not bind the Coach's own log. Do not start by building discovery and sharing across all session directories.

2.  ### History and New Instructions

    Use existing records as initial context and set a read cursor at a complete-line boundary. Only subsequent new user requests attach to the current deliberation turn.

3.  ### Reads and Invocation Triggers

    Allowing SDK read tools does not make the Coach automatically check for new files. Batch change notifications, read the needed segment, and let the Scheduler invoke the Coach when results are ready.

4.  ### Selected Evidence Retention

    Attach selected requests, responses, tool results, and code-read results actually used to the Journal. Do not send the entire original log on every request or duplicate it wholesale in another database.

### File-Based Internal Contract

These internal types are for small JSONL helpers, not AHP wire data or a general Reader interface. Validate original SDK event data at runtime and project only needed fields into evidence.

TypeScript · selected log and incremental processing

``` typescript
interface DriverLogRecord {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface LogCheckpoint {
  bindingId: string;
  generation: number;
  fileIdentity: string;
  completeOffset: number;  // Byte immediately after the last complete JSONL line
  lastEventId?: string;
}

type DriverLogChange =
  | {
      kind: "changed";
      size: number;
      modifiedAt: string;
    }
  | { kind: "reset_required"; reason: string };
```

SDK event id, toolCallId, byte position, and Journal sequence number are distinct identifiers. Do not treat rotation, deletion, or a partially written line as a completed new event. Do not force another harness's format into this type.

Node.js · selected-log change trigger

``` javascript
import { statSync, watchFile, unwatchFile } from "node:fs";

function watchDriverLog(logFile, intervalMs, onChange) {
  if (!Number.isFinite(intervalMs) || intervalMs < 100) {
    throw new Error("INVALID_LOG_POLL_INTERVAL");
  }
  const initial = statSync(logFile);
  if (!initial.isFile()) throw new Error("LOG_FILE_REQUIRED");
  let size = initial.size;
  let modified = initial.mtimeMs;
  const listener = current => {
    if (current.dev !== initial.dev || current.ino !== initial.ino ||
        current.size < size ||
        (current.size === size && current.mtimeMs !== modified)) {
      unwatchFile(logFile, listener);
      onChange({ kind: "reset_required", reason: "log_replaced_or_rewritten" });
      return;
    }
    if (current.size > size) {
      size = current.size;
      modified = current.mtimeMs;
      onChange({
        kind: "changed", size,
        modifiedAt: current.mtime.toISOString()
      });
    }
  };
  watchFile(logFile, { interval: intervalMs }, listener);
  return () => unwatchFile(logFile, listener);
}
```

This signals file changes, not completion of JSONL parsing or a model invocation. The path is one preverified log; connect needed incremental processing and Scheduler invocation in the callback. The probe used 100ms polling; limit actual model-call frequency separately.

New segment of selected JSONL→ Session and line-boundary checks→ Record normalization and deduplication→ Journal commit→ EvidenceSnapshot

**Observation rules · data errors must not become successful completion**

| Input | Handling | Effect on Coach and turns |
|----|----|----|
| Initial records | Read selected-session history as context; establish the baseline at a complete-line position | Do not count old user requests as new instructions |
| Repeated reads | Apply idempotently by binding, generation, and SDK event id. Use toolCallId to correlate calls and results | Prevent repeated notifications, duplicate turn closure, and duplicate evidence |
| Partial lines / in-progress results | Defer commit until the JSONL line is complete. Distinguish event completion from file-write completion | A file change alone does not mean tool success |
| Deletion / rotation / interrupted writes | Hold automatic evaluation → reverify file and session → reset the baseline as needed | Disclose unrecovered coverage. Never silently switch logs |
| Different binding / old generation | Reject and diagnose. Increment generation on rebinding | Keep other workspaces' and earlier conversations' results out of the current Coach context |

JSON · normalized Journal entry

``` json
{
  "journalSeq": 42,
  "pairingId": "pair-001",
  "bindingId": "binding-002",
  "generation": 2,
  "eventKey": "binding-002:g2:sdk-event-42",
  "evidence": {
    "id": "ev-42",
    "source": "tool",
    "sourceRef": "sdk-session-A/toolCall-3",
    "sourceVersion": "sdk-event-42",
    "recordedAt": "2026-09-12T06:30:00Z",
    "completeness": "complete",
    "text": "Description-processing results differ by language"
  }
}
```

Fictional data. We define the `eventKey` format, Evidence IDs, and local sequence numbers. Derive them from SDK events and toolCallId values actually read; the model must not invent provenance.

**File existence does not imply complete history recovery.**

Large outputs may reference separate files, and not every intermediate state is guaranteed to be retained. Check which paths, segments, and fields will be shared with SDK read tools; use only needed records as context. Unconditionally sending all raw content to a model was not verified in this probe.

### File-Based MVP Scope

Do not infer Driver intent and investigation from code files alone. Conversely, do not assume a session log describes all current code.

**Read materials and remaining checks**

| Material | Use | Caution |
|----|----|----|
| Current workspace | Read implementation, reference relationships, and code under review | Reuse built-in SDK read/search. Initial scope is saved files; do not assume unsaved editor buffers are included |
| Selected Driver log | Link requests, responses, execution arguments, and results to turns | Start with the verified JSONL format. Some fields and large-output bodies need further checks |
| Coach tool results and conversation | Record code actually read and reasons the user explained | Not automatically merged into the Driver log. Do not watch the Coach's own log as Driver input |
| Journal and exit snapshot | Freeze used evidence, decisions, and observation coverage as report input | Keep needed records, references, and content as observed, not copies of every original |

**AHP is a future option, not a prerequisite.**

Compare it when file access cannot supply required execution state, or when remote and multi-harness support and a stable query contract become necessary. This probe establishes file-access feasibility, not complete history recovery across every harness.

<a id="coach"></a>

<a id="coach-title"></a>

## 6. Coach Runtime and Intervention Scheduling

The proposed Coach uses a separate Copilot SDK runtime and conversation. Reuse the existing model and tool-calling loop, without assuming automatic sharing of the Native Driver's authentication, tools, or conversation.

### Persona, Context, and Permissions

**Three kinds of information provided to the Coach**

| Kind | Content | Handling |
|----|----|----|
| Role instructions | Problem definition, design reasoning, delegation design; exploration, debugging, and counterexamples as needed | Add the existing Coach persona as separate role instructions. |
| Task context | Human requests, Driver observations, relevant code, and confirmed decisions | Include source, session, turn, and file version. Do not treat quoted code as execution instructions. |
| Execution permissions | Readable information and callable tools | Constrain them through extension and runtime configuration, not merely a persona instruction saying “do not modify.” |

### Built-In SDK Read and Search Tools

Set the Coach's working directory to the actual project. Allowlist only file-read, listing, and search tools verified in the target SDK; restrict the path and scope of shared Driver logs. Keep `read_context_snapshot` as a helper for prior decisions and selected records, without restricting the Coach to this single tool.

**Separate read policies for Coach and Compiler**

| Aspect | Coach | Knowledge Compiler |
|----|----|----|
| Working directory | Selected project | Isolated runtime-state path |
| File access | Verified built-in SDK read/search plus explicitly shared log material | No new file reads or exploration. One snapshot from exit time |
| Changes and execution | Exclude edit, shell, and Driver-send tools | Exclude all built-in tools; permit only result-data submission |
| State storage | baseDirectory separate from the project | Separate context and memory for each Job |

SDK v1.0.13 · read tools and independent Coach session creation

``` javascript
import { CopilotClient, RuntimeConnection, defineTool } from "@github/copilot-sdk";

function createOwnedClient(host) {
  return new CopilotClient({
    connection: RuntimeConnection.forStdio(),
    mode: "empty",
    baseDirectory: host.isolatedDirectory,
    workingDirectory: host.isolatedDirectory,
    env: host.controlledRuntimeEnv,
    useLoggedInUser: false,
    gitHubToken: host.approvedToken
  });
}

async function createCoachSession(client, host) {
  const readTools = host.readOnlyBuiltinTools;
  if (!Array.isArray(readTools) || readTools.length === 0 ||
      !readTools.every(name => typeof name === "string" &&
        /^builtin:[a-z0-9_.-]+$/i.test(name)) ||
      typeof host.readOnlyPermissionHandler !== "function" ||
      typeof host.workspaceDirectory !== "string" ||
      host.workspaceDirectory.length === 0) {
    throw new Error("VERIFIED_READ_PROFILE_REQUIRED");
  }
  const readSnapshot = defineTool("read_context_snapshot", {
    description: "Read the context snapshot pinned by the host.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    defer: "never",
    skipPermission: true,
    handler: (args, invocation) => {
      if (args === null || typeof args !== "object" ||
          Array.isArray(args) || Object.keys(args).length !== 0) {
        throw new Error("EMPTY_ARGUMENT_OBJECT_REQUIRED");
      }
      invocation.signal?.throwIfAborted();
      return {
        resultType: "success",
        textResultForLlm: host.readPinnedSnapshotJson()
      };
    }
  });

  return client.createSession({
    model: host.model,
    systemMessage: { mode: "append", content: host.coachPolicy },
    workingDirectory: host.workspaceDirectory,
    configDirectory: host.isolatedDirectory,
    enableConfigDiscovery: false,
    skipCustomInstructions: true,
    enableOnDemandInstructionDiscovery: false,
    enableFileHooks: false,
    enableHostGitOperations: false,
    enableSkills: false,
    mcpServers: {},
    customAgents: [],
    skillDirectories: [],
    pluginDirectories: [],
    instructionDirectories: [],
    tools: [readSnapshot],
    availableTools: ["custom:read_context_snapshot", ...readTools],
    excludedTools: ["mcp:*"],
    onPermissionRequest: host.readOnlyPermissionHandler,
    memory: { enabled: false },
    enableSessionStore: false,
    skipEmbeddingRetrieval: true,
    embeddingCacheStorage: "in-memory",
    mcpOAuthTokenStorage: "in-memory",
    infiniteSessions: { enabled: false },
    enableSessionTelemetry: false,
    largeOutput: { enabled: false }
  });
}
```

`host.readOnlyBuiltinTools` is a list of names and behaviors actually verified in the target SDK; `readOnlyPermissionHandler` is an internal implementation that approves only reads within permitted paths and rejects everything else. Refuse startup without both. Actual SDK execution of this profile is not yet verified. The helper's `readPinnedSnapshotJson()` returns only the request's pinned context. [\[9\]](#source-09) [\[11\]](#source-11) [\[17\]](#source-17)

**Configuration alone does not verify read permissions.** A working directory is not an access-control boundary. Verify read-tool names, path decisions, and permission callback behavior in practice; do not allowlist edit, shell, or delegation tools. Remove the blanket `builtin:*` exclusion for the Coach because it needs built-in read tools. Keep it for the Compiler. Apply `skipPermission: true` only to the helper that returns Host memory.

General file-read permission does not distinguish fields inside JSONL. Before providing an actual log to the model, check for nonshared instructions or authentication information and confirm external-transmission scope. Start with a controlled test session; small helpers can prepare only needed fields and segments. Do not share the entire SDK state directory.

This example uses an extension-owned stdio runtime. It guarantees neither OS sandboxing nor zero retention. `enableSessionStore: false` disables the shared session store; it does not eliminate every ordinary conversation record. Reregister tools and permission policy on creation and recovery, and apply a separate storage and deletion policy.

**Actual SDK lifecycle APIs · pinned version**

| Call / event | Meaning | Runtime responsibility |
|----|----|----|
| `send()` | Returns a message ID | Do not treat it as response completion |
| `sendAndWait()` | Waits for session.idle or session.error | Serialize requests to the same session. May return undefined if there is no assistant message |
| `on()` | Subscribes to events and returns an unsubscribe function | Subscribe before sending; clean up at request end or disconnect |
| `abort()` | Acknowledges cancellation of an owned SDK request | Distinguish acknowledgment from settlement. Do not overlap the next pin/request before cancellation and idle are confirmed |
| `disconnect()` | Detaches the session and clears local handlers; retains disk records | The public cleanup method is disconnect, not session.close |
| `client.stop()` | Stops the owned SDK runtime, cleans up connections, and returns an error array | Check returned errors. Do not use it to stop the Native Driver Host |
| `resumeSession(id, config)` | Reconnects to an existing SDK session | Reregister tools, handlers, and restrictions. Do not resume past Coach conversation into the Compiler |

`sendAndWait`'s default 60-second timer starts after send returns; it is neither a whole-request deadline nor automatic cancellation. The Host must manage the overall deadline, cancellation, and cleanup state separately. SDK `hooks.onSessionEnd` also does not replace product pairing.end or deliberation-turn closure. [\[10\]](#source-10)

### Proactive Coaching Flow

The extension decides when to request evaluation; the Coach decides whether a question is needed and what it should ask. Do not replace that judgment with rules that attach a fixed sentence whenever “cache” appears.

New request, result, or condition→ Context building and deduplication→ Coach evaluation→ Question, explanation, or no intervention

- Batch events arriving close together; run only one automatic check at a time per Coach session.
- Prioritize direct user questions over automatic checks.
- Do not repeat answered or deferred questions unless their evidence changes.
- Distinguish a failed automatic evaluation from a judgment that no intervention is needed.
- Do not impose a uniform explanation-length limit. A short question may lead to a longer explanation and follow-up conversation.

JavaScript · late Coach response guard

``` javascript
function decideReply(session, lease, reply, audit) {
  if (reply.snapshotId !== lease.snapshotId) {
    throw new Error("REPLY_SNAPSHOT_MISMATCH");
  }
  const current =
    session.status === "active" &&
    session.pairingId === lease.pairingId &&
    session.epoch === lease.epoch &&
    session.revision === lease.revision;

  if (!current) {
    audit({ type: "coach.reply.discarded", reason: "superseded" });
    return { kind: "discarded", reason: "superseded" };
  }
  return {
    kind: "publish",
    pairingId: lease.pairingId,
    epoch: lease.epoch,
    revision: lease.revision,
    text: reply.text
  };
}
```

The `lease` captures `{ pairingId, epoch, revision, snapshotId }` at request start. snapshotId identifies the base conversation context; additional file evidence read through the SDK during this request is attached separately to the Journal. Incrementing input revision for the request's own tool results would discard every read-based response, so distinguish these changes. Update revision for user input, new Driver results, and known external-context changes. Make the decision and commit in the same serialized section.

**Scheduler policy · delays, cooldowns, and call budgets are tunable settings**

| Situation | Execution rule | State handling |
|----|----|----|
| Direct question | Prioritize over automatic evaluation. One request at a time in the same SDK session | Cancel and settle the automatic request before starting. Do not mix with an unsettled request |
| Consecutive Driver log changes | Batch and deduplicate complete new records → one evaluation | Discard earlier replies with an outdated input revision. Do not retrigger from the Coach's own log or read results |
| No intervention needed | Treat as a valid model judgment | Do not turn errors or timeouts into “nothing to say” |
| pause / end / rebinding | Increment epoch, invalidate queued Jobs, and cancel owned Coach requests | Block late replies. Do not cancel Driver work |

SDK tools read code as it exists at tool-call time. The hackathon MVP does not guarantee an atomic snapshot of the entire workspace. Record actual read results, times, and available versions; reconsider against new context when later changes become known. Only the exit report is restricted to frozen input.

**The main conversation is problem definition → design reasoning → delegation design.**

Code and errors can provide evidence during work, but attaching a review to every diff is not the point. Nor must every small request repeat a mandatory three-stage questioning sequence.

<a id="experience"></a>

<a id="experience-title"></a>

## 7. Pairing States and Execution Sequences

Manage deliberation-loop turns separately from the full pairing lifecycle. Message names below are internal operation names. The human sends Driver requests directly in the existing UI; new requests and results are linked from the selected log. The Coach reads code with built-in SDK tools.

``` mermaid
sequenceDiagram
    actor User as Human / UI
    participant Controller as Controller / Log
    participant Coach as Coach Runtime
    participant Driver as Driver / Session Log
    participant Store as Journal / Snapshot
    User->>Controller: start + shared context
    Controller->>Store: Commit human input → snapshot S1
    Controller->>Coach: run(lease, S1)
    Coach-->>Controller: Reply → Lease check → UI
    Note over User,Store: The human's instruction send closes one deliberation-loop turn
    User->>Controller: Select Driver log
    Controller->>Driver: Verify log baseline; start change detection
    User->>Driver: Human sends instruction directly in the existing Driver UI
    Driver-->>Controller: File: new request / source and turn linkage
    Controller->>Store: iteration N → driver_pending
    Driver-->>Controller: Read logged responses and tool results
    Controller->>Store: Evidence commit → snapshot S2
    Controller->>Coach: review(lease, S2)
    Coach-->>Controller: Review question / explanation → UI
    User->>Controller: Next work → iteration N+1
```

The Driver / Session Log lane groups existing execution with its stored records. Joint review references the same Driver evidence; additional Coach code reads and interpretations are recorded as separate sources. S1 and S2 are base conversation context, not atomic copies of the entire workspace.

The Coach and human reference the same Driver evidence in S2. Observing a result never automatically sends the next instruction.

### Pairing Lifecycle and Turn State

``` mermaid
stateDiagram-v2
    direction LR
    active --> paused: pause
    paused --> active: resume
    active --> closing: end
    paused --> closing: end
    closing --> closed: Cleanup succeeded
    closing --> close_failed: Cleanup failed
    close_failed --> closing: Retry
    note right of active
      Unbound Driver allowed
      Manage stage separately:
      discussing → driver_pending → reviewing
      Increment iteration when the next discussion starts after review
    end note
    note right of closing
      Freeze cutoff; block new input
    end note
```

**Internal events handled by the Controller**

| Event | State and data changes | Caution |
|----|----|----|
| `pairing.start` | New pairingId, active/discussing, driver=null, iteration=1 | Do not reuse an SDK/Driver sessionId as pairingId |
| `driver.bind` | Verify selected log and SDK sessionId, increment generation/epoch, establish initial complete-line baseline | Validate the path; do not bind the Coach's own log or another session |
| `directive.confirmed` | Link an actual new Native request to the turn. discussing → driver_pending | Exclude drafts, historical messages, and Coach suggestions. Leave unclear authorship/turn linkage unclassified until user confirmation |
| `driver.result` | Commit evidence from the same binding; create a joint-review snapshot | Result existence means neither success nor user understanding |
| `iteration.begin` | When the human chooses next work: reviewing → discussing, iteration+1 | Do not increment on every message or let the model independently finalize a new goal |
| `pairing.pause` | Increment epoch; invalidate queued Jobs. Initial policy proposal: stop both log watching and automatic coaching | Recheck file, session, and cursor on resume. Unrecovered segments mean coverage=partial |
| `pairing.end` | closing → freeze → log-watcher and Coach cleanup → closed or close_failed | Do not wait for Driver completion. Neither file-detection failure nor SDK idle means end |

JavaScript · exit ordering (internal ports)

``` javascript
async function closePairing(pairingId, services) {
  const frozen = await services.controller.freezeForClose(pairingId);
  // Under the same lock: closing, epoch increment, and finalized cutoff/snapshot.
  services.scheduler.stop(pairingId);

  const operations = ["logWatch.stop", "coach.closeOwnedRuntime"];
  const cleanup = await Promise.allSettled([
    Promise.resolve().then(() => services.logWatch.stop(pairingId)),
    Promise.resolve().then(() => services.coach.closeOwnedRuntime(pairingId))
  ]);
  const failures = cleanup.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ operation: operations[index], error: result.reason }]
      : []
  );

  await services.controller.finishClose(
    pairingId, frozen.closeToken, failures
  );
  const reportJob = await services.reports.enqueueOnce({
    pairingId,
    snapshotId: frozen.snapshotId,
    compilerVersion: "knowledge-v1"
  });
  return { snapshotId: frozen.snapshotId, reportJob };
}
```

`freezeForClose` is an internal port that blocks input and finalizes epoch, Journal cutoff, and immutable report input. On failure, show close_failed and retry with the same cutoff. `logWatch.stop` removes only our watcher on the selected file. `closeOwnedRuntime` cleans up only the owned Coach; `finishClose` records failures. Neither stops Driver execution nor deletes the original log.

**Exit boundary:** Driver output and late Coach replies arriving after closing do not enter the closed snapshot. Callbacks check pairingId, epoch, and generation. Updating a report with new material requires a new snapshotId and Job. Report failure does not reopen an already closed pairing.

**Reading a sent request differs from reading an unsent draft.**

Do not intercept unsent drafts in the existing Driver input. Discuss with the Coach before sending; use logs to inspect stored requests and results after sending to the Driver. Information not yet visible because of log format or write delay remains unverified.

<a id="knowledge"></a>

<a id="knowledge-title"></a>

## 8. Knowledge Compilation and HTML Artifacts

A separate Job transforms closed-pairing records into a learning report. Input is one frozen EvidenceSnapshot; model output is structured data. Do not delegate HTML authoring, file writing, or Driver control to the model.

``` mermaid
flowchart LR
    snapshot["FrozenSnapshot<br/>snapshotId / cutoff / hash"]
    compiler["Compiler<br/>Structured data only"]
    validator["Validator<br/>Schema / source ID / verification level"]
    renderer["HTML Renderer<br/>Fixed template + escape"]
    exporter["Save Dialog / Export<br/>User-selected path"]
    snapshot --> compiler
    compiler --> validator
    validator --> renderer
    validator -->|"Validation failure → bounded retry with the same input"| compiler
    renderer -->|"ready"| exporter
```

LLM input: allowed evidence + decided/open choices + generation policy. The model neither looks up extra evidence autonomously nor modifies external files.

The closed snapshot stays unchanged. Saving failure retries export only; report failure does not block Driver work.

### Frozen Input

Coverage is `journalSeq <= cutoff`. Exclude results arriving after exit; record in-progress tools and observation gaps in coverage. Never change content mapped to a snapshotId.

### Execution Isolation

The initial proposal is one independent SDK session per report Job. Do not continue the existing Coach conversation; permit only the frozen snapshot. Duplicate requests for the same snapshot and Compiler version resolve to the same Job.

SDK · structured-result submission tool

``` javascript
import { defineTool } from "@github/copilot-sdk";

function createReportOutputTool(reportJsonSchema, snapshot, job) {
  return defineTool("emit_session_report", {
    description: "Submit the report for this frozen snapshot.",
    parameters: reportJsonSchema,
    defer: "never",
    skipPermission: true,
    isTerminal: true,
    handler: (args, invocation) => {
      invocation.signal?.throwIfAborted();
      const report = validateKnowledgeReport(args, snapshot);
      job.acceptReportOnce(report);
      return "accepted";
    }
  });
}
```

`reportJsonSchema` and `job.acceptReportOnce` are internal implementations. The former matches the DTO below; production code should maintain one definition shared with runtime validation. The latter checks Job state and snapshotId and rejects duplicates and post-cancellation submissions. This tool submits validated data to Host memory; it does not write files.

SDK · Compiler-only tool allowlist

``` javascript
function createCompilerSession(
            client, isolationConfig, compilerPolicy, readFrozenSnapshot, emitReport,
            isolatedDirectory
          ) {
            if (typeof isolatedDirectory !== "string" || isolatedDirectory.length === 0) {
              throw new Error("COMPILER_ISOLATED_DIRECTORY_REQUIRED");
            }
            return client.createSession({
              ...isolationConfig,
              workingDirectory: isolatedDirectory,
              configDirectory: isolatedDirectory,
              systemMessage: { mode: "append", content: compilerPolicy },
    tools: [readFrozenSnapshot, emitReport],
    availableTools: [
      "custom:read_context_snapshot",
      "custom:emit_session_report"
    ],
    excludedTools: ["builtin:*", "mcp:*"],
    onPermissionRequest: () => ({ kind: "reject" })
  });
}
```

`isolationConfig` reuses the ambient-configuration disabling and memory/storage restrictions in 06. Explicitly override the working directory and permissions above so the Compiler inherits neither the project directory nor the Coach's read access. The read tool captures only one exit snapshot; it does not reuse live files or a past Coach SDK session.

**Model text is not the success condition.** No `response_format`-style session option was found in the pinned SDK source, so none is used here. A successful terminal tool may end the turn without an assistant message. After session completion, check for an accepted report object; fail with `NO_REPORT_SUBMITTED` if none exists. [\[9\]](#source-09) [\[10\]](#source-10)

Frozen data is not trusted instruction. Treat instructions embedded in Driver responses, code, and logs only as evidence; do not execute them. Limit Compiler `skipPermission` exceptions to snapshot reads and Host-memory submission.

TypeScript · report data and Job contracts

``` typescript
type KnowledgeBasis =
  | "discussed"
  | "human_explained"
  | "execution_observed"
  | "unverified";

interface KnowledgeItem {
  title: string;
  before: string;
  after: string;
  why: string;
  appliesWhen: string;
  limits: readonly string[];
  basis: KnowledgeBasis;
  evidenceIds: readonly string[];
}

interface KnowledgeReport {
  schemaVersion: 1;
  pairingId: string;
  snapshotId: string;
  title: string;
  items: readonly KnowledgeItem[];
  openQuestions: readonly string[];
}

interface ReportJob {
  jobId: string;
  snapshotId: string;
  compilerVersion: string;
  attempt: number;
  state:
    | "queued" | "generating" | "validating"
    | "ready" | "failed" | "cancelled" | "no_material";
  error?: {
    stage: "generate" | "validate" | "render";
    code: string;
  };
}
```

All are internal contracts. Export has separate state. A validated ReportJob remains ready after a save error; do not invoke the model again.

**Verification levels · not learning certification**

| basis | Required evidence | What it does not mean |
|----|----|----|
| `discussed` | The human–Coach conversation addressed the topic | An explanation does not establish that the user learned it |
| `human_explained` | A record of the user expressing their own reasons and conditions | An agreement button or “yes” alone does not establish independent understanding |
| `execution_observed` | A completed tool execution result was actually observed | Observing a test run differs from achieving the entire goal |
| `unverified` | An explanation or report exists, but verification remains | A Driver success claim alone does not raise it to verified |

JSON · compilation-result example

``` json
{
  "schemaVersion": 1,
  "pairingId": "pair-001",
  "snapshotId": "snapshot-042",
  "title": "Cache keys and freshness decisions",
  "items": [{
    "title": "Include inputs that change results in the cache key",
    "before": "Planned to use only the product ID as the key",
    "after": "Use both product ID and request language",
    "why": "Description-processing results differ by request language",
    "appliesWhen": "Reusing processed results for combinations of inputs",
    "limits": ["Check separately for authentication-dependent or user-specific results"],
    "basis": "human_explained",
    "evidenceIds": ["ev-08", "ev-42"]
  }],
  "openQuestions": ["Cache entry limit and eviction policy"]
}
```

In this fictional snapshot, ev-08 refers to a human statement and ev-42 to a tool result. Actual Jobs reject citations outside the allowed Evidence ID set.

JavaScript · schema, provenance, and verification-level validation

``` javascript
function requireObject(value, keys) {
  if (value === null || typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error("REPORT_SCHEMA_INVALID");
  }
}

function requireText(value, max = 2000) {
  if (typeof value !== "string" ||
      value.trim().length === 0 || value.length > max) {
    throw new Error("REPORT_TEXT_INVALID");
  }
}

function requireTextList(value, max) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error("REPORT_LIST_INVALID");
  }
  value.forEach(text => requireText(text));
}

function validateKnowledgeReport(value, snapshot) {
  requireObject(value, [
    "schemaVersion", "pairingId", "snapshotId",
    "title", "items", "openQuestions"
  ]);
  if (value.schemaVersion !== 1 ||
      value.pairingId !== snapshot.pairingId ||
      value.snapshotId !== snapshot.snapshotId) {
    throw new Error("REPORT_INPUT_MISMATCH");
  }
  requireText(value.title, 200);
  requireTextList(value.openQuestions, 24);
  if (!Array.isArray(value.items) ||
      value.items.length === 0 || value.items.length > 24) {
    throw new Error("REPORT_ITEMS_INVALID");
  }
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const bases = new Set([
    "discussed", "human_explained", "execution_observed", "unverified"
  ]);

  for (const item of value.items) {
    requireObject(item, [
      "title", "before", "after", "why", "appliesWhen",
      "limits", "basis", "evidenceIds"
    ]);
    for (const key of ["title", "before", "after", "why", "appliesWhen"]) {
      requireText(item[key]);
    }
    requireTextList(item.limits, 12);
    requireTextList(item.evidenceIds, 24);
    if (!bases.has(item.basis) || item.evidenceIds.length === 0 ||
        new Set(item.evidenceIds).size !== item.evidenceIds.length) {
      throw new Error("REPORT_BASIS_INVALID");
    }
    const refs = item.evidenceIds.map(id => {
      const ref = evidence.get(id);
      if (!ref) throw new Error("UNKNOWN_EVIDENCE_ID");
      return ref;
    });
    const completeHuman = refs.some(ref =>
      ref.source === "human" && ref.completeness === "complete");
    const completeTool = refs.some(ref =>
      ref.source === "tool" && ref.completeness === "complete");
    const conversation = refs.some(ref =>
      ref.source === "human" || ref.source === "coach");
    if ((item.basis === "human_explained" && !completeHuman) ||
        (item.basis === "execution_observed" && !completeTool) ||
        (item.basis === "discussed" && !conversation)) {
      throw new Error("EVIDENCE_BASIS_MISMATCH");
    }
  }
  return structuredClone(value);
}
```

Limits are initial design examples. Also enforce a response-byte limit before accepting JSON. The input snapshot must be an immutable object whose types, unique Evidence IDs, and hash have been validated by the Store. This check verifies structure, IDs, and source kinds; it proves neither that a claim follows logically from evidence nor that the user learned it. Mark validation errors as Job failures.

JavaScript · fixed-template HTML rendering

``` javascript
function escapeHtml(value) {
  const entities = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

function renderKnowledgeReport(raw, snapshot) {
  const report = validateKnowledgeReport(raw, snapshot);
  const usedIds = [...new Set(report.items.flatMap(item => item.evidenceIds))];
  const numbers = new Map(usedIds.map((id, index) => [id, index + 1]));
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const labels = {
    discussed: "Discussed",
    human_explained: "Explained by the human",
    execution_observed: "Execution evidence observed",
    unverified: "Reported / explained, not verified"
  };
  const list = values => values.map(text =>
    `<li>${escapeHtml(text)}</li>`).join("");

  const sections = report.items.map(item => {
    const refs = item.evidenceIds.map(id =>
      `<a href="#e-${numbers.get(id)}">[${numbers.get(id)}]</a>`).join(" ");
    return `<section><h2>${escapeHtml(item.title)}</h2>
      <p>${labels[item.basis]} · ${refs}</p>
      <p>Before: ${escapeHtml(item.before)}</p>
      <p>After: ${escapeHtml(item.after)}</p>
      <p>Reason: ${escapeHtml(item.why)}</p>
      <p>Applies when: ${escapeHtml(item.appliesWhen)}</p>
      <ul>${list(item.limits)}</ul></section>`;
  }).join("");

  const sources = usedIds.map(id => {
    const ref = evidence.get(id);
    return `<li id="e-${numbers.get(id)}">
      ${escapeHtml(ref.sourceRef)} · ${escapeHtml(ref.sourceVersion)}
      <pre>${escapeHtml(ref.text)}</pre></li>`;
  }).join("");
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>${escapeHtml(report.title)}</title>
    <style>body{max-width:900px;margin:auto;padding:24px;font:16px/1.8 sans-serif}
    pre{white-space:pre-wrap;overflow-wrap:anywhere}
    section{border-top:1px solid #ddd;margin-top:24px}</style>
    </head><body><h1>${escapeHtml(report.title)}</h1>
    <p>Snapshot: ${escapeHtml(snapshot.snapshotId)} / cutoff: ${snapshot.cutoff}</p>
    <p>Driver observation coverage: ${escapeHtml(snapshot.coverage.driver)}</p>
    <ul>${list(snapshot.coverage.gaps)}</ul>
    ${sections}<h2>Open Questions</h2><ul>${list(report.openQuestions)}</ul>
    <h2>Evidence</h2><ol>${sources}</ol></body></html>`;
}
```

A minimal template. Evidence links are internal anchors derived only from validated Evidence IDs. Do not insert model-provided HTML, URLs, or command links. Recheck the selected sharing and storage policy before exporting raw quotations.

**Failure, retry, and export contracts**

| Situation | State and action | Retry scope |
|----|----|----|
| No material to compile | Show no_material and the reason; skip model invocation | New material requires generation from a new snapshot |
| Generation / validation failure | failed(stage, code). Do not present a draft as a valid report | Bounded attempts against the same snapshot. Associate prompt, schema, and model settings with compilerVersion |
| User cancellation | Cancel only that Compiler request; show cancelled | Explicit retry. No effect on the Native Driver |
| HTML ready | ready. Offer preview and save | Keep HTML after a cancelled or failed save; retry export only |
| Save-path selection | Use the extension's save dialog; confirm overwrite and write only to the selected path | Show permission and path errors. Do not save to a model-selected path |
| Later Driver result | Keep the existing snapshot and report; do not silently merge late material | A user-requested update gets a new snapshotId and generation history |

<a id="boundaries"></a>

<a id="boundaries-title"></a>

## 9. Permissions, Errors, and Storage Boundaries

Being able to read a file does not verify appropriate read-only permissions. Check the Coach tool allowlist, permitted paths, and which log content reaches the model separately. Not using AHP does not remove these boundaries.

**Boundaries for extension integration and the Coach**

| Target | Allowed | Blocked / caution |
|----|----|----|
| Log helpers | Selected-file metadata, needed increments, and change detection | No discovery of other sessions, source modification/deletion, or Driver send/cancel/approval |
| Coach tools | Verified built-in SDK read/search and context helper reads | Exclude edit, shell, delegation, and Driver-control tools. General read permission does not distinguish sensitive fields within a log |
| Compiler tools | Exit-snapshot reads and validated report-data submission | Exclude all built-in tools. No new exploration of the live workspace or Driver log |
| UI and content | Questions, explanations, provenance, and connection status | Do not execute HTML or command links in model Markdown. Arbitrary Webview messages do not constitute approval |
| Shared materials | Selected Driver conversation and relevant files | Do not automatically attach other sessions, secret files, tokens, or the entire environment |

A working-directory setting is not an OS sandbox. Separately allow only the selected path for session records outside the workspace; test symlinks, path traversal, and actual SDK permission callback behavior. Exclude nonshared instructions and authentication information from model input, ordinary logs, and reports.

### Record and Context Provenance

- Record human requests, Driver responses, external file changes, and Coach suggestions as distinct sources.
- Record actual file content, ranges, read times, and available versions or hashes. Do not claim MVP SDK file reads include unsaved editor buffers.
- Do not attribute a file change to the Driver when its author is unknown.
- Do not automatically save Coach suggestions as agreed decisions. Link them to human confirmation.

### Explicit Failure States

Log-read and change-detection failures must not block Driver execution. Disclose the failed source path and missing coverage; do not recover by resending or cancelling Driver requests.

**Representative failures and handling**

| Situation | Handling | Prohibited response |
|----|----|----|
| Log-read failure / replacement | Stop automatic evaluation; show the last read position. Reverify file/session and record gaps | Resend Driver requests or silently switch logs |
| Missing records or results | Disclose gaps and discuss only available evidence | Present a truncated summary as the full session |
| Coach error / usage limit | Show the error and suspended automatic-intervention state. Driver remains independently usable | Hide the error as “nothing to say” |
| Permission-decision failure | Explicitly reject and record diagnostics | Assume throwing an exception alone blocks the action |
| Coach stop / restart | Clean up only Coach work and connections. Reregister tools and policy on recovery | Stop/delete the Native Driver or reuse prior approvals |

In the inspected SDK, omitting the permission handler may leave requests pending, and a tool Hook exception may not act as an explicit rejection. A `sendAndWait()` timeout also does not automatically cancel the request. Treat error, cancellation, and completion as distinct states. <a href="#source-09" aria-label="Source 9: SDK permissions">[9]</a> <a href="#source-10" aria-label="Source 10: SDK session handling">[10]</a>

### Code Sharing and Call Costs

Disclose that a separate Coach invocation resends material even when it was already used by the Native Driver. Model calls use external services; automatic checks also consume usage. Batch calls, show usage by role, and provide stop controls, without claiming exact billing or an absolute spending cap from local accounting alone.

Do not assume the native Copilot login automatically applies to an independent SDK Coach. Use supported authentication paths; do not extract private tokens. Never send credentials to the Webview or ordinary logs. <a href="#source-13" aria-label="Source 13: SDK authentication and usage">[13]</a>

<a id="implementation"></a>

<a id="implementation-title"></a>

## 10. Implementation Order and Validation Gates

The basic file-access PoC is verified in the current CLI/SDK session. Next, verify that a read-only Coach can actually read needed code and records but cannot modify files or execute commands. AHP implementation is not a prerequisite.

### Initial Support Scope

Start with **VS Code Desktop, one trusted local workspace, one Driver session in the verified CLI/SDK log format, and a read-only SDK Coach**. The exact SDK tool and permission profile still needs verification. Voice, automatic test authoring, multiple Drivers, and remote environments are out of initial scope.

Workspace Trust is separate from consent to send material to a model. Other Native Copilot harnesses, Remote SSH, WSL, and Dev Containers require fresh checks of file locations, accessibility, and formats. Compare AHP if needed then. <a href="#source-16" aria-label="Source 16: extensions and remote environments">[16]</a>

### Extension Modules

Start with a TypeScript extension, WebviewView, Copilot SDK, and small file helpers. These are responsibility boundaries, not instructions to create independent services for each. Do not add an AHP client, dedicated Workspace Reader, or separate cloud server/database to the MVP.

**Modules implemented by the extension**

| Module | Responsibility | Boundary |
|----|----|----|
| Driver Agent Package | Contribute role instructions and usage guidance | Do not duplicate Driver UI or execution loops |
| Local log helpers | Verify selected path and SDK sessionId, signal changes, and process needed JSONL increments | No general Reader framework or Driver-control API |
| Context Builder / Journal | Link used log segments, code reads, conversation, decisions, and observation coverage | Do not copy all raw content. Distinguish own tool results from external-context changes |
| Coach Scheduler | Batch events, prioritize direct questions, deduplicate, and budget calls | The Coach decides question content |
| Coach Runtime / Policy | Built-in SDK read/search tools, path permissions, persona, stop, and recovery | Exclude modification, shell, and Driver control. Refuse startup before actual profile verification |
| Coach View | Conversation, evidence links, connection and automatic-intervention status | SDK and authentication belong in the Host, not Webview |
| Pairing Controller | Coach-first start, turn linkage, pause/end, epoch, and cutoff | Serialize per session. Separate from Native session lifecycle |
| Knowledge Compiler | Generate and validate structured reports from frozen snapshots; retry Jobs | No new-file or other-conversation exploration; no code modification |
| Report Renderer / Export | Fixed template, escaping, preview, and optional save | No recompilation on save failure; no model-selected paths |

The initial SDK review baseline is GitHub release `v1.0.13`. Pin and test the actual package, runtime, and Extension Host Node compatibility. Verify that SDK platform runtime assets are included in the VSIX; a JavaScript bundle alone may not suffice. <a href="#source-08" aria-label="Source 8: SDK release">[8]</a> <a href="#source-12" aria-label="Source 12: runtime distribution">[12]</a>

### Stage Gates

**Implementation stages and exit criteria — planned work not yet executed**

| Stage | Deliverable | Exit criteria |
|----|----|----|
| 0\. File-access PoC | Read current-session requests, responses, tool arguments/results, and detect new output | **Verified in the current CLI/SDK environment.** Not verified for other harnesses, large outputs, or restart |
| 1\. SDK read profile | Actual read/search tool names, project path, selected log, permission callback | Code and needed records are readable; writes, shell, delegation, and nonshared paths are not allowed |
| 2\. Minimal pairing and joint review | Coach-first entry, log-change trigger, minimal Journal, turns, and Lease | Correct new-instruction/result linkage. Own read results do not cause infinite reinvocation |
| 3\. Exit and knowledge compilation | freeze, Compiler, Validator, Renderer, Export | Exclude post-cutoff material, reject fabricated provenance, respect sharing scope, escape HTML, separate save errors |
| 4\. Reliability and distribution | Negative permission tests, stop/recovery, call accounting, packaging | Policy survives errors and restarts; no side effects on Native Driver work |
| 5\. Real-work evaluation | Observe selective use in real projects | Check whether questions helped judgment, the human instructed directly, and report verification levels match actual evidence |

### Next SDK Read-Profile Checks

- The Coach reads saved project files and searches needed code with built-in SDK tools.
- It reads only permitted records from the selected Driver, not other sessions, authentication files, or nonshared material.
- Edit, shell, and delegation tools are not exposed; unexpected permission requests are rejected.
- Inspect actual tool results for file content, log segments, and large-output reference formats.
- Separate Driver and Coach logs; own reads and replies do not repeatedly trigger automatic interventions.
- The Compiler uses stricter settings than the Coach, reads no new files, and consumes only exit input.

**Judge file-access sufficiency against actual material.**

If required state or results are missing, or format/access limitations prevent meeting requirements, narrow support or compare AHP and Hooks. Do not hide failures or broaden permissions just to pass. Building AHP is not itself the goal.

**Regression-test matrix · future automation criteria**

| Input / action | Expected result | Validation layer |
|----|----|----|
| Start without Driver binding | active/discussing; Coach can respond; no Driver-port calls | Controller unit |
| Historical user turn / repeated event | Treat as baseline/duplicate; turn count unchanged | Normalizer + Journal |
| Confirmed new direct instruction | Link the new logged SDK event to the current turn exactly once; driver_pending | Log helper → Controller |
| Joint review after results | Human and Coach reference the same evidence snapshotId | Integration + UI |
| pause / end / context replacement while pending | Discard and diagnose old-Lease responses; zero Native cancel calls | Scheduler + Runtime |
| Simultaneous end and result event | Serialization boundary determines cutoff inclusion; existing snapshot content unchanged | Controller + Store |
| Wrong snapshotId / nonexistent Evidence ID | Report validation fails; not exposed as a valid report | Validator unit |
| Execution claim citing only Coach speech | EVIDENCE_BASIS_MISMATCH | Validator unit |
| HTML / command links in model or source content | Render as text; no execution or external requests | Renderer + browser |
| Save cancelled / permission error | Only Export state changes; ready data retained; zero additional model calls | Export integration |
| Missing read profile / wildcard tool name | Reject Coach creation. Do not fall back to all built-in tools | SDK configuration unit |
| Coach profile reused for Compiler | Compiler explicitly restricts working directory, permissions, and tools | Compiler configuration unit |

<a id="alternatives"></a>

<a id="alternatives-title"></a>

## 11. Future Alternatives and Unverified Items

The requirement is that the Coach can use Driver work context and current code, not AHP itself. Start the hackathon with the measured local-file approach; choose alternatives after identifying missing capabilities and support needs.

**Considered configurations and current assessment**

| Configuration | Benefits and constraints | Current assessment |
|----|----|----|
| Local log + SDK read/search | Current CLI/SDK record reading and new-output detection verified. Paths, formats, and permissions depend on environment | **Preferred hackathon MVP.** Verify the actual read-only Coach profile next |
| Existing Driver + AHP + separate Coach | Structured Host-state queries, subscriptions, and reconnection contracts. Endpoint, authentication, and compatibility need checking | Revisit if files lack needed state or remote/multi-harness support becomes necessary |
| Existing Driver + Hook | Selected submission/tool events can serve as lightweight triggers, with harness-specific differences | Consider as an alternative or complement to file watching after verifying needed events |
| Separate SDK Driver and Coach | Easier input/session control, but requires rebuilding Driver UI and execution integration | Not preferred: does not preserve the native UI |
| Two Custom Agents only | Simple manual persona conversations; no automatic session observation or intervention | Useful for persona testing, not a replacement for the full product |

### AHP Boundaries

AHP is a Host-state query/subscription protocol, not storage. It can read retained past turns through snapshot/fetchTurns and subscribe to new changes, but does not guarantee permanent retention of every original event. Do not assume serverSeq increases by exactly one for a selected channel; handle reconnection through replay or snapshot. This is future reference, not the current MVP code contract. [\[6\]](#source-06) [\[18\]](#source-18) [\[19\]](#source-19)

AHP is not the only way to manage read permissions. AHP itself also has execution and approval capabilities, so separate restrictions remain necessary. Connection to the existing Host endpoint and server-enforced read-only permissions are not yet verified. [\[4\]](#source-04) [\[5\]](#source-05) [\[7\]](#source-07)

### Open Decisions

- Actual built-in SDK read/search tool names, path permissions, and rejection behavior for the Coach
- Log locations, formats, and result completeness for each supported CLI/SDK and Native Copilot execution mode
- Selected Driver-log identification UX, large outputs, log rotation, and restart handling
- Coach/Compiler models, intervention frequency, call budgets, and validation-retry limits
- Context-retention period, raw-content storage scope, and deletion method
- Log-sharing scope for model input, sensitive-field filtering, and collection of code evidence actually used
- Pause-time collection policy, remote support scope, and report quotation, retention, and deletion policies

Test-authoring assistance and remote support are future features. Do not build a dedicated Workspace Reader first for basic read/search, or make the whole MVP depend on successful AHP integration. Observing an existing Driver through files differs from recreating the Driver with an extension-owned SDK.

<a id="sources"></a>

<a id="sources-title"></a>

## 12. Official Sources and References

Links support the explanations. Finding an implementation path in source differs from running it in the current environment. This HTML opens without external scripts, fonts, or images; only following a source link visits an external site.

1.  <a id="source-01"></a>[VS Code · Agent harnesses](https://code.visualstudio.com/docs/agents/run/agent-harnesses)

    Local and Agent Host-based Copilot; the distinction between UI and execution harness.

2.  <a id="source-02"></a>[VS Code · Contribution Points](https://code.visualstudio.com/api/references/contribution-points)

    The contribution point for an extension-packaged Custom Agent.

3.  <a id="source-03"></a>[VS Code source · Copilot Custom Agent conversion](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/src/vs/platform/agentHost/node/copilot/copilotPluginConverters.ts)

    Forwarding agent configuration to the SDK and handling empty tools arrays. Source baseline: Stable 1.137.0.

4.  <a id="source-04"></a>[VS Code · Introducing the Agent Host](https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture)

    Session ownership in a separate Host, multiple clients, AHP, and external-client implementation.

5.  <a id="source-05"></a>[VS Code source · Agent endpoints](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/cli/src/commands/agent_endpoints.rs)

    An explicit discovery path exposing editor/standalone Host endpoints to trusted tools; not an extension read-only-permission API.

6.  <a id="source-06"></a>[AHP specification · Chat channel](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/chat-channel.md)

    Chat state, past-turn retrieval, live changes, and optional draft synchronization.

7.  <a id="source-07"></a>[AHP specification · Authentication](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/authentication.md)

    Connection and provider authentication; grounds for separately testing permissions across the full integration.

8.  <a id="source-08"></a>[GitHub Copilot SDK · v1.0.13 release](https://github.com/github/copilot-sdk/releases/tag/v1.0.13)

    Review baseline for SDK examples; not a direct check of the current npm latest version.

9.  <a id="source-09"></a>[Copilot SDK source · Configuration and permission types](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/types.ts)

    System instructions, tool lists, approval, memory/session store, and discovery configuration.

10. <a id="source-10"></a>[Copilot SDK source · Session](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/session.ts)

    Events, sending, waiting, cancellation, Hooks, and error handling.

11. <a id="source-11"></a>[Copilot SDK source · Client](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/client.ts)

    Runtime connection, empty-mode defaults, session creation, and resume behavior.

12. <a id="source-12"></a>[Copilot SDK · Bundled runtime](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/setup/bundled-cli.md)

    Matching runtime and platform-asset distribution. Verify actual versions and included files during packaging.

13. <a id="source-13"></a>[Copilot SDK · Authentication](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/auth/authenticate.md) · [Usage and billing](https://github.com/github/copilot-sdk/blob/bba92dda4c4c5a34340817112968bd78485df006/docs/features/usage-and-billing.md)

    Supported authentication and model-call usage. Do not assume automatic Native-login sharing or free automatic checks.

14. <a id="source-14"></a>[VS Code source · Session server tools](https://github.com/microsoft/vscode/blob/645f29cc3176500b4b5762ba887cf2a7f0ffdf2c/src/vs/platform/agentHost/node/shared/sessionServerTools.ts)

    Truncation and omitted tool results in session-context queries; differences from full-record subscriptions.

15. <a id="source-15"></a>[VS Code · Hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference)

    Observable Hook events and harness-specific limitations; not a full session-access contract.

16. <a id="source-16"></a>[Webview API](https://code.visualstudio.com/api/extension-guides/webview) · [Remote Extensions](https://code.visualstudio.com/api/advanced-topics/remote-extensions) · [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust)

    Independent UI, Extension Host location, and trust boundaries.

17. <a id="source-17"></a>[Copilot SDK · Generated RPC types](https://github.com/github/copilot-sdk/blob/f13e4a2cc7e4e220974d2333142234e162a3252e/nodejs/src/generated/rpc.ts)

    The pinned version's explicit permission-rejection kind: reject. SDK-owned session control is separate from Native Driver authority.

18. <a id="source-18"></a>[AHP · Subscriptions](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/subscriptions.md)

    subscribe channel, view, delivery, snapshots, action notifications, and server sequence contracts.

19. <a id="source-19"></a>[AHP · Connection lifecycle](https://github.com/microsoft/agent-host-protocol/blob/0d6d98392b06d1e698e20b538e99e8ed1e304935/docs/specification/lifecycle.md)

    Reconnect replay/snapshot responses, missing channels, and notifications not replayed.

The MVP was revised to a file-based approach after the September 12, 2026 probe. Measurements apply to the current Copilot CLI/SDK session, not the actual Coach read profile or every Native harness. SDK examples use v1.0.13 commit f13e4a2 as their documentation baseline. VS Code 1.137.0-related source and AHP commit 0d6d983 are future-alternative references, not claims of latest versions. Distinguish document type/logic checks, file measurements, and actual SDK integration validation.

**Wellactually · Technical Design and Data Flow** — Revised September 12, 2026. A pre-implementation design document with internal contracts and code examples.

Product definition and complete user flow · Pairing types and work progression · Target audience · Driver persona · Coach persona · Earlier SDK-centered design notes

The preferred MVP is existing Driver + local logs + built-in SDK read tools. Keep Coach-first entry, separate turn and session lifecycles, and post-session Knowledge Compilation from frozen input. AHP and dedicated Readers are not required components. Readable without external scripts, fonts, or images.

[Back to top](#top)
