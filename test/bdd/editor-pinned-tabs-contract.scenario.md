# Scenario: Editor Pinned Tabs Contract - State Restoration, Movement, and Extension API

**Trigger:** `packages/editor/src/browser/workbench-editor.service.ts`, `packages/editor/src/common/editor.ts`, `packages/extension/src/browser/vscode/api/main.thread.editor-tabs.ts`, or `packages/extension/src/hosted/api/vscode/ext.host.editor-tabs.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Deterministic Editor Group resources with successful and failed revival, two independent Editor Groups, controllable same-group/cross-group drop targets, and Main Thread/Extension Host Tab API DTO harnesses. **Workspace mutation:** None. **Automation status:** Automated by focused Jest suites in `packages/editor/__tests__/browser/editor-service.test.ts`, `packages/editor/__tests__/browser/editor.contribution.test.ts`, `packages/extension/__tests__/browser/main.thread.editor-tabs.test.ts`, and `packages/extension/__tests__/hosted/api/vscode/ext.host.editor-tabs.test.ts`.

**Acceptance coverage:** Contract completion for `A-02`, `A-09`, `A-10`, and all of `A-11` from `test/bdd/feat-0710-acceptance.md`.

## Given

- An Editor Group stores ordered resource URIs, an active resource, Preview state, and optional `pinnedUris`.
- The same URI may be opened in more than one Editor Group.
- The test harness can fail selected resource revival, target-group open, or edge-split operations.
- Main Thread and Extension Host Tab API objects observe initial, update, and move DTO operations.

## When

### Part A - Restoration and Group Locality

1. Persist a group containing multiple pinned and ordinary resources, then restore it with all resources available.
2. Restore the same state while one saved pinned resource fails revival.
3. Restore legacy state with no `pinnedUris`.
4. Restore malformed state that marks the same resource as Preview and pinned.
5. Open the same URI in two groups, pin it in only one group, and serialize both groups.

### Part B - Close and Movement Invariants

6. Execute Close Others, Close to Right, Close All, Close Saved, and keyboard Close through their normal protected policies.
7. Execute an explicit close and forced cleanup with pinned closing enabled.
8. Move tabs within a region, across the same-group pinned boundary, and across groups into pinned and ordinary target regions.
9. Drop a pinned tab into an empty group and into a new edge split.
10. Force the destination open or edge split to fail.
11. Split a pinned tab and drag a Preview tab into the pinned region.

### Part C - VS Code Tab API Synchronization

12. Build the initial Main Thread Tab DTOs for pinned and ordinary resources.
13. Pin or unpin a resource without changing its array index.
14. Pin or unpin a resource in a way that moves its index.
15. Deliver the update and move operations to the Extension Host while retaining the existing public Tab object identity.
16. Close all tabs explicitly through the extension Tab API.

## Then

- Restoration derives the pinned boundary only from the successfully restored pinned prefix; a missing pinned resource never pins the following ordinary resource.
- Legacy state restores with zero pinned tabs, and pinned state wins over malformed Preview state.
- The same URI has independent pinned state in different Editor Groups.
- Normal user-facing bulk close and keyboard close protect pinned tabs; explicit close, forced cleanup, deletion, and explicit extension API close may remove them.
- Dragging across the pinned boundary changes pin state, target-region semantics control cross-group drops, and empty-group/new-split drops preserve source pin state.
- A failed target open or split leaves the source group, active resource, order, and pinned boundary unchanged.
- Splitting a pinned tab preserves pin state in both groups, and pinning a Preview performs Keep Open first.
- Main Thread DTOs expose the real `isPinned` value in initial, update, and move operations.
- Extension Host move handling refreshes the existing Tab object's DTO before publishing final order, so `Tab.isPinned` and ordering remain aligned without replacing the public object.

## Pass / Fail Judgment

- **PASS** - all restoration, locality, close, movement, failure-atomicity, and Tab API synchronization contracts hold in the deterministic harnesses.
- **BLOCKED** - the Editor Group or extension Tab DTO harness required by a subcase is unavailable.
- **FAIL** - restoration pins the wrong resource, groups leak pin state, protected closes remove pinned tabs, movement corrupts either group, failed drops mutate the source, or extension consumers observe stale `isPinned` or ordering.

## Hardening

- Hardening verdict: `DEFER` for Playwright because this is a `node-contract` scenario.
- Keep coverage in the focused Editor Group and extension Jest suites; use `editor-pinned-tabs.scenario.md` for real runtime layout and interaction proof.
