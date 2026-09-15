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
6. Optionally select a recent VS Code Driver session and ask about its results.
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
The intended exchange is a discussion with an engineering peer: a useful
viewpoint, its reasons and conditions, and a focused question only when needed.
The Pair should carry your choices and objections forward rather than restart
with a checklist. General questions do not require a repository scan. Ask
explicitly when you want a comprehensive checklist or a detailed explanation.

Persona changes apply to new Pair conversations. Reload the window after
installing an updated VSIX, then start a new conversation.

Sending the first message shares the complete current project tree read-only,
including directory listings, hidden files and dependencies. Sensitive files
are not automatically excluded; use a project appropriate for the model service.

All controls and Pair responses are Korean. Code, identifiers and quoted
source text keep their original language. There is no language setting.

## Input and controls

- Enter sends; Shift+Enter inserts a line break.
- Korean IME composition does not accidentally send.
- Messages are limited to 16 KiB UTF-8.
- **응답 중단** stops only the Pair's current response.
- Incoming messages do not force you away from older text you are reading.
- Distinct Pair messages, including messages around tool calls, appear in
  separate paragraphs both while streaming and in the completed reply.
  Chunks of the same message remain continuous.
- **대화 종료** closes the Pair while Driver work can continue.
- **새 대화** clears the in-memory transcript and connected Driver.

The gear button opens settings containing only current project information and
Driver connection. Close it with Escape or its close button.

## Driver results

1. Open settings and select **드라이버 세션 선택**.
2. Choose a recent VS Code Copilot session by title, project and activity time.
   Current-project sessions appear first; the picker also supports text search.
3. Check the displayed title and session identity.
4. Send instructions yourself in the existing Driver UI.
5. Ask the Pair to review the results against the criteria you discussed.

The Pair can read the entire selected session directory: conversation records,
metadata, plans, artifacts and hidden files. There is no watcher, background
message, copied log collection or instruction-confirmation step. The two allowed
scopes are the entire current project and the entire selected session. References
and links outside both scopes do not grant additional access.

The picker uses existing local VS Code agent-host metadata under
`~/.copilot/session-state`. It does not list terminal CLI sessions or every
Copilot Chat provider. If a session cannot be read, a warning points to the
Wellactually Output channel; there is no manual log-file picker fallback.

Choose material you may share: sensitive files are not automatically excluded.
Long records and tool results can be truncated, and supported formats depend on
the SDK. Native recursive search can skip Git metadata; explicit file reads
remain available. Disconnecting removes the session's additional read scope,
but project access and already-discussed excerpts remain. New chat resets the
Driver selection, and extension reload does not restore it.

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

See [development instructions](../code/README.md) and the
[code reading guide](code-review.md). Tests and conversation activity do not
establish learning or improved engineering skill.
