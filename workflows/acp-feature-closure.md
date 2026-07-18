# ACP Feature Closure

## Status

Draft. Open questions remain.

## Loop

When an ACP or ai-native feature is close to completion, run a closure pass that checks whether the feature has been carried through the repository surfaces it normally touches.

## Primary Pain

Feature closure can miss required coverage or contract propagation across ACP, ai-native, BDD, Playwright, i18n, common types, browser services, node services, and CI configuration. Missing pieces tend to surface later as Playwright or CI stabilization work.

## Trigger

Before commit or review, when the current diff includes ACP/ai-native-related surfaces such as:

- `packages/ai-native`
- `test/bdd`
- `tools/playwright`
- `packages/core-common/src/types/ai-native`
- `packages/core-browser/src/ai-native`
- `packages/i18n/src/common`

## Expected Work

- Inspect the current branch or working tree for ACP/ai-native changes.
- Identify touched behavior and public surfaces.
- Check whether the matching unit tests, BDD scenarios, Playwright tests, i18n strings, common types, and browser/node contract updates are present where relevant.
- Automatically fix safe closure gaps when the expected fix is mechanical or local, including missing test coverage glue, BDD scenario edits, documentation updates, i18n additions, and narrowly scoped verification helpers.
- Stop for a checkpoint before changing product behavior, externally visible protocol names, permission semantics, default configuration, capability gating, or backwards compatibility behavior.
- Run or recommend the narrowest verification commands that cover the changed surfaces.
- Always run `git diff --check`.
- Run the narrowest relevant Jest target for changed unit-tested code.
- Run the narrowest relevant Playwright target for changed browser flows, helpers, or e2e coverage.
- Require BDD or real browser/runtime validation when the diff touches layout, startup, ACP runtime interaction, permission dialogs, WebMCP, protocol surfaces, or extension-facing behavior.
- Prepare a brief with:
  - what was checked
  - what was missing
  - what was fixed or proposed
  - verification evidence
  - remaining risk

## Checkpoint

Push the checkpoint right. Do the inspection and any safe mechanical fixes first, then ask once with a decision-ready brief.

The checkpoint must happen before any change that affects product behavior, externally visible protocol names, permission semantics, default configuration, capability gating, or backwards compatibility behavior.

## Verification Evidence

Mandatory for every run:

- `git diff --check`

Conditional mandatory evidence:

- Changed unit-tested TypeScript or React behavior: the narrowest relevant Jest target.
- Changed browser flow, Playwright helper, or e2e scenario: the narrowest relevant Playwright target.
- Changed layout, startup, ACP runtime interaction, permission dialog, WebMCP, protocol surface, or extension-facing behavior: BDD or real browser/runtime validation appropriate to that surface.

Optional recommendations:

- Broader package typecheck, workspace build, full Playwright config, or full CI-equivalent commands when the touched surface crosses package boundaries or the narrow tests leave meaningful risk.

## Open Questions

- What exact shape should the final brief have?
