# OpenSumi Editor Pinned Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, group-local Zed-style Pinned Tabs to the OpenSumi editor without changing the existing Preview/Keep Open behavior.

**Architecture:** Keep `EditorGroup.resources` as the ordered tab collection and track Pinned Tabs as a contiguous leading prefix with `pinnedTabCount`. Centralize every pin, unpin, reorder, open, close, split, drag, and restore mutation in `EditorGroup`; persist pinned URIs to survive partial restoration safely. Render the pinned prefix as a sticky left group inside the existing non-wrap scroller, while wrap mode keeps one flat naturally wrapping sequence.

**Tech Stack:** TypeScript, React, LESS modules, OpenSumi dependency injection and command/menu registries, Jest/jsdom, Playwright, Yarn 4.4.1, Node.js `>=18.12.0`.

## Global Constraints

- Keep `editor.pinCurrent` and `Cmd/Ctrl+K Enter` as Keep Open; never reuse them for Pinned Tabs.
- Add `editor.togglePinnedTab` with `Cmd/Ctrl+K Shift+Enter` for the new feature.
- Pinned state is local to an Editor Group and must never be stored on shared `IResource` objects.
- Preserve the `browser`, `node`, and `common` import boundaries and introduce no new dependency.
- Support file, Untitled, Diff, Merge, Custom Editor, and Webview tabs through the same group model.
- Keep the default full-title single-row UI; do not add compact tabs, a separate pinned row, Pin All, or Unpin All.
- Preserve user-owned untracked files. Before every commit, run `git status --short` and stage only the exact files listed by that task.
- Follow TDD: add a focused failing test, observe the expected failure, implement the smallest complete behavior, then rerun the focused test.

---

## File Map

- `packages/editor/src/common/editor.ts`
  - Public `IEditorGroup` pinned-state contract, close options, and persisted `IEditorGroupState.pinnedUris`.
- `packages/editor/src/browser/workbench-editor.service.ts`
  - Pinned-prefix invariant, pin mutations, insertion, splitting, drag/drop, close protection, and restoration.
- `packages/editor/src/browser/tab.view.tsx`
  - Pinned tab controls, sticky pinned prefix, Dirty/Pin coexistence, middle-click protection, and drag targets.
- `packages/editor/src/browser/editor.module.less`
  - Sticky prefix, separator, Pin/Dirty layout, hover behavior, and wrap-mode styles.
- `packages/editor/src/browser/menu/title-context.menu.ts`
  - Scoped `editorTabPinned` context key for the clicked tab.
- `packages/editor/src/browser/editor.contribution.ts`
  - Toggle command, close-command protection, menu entries, and keybinding.
- `packages/core-browser/src/common/common.command.ts`
  - Stable `EDITOR_COMMANDS.TOGGLE_PINNED_TAB` declaration.
- `packages/i18n/src/common/en-US.lang.ts`
  - English command, menu, tooltip, and accessibility text.
- `packages/i18n/src/common/zh-CN.lang.ts`
  - Chinese command, menu, tooltip, and accessibility text.
- `packages/extension/src/browser/vscode/api/main.thread.editor-tabs.ts`
  - Real `Tab.isPinned` DTO values and explicit close-group behavior.
- `packages/editor/README.md`
  - Correct Keep Open terminology and new command documentation.
- `packages/editor/__tests__/browser/editor-service.test.ts`
  - Pinned model, lifecycle, close, drag, split, and persistence tests.
- `packages/editor/__tests__/browser/editor.contribution.test.ts`
  - Toggle command, protected close command, and keybinding tests.
- `packages/editor/__tests__/browser/editor.feature.test.ts`
  - Clicked-tab pinned context-key test.
- `packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts`
  - Main-thread Tab DTO and update/move event tests.
- `tools/playwright/src/editor.ts`
  - Pinned-tab inspection and interaction helpers.
- `tools/playwright/src/tests/editor.test.ts`
  - Runtime Pin/Unpin, close protection, Dirty state, persistence, and sticky scrolling coverage.

---

### Task 1: Add the Pinned-Prefix State Model

**Files:**

- Modify: `packages/editor/src/common/editor.ts:415-510`
- Modify: `packages/editor/src/browser/workbench-editor.service.ts:691-1160`
- Test: `packages/editor/__tests__/browser/editor-service.test.ts:190-525`
- Test support: `packages/markers/__tests__/browser/markes-service.test.ts:40-75`

**Interfaces:**

- Produces: `IEditorGroup.pinnedTabCount: number`
- Produces: `IEditorGroup.isPinned(uri: URI): boolean`
- Produces: `IEditorGroup.pinTab(uri: URI): boolean`
- Produces: `IEditorGroup.unpinTab(uri: URI): boolean`
- Produces: `IEditorGroup.togglePinTab(uri: URI): boolean`
- Produces: `EditorGroup.moveTab(uri: URI, targetIndex: number, pinned?: boolean): boolean`
- Preserves: `IEditorGroup.pin(uri: URI): Promise<void>` as Preview Keep Open.

- [ ] **Step 1: Write failing pin/unpin model tests**

Add these tests inside `describe('workbench editor service tests', ...)` in `packages/editor/__tests__/browser/editor-service.test.ts`:

```ts
it('should keep pinned tabs as a leading prefix without changing the active resource', async () => {
  const a = new URI('test://pin/a');
  const b = new URI('test://pin/b');
  const c = new URI('test://pin/c');
  await editorService.open(a, { preview: false });
  await editorService.open(b, { preview: false });
  await editorService.open(c, { preview: false });

  const group = editorService.currentEditorGroup as EditorGroup;
  expect(group.pinTab(b)).toBe(true);
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([b, a, c].map(String));
  expect(group.pinnedTabCount).toBe(1);
  expect(group.currentResource?.uri.toString()).toBe(c.toString());

  expect(group.pinTab(c)).toBe(true);
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([b, c, a].map(String));
  expect(group.pinnedTabCount).toBe(2);

  expect(group.unpinTab(b)).toBe(true);
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([c, b, a].map(String));
  expect(group.isPinned(c)).toBe(true);
  expect(group.isPinned(b)).toBe(false);

  while (group.pinnedTabCount > 0) {
    group.unpinTab(group.resources[0].uri);
  }
  await group.closeAll();
});

it('should keep open a preview when it becomes pinned and never restore preview on unpin', async () => {
  const uri = new URI('test://pin/preview');
  await editorService.open(uri, { preview: true });
  const group = editorService.currentEditorGroup as EditorGroup;

  expect(group.previewURI?.toString()).toBe(uri.toString());
  expect(group.pinTab(uri)).toBe(true);
  expect(group.previewURI).toBeNull();
  expect(group.isPinned(uri)).toBe(true);

  expect(group.unpinTab(uri)).toBe(true);
  expect(group.previewURI).toBeNull();
  expect(group.isPinned(uri)).toBe(false);
  expect(group.pinTab(new URI('test://pin/not-open'))).toBe(false);

  await group.close(uri, { force: true });
});

it.each(['file', 'untitled', 'diff', 'mergeEditor', 'custom-editor', 'webview'])(
  'should keep pinned state independent of the %s tab input type',
  (scheme) => {
    const group = editorService.currentEditorGroup as EditorGroup;
    const uri = new URI(`${scheme}://pin/type`);
    group.resources = [{ uri, name: `${scheme}-tab` } as any];

    expect(group.pinTab(uri)).toBe(true);
    expect(group.isPinned(uri)).toBe(true);
    expect(group.unpinTab(uri)).toBe(true);
    expect(group.isPinned(uri)).toBe(false);

    group.resources = [];
  },
);
```

- [ ] **Step 2: Run the focused test and confirm the missing API failure**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL with TypeScript/runtime errors showing that `pinTab`, `unpinTab`, `isPinned`, or `pinnedTabCount` do not exist.

- [ ] **Step 3: Add the public pinned-state contract**

Extend `IEditorGroup` in `packages/editor/src/common/editor.ts`:

```ts
readonly pinnedTabCount: number;

isPinned(uri: URI): boolean;

pinTab(uri: URI): boolean;

unpinTab(uri: URI): boolean;

togglePinTab(uri: URI): boolean;
```

Do not rename or remove the existing Preview-oriented `pin(uri)` method.

Update the concrete `IEditorGroup` test double in `packages/markers/__tests__/browser/markes-service.test.ts` with neutral pinned behavior:

```ts
pinnedTabCount: 0,
isPinned: () => false,
pinTab: () => false,
unpinTab: () => false,
togglePinTab: () => false,
```

- [ ] **Step 4: Implement one atomic reorder primitive**

Add the field and methods near `previewURI` and `resources` in `EditorGroup`:

```ts
private _pinnedTabCount = 0;

get pinnedTabCount(): number {
  return this._pinnedTabCount;
}

isPinned(uri: URI): boolean {
  const index = this.resources.findIndex((resource) => resource.uri.isEqual(uri));
  return index >= 0 && index < this._pinnedTabCount;
}

moveTab(uri: URI, targetIndex: number, pinned = this.isPinned(uri)): boolean {
  const oldIndex = this.resources.findIndex((resource) => resource.uri.isEqual(uri));
  if (oldIndex < 0) {
    return false;
  }

  const wasPinned = oldIndex < this._pinnedTabCount;
  const stateChanged = wasPinned !== pinned;
  if (!stateChanged && oldIndex === targetIndex) {
    return false;
  }

  const nextPinnedTabCount = Math.max(
    0,
    Math.min(
      this.resources.length,
      this._pinnedTabCount + (pinned && !wasPinned ? 1 : 0) - (!pinned && wasPinned ? 1 : 0),
    ),
  );
  const [resource] = this.resources.splice(oldIndex, 1);
  const maximumIndex = this.resources.length;
  const minimumIndex = pinned ? 0 : nextPinnedTabCount;
  const maximumRegionIndex = pinned ? Math.max(0, nextPinnedTabCount - 1) : maximumIndex;
  const nextIndex = Math.max(minimumIndex, Math.min(targetIndex, maximumRegionIndex));

  this.resources.splice(nextIndex, 0, resource);
  this._pinnedTabCount = nextPinnedTabCount;
  if (pinned && this.previewURI?.isEqual(uri)) {
    this.previewURI = null;
  }

  if (oldIndex !== nextIndex) {
    this._onDidEditorGroupTabOperation.fire({
      type: 'move',
      resource,
      oldIndex,
      index: nextIndex,
    });
  }
  this.notifyTabChanged();
  return stateChanged || oldIndex !== nextIndex;
}

pinTab(uri: URI): boolean {
  if (this.isPinned(uri)) {
    return false;
  }
  return this.moveTab(uri, this._pinnedTabCount, true);
}

unpinTab(uri: URI): boolean {
  if (!this.isPinned(uri)) {
    return false;
  }
  return this.moveTab(uri, this._pinnedTabCount - 1, false);
}

togglePinTab(uri: URI): boolean {
  return this.isPinned(uri) ? this.unpinTab(uri) : this.pinTab(uri);
}
```

- [ ] **Step 5: Run the model tests**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts packages/markers/__tests__/browser/markes-service.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS, including the new pinned-prefix/type-neutral tests, the markers test double, and all existing editor-service tests.

- [ ] **Step 6: Commit the state model**

```bash
git status --short
git add packages/editor/src/common/editor.ts packages/editor/src/browser/workbench-editor.service.ts packages/editor/__tests__/browser/editor-service.test.ts packages/markers/__tests__/browser/markes-service.test.ts
git commit -m "feat(editor): add pinned tab state model"
```

---

### Task 2: Integrate Opening, Closing, Splitting, and Dragging

**Files:**

- Modify: `packages/editor/src/browser/workbench-editor.service.ts:1377-1475`
- Modify: `packages/editor/src/browser/workbench-editor.service.ts:1956-2025`
- Modify: `packages/editor/src/browser/workbench-editor.service.ts:2240-2300`
- Test: `packages/editor/__tests__/browser/editor-service.test.ts`

**Interfaces:**

- Consumes: `EditorGroup.moveTab`, `pinTab`, `isPinned`, and `pinnedTabCount` from Task 1.
- Produces: ordinary opens never enter the Pinned Region implicitly.
- Produces: split and cross-group drag preserve or derive pinned state exactly once.
- Produces: explicit single-tab close keeps the boundary valid.

- [ ] **Step 1: Add failing lifecycle and drag tests**

Add focused tests:

```ts
it('should insert an ordinary tab after the pinned prefix when a pinned tab is active', async () => {
  const pinned = new URI('test://pin/open-pinned');
  const ordinary = new URI('test://pin/open-ordinary');
  await editorService.open(pinned, { preview: false });
  const group = editorService.currentEditorGroup as EditorGroup;
  group.pinTab(pinned);
  await group.open(ordinary, { preview: false });

  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString(), ordinary.toString()]);
  expect(group.pinnedTabCount).toBe(1);

  await group.close(ordinary, { force: true });
  await group.close(pinned, { force: true });
});

it('should preserve pin state when splitting a pinned tab', async () => {
  const uri = new URI('test://pin/split');
  await editorService.open(uri, { preview: false });
  const source = editorService.currentEditorGroup as EditorGroup;
  source.pinTab(uri);

  await source.split(EditorGroupSplitAction.Right, uri, { focus: true });
  const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
  expect(source.isPinned(uri)).toBe(true);
  expect(target.isPinned(uri)).toBe(true);

  await source.close(uri, { force: true });
  await target.close(uri, { force: true });
});

it('should change pin state when a same-group drag crosses the pinned boundary', async () => {
  const a = new URI('test://pin/drag-a');
  const b = new URI('test://pin/drag-b');
  const c = new URI('test://pin/drag-c');
  await editorService.open(a, { preview: false });
  await editorService.open(b, { preview: false });
  await editorService.open(c, { preview: false });
  const group = editorService.currentEditorGroup as EditorGroup;
  group.pinTab(a);

  await group.dropUri(c, DragOverPosition.CENTER, group, group.resources[0]);
  expect(group.isPinned(c)).toBe(true);

  const firstOrdinary = group.resources[group.pinnedTabCount];
  await group.dropUri(c, DragOverPosition.CENTER, group, firstOrdinary);
  expect(group.isPinned(c)).toBe(false);

  for (const resource of [...group.resources]) {
    await group.close(resource.uri, { force: true });
  }
});

it('should derive pin state from the target region during a cross-group drop', async () => {
  const sourceUri = new URI('test://pin/cross-source');
  const targetUri = new URI('test://pin/cross-target');
  await editorService.open(sourceUri, { preview: false });
  const source = editorService.currentEditorGroup as EditorGroup;
  await source.split(EditorGroupSplitAction.Right, targetUri, { focus: true });
  const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
  target.pinTab(targetUri);

  await target.dropUri(sourceUri, DragOverPosition.CENTER, source, target.resources[0]);
  expect(target.isPinned(sourceUri)).toBe(true);
  expect(source.resources.some((resource) => resource.uri.isEqual(sourceUri))).toBe(false);

  for (const resource of [...target.resources]) {
    await target.close(resource.uri, { force: true });
  }
});
```

Add `DragOverPosition` to the existing import from `@opensumi/ide-editor/lib/browser`.

- [ ] **Step 2: Run the lifecycle tests and confirm their failures**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL because ordinary insertion can still occur inside the prefix, split does not copy pin state, drag does not derive state from the target region, and close does not shrink the boundary.

- [ ] **Step 3: Clamp ordinary insertion after the pinned prefix**

In the new-resource branch of `doOpen`, replace direct current/index insertion with a single calculated index:

```ts
const currentIndex = this.currentResource ? this.resources.indexOf(this.currentResource) : this.resources.length - 1;
const hasExplicitIndex = options.index !== undefined && options.index < this.resources.length;
const requestedIndex = hasExplicitIndex ? options.index! : currentIndex + 1;
const insertionIndex = Math.max(this._pinnedTabCount, Math.min(requestedIndex, this.resources.length));
const replaceResource = hasExplicitIndex ? this.resources[insertionIndex] : this.currentResource;

this.resources.splice(insertionIndex, 0, resource);
tabOperationToFire = {
  type: 'open',
  resource,
  index: insertionIndex,
};
```

Keep Preview replacement and `options.replace` behavior after this insertion block.

- [ ] **Step 4: Preserve pin state across split**

Change `split` to remember the source state and pin the successfully opened target:

```ts
const shouldPin = this.isPinned(uri);
const result = await editorGroup.open(uri, { ...options, preview: false, revealRangeInCenter: false });
if (result && shouldPin) {
  editorGroup.pinTab(uri);
}
return result;
```

- [ ] **Step 5: Keep the boundary valid on explicit close**

Immediately after removing the resource in `close`:

```ts
this.resources.splice(index, 1);
if (index < this._pinnedTabCount) {
  this._pinnedTabCount--;
}
```

Retain the existing explicit-close confirmation, close event, current-resource fallback, and resource disposal flow.

- [ ] **Step 6: Make drop behavior derive state from the target region**

Record the source state before branching. For edge drops, apply it to the newly created split before closing the source:

```ts
const sourceWasPinned = sourceGroup?.isPinned(uri) ?? this.isPinned(uri);
if (position !== DragOverPosition.CENTER) {
  const result = await this.split(getSplitActionFromDragDrop(position), uri, { preview: false, focus: true });
  if (!result) {
    return;
  }
  const targetGroup = result.group as EditorGroup;
  if (sourceWasPinned && !targetGroup.isPinned(uri)) {
    targetGroup.pinTab(uri);
  }
  if (sourceGroup) {
    await sourceGroup.close(uri);
  }
  return;
}
```

Refactor the center-drop branch around this flow:

```ts
const targetIndex = targetResource ? this.resources.indexOf(targetResource) : this.resources.length;
const targetPinned = targetResource
  ? targetIndex >= 0 && targetIndex < this._pinnedTabCount
  : this.resources.length === 0
  ? sourceWasPinned
  : false;

if (sourceGroup === this) {
  this.moveTab(uri, targetIndex, targetPinned);
  await this.open(uri, { preview: false, focus: true });
  return;
}

const opened = await this.open(uri, {
  index: targetIndex,
  preview: false,
  focus: true,
});
if (!opened) {
  return;
}
this.moveTab(uri, targetIndex, targetPinned);
if (sourceGroup) {
  await sourceGroup.close(uri);
}
```

Only close the source after the target split/open succeeds. An empty target preserves the source pinned state.

- [ ] **Step 7: Run lifecycle tests**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS for insertion, split, drag, close-boundary, and all previous editor-service behavior.

- [ ] **Step 8: Commit lifecycle integration**

```bash
git status --short
git add packages/editor/src/browser/workbench-editor.service.ts packages/editor/__tests__/browser/editor-service.test.ts
git commit -m "feat(editor): integrate pinned tabs with tab lifecycle"
```

---

### Task 3: Protect Pinned Tabs from Routine Close Actions

**Files:**

- Modify: `packages/editor/src/common/editor.ts:415-510`
- Modify: `packages/editor/src/browser/workbench-editor.service.ts:1956-2205`
- Modify: `packages/editor/src/browser/history/index.ts:185-194`
- Test: `packages/editor/__tests__/browser/editor-service.test.ts`
- Test: `packages/editor/__tests__/browser/editor.feature.test.ts:168-445`

**Interfaces:**

- Produces: `IEditorGroupCloseOptions { closePinned?: boolean; force?: boolean }`
- Produces: `IEditorGroup.closeAll(options?: IEditorGroupCloseOptions): Promise<boolean>`
- Produces: `EditorGroup.activateFirstUnpinned(): Promise<boolean>`
- Preserves: `close(uri)` as an explicit close primitive that can close a Pinned Tab.

- [ ] **Step 1: Add failing close-policy tests**

```ts
it('should protect pinned tabs from bulk close operations', async () => {
  const pinned = new URI('test://pin/protected');
  const target = new URI('test://pin/target');
  const other = new URI('test://pin/other');
  await editorService.open(pinned, { preview: false });
  await editorService.open(target, { preview: false });
  await editorService.open(other, { preview: false });
  const group = editorService.currentEditorGroup as EditorGroup;
  group.pinTab(pinned);

  await group.closeOthers(target);
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString(), target.toString()]);

  await group.open(other, { preview: false });
  await group.closeToRight(pinned);
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);

  await group.open(target, { preview: false });
  await group.closeSaved();
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);

  await group.open(target, { preview: false });
  await group.closeAll();
  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString()]);
  expect(group.isPinned(pinned)).toBe(true);

  await group.closeAll({ closePinned: true, force: true });
  expect(group.resources).toHaveLength(0);
});

it('should activate the first ordinary tab instead of closing an active pinned tab', async () => {
  const pinned = new URI('test://pin/active');
  const ordinary = new URI('test://pin/fallback');
  await editorService.open(pinned, { preview: false });
  await editorService.open(ordinary, { preview: false });
  const group = editorService.currentEditorGroup as EditorGroup;
  group.pinTab(pinned);
  await group.open(pinned, { focus: true });

  expect(await group.activateFirstUnpinned()).toBe(true);
  expect(group.currentResource?.uri.toString()).toBe(ordinary.toString());

  await group.open(pinned, { focus: true });
  await group.close(ordinary, { force: true });
  expect(await group.activateFirstUnpinned()).toBe(false);
  expect(group.currentResource?.uri.toString()).toBe(pinned.toString());

  await group.closeAll({ closePinned: true, force: true });
});
```

In the existing editor-history test, make `testEditorGroup.open` a Jest mock that still assigns `currentUri`, then add this assertion after `historyService.popClosed()`:

```ts
expect(testEditorGroup.open).toHaveBeenLastCalledWith(testUri3, {
  focus: true,
  preview: false,
});
```

- [ ] **Step 2: Run the tests and confirm bulk close currently removes Pinned Tabs**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts packages/editor/__tests__/browser/editor.feature.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL because `closeAll` has no options, bulk methods do not filter pinned resources, `activateFirstUnpinned` does not exist, and reopened entries do not force `preview: false`.

- [ ] **Step 3: Add close options to the common contract**

In `packages/editor/src/common/editor.ts`:

```ts
export interface IEditorGroupCloseOptions {
  closePinned?: boolean;
  force?: boolean;
}
```

Change the interface method to:

```ts
closeAll(options?: IEditorGroupCloseOptions): Promise<boolean>;
```

- [ ] **Step 4: Centralize multi-resource closing**

Import `IEditorGroupCloseOptions` and add this helper to `EditorGroup`:

```ts
private async closeResources(resourcesToClose: IResource[], force = false): Promise<boolean> {
  const uniqueResources = resourcesToClose.filter(
    (resource, index, resources) => resources.findIndex((candidate) => candidate.uri.isEqual(resource.uri)) === index,
  );
  for (const resource of uniqueResources) {
    if (!force && !(await this.shouldClose(resource))) {
      return false;
    }
  }

  const currentWasClosed = !!this.currentResource && uniqueResources.includes(this.currentResource);
  const currentIndex = this.currentResource ? this.resources.indexOf(this.currentResource) : -1;
  const previewWasClosed =
    !!this.previewURI && uniqueResources.some((resource) => resource.uri.isEqual(this.previewURI!));
  const indexed = uniqueResources
    .map((resource) => ({ resource, index: this.resources.indexOf(resource) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => right.index - left.index);

  for (const { resource, index } of indexed) {
    this.resources.splice(index, 1);
    if (index < this._pinnedTabCount) {
      this._pinnedTabCount--;
    }
    this._onDidEditorGroupTabOperation.fire({ type: 'close', resource, index });
    this.clearResourceOnClose(resource);
    this.disposeDocumentRef(resource.uri);
  }
  if (previewWasClosed) {
    this.previewURI = null;
  }

  if (currentWasClosed) {
    const nextResource = this.resources[Math.min(Math.max(currentIndex, 0), this.resources.length - 1)];
    if (nextResource) {
      await this.open(nextResource.uri);
    } else {
      this.backToEmpty();
    }
  } else {
    this.notifyTabChanged();
  }
  if (this.resources.length === 0) {
    this.availableOpenTypes = [];
    this.activeComponents.clear();
    if (this.grid.parent) {
      this.dispose();
    }
  }
  return true;
}
```

- [ ] **Step 5: Apply the protected filters**

Use the helper in each bulk method:

```ts
async closeAll({ closePinned = false, force = false }: IEditorGroupCloseOptions = {}): Promise<boolean> {
  const resourcesToClose = this.resources.filter((resource) => closePinned || !this.isPinned(resource.uri));
  return this.closeResources(resourcesToClose, force);
}

async closeSaved() {
  const resourcesToClose = this.resources.filter((resource) => {
    const decoration = this.resourceService.getResourceDecoration(resource.uri);
    return !this.isPinned(resource.uri) && (!decoration || !decoration.dirty);
  });
  return this.closeResources(resourcesToClose);
}

async closeToRight(uri: URI) {
  const index = this.resources.findIndex((resource) => resource.uri.isEqual(uri));
  if (index < 0) {
    return false;
  }
  return this.closeResources(
    this.resources.slice(index + 1).filter((resource) => !this.isPinned(resource.uri)),
  );
}

async closeOthers(uri: URI) {
  const target = this.resources.find((resource) => resource.uri.isEqual(uri));
  if (!target) {
    return false;
  }
  const closed = await this.closeResources(
    this.resources.filter((resource) => resource !== target && !this.isPinned(resource.uri)),
  );
  if (closed) {
    await this.open(uri);
  }
  return closed;
}

async activateFirstUnpinned(): Promise<boolean> {
  const resource = this.resources[this._pinnedTabCount];
  if (!resource) {
    return false;
  }
  await this.open(resource.uri, { focus: true });
  return true;
}
```

Update the no-URI branch of `WorkbenchEditorServiceImpl.closeAll(uri?, force?)` at line 575 to call `group.closeAll({ closePinned: !!force, force: !!force })`. Leave the user-facing calls in `editor.contribution.ts` and `opened-editor` on their default protected behavior. Task 6 changes the extension TabGroups close path to `{ closePinned: true }`; URI-specific Webview cleanup continues through explicit `close(uri, { force })` and needs no bulk-policy change.

Change `EditorHistoryService.popClosed()` so reopened entries are ordinary, not Preview:

```ts
this.editorService.open(uri, {
  focus: true,
  preview: false,
});
```

- [ ] **Step 6: Run close-policy tests**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts packages/editor/__tests__/browser/editor.feature.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS for protected Close Others/All, explicit close-all, first-ordinary activation, and all existing close tests.

- [ ] **Step 7: Commit close protection**

```bash
git status --short
git add packages/editor/src/common/editor.ts packages/editor/src/browser/workbench-editor.service.ts packages/editor/src/browser/history/index.ts packages/editor/__tests__/browser/editor-service.test.ts packages/editor/__tests__/browser/editor.feature.test.ts
git commit -m "feat(editor): protect pinned tabs from close actions"
```

---

### Task 4: Persist and Restore Pinned State

**Files:**

- Modify: `packages/editor/src/common/editor.ts:959-966`
- Modify: `packages/editor/src/browser/workbench-editor.service.ts:2328-2385`
- Test: `packages/editor/__tests__/browser/editor-service.test.ts`

**Interfaces:**

- Produces: `IEditorGroupState.pinnedUris?: string[]`
- Consumes: `pinnedTabCount` and `isPinned` from Task 1.
- Guarantees: old states restore with zero Pinned Tabs; partial restoration cannot pin an ordinary tab.

- [ ] **Step 1: Extend the existing state tests with pinned cases**

Update the existing `getState()` expectation to include `pinnedUris: []`, then add:

```ts
it('should persist pinned uris and restore only the successfully revived pinned prefix', async () => {
  const pinned = new URI('test://pin/state-pinned');
  const ordinary = new URI('test://pin/state-ordinary');
  await editorService.open(pinned, { preview: false });
  await editorService.open(ordinary, { preview: false });
  const group = editorService.currentEditorGroup as EditorGroup;
  group.pinTab(pinned);

  expect(group.getState()).toEqual({
    uris: [pinned.toString(), ordinary.toString()],
    current: ordinary.toString(),
    previewIndex: -1,
    pinnedUris: [pinned.toString()],
  });

  await group.closeAll({ closePinned: true, force: true });
  await group.restoreState({
    uris: [pinned.toString(), 'unknown://missing-pinned', ordinary.toString()],
    current: ordinary.toString(),
    previewIndex: -1,
    pinnedUris: [pinned.toString(), 'unknown://missing-pinned'],
  });

  expect(group.resources.map((resource) => resource.uri.toString())).toEqual([pinned.toString(), ordinary.toString()]);
  expect(group.pinnedTabCount).toBe(1);
  expect(group.isPinned(ordinary)).toBe(false);

  await group.closeAll({ closePinned: true, force: true });
});

it('should restore legacy editor group state without pinned tabs', async () => {
  const uri = new URI('test://pin/legacy-state');
  const group = editorService.currentEditorGroup as EditorGroup;
  await group.restoreState({ uris: [uri.toString()], current: uri.toString(), previewIndex: -1 });
  expect(group.pinnedTabCount).toBe(0);
  expect(group.isPinned(uri)).toBe(false);
  await group.closeAll({ closePinned: true, force: true });
});

it('should keep the same uri independently pinned in different editor groups', async () => {
  const uri = new URI('test://pin/group-local');
  await editorService.open(uri, { preview: false });
  const source = editorService.currentEditorGroup as EditorGroup;
  source.pinTab(uri);
  await source.split(EditorGroupSplitAction.Right, uri, { focus: true });
  const target = editorService.editorGroups.find((group) => group !== source) as EditorGroup;
  target.unpinTab(uri);

  expect(source.isPinned(uri)).toBe(true);
  expect(target.isPinned(uri)).toBe(false);
  expect(source.getState().pinnedUris).toEqual([uri.toString()]);
  expect(target.getState().pinnedUris).toEqual([]);

  await source.closeAll({ closePinned: true, force: true });
  await target.closeAll({ closePinned: true, force: true });
});

it('should let pinned state win over malformed preview state during restoration', async () => {
  const uri = new URI('test://pin/malformed-state');
  const group = editorService.currentEditorGroup as EditorGroup;
  await group.restoreState({
    uris: [uri.toString()],
    current: uri.toString(),
    previewIndex: 0,
    pinnedUris: [uri.toString()],
  });

  expect(group.isPinned(uri)).toBe(true);
  expect(group.previewURI).toBeNull();
  await group.closeAll({ closePinned: true, force: true });
});
```

- [ ] **Step 2: Run the state tests and confirm the missing field/failure**

Run:

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL because `pinnedUris` is absent and restoration never rebuilds the pinned boundary.

- [ ] **Step 3: Add the optional state field**

```ts
export interface IEditorGroupState {
  uris: string[];
  current?: string;
  previewIndex: number;
  pinnedUris?: string[];
}
```

- [ ] **Step 4: Serialize revivable pinned URIs**

Replace `getState()` with:

```ts
getState(): IEditorGroupState {
  const revivableResources = this.resources.filter(couldRevive);
  const uris = revivableResources.map((resource) => resource.uri.toString());
  const pinnedUris = revivableResources
    .filter((resource) => this.isPinned(resource.uri))
    .map((resource) => resource.uri.toString());
  return {
    uris,
    current: this.currentResource && couldRevive(this.currentResource) ? this.currentResource.uri.toString() : undefined,
    previewIndex: this.previewURI ? uris.indexOf(this.previewURI.toString()) : -1,
    pinnedUris,
  };
}
```

- [ ] **Step 5: Restore and sanitize the prefix**

At the start of `restoreState`, reset the runtime boundary before any backend opens:

```ts
this._pinnedTabCount = 0;
```

After the existing resource-open loop, rebuild it from successfully restored resources:

```ts
const pinnedUris = new Set(state.pinnedUris || []);
let restoredPinnedTabCount = 0;
while (
  restoredPinnedTabCount < this.resources.length &&
  pinnedUris.has(this.resources[restoredPinnedTabCount].uri.toString())
) {
  restoredPinnedTabCount++;
}
this._pinnedTabCount = restoredPinnedTabCount;
if (this.previewURI && this.isPinned(this.previewURI)) {
  this.previewURI = null;
}
```

Keep `_restoringState` true until the active resource, Preview state, and pinned boundary are all final; then emit the existing single tab-changed notification.

- [ ] **Step 6: Run state and full editor tests**

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS for new state, partial failure, legacy state, and all previous tests.

- [ ] **Step 7: Commit persistence**

```bash
git status --short
git add packages/editor/src/common/editor.ts packages/editor/src/browser/workbench-editor.service.ts packages/editor/__tests__/browser/editor-service.test.ts
git commit -m "feat(editor): persist pinned tab state"
```

---

### Task 5: Add Commands, Menus, Keybindings, and Localized Copy

**Files:**

- Modify: `packages/core-browser/src/common/common.command.ts:380-430,558-580`
- Modify: `packages/editor/src/browser/editor.contribution.ts:320-410,606-690,1270-1370`
- Modify: `packages/editor/src/browser/menu/title-context.menu.ts:11-55`
- Modify: `packages/i18n/src/common/en-US.lang.ts:108-130`
- Modify: `packages/i18n/src/common/zh-CN.lang.ts:104-130`
- Modify: `packages/editor/README.md:165-215`
- Test: `packages/editor/__tests__/browser/editor.contribution.test.ts`
- Test: `packages/editor/__tests__/browser/editor.feature.test.ts:516-535`

**Interfaces:**

- Produces: `EDITOR_COMMANDS.TOGGLE_PINNED_TAB` with id `editor.togglePinnedTab`.
- Produces: scoped context key `editorTabPinned`.
- Consumes: `togglePinTab`, `isPinned`, and `activateFirstUnpinned`.

- [ ] **Step 1: Add failing command and context-key tests**

In `editor.contribution.test.ts`, mock the editor service before resolving `EditorContribution` and add:

```ts
it('should toggle the active pinned tab and protect keyboard close', async () => {
  const uri = new URI('test://pin/command');
  const group = {
    currentResource: { uri },
    togglePinTab: jest.fn(),
    pinPreviewed: jest.fn(),
    isPinned: jest.fn(() => true),
    activateFirstUnpinned: jest.fn(async () => true),
    close: jest.fn(),
  };
  injector.mockService(WorkbenchEditorService, { currentEditorGroup: group });
  const contribution = injector.get(EditorContribution);
  const registry = injector.get<CommandRegistry>(CommandRegistry);
  contribution.registerCommands(registry);
  const commandService = injector.get<CommandService>(CommandService);

  await commandService.executeCommand(EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id);
  expect(group.togglePinTab).toHaveBeenCalledWith(uri);

  await commandService.executeCommand(EDITOR_COMMANDS.PIN_CURRENT.id);
  expect(group.pinPreviewed).toHaveBeenCalled();

  await commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id);
  expect(group.activateFirstUnpinned).toHaveBeenCalled();
  expect(group.close).not.toHaveBeenCalled();

  await commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, { group, uri });
  expect(group.close).toHaveBeenCalledWith(uri);

  const keybindings = { registerKeybinding: jest.fn() };
  contribution.registerKeybindings(keybindings as any);
  expect(keybindings.registerKeybinding).toHaveBeenCalledWith({
    command: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id,
    keybinding: 'ctrlcmd+k shift+enter',
  });

  const menus = { registerMenuItem: jest.fn() };
  contribution.registerMenus(menus as any);
  expect(menus.registerMenuItem).toHaveBeenCalledWith(
    MenuId.EditorTitleContext,
    expect.objectContaining({
      command: expect.objectContaining({ id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id }),
      when: '!editorTabPinned',
    }),
  );
  expect(menus.registerMenuItem).toHaveBeenCalledWith(
    MenuId.EditorTitleContext,
    expect.objectContaining({
      command: expect.objectContaining({ id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id }),
      when: 'editorTabPinned',
    }),
  );
});
```

Import `MenuId` from `@opensumi/ide-core-browser/lib/menu/next` and `WorkbenchEditorService` from `@opensumi/ide-editor/lib/common`.

In the title-context-menu test, capture the created key:

```ts
const pinnedKey = { set: jest.fn(), get: jest.fn(), reset: jest.fn() };
const createKey = jest.fn((name: string) =>
  name === 'editorTabPinned' ? pinnedKey : { set: jest.fn(), get: jest.fn(), reset: jest.fn() },
);
service.show(0, 0, new URI('file:///test1.ts'), {
  isPinned: jest.fn(() => true),
  contextKeyService: {
    createScoped: jest.fn(() => ({ createKey, dispose: jest.fn() })),
  },
} as any);
expect(createKey).toHaveBeenCalledWith('editorTabPinned', false);
expect(pinnedKey.set).toHaveBeenCalledWith(true);
```

- [ ] **Step 2: Run command/menu tests and confirm failures**

```bash
yarn test packages/editor/__tests__/browser/editor.contribution.test.ts packages/editor/__tests__/browser/editor.feature.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL because the toggle command and `editorTabPinned` key do not exist and CLOSE still closes the active pinned tab.

- [ ] **Step 3: Declare the stable command and localized strings**

In `common.command.ts`:

```ts
export const TOGGLE_PINNED_TAB: Command = {
  id: 'editor.togglePinnedTab',
  category: CATEGORY,
  label: '%editor.togglePinnedTab%',
};
```

Add these English keys:

```ts
'editor.togglePinnedTab': 'Toggle Pin Tab',
'editor.title.context.pinTab': 'Pin Tab',
'editor.title.context.unpinTab': 'Unpin Tab',
'editor.unpinTab.title': 'Unpin {0}',
```

Add these Chinese keys:

```ts
'editor.togglePinnedTab': '切换固定标签',
'editor.title.context.pinTab': '固定标签',
'editor.title.context.unpinTab': '取消固定标签',
'editor.unpinTab.title': '取消固定 {0}',
```

- [ ] **Step 4: Register the toggle command and protected CLOSE behavior**

```ts
commands.registerCommand(EDITOR_COMMANDS.TOGGLE_PINNED_TAB, {
  execute: (resource?: ResourceArgs) => {
    const { group, uri } = this.extractGroupAndUriFromArgs(resource || {});
    if (group && uri) {
      group.togglePinTab(uri);
    }
  },
});
```

Change the CLOSE handler to distinguish a context-menu target from a no-argument keyboard/command-palette close:

```ts
commands.registerCommand(EDITOR_COMMANDS.CLOSE, {
  execute: async (resource?: ResourceArgs) => {
    const explicitTarget = !!resource?.uri;
    const { group, uri } = this.extractGroupAndUriFromArgs(resource || {});
    if (!group || !uri) {
      return;
    }
    if (!explicitTarget && group.isPinned(uri)) {
      await group.activateFirstUnpinned();
      return;
    }
    await group.close(uri);
  },
});
```

- [ ] **Step 5: Register the keybinding and mutually exclusive context items**

```ts
keybindings.registerKeybinding({
  command: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id,
  keybinding: 'ctrlcmd+k shift+enter',
});
```

Register two `MenuId.EditorTitleContext` entries before Close:

```ts
menus.registerMenuItem(MenuId.EditorTitleContext, {
  command: {
    id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id,
    label: localize('editor.title.context.pinTab'),
  },
  group: '0_tab',
  order: 0,
  when: '!editorTabPinned',
});
menus.registerMenuItem(MenuId.EditorTitleContext, {
  command: {
    id: EDITOR_COMMANDS.TOGGLE_PINNED_TAB.id,
    label: localize('editor.title.context.unpinTab'),
  },
  group: '0_tab',
  order: 0,
  when: 'editorTabPinned',
});
```

- [ ] **Step 6: Set the clicked-tab pinned context**

Inside `TabTitleMenuService.show`, after creating `titleContext`:

```ts
const pinnedContext = titleContext.createKey<boolean>('editorTabPinned', false);
pinnedContext.set((group as EditorGroup).isPinned(uri));
```

Build the menu before disposing the scoped context, as the existing code already does.

- [ ] **Step 7: Correct documentation terminology**

Change the README entry for `editor.pinCurrent` to “保留当前 Preview Tab（取消 Preview 模式）” and add:

```md
- `editor.togglePinnedTab`: 固定或取消固定当前 tab
```

- [ ] **Step 8: Run command, menu, i18n, and editor tests**

```bash
yarn test packages/editor/__tests__/browser/editor.contribution.test.ts packages/editor/__tests__/browser/editor.feature.test.ts --runInBand --selectProjects jsdom
yarn tsc --build configs/ts/references/tsconfig.core-browser.json configs/ts/references/tsconfig.editor.json configs/ts/references/tsconfig.i18n.json --pretty false
```

Expected: all tests PASS and all three TypeScript references build without errors.

- [ ] **Step 9: Commit commands and copy**

```bash
git status --short
git add packages/core-browser/src/common/common.command.ts packages/editor/src/browser/editor.contribution.ts packages/editor/src/browser/menu/title-context.menu.ts packages/i18n/src/common/en-US.lang.ts packages/i18n/src/common/zh-CN.lang.ts packages/editor/README.md packages/editor/__tests__/browser/editor.contribution.test.ts packages/editor/__tests__/browser/editor.feature.test.ts
git commit -m "feat(editor): add pin tab commands and menus"
```

---

### Task 6: Expose Pinned State through the VS Code Tab API

**Files:**

- Modify: `packages/extension/src/browser/vscode/api/main.thread.editor-tabs.ts:31-100,152-250`
- Create: `packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts`

**Interfaces:**

- Consumes: `EditorGroup.isPinned` and existing open/close/move/tab-changed events.
- Produces: accurate `IEditorTabDto.isPinned` values.
- Produces: TAB_UPDATE when only pinned state changes and TAB_MOVE containing the final pinned DTO when order changes.
- Guarantees: extension TabGroups explicit close can close Pinned Tabs.

- [ ] **Step 1: Create a failing main-thread tab API test**

Create `packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts` with a mock Editor Group and proxy:

```ts
import { Deferred, Emitter, URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { MainThreadEditorTabsService } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.editor-tabs';
import { TabModelOperationKind } from '@opensumi/ide-extension/lib/common/vscode/editor-tabs';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('MainThreadEditorTabsService', () => {
  it('should publish pinned state in initial, update, and move DTOs', async () => {
    const tabChanged = new Emitter<void>();
    const tabOperation = new Emitter<any>();
    const bodyChanged = new Emitter<void>();
    const resource = { uri: new URI('test://pin/extension'), name: 'extension.ts' } as any;
    let pinned = true;
    const group = {
      groupId: 1,
      index: 0,
      resources: [resource],
      currentResource: resource,
      previewURI: null,
      isPinned: jest.fn(() => pinned),
      getLastOpenType: jest.fn(() => ({ type: 'code' })),
      resourceService: { getResourceDecoration: jest.fn(() => ({ dirty: false })) },
      editorComponentRegistry: {},
      onDidEditorGroupTabOperation: tabOperation.event,
      onDidEditorGroupTabChanged: tabChanged.event,
      onDidEditorGroupBodyChanged: bodyChanged.event,
      addDispose: jest.fn(),
      closeAll: jest.fn(async () => true),
    } as any;
    const groupsChanged = new Emitter<void>();
    const activeChanged = new Emitter<void>();
    const contributionsReady = new Deferred<void>();
    const editorService = {
      editorGroups: [group],
      sortedEditorGroups: [group],
      currentEditorGroup: group,
      onDidEditorGroupsChanged: groupsChanged.event,
      onActiveResourceChange: activeChanged.event,
      contributionsReady,
    } as any;
    const proxy = {
      $acceptEditorTabModel: jest.fn(),
      $acceptTabOperation: jest.fn(),
      $acceptTabGroupUpdate: jest.fn(),
    };
    const injector = createBrowserInjector(
      [],
      new MockInjector([{ token: WorkbenchEditorService, useValue: editorService }]),
    );
    const service = injector.get(MainThreadEditorTabsService, [{ getProxy: () => proxy } as any]);
    contributionsReady.resolve();
    await Promise.resolve();

    expect(proxy.$acceptEditorTabModel.mock.calls.at(-1)[0][0].tabs[0].isPinned).toBe(true);

    pinned = false;
    tabChanged.fire();
    expect(proxy.$acceptTabOperation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: TabModelOperationKind.TAB_UPDATE,
        tabDto: expect.objectContaining({ isPinned: false }),
      }),
    );

    pinned = true;
    tabOperation.fire({ type: 'move', resource, oldIndex: 0, index: 0 });
    expect(proxy.$acceptTabOperation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: TabModelOperationKind.TAB_MOVE,
        tabDto: expect.objectContaining({ isPinned: true }),
      }),
    );

    service.dispose();
    await injector.disposeAll();
  });
});
```

- [ ] **Step 2: Run the new test and confirm `isPinned` remains false**

```bash
yarn test packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts --runInBand --selectProjects jsdom
```

Expected: FAIL because `EditorTabDtoData.from()` still hard-codes `isPinned: false`.

- [ ] **Step 3: Publish the real state**

Change the DTO field:

```ts
isPinned: editorGroup.isPinned(resource.uri),
```

Keep `EditorTabGroupData`'s existing behavior: a move operation calls `tryUpdate()` before emitting TAB_MOVE, while tab-changed produces TAB_UPDATE only when the DTO changed.

- [ ] **Step 4: Make extension close-group explicit**

Change `$closeGroup` to opt into closing Pinned Tabs:

```ts
return await editorGroup.closeAll({ closePinned: true });
```

`$closeTab` continues to call the low-level explicit `close(uri)` method.

- [ ] **Step 5: Run extension and editor API tests**

```bash
yarn test packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts --runInBand --selectProjects jsdom
yarn tsc --build configs/ts/references/tsconfig.extension.json --pretty false
```

Expected: PASS and the extension reference builds cleanly.

- [ ] **Step 6: Commit the extension contract**

```bash
git status --short
git add packages/extension/src/browser/vscode/api/main.thread.editor-tabs.ts packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts
git commit -m "feat(extension): expose pinned editor tabs"
```

---

### Task 7: Render the Sticky Pinned Region and Add Runtime Coverage

**Files:**

- Modify: `packages/editor/src/browser/tab.view.tsx:70-535`
- Modify: `packages/editor/src/browser/editor.module.less:70-370`
- Modify: `tools/playwright/src/editor.ts:10-145`
- Modify: `tools/playwright/src/tests/editor.test.ts:20-130`

**Interfaces:**

- Consumes: `pinnedTabCount`, `isPinned`, `unpinTab`, and target-region `dropUri` behavior.
- Produces: `data-pinned='true|false'` on each editor tab for accessibility/testing.
- Produces: a sticky full-title Pinned Region in non-wrap mode and a flat prefix in wrap mode.
- Produces: Pin plus Dirty coexistence, no pinned close X, and no pinned middle-click close.

- [ ] **Step 1: Extend the Playwright editor helper and write failing runtime tests**

Add to `OpenSumiEditor` in `tools/playwright/src/editor.ts`:

```ts
async isPinned() {
  return (await (await this.getTab())?.getAttribute('data-pinned')) === 'true';
}

async isEditorTabVisible() {
  return !!(await this.getTab());
}

async hasPinAction() {
  return !!(await (await this.getTab())?.$("[class*='pin_tab___']"));
}

async hasCloseAction() {
  return !!(await (await this.getTab())?.$("[class*='close_tab___']"));
}

async isCurrentTab() {
  return (await (await this.getTab())?.getAttribute('class'))?.includes('kt_editor_tab_current___') ?? false;
}

async clickPinAction() {
  const action = await (await this.getTab())?.$("[class*='pin_tab___']");
  await action?.click();
}

async middleClickTab() {
  await (await this.getTab())?.click({ button: 'middle' });
}
```

Add a localized label map and a `Pinned Tabs` test to `tools/playwright/src/tests/editor.test.ts`:

```ts
const pinnedTabLabels = {
  pin: ['Pin Tab', '固定标签'],
  unpin: ['Unpin Tab', '取消固定标签'],
};

test('Pinned Tabs should stay visible, dirty, and protected', async () => {
  const pinnedEditor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
  const ordinaryEditor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor2.js', false);

  const pinMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(pinMenu, pinnedTabLabels.pin)).click();
  expect(await pinnedEditor.isPinned()).toBe(true);
  expect(await pinnedEditor.hasPinAction()).toBe(true);
  expect(await pinnedEditor.hasCloseAction()).toBe(false);
  expect(await ordinaryEditor.isCurrentTab()).toBe(true);

  await pinnedEditor.clickPinAction();
  expect(await pinnedEditor.isPinned()).toBe(false);
  const repinFromContextMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(repinFromContextMenu, pinnedTabLabels.pin)).click();
  expect(await pinnedEditor.isPinned()).toBe(true);
  expect(await ordinaryEditor.isCurrentTab()).toBe(true);

  await pinnedEditor.middleClickTab();
  expect(await pinnedEditor.isEditorTabVisible()).toBe(true);

  await (await pinnedEditor.getTab())?.click();
  await pinnedEditor.addTextToNewLineAfterLineByLineNumber(1, '// pinned dirty');
  expect(await pinnedEditor.isDirty()).toBe(true);
  expect(await pinnedEditor.hasPinAction()).toBe(true);

  const pinnedTab = await pinnedEditor.getTab();
  const scroll = app.page.locator("[class*='kt_editor_tabs_scroll___']").first();
  await scroll.evaluate((element: HTMLElement) => {
    element.style.width = '180px';
  });
  const before = await pinnedTab?.boundingBox();
  await scroll.evaluate((element: HTMLElement) => {
    element.scrollLeft = element.scrollWidth;
  });
  const after = await pinnedTab?.boundingBox();
  expect(Math.abs((before?.x || 0) - (after?.x || 0))).toBeLessThan(2);

  const closeAllMenu = await ordinaryEditor.openTabContextMenu();
  await (await menuItemByAnyName(closeAllMenu, ['Close All', '关闭全部'])).click();
  expect(await pinnedEditor.isEditorTabVisible()).toBe(true);
  expect(await ordinaryEditor.isEditorTabVisible()).toBe(false);

  await pinnedEditor.save();
  const unpinMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(unpinMenu, pinnedTabLabels.unpin)).click();
  expect(await pinnedEditor.isPinned()).toBe(false);

  const repinMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(repinMenu, pinnedTabLabels.pin)).click();
  const explicitCloseMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(explicitCloseMenu, ['Close', '关闭'])).click();
  expect(await pinnedEditor.isEditorTabVisible()).toBe(false);

  await app.page.keyboard.press('Alt+Shift+T');
  const reopenedTab = app.page.locator(`#${OPENSUMI_VIEW_CONTAINERS.EDITOR_TABS} [data-uri*='editor.js']`);
  await expect(reopenedTab).toHaveAttribute('data-pinned', 'false');
  await reopenedTab.hover();
  await reopenedTab.locator("[class*='close_tab___']").click();
});
```

Add this persistence test immediately after the runtime behavior test:

```ts
test('Pinned Tabs should restore after reload', async () => {
  const pinnedEditor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
  const pinMenu = await pinnedEditor.openTabContextMenu();
  await (await menuItemByAnyName(pinMenu, pinnedTabLabels.pin)).click();
  expect(await pinnedEditor.isPinned()).toBe(true);

  await app.page.waitForTimeout(500);
  await app.page.reload();
  const restoredTab = app.page.locator(`#${OPENSUMI_VIEW_CONTAINERS.EDITOR_TABS} [data-uri*='editor.js']`);
  await expect(restoredTab).toHaveAttribute('data-pinned', 'true');

  await restoredTab.click();
  await app.page.keyboard.press(keypressWithCmdCtrl('KeyK'));
  await app.page.keyboard.press('Shift+Enter');
  await expect(restoredTab).toHaveAttribute('data-pinned', 'false');
  await restoredTab.hover();
  await restoredTab.locator("[class*='close_tab___']").click();
});
```

- [ ] **Step 2: Build and run the focused Playwright test to observe failure**

Check ports first:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN || true
lsof -nP -iTCP:8000 -sTCP:LISTEN || true
```

Start the E2E profile in one terminal:

```bash
yarn start:e2e
```

In another terminal:

```bash
yarn workspace @opensumi/playwright build
yarn workspace @opensumi/playwright exec playwright test editor.test.js --config=./configs/playwright.config.ts --grep "Pinned Tabs"
```

Expected: FAIL because Pin/Unpin menu items, `data-pinned`, Pin controls, sticky layout, and close protection are not rendered yet.

- [ ] **Step 3: Refactor tab rendering into a reusable resource renderer**

Change `renderEditorTab` to accept `isPinned`, and render the right-side controls with both states:

```tsx
const renderEditorTab = React.useCallback(
  (resource: IResource, isCurrent: boolean, isPinned: boolean) => {
    const decoration = resourceService.getResourceDecoration(resource.uri);
    const subname = resourceService.getResourceSubname(resource, group.resources);
    return editorTabService.renderEditorTab(
      <>
        <div className={tabsLoadingMap[resource.uri.toString()] ? 'loading_indicator' : cls(resource.icon)}> </div>
        <div tabIndex={0} role='tab' aria-selected={isCurrent ? 'true' : 'false'}>
          {resource.name}
        </div>
        {subname ? <div className={styles.subname}>{subname}</div> : null}
        {decoration.readOnly ? (
          <span className={cls(getExternalIcon('lock'), styles.editor_readonly_icon)}></span>
        ) : null}
        <div className={cls(styles_tab_right, { [styles.pinned_tab_right]: isPinned })}>
          <div className={cls({ [styles.kt_hidden]: !decoration.dirty, [styles.dirty]: true })}></div>
          {isPinned ? (
            <div
              className={styles.pin_tab}
              onMouseDown={(event) => {
                event.stopPropagation();
                group.unpinTab(resource.uri);
              }}
              tabIndex={0}
              role='button'
              title={formatLocalize('editor.unpinTab.title', resource.name)}
              aria-label={formatLocalize('editor.unpinTab.title', resource.name)}
            >
              <div className={getIcon('pinned')} />
            </div>
          ) : (
            <div
              className={styles_close_tab}
              onMouseDown={(event) => {
                event.stopPropagation();
                group.close(resource.uri);
              }}
            >
              {editorTabService.renderTabCloseComponent(
                <div
                  className={cls(getIcon('close'), styles_kt_editor_close_icon)}
                  tabIndex={0}
                  role='button'
                  aria-label={formatLocalize('editor.closeTab.title', resource.name)}
                />,
              )}
            </div>
          )}
        </div>
      </>,
      isCurrent,
    );
  },
  [editorTabService, group, resourceService, tabsLoadingMap],
);
```

Do not pass the Pin action through `renderTabCloseComponent`, because the Design override gives that wrapper Close-specific copy.

- [ ] **Step 4: Render a sticky prefix only in non-wrap mode**

Extract the existing resource map into `renderTabs(resources, indexOffset)` and keep global indices for drag/drop and wrap calculations:

```tsx
const curTabIndex = group.resources.findIndex((resource) => group.currentResource === resource);

const renderTabs = (resources: IResource[], indexOffset: number) =>
  resources.map((resource, localIndex) => {
    let ref: HTMLDivElement | null;
    const i = indexOffset + localIndex;
    const decoration = resourceService.getResourceDecoration(resource.uri);
    const isPinned = group.isPinned(resource.uri);
    return (
      <div
        draggable={true}
        title={resource.title}
        className={cls({
          [styles_kt_editor_tab]: true,
          [styles.last_in_row]: tabMap.get(i),
          [styles_kt_editor_tab_current_prev]: curTabIndex - 1 === i,
          [styles_kt_editor_tab_current_next]: curTabIndex + 1 === i,
          [styles_kt_editor_tab_current]: group.currentResource === resource,
          [styles.kt_editor_tab_preview]: group.previewURI?.isEqual(resource.uri),
          [styles_kt_editor_tab_dirty]: decoration.dirty,
        })}
        style={
          wrapMode && i === group.resources.length - 1
            ? { marginRight: lastMarginRight, height: layoutViewSize.editorTabsHeight }
            : { height: layoutViewSize.editorTabsHeight }
        }
        onContextMenu={(event) => {
          tabTitleMenuService.show(event.nativeEvent.x, event.nativeEvent.y, resource.uri, group);
          event.preventDefault();
        }}
        key={resource.uri.toString()}
        onMouseUp={(event) => {
          if (event.nativeEvent.button === MouseEventButton.Middle && !isPinned) {
            event.preventDefault();
            event.stopPropagation();
            group.close(resource.uri);
          }
        }}
        onMouseDown={(event) => {
          if (event.nativeEvent.button === MouseEventButton.Left) {
            group.open(resource.uri, { focus: true });
          }
        }}
        data-uri={resource.uri.toString()}
        data-pinned={isPinned ? 'true' : 'false'}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          ref?.classList.add(styles.kt_on_drag_over);
        }}
        onDragLeave={() => ref?.classList.remove(styles.kt_on_drag_over)}
        onDrop={(event) => {
          ref?.classList.remove(styles.kt_on_drag_over);
          onDrop(event, i, resource);
        }}
        onDoubleClick={() => group.pinPreviewed(resource.uri)}
        ref={(element) => (ref = element)}
        onDragStart={(event) => {
          event.dataTransfer.setData('uri', resource.uri.toString());
          event.dataTransfer.setData('uri-source-group', group.name);
        }}
      >
        {renderEditorTab(resource, group.currentResource === resource, isPinned)}
      </div>
    );
  });
```

In non-wrap mode render:

```tsx
<Scroll
  forwardedRef={(element) => (element ? (tabContainer.current = element) : null)}
  className={styles.kt_editor_tabs_scroll}
>
  <div
    className={cls({
      [styles_kt_editor_tabs_content]: true,
      [styles.kt_editor_tabs_content_empty]: group.resources.length === 0,
      [styles_kt_editor_tabs_current_last]: curTabIndex === group.resources.length - 1,
    })}
    ref={contentRef as any}
    role='tablist'
  >
    {group.pinnedTabCount > 0 ? (
      <div
        className={cls(styles.pinned_tabs, {
          [styles.pinned_tabs_with_ordinary]: group.pinnedTabCount < group.resources.length,
        })}
      >
        {renderTabs(group.resources.slice(0, group.pinnedTabCount), 0)}
      </div>
    ) : null}
    {renderTabs(group.resources.slice(group.pinnedTabCount), group.pinnedTabCount)}
  </div>
</Scroll>
```

```tsx
<div className={styles.kt_editor_wrap_container}>
  <div
    className={cls({
      [styles_kt_editor_tabs_content]: true,
      [styles.kt_editor_tabs_content_empty]: group.resources.length === 0,
      [styles_kt_editor_tabs_current_last]: curTabIndex === group.resources.length - 1,
    })}
    ref={contentRef as any}
    role='tablist'
  >
    {renderTabs(group.resources, 0)}
  </div>
</div>
```

- [ ] **Step 5: Add sticky, separator, and Pin/Dirty styles**

Add LESS rules:

```less
.pinned_tabs {
  position: sticky;
  left: 0;
  z-index: var(--stacking-level-editor-tabbar-pinned, 12);
  display: inline-flex;
  flex-shrink: 0;
  background: var(--editorGroupHeader-tabsBackground);

  .kt_editor_tab:last-child {
    margin-right: 0;
  }
}

.pinned_tabs_with_ordinary {
  border-right: 1px solid var(--tab-lastPinnedBorder);
}

.pinned_tab_right {
  width: auto !important;
  gap: 6px;

  &:hover {
    transform: none !important;
    background: transparent !important;
  }

  .dirty {
    display: flex !important;
  }
}

.pin_tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;

  &:hover {
    transform: scale(1.1);
    background-color: var(--kt-icon-hoverBackground);
  }
}
```

Replace the existing tab hover rule that hides Dirty and shows Close with a selector limited to ordinary tabs:

```less
&:hover {
  .tab_right:not(.pinned_tab_right) {
    .dirty {
      display: none;
    }

    .close_tab {
      display: block;
    }
  }
}
```

Leave the existing `last_in_row` rule and editor-action layout rules unchanged.

- [ ] **Step 6: Run TypeScript and focused Playwright coverage**

```bash
yarn tsc --build configs/ts/references/tsconfig.editor.json configs/ts/references/tsconfig.design.json configs/ts/references/tsconfig.playwright.json --pretty false
yarn workspace @opensumi/playwright build
yarn workspace @opensumi/playwright exec playwright test editor.test.js --config=./configs/playwright.config.ts --grep "Pinned Tabs"
```

Expected: all builds and focused runtime tests PASS.

The standard E2E startup includes `DesignModule`, so this Playwright pass also verifies that `DesignEditorTabService.renderEditorTab()` preserves the Pin and Dirty controls. No change to its Close-specific `renderTabCloseComponent()` wrapper is required.

- [ ] **Step 7: Manually verify Wrap Tabs and drag boundaries in the running IDE**

With `yarn start:e2e` still running:

1. Enable `editor.wrapTab`.
2. Open enough tabs to create at least two rows.
3. Pin two tabs and confirm they remain the flat leading prefix without a forced row break, with the `tab.lastPinnedBorder` separator after the second pinned tab.
4. Drag an ordinary tab onto a pinned target and confirm it becomes pinned.
5. Drag it onto an ordinary target and confirm it becomes ordinary.
6. Split a pinned tab and confirm the target copy is pinned.

Expected: all six observations match the approved design, with no overlapping editor actions or missing Dirty indicator.

Stop the E2E server with `Ctrl+C` after the manual checks complete.

- [ ] **Step 8: Commit UI and runtime coverage**

```bash
git status --short
git add packages/editor/src/browser/tab.view.tsx packages/editor/src/browser/editor.module.less tools/playwright/src/editor.ts tools/playwright/src/tests/editor.test.ts
git commit -m "feat(editor): render and test pinned tabs"
```

---

### Task 8: Run the Full Focused Verification Matrix

**Files:**

- Verify: all files modified by Tasks 1-7.
- Do not stage: unrelated untracked `CONTEXT.md`, `NOTES.md`, `.scratch/`, `.matt-pocock-skills/`, workflows, or unrelated ADR files.

**Interfaces:**

- Consumes: every task deliverable.
- Produces: evidence that the feature meets the approved design across editor core, commands, extension API, and runtime UI.

- [ ] **Step 1: Run all focused Jest suites together**

```bash
yarn test packages/editor/__tests__/browser/editor-service.test.ts packages/editor/__tests__/browser/editor.contribution.test.ts packages/editor/__tests__/browser/editor.feature.test.ts packages/markers/__tests__/browser/markes-service.test.ts packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS with zero failed tests.

- [ ] **Step 2: Build every affected TypeScript reference**

```bash
yarn tsc --build configs/ts/references/tsconfig.core-browser.json configs/ts/references/tsconfig.editor.json configs/ts/references/tsconfig.i18n.json configs/ts/references/tsconfig.design.json configs/ts/references/tsconfig.extension.json configs/ts/references/tsconfig.playwright.json --pretty false
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Rerun the focused Playwright scenario**

```bash
yarn workspace @opensumi/playwright exec playwright test editor.test.js --config=./configs/playwright.config.ts --grep "Pinned Tabs"
```

Expected: PASS for Pin/Unpin, Dirty plus Pin, close protection, persistence, and sticky scrolling.

- [ ] **Step 4: Check formatting and the final diff**

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors; only the intended feature files and any explicitly retained user-owned untracked files appear; the seven feature commits are visible.

- [ ] **Step 5: Perform the final design coverage audit**

Confirm each requirement has direct evidence:

- group-local prefix and persistence: editor-service tests;
- Keep Open compatibility: preview tests and unchanged `editor.pinCurrent`;
- open/split/drag behavior: lifecycle tests plus runtime drag check;
- routine close protection and explicit close: editor-service and command tests;
- command/menu/context key: contribution and feature tests;
- full-title sticky UI, inactive-tab focus preservation, Pin-control Unpin, Dirty plus Pin, wrap behavior: Playwright plus runtime check;
- `Tab.isPinned` and move/update events: extension test.

Expected: no approved requirement lacks a test or an explicit runtime observation.
