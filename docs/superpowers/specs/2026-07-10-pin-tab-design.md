# OpenSumi Editor Pinned Tabs Design

## Summary

OpenSumi will add Zed-style Pinned Tabs to each Editor Group. A Pinned Tab occupies a persistent leading region of its group, remains visible while ordinary tabs scroll, and is protected from ordinary close actions. This is separate from the existing Keep Open behavior currently exposed as `editor.pinCurrent`, which only promotes a Preview Tab into an ordinary tab.

The design preserves the existing `resources: IResource[]` contract. Each Editor Group maintains a contiguous pinned prefix at runtime and persists pinned resource URIs with its session state.

## Terminology

- **Pinned Tab**: A tab explicitly fixed within one Editor Group and restored with that group's session state.
- **Pinned Region**: The contiguous leading section containing every Pinned Tab in an Editor Group.
- **Preview Tab**: A provisional tab that may be replaced by a later preview open.
- **Keep Open**: The transition that promotes a Preview Tab into an ordinary non-preview tab. It does not pin the tab.

The same resource may be pinned in one Editor Group and ordinary in another.

## Goals

- Provide Pin Tab and Unpin Tab behavior aligned with Zed's core semantics.
- Keep pinned state local to an Editor Group.
- Preserve existing Preview and Keep Open behavior and command compatibility.
- Keep Pinned Tabs visible and protected from routine close operations.
- Restore pinned state with editor session state.
- Expose the real pinned state through the existing VS Code Tab API DTO.
- Support every editor tab type through the same group-level model.

## Non-goals

- Compact icon-only Pinned Tabs.
- A separate row for Pinned Tabs.
- Workspace-level favorite files or automatically pinning a URI when it is reopened.
- Pin All or Unpin All commands.
- Restoring pin state, original group, or original position through Reopen Closed Editor.
- Changing `Cmd/Ctrl+W` focus to a different Editor Group.
- Adding a new extension API that lets extensions mutate pin state directly.
- Refactoring `resources` into a new public tab-entry collection.

## State Model

Pinned state belongs to `EditorGroup`, never to `IResource`, because `ResourceService` may share the same resource object between groups.

Each group maintains a boundary such as `pinnedTabCount` with this invariant:

```text
0 <= pinnedTabCount <= resources.length
resources[0 .. pinnedTabCount)     = Pinned Tabs
resources[pinnedTabCount .. end)   = ordinary and Preview Tabs
```

The existing `resources: IResource[]` collection remains the source of truth for tab order. Group-level helpers centralize state changes:

- `isPinned(uri)`
- `pinTab(uri)`
- `unpinTab(uri)`
- `togglePinTab(uri)`
- tab movement helpers that update both order and the pinned boundary

The existing Preview-oriented `pin` and `pinPreviewed` behavior remains compatible and must not be reused for Pinned Tabs.

Operations for a URI that is closed or does not belong to the target group are safe no-ops. Every mutation clamps and validates the boundary after opening, closing, moving, restoring, or deleting resources.

## Pin and Unpin Behavior

Pinning a tab:

1. Performs Keep Open if the target is the group's Preview Tab.
2. Moves the target to the end of the Pinned Region.
3. Increments the pinned boundary.
4. Preserves the active resource and editor focus.

Unpinning a tab:

1. Moves the target to the beginning of the ordinary region.
2. Decrements the pinned boundary.
3. Does not restore Preview state.
4. Preserves the active resource and editor focus.

Pinning or unpinning an inactive tab through its context menu does not activate it.

## Opening, Splitting, and Moving Tabs

- Opening an ordinary resource while a Pinned Tab is active inserts it immediately after the Pinned Region. When an ordinary tab is active, the existing insert-after-current behavior remains unchanged.
- Splitting a Pinned Tab creates a pinned copy in the new Editor Group and leaves the source pinned.
- Dragging an ordinary tab into a Pinned Region pins it.
- Dragging a Pinned Tab into an ordinary region unpins it.
- Cross-group drops derive pin state from the target region.
- Dropping into an empty newly created group preserves the source tab's pin state because no target region exists yet.
- Dragging a Preview Tab into a Pinned Region also performs Keep Open.
- Movement within the same region only changes order.

All file, Untitled, Diff, Merge, Custom Editor, and Webview tabs can be pinned. Only tabs supported by the existing session revival mechanism can survive a session restart.

## Commands and Menus

The existing command remains unchanged:

- `editor.pinCurrent`
- `Cmd/Ctrl+K Enter`
- Meaning: Keep Open the current Preview Tab.

The new command is:

- `editor.togglePinnedTab`
- `Cmd/Ctrl+K Shift+Enter`
- Meaning: toggle the current tab's Pinned state.

The command palette operates on the active tab. The Editor Title context menu operates on the clicked tab and shows either Pin Tab or Unpin Tab. `TabTitleMenuService` creates a scoped pinned-state context key for the target URI; it must not infer state from the active editor.

Pinned Tabs show a Pin control that invokes Unpin. Double-clicking a Preview Tab continues to perform only the existing Keep Open behavior.

## Closing Semantics

Pinned Tabs are protected from ordinary close operations:

- They do not display a close X.
- Middle-click does not close them.
- Close Others, Close to Right, Close All, and Close Saved skip every Pinned Tab by default.
- Close Others on an ordinary tab therefore retains the target and every Pinned Tab.

When `Cmd/Ctrl+W` targets a Pinned Tab, the group activates its first ordinary tab without closing the pinned one. If the group has no ordinary tab, the command is a no-op and does not move focus to another group.

The context menu's explicit Close action can close a Pinned Tab and uses the existing dirty-resource confirmation flow. Low-level explicit close, resource deletion, forced cleanup, and the extension Tab API's explicit close can also close Pinned Tabs. User-facing bulk close operations must distinguish their default protected policy from internal forced cleanup.

Reopen Closed Editor keeps its existing behavior: an explicitly closed Pinned Tab reopens as an ordinary tab in the current group, without restoring pin metadata.

## Tab Bar Layout

In the default non-wrapping mode:

- The Pinned Region remains visible on the left.
- The ordinary region scrolls horizontally independently.
- The Pinned Region has no width cap; many Pinned Tabs may reduce the space available to ordinary tabs.
- The existing editor actions and right-side extension content retain their current placement.

Pinned Tabs keep their full icon, name, subname, read-only state, active state, and tooltip. The Pin control replaces the close X. When a Pinned Tab is dirty, the Dirty dot and Pin control are both visible. The final pinned tab uses the existing `tab.lastPinnedBorder` theme color to separate the two regions.

When `editor.wrapTab` is enabled, the tab list remains one naturally wrapping ordered sequence. Pinned Tabs form its leading prefix and ordinary tabs follow without a forced row break. No separate pinned row or horizontal pinned-region scrolling is introduced in wrap mode.

The Pin and Dirty controls remain inside the content passed through `IEditorTabService`, preserving Design tab overrides and other render customizations.

## Persistence and Restoration

`IEditorGroupState` gains a backwards-compatible optional field:

```ts
interface IEditorGroupState {
  uris: string[];
  current?: string;
  previewIndex: number;
  pinnedUris?: string[];
}
```

`getState()` filters resources through the existing revival rules and records the pinned URIs that remain in the saved ordered list. Persisting URIs instead of only the boundary prevents a failed pinned-resource restoration from accidentally pinning the next ordinary tab.

`restoreState()`:

1. Restores resources using the existing ordered backend-open flow.
2. Restores the active resource and Preview state using existing behavior.
3. Builds a set from `pinnedUris`.
4. Walks the successfully restored `resources` prefix until the first URI that was not saved as pinned.
5. Sets the pinned boundary to that validated prefix length.
6. Clears Preview state if a malformed state marked the same restored tab as both Preview and Pinned, preserving the rule that Pin includes Keep Open.

States without `pinnedUris` restore with zero Pinned Tabs. Deleted, missing, unsupported, or otherwise failed resources cannot extend the restored pinned boundary.

## Events and Extension API

Every Pin or Unpin operation fires the existing tab-changed notification so the UI, session state, context keys, and extension DTOs refresh.

If the resource index changes, the group also emits the existing `move` tab operation with the old and new indices. If only the pinned boundary changes while the resource remains at the same index, a state update is sufficient. No new public tab-operation type is introduced.

`EditorTabDtoData.from()` sets `isPinned` from `EditorGroup.isPinned(resource.uri)` instead of returning `false`. Extension-side tab order and update events must reflect the same final group state.

## Main Implementation Areas

- `packages/editor/src/browser/workbench-editor.service.ts`
  - group state, pin mutations, ordering, opening, closing, drag/drop, splitting, persistence
- `packages/editor/src/common/editor.ts`
  - group contract and `IEditorGroupState`
- `packages/editor/src/browser/tab.view.tsx`
  - pinned/ordinary rendering regions, controls, scrolling, drag targets, middle-click behavior
- `packages/editor/src/browser/editor.module.less`
  - pinned separator, Pin/Dirty layout, hover and wrap styles
- `packages/editor/src/browser/menu/title-context.menu.ts`
  - target-tab pinned context key
- `packages/editor/src/browser/editor.contribution.ts`
  - commands, menu entries, close policies, keybindings
- `packages/core-browser/src/common/common.command.ts`
  - stable command declaration
- `packages/extension/src/browser/vscode/api/main.thread.editor-tabs.ts`
  - `isPinned` and tab ordering updates
- editor localization, README, tests, and Design tab rendering coverage

## Failure Handling and Invariants

- Clamp the pinned boundary after every collection mutation.
- Closing or deleting an item inside the Pinned Region decrements the boundary.
- Cross-group moves update the source and destination boundaries independently.
- A failed target-group open leaves the source group unchanged.
- Restoration derives the boundary only from successfully restored prefix members.
- A tab cannot remain both Preview and Pinned after restoration; Pinned state wins and clears Preview.
- Context menu commands always carry the target `{ uri, group }` pair.
- Internal cleanup paths that must remove every tab explicitly opt into closing Pinned Tabs.

## Verification

Focused EditorGroup tests cover:

- Pin and Unpin ordering.
- Active-resource and focus preservation for active and inactive targets.
- Preview promotion and non-restoration after Unpin.
- Ordinary-tab insertion when a Pinned Tab is active.
- Same-group and cross-group drag behavior, including empty target groups.
- Split behavior.
- Single and bulk close protection.
- Explicit close and Reopen Closed Editor behavior.
- All supported editor tab input types.

State tests cover:

- Saving and restoring multiple pinned and ordinary tabs.
- Backwards compatibility without `pinnedUris`.
- Missing or failed pinned resources during restoration.
- Independent state for the same URI in multiple groups.

Extension tests cover:

- Correct `Tab.isPinned` values.
- Update-only events when the boundary changes without an index change.
- Move and update behavior when Pin or Unpin reorders a tab.

UI and runtime tests cover:

- Pin/Unpin context menu visibility for the clicked tab.
- Pin, Dirty, read-only, and active-state coexistence.
- Middle-click protection.
- Drag targets across the pinned boundary.
- Independent ordinary-region scrolling with the Pinned Region visible.
- Natural Wrap Tabs behavior and the pinned separator.
- Design tab overrides.

Verification uses focused Jest tests, the affected TypeScript reference build, `git diff --check`, and a running IDE or Playwright check for real scrolling and drag/drop layout behavior.

## Acceptance Criteria

- Users can Pin or Unpin any editor tab from its context menu, command palette, or default shortcut.
- Pinned Tabs form a stable, persistent, group-local leading region.
- Preview, opening, dragging, splitting, closing, scrolling, wrapping, and session restoration follow the rules above.
- Existing Keep Open behavior and shortcut remain compatible.
- Pinned Tabs are protected from routine close actions but remain explicitly closeable.
- VS Code Tab API consumers observe accurate pinned state and final ordering.
- Focused tests and runtime layout validation pass without changing unrelated editor behavior.
