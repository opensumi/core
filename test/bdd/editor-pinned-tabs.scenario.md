# Scenario: Editor Pinned Tabs - Core Behavior, Sticky Layout, Accessibility, and Persistence

**Trigger:** `packages/editor/src/browser/workbench-editor.service.ts`, `packages/editor/src/browser/tab.view.tsx`, `packages/editor/src/browser/editor.module.less`, `packages/editor/src/browser/editor.contribution.ts`, `packages/opened-editor/src/browser/opened-editor.contribution.ts`, or `tools/playwright/src/tests/editor.test.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server opened with Common Preflight on the disposable default Playwright workspace containing `editor.js`, `editor2.js`, and `editor3.js`. **Workspace mutation:** Temporary editor content, `editor.wrapTab`, open-tab order, and pinned state; restore or discard all mutations before the scenario ends. **Automation status:** Automated through Chrome DevTools MCP; the stable contract is already hardened by the five Pinned Tabs tests in `tools/playwright/src/tests/editor.test.ts`.

## Given

- Common Preflight in `test/bdd/README.md` passes at:
  ```text
  http://localhost:8080/?workspaceDir=<absolute disposable workspace path>
  ```
- The disposable workspace contains `editor.js`, `editor2.js`, and `editor3.js`.
- The runner records the original `.sumi/settings.json` content or its absence before changing `editor.wrapTab`.
- The runner starts with `editor.wrapTab=false`, closes leftover editors, and normalizes all three fixture tabs to ordinary, unpinned state.
- Menu actions may use either English or Chinese labels:
  - Pin Tab / 固定标签
  - Unpin Tab / 取消固定标签
  - Close / 关闭
  - Close All / 关闭全部
- The scenario uses `data-uri` to identify tabs and `data-pinned='true|false'` to observe pinned state.

## When

### Part A - Core Behavior and Close Semantics

1. `chrome-devtools-mcp`: Open `editor.js`, then open `editor2.js` so `editor2.js` is current.
2. Open the context menu for the inactive `editor.js` tab and choose Pin Tab.
3. Assert `editor.js` has `data-pinned='true'`, exposes the localized Unpin button, has no Close control, and has no visible Dirty indicator.
4. Assert `editor2.js` remains current.
5. Focus the `editor.js` Unpin button and press Enter.
6. Assert `editor.js` becomes ordinary and `editor2.js` remains current.
7. Pin `editor.js` again, focus its Unpin button, and press Space.
8. Assert `editor.js` becomes ordinary and `editor2.js` remains current; pin `editor.js` again for the remaining checks.
9. Middle-click the pinned `editor.js` tab and assert it remains open.
10. Activate `editor.js`, add the marker `// pinned dirty` on a new line without saving, and assert Dirty and Unpin are both visible.
11. Temporarily narrow the real non-wrap tab scroll viewport to `180px`, record the pinned tab x-coordinate, scroll the outer tab viewport to its maximum `scrollLeft`, and assert the pinned x-coordinate changes by less than `2px`.
12. Restore the original viewport width and `scrollLeft`.
13. Open the context menu for `editor2.js`, choose Close All, and assert `editor2.js` closes while pinned `editor.js` remains open.
14. Save `editor.js`, explicitly unpin and repin it, then choose Close from its context menu.
15. Assert the explicitly closed pinned tab is no longer visible.
16. Invoke Reopen Closed Editor with `Alt+Shift+T` and assert the reopened `editor.js` tab has `data-pinned='false'`; close it.

### Part B - Sticky Reachability, Wrap Transitions, and Keyboard Access

17. Open `editor.js`, `editor2.js`, and `editor3.js`; pin the first two and keep `editor3.js` ordinary.
18. Narrow the real non-wrap tab scroll viewport to `240px`, scroll to the end, and activate `editor3.js` through Explorer or another action that does not auto-scroll the tab element.
19. Record the outer viewport, pinned region, and active ordinary tab bounding boxes.
20. Assert the pinned region width is less than the viewport width and the active ordinary tab has visible pixels to the right of the visible pinned boundary.
21. Restore viewport state, unpin, and close all three tabs.
22. Reopen all three fixture files and pin all three.
23. Narrow the viewport to `240px`, reset both outer and nested pinned scroll positions to zero, then activate the last pinned tab without clicking its hidden tab element.
24. Assert the pinned region has a real nested overflow viewport (`clientWidth < scrollWidth`) and the active last pinned tab intersects the visible nested and outer viewport bounds.
25. Restore viewport state, unpin, and close all three tabs.
26. `bdd-fixture`: save the original `.sumi/settings.json`, write `{"editor.wrapTab": true}`, and reload the IDE so the tab component mounts in wrap mode.
27. Open all three fixture files, pin the first two, keep `editor3.js` ordinary, and assert wrap mode renders one flat tab sequence with pinned states `true, true, false` and no dedicated pinned wrapper row.
28. `bdd-fixture`: write `{"editor.wrapTab": false}` while the IDE remains open and wait for the non-wrap tab viewport.
29. Narrow the viewport to `240px`, change current state between a pinned tab and `editor3.js`, and assert the sticky pinned cap recomputes and the active ordinary tab remains reachable beside it.
30. Restore the original settings file, viewport state, tab state, and pin state.

### Part C - Persistence

31. Open `editor.js`, pin it, and verify `data-pinned='true'`.
32. Wait at least `500ms` for editor state persistence, then reload the IDE.
33. Assert the restored `editor.js` tab still has `data-pinned='true'`.
34. Activate the restored tab, press `Cmd/Ctrl+K`, then press `Shift+Enter`.
35. Assert the tab has `data-pinned='false'`, the ordinary Close control is available, and close the tab.

### Part D - Cleanup and Diagnostics

36. Restore the original `.sumi/settings.json` content, or delete the temporary file if it did not exist before the run.
37. Revert or discard the `// pinned dirty` file edit and close remaining fixture editors.
38. Restore any inline tab-viewport width, max-width, or scroll positions changed by the scenario.
39. Record bounded tab-state/geometry evidence and relevant console errors. Redact secret-like query values and do not save unbounded logs.

## Then

- Pinning an inactive tab never changes the current editor.
- Pinned tabs expose Unpin, hide Close, reject middle-click close, and show Dirty only when dirty.
- Enter and Space activate the native Unpin button without activating its parent tab.
- Routine Close All preserves pinned tabs, while explicit Close removes them.
- Reopen Closed Editor restores the resource as an ordinary tab.
- The non-wrap pinned prefix stays sticky during outer horizontal scrolling.
- Active ordinary tabs remain reachable beside a narrow sticky prefix.
- Over-wide pinned prefixes form a nested horizontal viewport that keeps the active pinned tab reachable.
- Wrap mode remains one flat naturally wrapping sequence, and switching back to non-wrap recomputes sticky reachability.
- Pinned state persists across reload and `Cmd/Ctrl+K, Shift+Enter` removes it.
- Cleanup restores file content, preferences, viewport styles, and tab state.

## Evidence

When evidence is needed, save it under:

```text
test/bdd/evidence/<date>/editor-pinned-tabs/
```

Capture only critical points:

- pinned/current state before and after keyboard and menu actions;
- clean versus Dirty control visibility;
- bounded viewport, pinned-region, and active-tab geometry;
- wrap-mode tab sequence and pinned prefix;
- pinned state before and after reload;
- cleanup result and redacted console diagnostics.

Do not commit evidence files.

## Hardening

- Hardening verdict: `CONVERT`, already satisfied.
- Existing hardened spec: `tools/playwright/src/tests/editor.test.ts`.
- Existing cases:
  - `Pinned Tabs should stay visible, dirty, and protected`
  - `Pinned Tabs should keep an active ordinary tab reachable beside the sticky prefix`
  - `Pinned Tabs should keep an active pinned tab reachable inside an over-wide sticky prefix`
  - `Pinned Tabs should refresh sticky scrolling after switching from wrap to non-wrap mode`
  - `Pinned Tabs should restore after reload`
- Do not generate a duplicate `editor-pinned-tabs.test.ts` unless the existing editor test suite is deliberately reorganized in a separate change.

## Pass / Fail Judgment

- **PASS** - all core, layout, keyboard, persistence, and cleanup expectations pass on the real IDE runtime.
- **BLOCKED** - Common Preflight, the disposable default workspace, stable tab/menu selectors, preference fixture mutation, or browser execution surface is unavailable.
- **FAIL** - prerequisites are present but any required pinned state, close behavior, keyboard action, sticky reachability, wrap transition, persistence, or cleanup assertion is violated.
