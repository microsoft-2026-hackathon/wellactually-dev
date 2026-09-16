# Local VSIX Delivery

The delivery target is a VS Code extension, not a standalone website. Azure
infrastructure and a cloud backend are outside this MVP. Browser fixture
previews verify the Webview assets only; they do not replace an installed
extension or authenticated SDK test.

## Package

From `code/`:

```sh
npm ci
npm test
npm exec -- vsce ls
npm run package
```

The output is `code/wellactually-0.0.1.vsix`, an ignored build artifact.
`wellactually-local` is a local extension identity, not a claim to a registered
Marketplace publisher. There is no Marketplace publish command.

The initial target is macOS Apple Silicon (`darwin-arm64`), VS Code 1.137.0, SDK
1.0.13 and its bundled CLI 1.0.83 / protocol 3. Do not label the native-runtime
VSIX universal or claim untested platform compatibility.
Session metadata discovery also uses the macOS system `/usr/bin/sqlite3`
utility in read-only mode. It reads the active VS Code profile's session
registry/title metadata and workspace Chat indexes, not credentials. Ordinary
Chat selection uses a streaming JSON identity check on the selected original
file; it does not copy or normalize conversations.

Inspect the package for compiled code, policy/persona Markdown, Webview CSS,
and required SDK native assets. Confirm removed report and language modules
are absent. It must not include tests, probe outputs,
personal logs, credentials, local state, or exported reports.

## Clean-profile verification

Use a new dedicated local test directory for this verification. Substitute
that exact path below; do not reuse an existing user's profile:

```sh
code --user-data-dir /absolute/dedicated-test/user \
     --extensions-dir /absolute/dedicated-test/extensions \
     --install-extension /absolute/repo/code/wellactually-0.0.1.vsix

code --user-data-dir /absolute/dedicated-test/user \
     --extensions-dir /absolute/dedicated-test/extensions \
     /absolute/repo/code/test/fixtures/workspace
```

Trust only the synthetic workspace used for the demo. Open the Wellactually
Pair view and send a question. Existing authentication is reused where
possible; use the official fallback only when needed. Never migrate private
authentication files.

The test module `code/test/extensionHost.integration.ts` uses VS Code's built-in
extension test entry to check activation, command registration, and an initially
idle state. It waits for the actual Webview browser-ready handshake and checks
Korean-only host state with no report or language preference.
This is a narrower check than the human/live-model journey.
Follow [the demo checklist](demo-checklist.md) for the latter, and record which
gates actually passed.

Authentication dialogs are blocked by VS Code's Extension Test Runner. For
authenticated checks, use a normal installed-extension window and synthetic
project/session data. After replacing a same-version VSIX, reload the intended
test window or restart its dedicated instance so the Extension Host does not
keep old modules in memory.

## Rollback and cleanup

Uninstall only this extension from the selected test profile:

```sh
code --user-data-dir /absolute/dedicated-test/user \
     --extensions-dir /absolute/dedicated-test/extensions \
     --uninstall-extension wellactually-local.wellactually
```

End the conversation before closing the window. This revision has no report
input, recovery snapshot or deletion control. Driver transcripts and HTML
exported by previous versions are never deleted by the extension.

Close the dedicated test window before removing its explicitly identified
temporary profile. Do not delete, reset, or copy the user's normal VS Code or
Copilot configuration. Do not terminate processes by executable name.

## Submission readiness

Passing unit tests or producing a VSIX does not verify model-driven retrieval
or conversational quality. Authentication reuse, actual Pair direct reads,
compaction and Driver independence need recorded outcomes.
Knowledge Compilation, language selection, automatic reactions, recovery and
comparative latency benchmarks are outside the prototype.

See [the current product design](../docs/specs/2026-09-12-wellactually-product-design.md),
[event rules](../docs/hackathon-2026.md), and
[application setup and limitations](../code/README.md).