# Wellactually VS Code Extension

See the [user guide](../docs/user-guide.md) for use and the
[code reading guide](../docs/code-review.md) for implementation structure.
The [product design](../docs/specs/2026-09-12-wellactually-product-design.md)
is the current behavior contract. The interface and Pair responses are Korean-only.

The project and extension are still **Wellactually**. The conversational role
is **Pair** in English and **페어** in the Korean interface. Existing internal
view IDs, source filenames, symbols and diagnostic codes retain their spelling
for compatibility; they are not the product-facing role name.

## Current scope

- VS Code 1.137.0+, a trusted local project, macOS Apple Silicon VSIX.
- Node `^20.19.0 || >=22.12.0`; SDK 1.0.13 / bundled CLI 1.0.83.
- One persistent read-only Pair, invoked only by human messages.
- Complete current project tree plus one selected VS Code Driver session tree.
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

## Pairing behavior

The Pair is an engineering judgment partner, not an autonomous coding agent
or a report generator. It answers the actual question, prioritizes a useful
tradeoff, explains a provisional view with a concrete example, and builds on
the human's choices and objections. It asks at most one focused question only
when the answer would materially affect the advice. No fixed length, mandatory
closing question or blanket checklist ban is imposed.

General design questions do not trigger repository reconnaissance. File reads
should resolve a relevant factual uncertainty in a project/session-specific
discussion. Full read authorization does not require reading every source.

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

`wellactually.model` applies to new Pair conversations; the default is
`claude-haiku-4.5`, with actual read-tool inventory checked. There is no
`wellactually.language` configuration. A stale user setting is ignored rather
than silently rewritten.

## Session selection, access and lifetime

Settings contain only the project and Driver connection. Choose a recent
VS Code Copilot session by title, project and last activity. Sessions belonging
to the current project appear first. The host reads bounded `workspace.yaml`
metadata and file timestamps from `~/.copilot/session-state`, selecting only
`client_name: vscode-agent-host` entries. YAML parsing uses the pinned `yaml`
dependency. This local, version-dependent adapter does not claim support for
every Copilot Chat provider, CLI sessions or custom session-store locations.
Unavailable entries produce a visible warning and diagnostic codes in Output.
Selection revalidates the metadata and a complete `session.start` header,
without parsing subsequent events or creating a log collection.
Connection changes and disconnects are disabled while selection and validation
are pending, so an older selection cannot undo a successful disconnect.

The Pair's read-only access is the union of two complete trees:

1. The current project root and everything inside it.
2. The selected Driver session root and everything inside it, including
   `events.jsonl`, metadata, plans and artifact files.

Directory listings, hidden files, dependencies and arbitrary file extensions
are authorized. There are no sensitive-filename exclusions: both trees may
contain secrets, so share only data appropriate for the model service.
SDK-supported formats and bounded output still apply. Native recursive search
may omit Git metadata; explicit reads/searches of those files remain allowed.
Symlinks are resolved within the union; links and references outside both roots
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
