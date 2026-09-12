# Repository Agent Skills

This directory contains the focused skill set used by coding agents in this
repository.

## Included

- Discovery: `brainstorming`, `grill-with-docs`, `grilling`
- Product and architecture: `domain-modeling`, `codebase-design`
- Delivery: `writing-plans`, `tdd`, `systematic-debugging`,
  `verification-before-completion`
- Frontend quality: `frontend-design`, `baseline-ui`, `fixing-accessibility`

The skills were selected from the local `harness-guide` repository. Parallel
subagent execution, worktrees, duplicate TDD workflows, and branch-finishing
automation are intentionally omitted until the project scope calls for them.

`writing-plans` has one repository-local adaptation: plans hand off to direct
vertical-slice execution with `tdd` instead of requiring optional subagent or
batch execution skills.