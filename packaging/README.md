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

## Compile Session Knowledge (Intermediate Preview)

In the same **Wellactually Intermediate** conversation, ask:

> Save what we learned from this task as an engineering article.

The `knowledge-compile` Skill uses the available conversation and, when relevant,
the already linked Driver context. It saves a new Markdown article under the
task workspace's `.wellactually/knowledge/` directory and returns its link.
No transcript re-entry, evidence form, or JSON confirmation is required.
You can read and edit the saved article afterward.

The article explains the problem, actual choices, accepted costs, mechanisms,
and supported outcomes. Missing history and unverified results remain explicit;
this is not a complete transcript export or an assessment of your ability.

Compilation runs only on request. Intermediate has native edit access with a
policy restriction to these knowledge articles, not a path-enforced sandbox or
deterministic secret scanner. Existing notes must not be overwritten. Ordinary
Pair work still cannot edit implementation files or execute commands.

This preview enables saving only in Intermediate. Beginner, Easy, and Advanced
retain their existing permissions pending live Intermediate validation. Plugin
discovery and saving must be smoke-tested in the target VS Code installation.

## Source

Wellactually is developed in the
[`wellactually-dev`](https://github.com/microsoft-2026-hackathon/wellactually-dev)
repository. This repository contains generated release packaging and should not
be edited directly.
