# Wellactually VS Code Extension

See the [user guide](../docs/user-guide.md) for use and the
[code reading guide](../docs/code-review.md) for implementation structure.
The [product design](../docs/specs/2026-09-12-wellactually-product-design.md)
is the current behavior contract. Controls and Pair responses use Korean;
the composer placeholder is the English branding exception
`Pair Programming with WellActually...`.

The project and extension are still **Wellactually**. The conversational role
is **Pair** in English and **페어** in the Korean interface. Existing internal
view IDs, source filenames, symbols and diagnostic codes retain their spelling
for compatibility; they are not the product-facing role name.

## Current scope

- VS Code 1.137.0+, a trusted local project, macOS Apple Silicon VSIX.
- Node `^20.19.0 || >=22.12.0`; SDK 1.0.13 / bundled CLI 1.0.83.
- One persistent read-only Pair, invoked only by human messages.
- Complete current project plus one selected Driver's original records/artifacts.
- Recent-session picker using existing metadata, without collecting or copying logs.
- Chat, source excerpts, stop, end and new chat.
- No language selector, automatic observation, Knowledge Compilation or reports.

The existing Driver is independent. Wellactually cannot write or send its
instructions, edit code, execute commands, or stop Driver work.

## Development

```sh
npm ci
npm test
npm run package
```

Use the `wellactually: build` task and **Wellactually Extension** F5 launch
configuration, or `npm run build` in this directory. The build cleans generated
`dist/` first so removed report/language modules cannot remain in the package.
On this machine, use `PATH=/opt/homebrew/bin:$PATH` if the default shell selects
unsupported Node 18.

Focused checks after building:

```sh
node --test dist/test/chat.test.js dist/test/productLanguage.test.js
node --test dist/test/coachPolicy.test.js dist/test/sdkRuntime.test.js
node --test dist/test/sdkPaths.integration.js
```

The last command uses real SDK tools with synthetic files, not model
inference. The separate Extension Host integration needs VS Code.
No additional framework, database, linter or cloud service is introduced.

The opt-in authenticated model-control check is separate:

```sh
WELLACTUALLY_LIVE_MODEL_CHECK=1 node --test dist/test/modelControls.live.js
```

It requires supported SDK authentication and account access to the tested
models, and makes two small synthetic model requests (which consume usage).
It checks real catalog normalization, low/high/none effort switching, model-
specific `grep`/`rg` tool names, selected Driver access, revoked Driver-scope
denial and conversation retention.
It does not interact with VS Code's native account-consent or Quick Pick UI.

## Pairing behavior

The Pair is an engineering judgment partner, not an autonomous coding agent
or a report generator. In discussion it adds one useful observation, question,
tentative concern or small suggested check, then lets the human respond.
It does not try to finish the topic or produce a complete explanation on every
turn. An unverified concern can be raised as a possibility without first
assembling an evidence report; it must not be presented as a verified defect.
The Pair builds on the human's responses rather than preempting their decisions.
Explicit requests for facts, detail, checklists or verification still receive
the needed response. There is no forced question, artificial brevity, hidden
answer or conversational template.

General design questions do not trigger repository reconnaissance. File reads
serve the current discussion or an explicit verification request, not a need
to prove every hunch before mentioning it. Full read authorization does not
require reading every source, but the Pair should perform relevant available
lookups when asked rather than unnecessarily redirecting them to the human.

SDK `systemMessage.mode: "customize"` replaces only three behavior sections:
`identity` from [coach.md](src/policies/coach.md), `tone` from
[coach-tone.md](src/policies/coach-tone.md), and `tool_efficiency` from
[coach-tools.md](src/policies/coach-tools.md). SDK safety/tool-instruction
sections are not replaced, and runtime read permissions are unchanged.
The policy files load when a new Pair session starts. After installing an
updated VSIX, reload the extension window and start a new conversation;
existing SDK conversations do not retroactively receive a new persona.

## Startup and authentication

Open **페어** or run **Wellactually: 페어 열기**. The opening screen introduces
AI pair programming and briefly explains Wellactually. It has no persistent
welcome notice or optional-Driver onboarding sentence. The composer invites
discussion and sends messages, rather than presenting a question form.
The full-project read-only sharing disclosure remains visible.

The first message creates
the Pair; opening the view and selecting a Driver session do not invoke a model.
A single project is selected automatically; multi-root selection uses the
active editor or a picker when ambiguous.

The private SDK runtime first attempts ambient/environment authentication.
Its private data directory does not guarantee reuse of the CLI's default
selected account. If unavailable, the host silently requests an existing
authorized VS Code GitHub session, then asks for account access only if needed.
No private credential caches are read and no token is printed or stored in
the repository. Failures remain visible.
If startup is stopped while account consent is pending, a later approval is
not used to open an authenticated Pair client for that cancelled request.
The native consent dialog itself may remain open until the provider resolves it.

The composer has model and reasoning selectors. Available models and effort
levels come from Copilot SDK metadata, not a hardcoded copy of VS Code Chat's
catalog. Policy-disabled models are excluded. A model without selectable
reasoning levels uses its own behavior; this does not mean it performs no
reasoning. Model names remain as provided by the SDK; control labels are Korean.
The wire catalog can advertise `none` even though SDK 1.0.13 omits it from its
TypeScript enum. Pair accepts it only for models that advertise support and
applies it through the model RPC. The read-only search tool may be named `grep`
or `rg` depending on the model; both names receive the same path/argument checks.
Tool inventory validation still rejects extra write, shell or other tools.
The model picker recommends current high-capability (frontier) models for
complex design discussions, with a speed/usage caveat. This is conditional
guidance, not measured Pair-quality superiority, a required model tier, or an
automatic change to the default model.

Changes are allowed while idle and take effect on the next message in the same
SDK conversation. Transcript, drafts, Pair persona, Driver connection and read
permissions remain unchanged. Switching to another model selects its advertised
default effort when available; choosing a level validates that model's support.
The live switch is confirmed against SDK model state and tool inventory.
An unconfirmed switch ends the conversation rather than sending with misleading
model labels; the error explains how to recover.

Picker choices persist in VS Code workspace state under
`wellactually.pairModel`, including across new chats. If no choice has been
stored, `wellactually.model` provides the initial model ID; the fallback is
`claude-haiku-4.5`. Opening the view is still lazy. Opening a selector may request
existing/interactive account access to fetch SDK metadata, but does not send a
message to a model. After startup, inventory requests reuse the owned client.
There is no `wellactually.language` setting; stale language settings are ignored.

## Session selection, access and lifetime

Settings contain only the project and Driver connection. The picker displays
the total session count and sorts globally by last activity, without grouping
the current project first. A session title is the primary label; the project
name, full path, source and identity are secondary searchable details.

Discovery combines three existing catalogs:

- Ordinary VS Code Copilot Chat: `chat.ChatSessionStore.index` in each
  `User/workspaceStorage/<workspace-id>/state.vscdb` and the default profile's
  global index for empty windows. The host reads titles/timing from indexes,
  not messages; `workspace.json` identifies each project. Records remain in
  `chatSessions/<sessionId>.jsonl` or legacy `.json` files. Chat panel Agent mode
  can use this storage too; it is not synonymous with agent-host.
- The current VS Code profile's `globalStorage/agent-host.db` registrations and
  `agentSessionData/<visible-session-id>/session.db` metadata. `customTitle` is
  the visible session title; `defaultChatProviderData.sdkSessionId` maps it to
  the actual Copilot records. VS Code registration activity time takes precedence
  over metadata file modification times.
- `workspace.yaml` in `~/.copilot/session-state` and, when configured,
  `COPILOT_HOME/session-state`. No client-label filter or project filter applies.
  Prefer an explicit `user_named` name or SDK summary; do not display an
  automatically seeded first-message name as a title.

The host uses `/usr/bin/sqlite3 -readonly` with fixed metadata-only queries,
bounded output and a timeout. This uses the system reader on the supported
macOS target, introduces no database or native dependency, and grants no SQLite
or command tool to the Pair. It does not read chat-content or credential tables.
YAML parsing uses the pinned `yaml` dependency. Ordinary Chat selection uses
`@streamparser/json` only to verify record identity, including legacy snapshots
that put the ID after requests. It does not retain a conversation tree, generate
titles, normalize records or copy logs. Identity scanning stops after the ID
with a 64 MiB maximum; failures remain explicit.

VS Code entries replace duplicate raw SDK entries while retaining their visible
session identity only when the backing mapping is known. Missing mappings leave
the VS Code entry unavailable and any standalone SDK record separate.
Entries without a title say "untitled"; registered sessions
with missing records remain visible with an unavailable status rather than
disappearing. Corrupt/unreadable catalogs produce a warning and diagnostic codes.
Selection rechecks the current Chat index and snapshot identity, or the SDK
backing identity and complete `session.start` header.
Missing or unsupported records fail explicitly without connecting another path.
No conversation bodies are copied, parsed for titles, or collected by the host.
This local format integration does not enumerate every remote/native chat
provider or every installed VS Code profile.
Connection changes and disconnects are disabled while selection and validation
are pending, so an older selection cannot undo a successful disconnect.

The Pair's read-only access is the union of two source scopes:

1. The current project root and everything inside it.
2. The selected Driver's records and artifacts. SDK sessions authorize their
   dedicated directory, including `events.jsonl`, metadata and files.
   Standard Chat authorizes only its exact JSON/JSONL record and, when present,
   `chatEditingSessions/<sessionId>`. It must not authorize the shared
   `chatSessions` directory, workspace database or unrelated chats.
   Empty-window records are global while editing artifacts remain in workspace
   storage; resolve the selected session's unique editing directory separately.
   Ambiguous matches fail explicitly instead of choosing an arbitrary directory.

Directory listings, hidden files, dependencies and arbitrary file extensions
are authorized. There are no sensitive-filename exclusions: both trees may
contain secrets, so share only data appropriate for the model service.
SDK-supported formats and bounded output still apply. Native recursive search
may omit Git metadata; explicit reads/searches of those files remain allowed.
Symlinks are resolved within the union; links and references outside both scopes
do not grant access. Native recursive search does not follow directory symlinks.

Changing the Driver revokes the old session's extra scope without resetting
the Pair. Files already inside the project remain allowed by project scope.
Writes, shell commands, delegation and MCP remain denied. No source is copied,
watched, normalized or automatically sent to the model.

SDK Infinite Sessions handles context compaction. Separate Memory and
cross-session retrieval are disabled. The UI keeps up to 256 entries and
approximately 1 MiB, independently from model context. Original excerpts are
not translated. Stop affects the current response; End closes owned resources;
New chat clears the display transcript and Driver connection.

There is no Compiler, report snapshot/cache/export or persistent recovery.
Old user-exported reports, Driver logs and earlier-version retained snapshots
are not deleted. Owned temporary runtime data is removed after verified
cleanup; cleanup errors remain visible.
After tool work, the Pair must produce a final reply and turn-end event;
an earlier planning message cannot satisfy completion. Missing final output
is reported as incomplete, with any received text retained as partial.
If a response failure closes the runtime, the chat ends instead of accepting
messages on that closed runtime. Verified client shutdown permits fresh-chat
cleanup without retrying RPCs on a stopped client. Unverified cleanup remains
an error, with guidance to retry a new chat or reload the window after checking
ongoing work.

## Verification boundaries

Tests verify control flow, persona configuration, fixed Korean prompts/UI,
permissions, direct reads and cleanup. Prompt assertions and native tool tests
do not prove conversational quality, model-driven retrieval or compaction recall.
The [demo checklist](../deploy/demo-checklist.md) separates
technical checks from a human/model journey. Record each observed outcome
separately; synthetic checks do not verify the live-model journey.
Path checks are preflight checks, not an atomic OS sandbox against concurrent
path replacement. Hardening that boundary remains deferred; use trusted,
synthetic data for prototype demos.
