# Wellactually

Wellactually provides progressive pair programming with AI in VS Code. Choose a
Pair mode for the level of Navigator support you want, then give implementation
instructions directly to the separate Wellactually Driver session.

## Included Agents

- Wellactually Beginner
- Wellactually Easy
- Wellactually Intermediate
- Wellactually Advanced
- Wellactually Driver

## Requirements

- A current VS Code release with Agent Plugins enabled
- GitHub Copilot access
- Copilot Agent Host session-management tools
- For Knowledge saving: Node.js 22+ on the MCP host's PATH, bundled stdio MCP
	support, client workspace roots, and form elicitation (save confirmation)

## Install From Source

1. Run `Chat: Install Plugin From Source` from the VS Code Command Palette.
2. Enter `https://github.com/microsoft-2026-hackathon/wellactually.git`.
3. Confirm the installation and select a Wellactually Pair mode in Chat.

The plugin repository is public, so users do not need to clone it or request
repository access before installing.

## Use

Start with one of the four Pair modes in the default Chat View. Discuss the
problem, direction, and scope with the Pair. When you choose to implement, the
Pair creates a separate Driver session that uses the same workspace. Open that
session, select **Wellactually Driver**, and write the implementation instruction
yourself. Return to the Pair session to continue the discussion after the Driver
finishes.

The Pair can read the Driver session to understand the user's instruction and
new implementation context. The Driver cannot read the Pair session, and the
Pair does not send tasks to the Driver.

## Compile Session Knowledge (Save Tool Preview)

In the same Pair conversation, ask:

> Save what we learned from this task as an engineering article.

The `knowledge-compile` Skill writes from the available conversation and, when
relevant, the already linked Driver context. The bundled `saveKnowledge` tool
then asks you to confirm the destination. Confirm **Save this article** to create
a new Markdown article under the task workspace's `.wellactually/knowledge/`
directory and receive its link. Declining or cancelling creates no file.
No tool toggling, transcript re-entry, evidence interview, or separate Compiler
agent is required. You can read and edit the saved article afterward.

The article explains the problem, actual choices, accepted costs, mechanisms,
and supported outcomes. Missing history and unverified results remain explicit;
this is not a complete transcript export or an assessment of your ability.

All four Pair modes expose only the exact `wellactually-knowledge/saveKnowledge`
save capability alongside their existing read/session tools, with no general
edit or execute access. Driver permissions are unchanged. The plugin includes
the runtime and dependency notices; users do not need to run `npm install`.

The server accepts only client-provided workspace roots, never an arbitrary
model-provided path or the plugin working directory as a fallback. It generates
`YYYY-MM-DD-ascii-slug-uuid.md` with UTC date and YAML title/date/tags, rejects
linked destination directories, and exclusively creates files without overwrite.
Each save requires a fresh host confirmation, even if the host auto-approves tool
invocation. Plugin startup trust is not save approval. If roots, the tool, or
confirmation are unavailable, saving is blocked; Pair must not request general
writing access as a workaround. Multi-root selection must match a host root.

This is a narrow local file writer, not an OS sandbox against hostile concurrent
directory replacement or a deterministic secret scanner. Do not use it in a
directory controlled by an untrusted local process. An I/O failure may leave a
partial new note, which the tool does not edit or delete. Compilation remains
explicit-request-only; ordinary Pair work stays non-implementing.

Automated filesystem, MCP protocol, and bundle/packaging checks cover this save
tool. Actual discovery, tool selector resolution, and confirmation UX in Windows
VS Code Local and Agent Host sessions still require live validation. The earlier
user-confirmed Intermediate save used general edit permission, not this tool.

Known blocker (2026-09-18): Windows VS Code 1.138.0 LocalProcess discovers the
standard plugin MCP configuration but passes `${PLUGIN_ROOT}` literally to Node,
so the bundled server does not start through that installation path. A local
user-level MCP registration with an absolute bundle path passed startup and tool
discovery checks; it is a development workaround, not a portable deployment fix.
Same-Pair saving and the actual confirmation UI remain unverified.

## Source

Wellactually is developed in the
[`wellactually-dev`](https://github.com/microsoft-2026-hackathon/wellactually-dev)
repository. This repository contains generated release packaging and should not
be edited directly.
