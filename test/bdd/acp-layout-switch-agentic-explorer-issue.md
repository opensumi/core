# ACP Layout Switch Issue: Agentic Explorer Visibility

## Category

Layout switch and side tabbar restore.

## Evidence

- Runtime: `yarn start`
- URL: `http://localhost:8080/?workspaceDir=/Users/lujunsheng/ant/github/opensumi/core/tools/playwright/src/tests/workspaces/default`
- Scenario: `test/bdd/acp-layout-switch.scenario.md`
- Expected Agentic behavior:
  - AI Chat is left of Explorer/workbench.
  - Explorer remains visible.
  - Explorer can expand folders and open files.

Observed after switching Classic -> Agentic:

| Element          | Geometry                   |
| ---------------- | -------------------------- |
| AI Chat          | `left=0`, `width=1080px`   |
| Editor/workbench | `left=1086`, `width=659px` |
| Explorer panel   | `width=0px`                |

After clicking the Explorer activity item:

| Element          | Geometry                   |
| ---------------- | -------------------------- |
| AI Chat          | `left=0`, `width=1440px`   |
| Editor/workbench | `left=1446`, `width=293px` |
| Explorer panel   | `left=1745`, `width=0px`   |

## Result

FAIL. Explorer text can return to the page after clicking the activity item, but the Explorer panel remains `0px` wide and is not practically visible.

## Review Notes

- This appears related to layout switch restore state or side tabbar width restoration.
- The Agentic layout resize bounds for AI Chat itself passed (`640px -> 1440px`), so the issue is narrower than all Agentic resizing.
- The fix should preserve Explorer visibility after Agentic switch without requiring manual splitter repair.

## Root Cause

The left tabbar renderer used the `extendView` tabbar service while rendering the left/view activity bar. In Agentic layout this meant Explorer activity state and resize restoration could be routed through the wrong service, leaving Explorer text present but the actual Explorer panel at `0px` width.

## Fix

- Updated `packages/ai-native/src/browser/layout/tabbar.view.tsx` to use `TabbarServiceFactory(SlotLocation.view)` in `AILeftTabbarRenderer`.
- Added coverage in `packages/ai-native/__test__/browser/ai-tabbar-layout.test.tsx` to assert the Agentic left tabbar uses the `view` tabbar service.

## Verification

- `yarn jest packages/ai-native/__test__/browser/ai-tabbar-layout.test.tsx --runInBand`
- `yarn jest packages/main-layout/__tests__/browser/layout.service.test.tsx --runInBand`
- Runtime Playwright/Chrome DevTools MCP recheck after switching to Agentic and clicking Explorer:
  - AI Chat: `left=0`, `width=1080px`
  - Explorer: `left=1485`, `width=260px`
  - Editor/workbench: `left=1086`, `width=393px`

Status: fixed.
