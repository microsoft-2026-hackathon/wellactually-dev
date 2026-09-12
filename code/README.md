# Application Code

Application source and tests will live here as the accepted TypeScript VS Code
extension plan is implemented. The MVP preserves the existing Driver, reads one
selected local CLI/SDK log, and uses a separate Copilot SDK Coach with verified
read/search permissions. AHP, a dedicated workspace-reader service, and a cloud
backend are not initial implementation requirements.

Follow `docs/implementation-plan.md` from the repository root. Its first gate
verifies the actual SDK read profile before dependent integration work. The
package manifest, build, and tests do not exist yet; documentation and probe
evidence must not be described as a working extension.

When implementation begins, update this document with:

- component boundaries and entry points;
- prerequisites and local setup;
- build, run, test, lint, and format commands;
- required configuration and safe sample values.

See the root `README.md` and `AGENTS.md` before making changes.
