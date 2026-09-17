# Wellactually User Guide

**VS Code extension 0.0.1 | Updated September 16, 2026**

Wellactually is a Korean-language Pair alongside your existing coding agent.
You own engineering choices and write every Driver instruction yourself.
The product no longer includes language selection or Knowledge Compilation.

## Quick start

1. Install `wellactually-0.0.1.vsix` with **Extensions: Install from VSIX...**.
2. Open a trusted local project.
3. Open **페어** in the right-hand Secondary Side Bar, or run
   **Wellactually: 페어 열기**.
4. Share a design idea or implementation concern to start a discussion.
   The first message starts the Pair; there is no Start wizard.
5. If authentication cannot be reused, allow the requested GitHub account access.
6. Optionally select a Driver from all locally stored Copilot sessions and discuss its results.
7. Stop the current response or end the conversation when finished.

The package targets macOS Apple Silicon and VS Code 1.137.0+. Other platforms
and remote workspaces are not verified. Reload the intended window after
replacing a same-version VSIX.

## Conversation

The opening screen introduces AI pair programming and describes Wellactually,
without a separate welcome instruction or Driver-connection onboarding line.
The composer invites discussion; a message does not have to be a question.
The project-sharing disclosure remains visible before sending.

A single open project is used automatically. Multi-root workspaces use the
active editor's project or ask when ambiguous. Opening the Pair view does not
start a model request.

Describe your uncertainty, for example whether descriptions and stock data
need different caching criteria. The Pair can inspect saved project files,
explain alternatives, and help examine verification criteria. It cannot edit,
run commands or operate the Driver.
The intended exchange is a discussion with an engineering peer. A short
observation, tentative concern, question or suggested check can be enough for
one turn; the Pair need not finish the topic before you respond.
It should build on your reaction rather than restart with a checklist.
Unverified concerns should be phrased as possibilities, not established defects.
General discussion does not require a repository scan. Ask explicitly when
you want a full explanation, comprehensive checklist or verification of shared
files, rather than a conversational nudge.

Persona changes apply to new Pair conversations. Reload the window after
installing an updated VSIX, then start a new conversation.

Sending the first message shares the complete current project tree read-only,
including directory listings, hidden files and dependencies. Sensitive files
are not automatically excluded; use a project appropriate for the model service.

Controls and Pair responses are Korean, with the requested English composer
placeholder **Pair Programming with WellActually...** as a branding exception.
Code, identifiers and quoted source text keep their original language.
There is no language setting.

## Input and controls

The composer groups the text box, read-only Pair role label, model and reasoning
selectors, and send/stop controls in one input area, similar to the familiar
Copilot Chat layout.
The text box starts at one line and grows with its content up to a compact
height limit. The model button shows the SDK model name, or the selected model
ID until model metadata has loaded; it does not use generic model categories.

- Select a model from the input footer. The list comes from the Pair SDK's
  available models and may differ from the separate Driver's model list.
- Select a reasoning level when the model offers one. Model-default behavior is
  used when no explicit level is selected; no selectable level does not mean
  reasoning is disabled.
  **사용 안 함** is available only when the model explicitly supports `none`.
- Changes apply to the next message while preserving the current discussion
  and Driver connection. Model changes are unavailable during a response.
- The workspace remembers your choices for new chats and after reloading.
  Opening a selector may request GitHub account access to fetch available
  settings; it does not itself send a model request.

- Enter sends; Shift+Enter inserts a line break.
- The compact send button is inactive and uncolored while the input is empty
  or whitespace-only; entering text enables it when the Pair is otherwise idle.
- Korean IME composition does not accidentally send.
- Messages are limited to 16 KiB UTF-8.
- **응답 중단** stops only the Pair's current response.
- Incoming messages do not force you away from older text you are reading.
- Distinct Pair messages, including messages around tool calls, appear in
  separate paragraphs both while streaming and in the completed reply.
  Chunks of the same message remain continuous.
- **대화 종료** closes the Pair while Driver work can continue.
- **새 대화** clears the in-memory transcript and connected Driver.
  It retains this workspace's selected model and reasoning preference.

The gear button opens settings containing only current project information and
Driver connection. Close it with Escape or its close button.

## Driver results

1. Open settings and select **드라이버 세션 선택**.
2. Search the global local-session catalog by title or project. The picker shows
   the total count and orders every project together by last activity, without
   moving the current project to the top.
   The main label is the session title, not its first message. The project,
   full path, source, time and identity appear as secondary searchable details.
3. Check the displayed title and session identity.
4. Send instructions yourself in the existing Driver UI.
5. Ask the Pair to review the results against the criteria you discussed.

Connection changes and disconnects are temporarily disabled while a session
selection is pending. The settings view shows when that operation is in progress.

For an SDK Driver, Pair can read its entire dedicated session directory.
For ordinary VS Code Copilot Chat, Pair reads only that session's original
JSON/JSONL transcript and its session-specific editing artifacts, not the shared
folder containing other conversations. There is no watcher, background
message, copied log collection or instruction-confirmation step. The two allowed
scopes are the entire current project and the entire selected session. References
and links outside both scopes do not grant additional access.

The picker includes ordinary Copilot Chat from every saved workspace in this
VS Code installation's user-data store, including other open project windows and
empty-window chats. Their titles come from VS Code's Chat history index.
Agent mode in a normal Chat panel can use this same storage.
These entries are merged with agent-host registrations and CLI/SDK records,
including the configured `COPILOT_HOME` store. Other projects are not filtered out.
The source label distinguishes ordinary Copilot Chat from agent-host sessions.
Reopen the picker to refresh indexes after a new conversation has been saved.
Untitled sessions use an explicit untitled label. Registered sessions with
missing local records remain visible, but selecting one explains why it cannot
connect. Check the original session in VS Code; removed or unsupported records
are not reconstructed. If catalog metadata cannot be read, a warning points to
the Wellactually Output channel. There is no manual log-file picker fallback.
Different VS Code installations or user-data roots and records stored only on a
remote host are not automatically merged into this catalog. Locally saved
workspace chat indexes are included regardless of which window wrote them.

Choose material you may share: sensitive files are not automatically excluded.
Long records and tool results can be truncated, and supported formats depend on
the SDK. Native recursive search can skip Git metadata; explicit file reads
remain available. Disconnecting removes the session's additional read scope,
but project access and already-discussed excerpts remain. New chat resets the
Driver selection, and extension reload does not restore it.
Search excerpts are labeled with `grep` or `rg` and the actual searched paths, including
paths in the selected Driver session. A search excerpt is not a complete file read.

## Removed features and lifetime

There is no report generation, preview, HTML export, language selector,
automatic review, pause/resume observer or persistent conversation recovery.
Ending only stops and cleans up the Pair; no post-conversation model is run.
Files exported by previous versions are not deleted.

The display transcript is bounded; closing/reloading the extension does not
restore it. Driver logs remain user-owned and are never deleted.

If authentication or a read fails, inspect the visible error and project/session
selection. Do not grant access to the whole home directory or copy private
credential stores to bypass the supported flow.
If the Pair runtime closes after a response failure, the chat ends so you can
start a new conversation instead of repeatedly sending to a closed session.
If cleanup cannot be verified, follow the visible recovery guidance; check
ongoing work before reloading the VS Code window.

See [development instructions](../code/README.md) and the
[code reading guide](code-review.md). Tests and conversation activity do not
establish learning or improved engineering skill.
