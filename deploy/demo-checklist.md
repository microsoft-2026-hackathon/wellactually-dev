# Local Prototype Demo Checklist

This checklist covers the current Korean-only, human-triggered Pair described
in the [product contract](../docs/specs/2026-09-12-wellactually-product-design.md).
Use synthetic catalog code and disposable synthetic Driver data only. Checks
from earlier versions do not verify the current flow.

## Technical acceptance

- [x] Authenticated SDK model-control check: catalog lookup, low/high/none switches, model-specific read-tool aliases, source denial and two synthetic production-runtime turns passed on September 17. This is not native picker/consent UI acceptance.
- [ ] Build, run relevant tests, and package the locked darwin-arm64 SDK assets.
- [ ] Activate the installed extension and receive Webview ready without a model.
- [ ] Verify Korean controls regardless of the VS Code locale, with no language selector.
- [ ] Check the AI pair-programming title, product description and read-only sharing disclosure, with no persistent welcome notice or Driver-onboarding sentence.
- [ ] Send the first message without a Start or single-folder selection wizard.
- [ ] Reuse authorized authentication; only fall back when unavailable.
- [ ] Open model/effort selectors without sending a model message; show actual SDK inventory and model-supported levels.
- [ ] Change model and effort between messages while preserving discussion, Driver access and drafts.
- [ ] Verify changes are blocked during a response and that model preferences survive a new chat/reload in the same workspace.
- [ ] Verify an unavailable model or unconfirmed switch produces a visible error rather than a misleading selected label.
- [ ] Search all local Copilot sessions across projects and client types by title/project/time without a file dialog.
- [ ] Verify the displayed count covers the active VS Code registry plus SDK-only entries, with global recency rather than current-project grouping.
- [ ] Show the actual VS Code session title, not the first message, and connect its correct backing SDK session.
- [ ] Keep registered entries with missing local records visible and explain why they cannot connect.
- [ ] Create a standard Copilot Chat in another project window and find its indexed title without opening that project in the Pair window.
- [ ] Connect an ordinary Chat JSON/JSONL record and its own editing artifacts; deny sibling chats, shared record directories and workspace databases.
- [ ] Verify both ordinary Chat and agent-host/SDK sessions appear in global recent order, without conflating Chat Agent mode with agent-host storage.
- [ ] Show sessions without records and explain why they cannot connect yet.
- [ ] List project directories and read hidden, dependency and ordinary files with editing/shell unavailable.
- [ ] Read the selected session's records, metadata and artifacts directly; deny its parent and unselected siblings.
- [ ] Follow only links resolving inside the two approved roots, with no external traversal.
- [ ] Show the full-tree sharing scope, without claiming automatic sensitive-file exclusion.
- [ ] Reconnect/revoke Driver access without losing the Pair conversation.
- [ ] Verify context compaction with restricted tools on synthetic data.
- [ ] Stop and end without late text or any change to Driver activity.
- [ ] Verify no report actions, output jobs or post-end model requests remain.
- [ ] Report authentication, read, model and cleanup failures explicitly.

## Human journey

Use the [Pair persona test scenarios](../docs/pair-persona-test-scenarios.md)
for copyable Korean inputs and conversational observation criteria.

- [ ] Raise the idea of compiling knowledge from agent sessions: receive a relevant observation, concern or question rather than a complete solution, repository scan or checklist.
- [ ] Suggest using only final answers: the Pair reacts to that idea and leaves room for a response instead of preemptively designing the full extraction pipeline.
- [ ] Raise a plausible edge case without asking for verification: the Pair can discuss it as an unverified possibility without conducting an evidence audit or inventing proof.
- [ ] Ask a direct factual question: the Pair answers rather than withholding information to force discussion.
- [ ] Explain that the knowledge will support future engineering decisions: the next reply uses that goal rather than asking for it again.
- [ ] Reject a Pair suggestion: it revises the reasoning rather than defending the old suggestion or restarting a generic checklist.
- [ ] Explicitly ask for a comprehensive checklist: the Pair supplies it instead of enforcing brevity or a one-question template.
- [ ] Ask a project-specific follow-up requiring evidence: the Pair reads relevant sources without treating the conceptual-question guidance as a blanket ban on tools.
- [ ] Discuss a Redis assumption and separate description/price/stock freshness.
- [ ] Send the investigation instruction in the existing Driver UI.
- [ ] Ask the Pair to review the result; show there is no unsolicited reaction.
- [ ] Discover language-dependent descriptions and revise the cache criterion.
- [ ] Reject or defer a Pair suggestion without it becoming a supposed decision.
- [ ] End early without claiming learning was proved.

Unit tests, direct native tool calls and browser fixtures cannot certify this
human/model journey. Record actual observed outcomes; never check a box merely
because code exists. Model-speed comparisons are deferred.

| Global criterion | Evidence to show |
| --- | --- |
| Inspiration | Human reasoning connected to actual coding results |
| Business Value | Useful delegation support, without invented ROI |
| Customer Focus | A junior's uncertainty in their existing project |
| Feasibility | Small SDK-based implementation and honest limits |
| Make Something | Installed Pair and a complete user-triggered review conversation |

Be ready before September 18 at 09:00 for Seoul first-round review. The
separate global video is at most two minutes and due September 21 at 11:59 PM
Pacific. Target `Hack for Agentic Coding`, disclose AI tools, and protect data.
