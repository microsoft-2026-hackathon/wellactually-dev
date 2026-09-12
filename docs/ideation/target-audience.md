# Wellactually: Target Audience and Core Problem

**Discussion baseline:** September 11, 2026

**English edition:** September 12, 2026

**Status:** Product framing. Market size and effectiveness remain hypotheses.

This English edition preserves the scope of the initial audience discussion and
uses the subsequently agreed framing: the gap concerns opportunities to apply
established engineering methods and know-how, not access to a senior colleague's
judgment as an end in itself. The Korean discussion is retained separately,
unchanged. The canonical English product contract controls implementation.

## 1. One-Sentence Definition

**An AI-native junior developer who can build and deploy with coding agents but
has had limited opportunity to apply established development methods, design
principles, and practical engineering judgment in real work.**

Wellactually lets this developer selectively pair with AI on an existing
project, practicing both engineering judgment and the ability to delegate work
to a coding agent.

## 2. Starting User Context

The initial idea came from a first-year engineer at a cloud service provider.
Coding agents were already available when they started their development
career. They were familiar with agent use and deployment, but felt a gap in
experience with the considerations and design practices involved in software
development.

That experience makes the initial audience concrete. Working at a cloud service
provider or having exactly one year of experience is not an eligibility rule.
The relevant distinction is the gap between agent-centered development
experience and opportunities to develop engineering judgment.

## 3. AI-Native Junior Developers

In this context, an AI-native developer has used coding agents as an ordinary
part of development from the beginning of their career. The term is not a
classification by age, model choice, or willingness to type code manually.

These developers may already be able to:

- request implementations from an agent and obtain working results;
- connect tools and services into functioning features;
- use development environments and deployment processes to deliver software.

Producing those results is not the same as independently practicing how to:

- separate the underlying problem from the requested solution;
- identify missing assumptions and constraints;
- break down work and choose an appropriate sequence;
- compare design alternatives and tradeoffs;
- form hypotheses and choose observations that discriminate between them;
- assess change impact, complexity, and maintenance cost;
- define completion criteria and evaluate the result against them.

Not every AI-native junior has this gap. The initial audience consists of people
who feel such a gap and want to address it through their own development work.

## 4. Core Problem: A Capability-Formation Gap

The problem is not simply an inability to write code or operate an agent.

**A developer can obtain an implementation while having too little practice
with the methods, design principles, and questions that inform the work.**
If decomposition, design choices, and verification decisions occur inside the
agent's workflow, the human may see only the request and the result.

This differs from an experienced developer using an existing skill less often.
The central concern is the initial formation of that capability, not
necessarily the loss of a capability previously acquired.

A developer also need not know precisely what they are missing before asking
for pairing. Uncertainty such as “Is this design appropriate?” or “What should
I consider here?” is sufficient to start a session. Discovering the specific
judgment points is part of the conversation.

## 5. Learning Judgment, Not Restoring Manual Work

Requesting and deploying a cache implementation differs from deciding whether a
cache is appropriate. Pairing can surface questions such as:

> Have you verified that this is the bottleneck a cache would address?
>
> How stale may this data be?
>
> What happens when invalidation does not work as expected?
>
> Is the benefit worth the additional complexity?

The aim is not to memorize that list. The developer practices understanding:

- why a question matters at this point in the task;
- what evidence would help answer it;
- how the current project context changes the choice;
- how the choice relates to implementation and operational results.

These considerations were established before coding agents, but remain useful
when delegating to them. The objective is not to return to an older workflow.
It is to apply those approaches within current AI-assisted development.

## 6. Two Capabilities to Practice

### Engineering Judgment

Real tasks provide practice in problem framing, requirements clarification,
design comparison, exploration, debugging, impact analysis, and verification.
The goal is to understand reasons and conditions and make a choice, rather than
accept a supposed “senior developer's answer.”

### Delegating to Coding Agents

Familiarity with an agent does not automatically mean effective delegation.
The human still needs to decide what to assign, how much to assign, which
constraints to preserve, and when to inspect the results.

- Express the goal and expected outcome.
- Choose the unit and scope of work.
- State what must not change and what must be verified.
- Avoid leaving consequential unknowns to an unreviewed agent decision.
- Adjust the next instruction after inspecting the result.

Having Coach finish and forward an instruction may remove precisely the
practice this audience needs. The human's own instruction and its consequences
are part of the experience.

## 7. Product Direction

The core pattern is **AI Driver — Human Navigator — AI Coach**.

### Human Navigator

The human owns consequential choices and directly instructs the Driver. They
can reject, defer, or question a Coach suggestion.

### AI Driver

The Driver investigates, implements, and verifies within the human's goal and
constraints. It should be capable at that work; the product does not require
the human to type all implementation details.

### AI Coach

Coach surfaces relevant considerations the human has not yet raised. It can
discuss architecture as well as concrete code and results, without substituting
its preferred design for the human's choice.

The current direction includes:

- **Discussion before delegation:** examine the intended work and missing
  conditions before the human writes the final instruction.
- **Design reasoning:** discuss the grounds, alternatives, and costs of a
  choice.
- **Process-centered support:** code, diffs, logs, and tests are evidence for
  judgment, not merely inputs to a static review report.
- **Human instruction ownership:** Coach does not write or send a finished
  instruction, even if it could ask the human to approve it.
- **Optional pairing:** start on an existing personal, self-directed learning,
  or work project when a decision warrants discussion; do not require daily or
  per-task use.
- **A useful exit:** leave the pairing session independently of Driver work,
  with optional Knowledge Compilation from the evidence gathered.

The initial discussion considered Coach-written tests as an optional extension.
The current MVP excludes it: Coach uses restricted reading and search, and the
human delegates implementation and verification to the Driver.

Questions should expose useful thinking, not become an endless hidden-answer
quiz. Explain what is necessary to continue the current decision, and keep a
broader curriculum outside the session.

## 8. What Is Not the Core Value

- A chatbot that only explains concepts after being asked.
- A reviewer that only lists code errors and diffs.
- A convenience service that merely runs tests.
- Automatic forwarding of instructions to the Driver.
- A training tool that requires all code to be written manually.
- A virtual senior who interrupts every small task or decides everything.

Some of these capabilities may be useful supporting functions. None alone
defines the intended pairing experience.

## 9. The Name

**Wellactually** refers to the “Well, actually...” colleague who points out an
overlooked exception or assumption.

The intended interruption is not nitpicking or a display of authority. It is a
grounded contribution that exposes a decision the human might otherwise miss.
The name does not require every response to start with that phrase.

**Driver implements. Coach surfaces considerations. The human decides and
instructs.**

## 10. Hypotheses to Evaluate

- How many AI-native juniors experience a comparable gap?
- Which tasks and decisions make it most apparent?
- When is a proactive question useful, and when is it distracting?
- On a similar later task, can the human formulate relevant questions and
  instructions without Coach?
- Does perceived learning match observable independent judgment?
- What level of support is useful without making development unnecessarily
  burdensome?

Market size and learning effects are not established. User interviews and
observations can refine the audience; stronger claims about retention or
transfer require a later study rather than session counts or report generation.

## Related Material

The product description, technical design, pairing-model discussion, and Coach
and Driver persona drafts provide additional context. Earlier explorations of
permissions and automation are not all adopted by the current product contract.
