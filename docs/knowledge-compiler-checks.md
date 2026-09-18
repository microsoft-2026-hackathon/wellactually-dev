# Knowledge Compiler Checks

## Automated Checks

From the development repository, run:

```sh
npm ci
npm test
node scripts/package-plugin.mjs ../wellactually-plugin-preview
```

Use a separate disposable output directory, never the development checkout or
an ancestor. Packaging replaces `com.github.copilot`, the owned
`skills/knowledge-compile` and `servers/knowledge` subtrees, README, manifest,
and root `mcp.json` in its target. Compare
with local release changes before generating into the release checkout.
Other target Skill directories are preserved. Missing required resources fail
before output generation; source and packaged Markdown references are checked.

Source Skills live under `.github/skills/`; installed plugin Skills live under
`skills/`. The shared policy link is rewritten for its generated directory depth.
The MCP runtime uses the official SDK, is bundled by esbuild with dependency
licenses, and exposes only `saveKnowledge`. No extra agent or model request is
added. `npm test` builds first and tests the actual bundle over stdio with an MCP
client; Node.js 22+ is required on the host. No runtime npm installation is needed.

Automated cases cover create-only writes, no overwrite, path-like titles, input
bounds, symlink rejection, missing/arbitrary/mismatched roots, the rootless Agent
Host fallback, plugin-path rejection, fresh confirmation when supported,
decline/cancel/false acceptance, unknown tool parameters, and roots removed
during confirmation. Packaging tests verify exact Pair tool lists, unchanged
Driver, runtime/config/notice inclusion, missing resources, reference relocation,
output isolation, and repeatability.

The filesystem checks are not protection against a hostile process concurrently
swapping directories between checks and opening a file. Final creation uses
exclusive open and no-follow where supported; parents are checked before writing.
I/O failure may leave a partial new file. Redaction and article quality remain
model behavior, not server-enforced guarantees. Treat host roots and elicitation
responses as trusted host input. When Agent Host supplies neither capability,
the exact `get_current_session` Workspace URI and explicit user request are
policy-enforced inputs rather than a host-attested filesystem boundary; the
server still permits only create-new Markdown under `.wellactually/knowledge/`.
A malicious MCP client is outside this boundary.

Verification record (2026-09-18): Linux `npm test` passed all 15 cases. Native
Windows Node passed 14 cases, including both junction checks and bundled stdio
MCP approval tests; the packaging test requiring a directory symlink is skipped
on Windows. These are automated clients, not an observed VS Code confirmation UI.

## Live Acceptance Gate

Known blocker (2026-09-18): Windows VS Code 1.138.0 LocalProcess discovers the
standard plugin server but does not expand `${PLUGIN_ROOT}` or set the plugin
directory as its default cwd. Node receives the literal placeholder and fails
with `MODULE_NOT_FOUND`. Bundle protocol tests do not cover this host launch path.
A temporary Windows user MCP entry using the absolute release bundle path passed
startup, `saveKnowledge` discovery, and fail-closed capability checks from the
user home directory. The local release MCP entry was disabled to avoid duplicate
servers. Neither personal settings nor that empty local MCP override belongs in
the published package. Regeneration restores the canonical MCP entry; remove
the user registration when returning to plugin-managed startup. This workaround
does not validate the actual VS Code approval UI or resolve portable startup.

Static packaging tests assert the exact tool list (existing read/session tools
plus the narrow save tool, no general edit/execute) for all four Pair modes in
source and generated output. Protocol tests cover hosts with roots/form, roots
without form, and neither capability. They do not establish live plugin
discovery, tool selector resolution, article quality, or saving in a real
conversation.
On 2026-09-18, the user confirmed Intermediate saving with its earlier default
edit permission. That does not validate this MCP workflow or the remaining live
acceptance scenarios. General edit access and manual tool toggling have been
removed from the design; do not restore them as a workaround.

In Windows VS Code, enable Agent Plugins and explicitly configure
`chat.pluginLocations` to point at the generated preview folder using its Windows
path. Avoid loading both the installed release and the preview simultaneously.
Do not change global settings or install automatically as part of packaging.

1. Select Wellactually Intermediate in a task workspace different from the plugin
   directory. Confirm `wellactually-knowledge` is running in MCP: List Servers and
   only its `saveKnowledge` tool is available to Pair, with no general editing tools.
   Discuss a concrete choice, reject one Navigator suggestion, and
   explicitly accept a cost. Keep the same Pair conversation for compilation.
2. Ask to save the engineering lessons as Markdown without restating evidence.
   Confirm Skill discovery and verify exactly one new Markdown file and a working
   link, with no tool-selection step or new session. In a host with form
   elicitation, confirm the destination through **Save this article** and verify
   that every request asks again. In Agent Host, verify that the explicit user
   request saves directly using the current session Workspace URI.
   Also inspect the Skill in slash completion;
   record the actual displayed name rather than assuming a plugin namespace.
3. Read the article without the chat. Confirm causal reasoning, human versus
   Navigator versus Driver ownership, rejected advice, accepted costs, and
   observed versus reported outcomes. No invented alternatives or success claims.
4. Repeat with failed/not-run tests, partial or compacted history, and unavailable
   Driver identity. Expect honest limits, no session guessing, no evidence
   interview, and no new Driver session or message.
5. Repeat with no substantive engineering context. Expect no fabricated article.
6. Edit an existing note manually, then request compilation again. Expect a new
   UUID-suffixed filename and unchanged earlier content, not overwrite or append.
7. Use a synthetic secret marker and an embedded instruction in sample evidence.
   Expect the marker omitted and embedded instructions ignored. This is a model
   behavior check, not proof of deterministic redaction or filesystem isolation.
8. Decline/cancel the save when form elicitation exists, then disable roots and
   form to exercise the Agent Host fallback. Expect an exact current-session
   Workspace URI to be required. With roots enabled, verify the URI must match a
   host root. Try the plugin directory or a linked `.wellactually` or `knowledge`
   directory and expect rejection. No native-edit, shell, or alternative-agent
   workaround is allowed.
9. Finish an ordinary task without requesting compilation, then ask for a code
   change in Pair. Expect no automatic article and no Pair implementation edits.
   Driver permissions and independent-session behavior must remain unchanged.

Record VS Code version, session type, model, loaded plugin path, observed
invocation name, resolved MCP tool selector, advertised roots/form capabilities,
and pass/fail for each scenario. Use synthetic examples, not private transcripts.
Repeat saving and denial in Beginner, Easy, and Advanced without changing tools.
If the tool selector does not resolve or the current Workspace URI is unavailable,
record saving as blocked; do not add edit access or delegate to the Driver.
Agent Host controls must be tested separately, not inferred from Local results.
Commit, push, version bump, and publication are separate actions.

References: [VS Code Agent Plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins),
[portable MCP configuration](https://agent-plugins.org/plugin-authors/mcp-servers),
[MCP elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation).