# ACP Layout Switch Issue: Classic Resize Bound

## Category

Layout resize constraint.

## Evidence

- Runtime: `yarn start`
- URL: `http://localhost:8080/?workspaceDir=/Users/lujunsheng/ant/github/opensumi/core/tools/playwright/src/tests/workspaces/default`
- Scenario: `test/bdd/acp-layout-switch.scenario.md`
- Expected Classic AI Chat width range: `280px <= width <= 1080px`

Observed with real Playwright mouse drag:

| Step              | AI Chat width |
| ----------------- | ------------: |
| Before drag       |       `479px` |
| After first drag  |      `1079px` |
| After second drag |      `1493px` |

## Result

FAIL. Classic AI Chat can exceed the expected `1080px` maximum after dragging the AI Chat/workbench horizontal splitter.

## Review Notes

- The failure is tied to the horizontal splitter between workbench and `.AI-Chat-slot`.
- The resize path should enforce Classic maximum size after repeated drags, not only after the first drag.
- The existing BDD report claiming pass is stale relative to this observation and should be updated after the fix is verified.

## Root Cause

The horizontal resize logic in flex mode had asymmetric maximum-bound checks. When the fixed pane was the previous pane, the code used `nextMaxResize > nextWidth`; it should clamp when `nextWidth` is greater than or equal to `nextMaxResize`. The matching previous-pane branch also compared against the wrong width.

## Fix

- Updated `packages/core-browser/src/components/resize/resize.tsx` so both flex-mode max-resize branches clamp when either pane exceeds its own max.
- Strengthened `packages/ai-native/__test__/browser/ai-layout.test.tsx` so the outer SplitPanel child carries `maxResize` for AI Chat in both Classic and Agentic layouts.

## Verification

- `yarn jest packages/ai-native/__test__/browser/ai-layout.test.tsx --runInBand`
- Runtime Playwright/Chrome DevTools MCP recheck:
  - Classic before drag: `479px`
  - Drag toward min: `279px`
  - Drag toward max: `1079px`

Status: fixed.
