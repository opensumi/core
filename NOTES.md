# Loop Notes

Raw notes for workflow discovery. These are observations from the repository and commit history, not confirmed workflow specs.

## Observed Tools And Channels

- Repository: OpenSumi core TypeScript monorepo.
- Main active areas in recent self-authored commits:
  - `packages/ai-native`
  - `tools/playwright`
  - `test/bdd`
  - `packages/i18n`
  - `packages/core-common`
  - `packages/core-browser`
- Repeated artifacts:
  - BDD scenario markdown under `test/bdd/*.scenario.md`
  - Playwright tests under `tools/playwright/src/tests`
  - Unit tests under `packages/ai-native/__test__`
  - Context notes in `CONTEXT.md`
  - i18n strings in `packages/i18n/src/common`

## Observed Recent Loop Candidates

- Feature delivery loop: ACP/ai-native behavior is changed, then browser/node contracts, preferences, i18n, unit tests, BDD scenarios, and Playwright coverage are updated together.
- E2E hardening loop: after feature delivery, failing or flaky Playwright coverage is stabilized through helper changes, config splits, and narrower smoke coverage.
- BDD-to-Playwright loop: BDD scenarios are added or adjusted, then matched to Playwright tests and fixture support.
- Contract propagation loop: externally visible ACP/WebMCP behavior changes require coordinated updates across common types, browser exposure, node services, tests, and documentation.

## Open Decisions

- Which loop should become the first implementable workflow spec?
