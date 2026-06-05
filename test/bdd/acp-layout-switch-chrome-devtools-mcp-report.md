# ACP Layout Switch Chrome DevTools MCP + WebMCP Test Report

Date: 2026-06-03

## Scope

- Module: ACP / AI Native layout switching.
- Runtime: `yarn start`.
- Browser control: Chrome DevTools MCP.
- WebMCP usage: supplemental read-only capability checks and ACP chat view activation.
- Playwright: not run in this verification pass.

## Environment

- Workspace: `/Users/lujunsheng/ant/github/opensumi/core/tools/playwright/src/tests/workspaces/default`
- URL: `http://127.0.0.1:8080/?workspaceDir=/Users/lujunsheng/ant/github/opensumi/core/tools/playwright/src/tests/workspaces/default`
- IDE readiness checks:
  - `#main` exists.
  - Layout selector visible.
  - Explorer visible.
  - AI Chat view visible after ACP/WebMCP activation.

## WebMCP Capability Check

- `navigator.modelContext`: present.
- Available browser tools: 29.
- Legacy `_opensumi/...` tool names: 0.
- Representative successful calls:
  - `workspace_getInfo({})`
  - `acp_chat_showChatView({})`
  - `acp_chat_getSessionState({})`
  - `acp_chat_getPermissionState({})`
  - `editor_getActive({})`
  - `workspace_listOpenFiles({})`
- `file_*` tools were not exposed in this browser catalog, so `file_exists` and `file_read` were not called.

## Chrome DevTools MCP Interaction Steps

1. Loaded the IDE using `yarn start`.
2. Verified the default layout control showed `Agentic Layout`.
3. Used WebMCP `acp_chat_showChatView({})` to ensure ACP chat was visible.
4. Used the visible layout selector to switch `Agentic Layout -> Classic Layout`.
5. Verified Classic layout geometry:
   - Explorer: `x=48`, `width=231`
   - AI Chat: `x=1321`, `width=479`
   - Result: Explorer/workbench is left of AI Chat.
6. In Classic layout:
   - Expanded `test`.
   - Opened `test/test.js`.
   - Verified `editor_getActive({})` returned active file `test/test.js`.
7. Used the visible layout selector to switch `Classic Layout -> Agentic Layout`.
8. Verified Agentic layout geometry:
   - AI Chat: `x=0`, `width=1080`
   - Workbench: `x=1086`
   - Explorer: `x=1611`, `width=134`
   - Result: AI Chat is left of workbench/Explorer.
9. In Agentic layout:
   - Confirmed `test` remained expanded.
   - Opened `editor.js` from Explorer.
   - Verified `editor_getActive({})` returned active file `editor.js`.

## Resize Coverage

Additional Chrome DevTools MCP drag checks were performed for visible layout splitters.

1. Agentic AI Chat / Workbench horizontal splitter:
   - Before: AI Chat was collapsed, `x=0`, `width=0`; workbench `x=6`, `width=1794`.
   - Dragged the left horizontal splitter from `x=3` to `x=360`.
   - After: AI Chat became visible, `x=0`, `width=640`; workbench moved to `x=646`, `width=1154`.
   - Result: passed.
2. Agentic bottom Panel / Workbench vertical splitter:
   - Before: vertical splitter `y=642`.
   - Dragged the splitter upward to `y=512`.
   - After: Terminal panel title moved from `y=649.5` to `y=519.5`.
   - Result: passed.
3. Agentic Explorer / Workbench horizontal splitter:
   - Before: Explorer panel was collapsed, `x=1745`, `width=0`; Explorer slot `width=48`.
   - Dragged the Explorer left splitter from `x=1742` to `x=1482`.
   - After: Explorer panel became visible, `x=1485`, `width=260`; Explorer slot `width=308`.
   - File tree nodes became fully visible.
   - Result: passed.
4. Classic AI Chat / Workbench horizontal splitter:
   - Before: AI Chat `x=1321`, `width=479`; workbench `width=1314`.
   - Dragged the splitter from `x=1317` to `x=1197`.
   - After: AI Chat `x=721`, `width=1079`; workbench `width=714`.
   - Result: passed.
5. Post-resize Explorer interaction:
   - Opened `editor2.js` from Explorer.
   - `editor_getActive({})` returned active file `editor2.js`.
   - `workspace_listOpenFiles({})` returned one active open file, `editor2.js`.
   - Result: passed.

## Result

Passed.

- Layout switching worked in both directions without page reload.
- AI Chat remained visible after switching.
- Explorer/file tree remained visible and interactive after each switch.
- File open behavior continued to work after each switch.
- Drag resizing worked for Agentic AI, Agentic Explorer, Agentic bottom Panel, and Classic AI splitters.
- WebMCP read-only/editor/workspace/ACP checks continued to return successful bounded results.

## Notes

- Earlier `start:e2e` verification was not representative for this ACP/WebMCP path because browser `navigator.modelContext` was absent there.
- The valid verification path for this report is `yarn start`, as requested.
- The `yarn start` server was stopped after verification.
