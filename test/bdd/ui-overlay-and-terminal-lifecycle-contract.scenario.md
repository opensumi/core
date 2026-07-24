# Scenario: UI Overlay And Terminal Lifecycle Contract - React 18 Roots, Cleanup, And Context Rebinding

**Trigger:** `packages/components/src/modal/Modal.tsx`, `packages/components/src/notification/notification.tsx`, `packages/terminal-next/src/browser/component/terminal.view.tsx`, `packages/terminal-next/src/browser/terminal.context-key.ts`, or `packages/terminal-next/src/browser/terminal.controller.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** React 18 jsdom roots for Modal and Notification, controllable notification containers/placements, and a Terminal Controller harness with two mount DOM nodes plus observable context-key service disposal. **Workspace mutation:** None. **Automation status:** Partially automated by `packages/components/__tests__/modal.test.tsx`, `packages/components/__tests__/notification.test.tsx`, and `packages/terminal-next/__tests__/browser/controller-lifecycle.test.ts`. Current tests cover Modal wrapper-class compatibility, avoidance of the legacy Notification instance/render entrypoint, Terminal context rebinding disposal, and initialization without a mounted view. Modal button/repeated-mount behavior, Notification add/remove/destroy/container/placement behavior, and Terminal focus/shortcut/context-menu behavior remain pending focused conversion.

**Acceptance coverage:** `F-01` through `F-03` from `test/bdd/feat-0710-acceptance.md`.

## Given

- A centered Modal receives both a legacy `wrapClassName` and modern Dialog `classNames`.
- Notification can create, append to, remove from, and destroy a React 18 root in a selected container.
- Terminal Controller can initialize context keys before and after its view DOM is replaced.

## When

### Part A - Modal Wrapper Compatibility

1. Render a visible centered Modal with a custom wrapper class.
2. Inspect the Dialog wrapper class composition, close behavior, footer actions, and repeated mount/unmount cleanup.

### Part B - Notification Root Lifecycle

3. Create a notification instance, append more than one notice, remove one notice, and destroy the instance.
4. Repeat with a custom container and placement.

### Part C - Terminal Context Rebinding

5. Initialize Terminal context keys against DOM node A, focus and blur the Terminal, then initialize against DOM node B.
6. Trigger readiness, focus, blur, shortcut/context-menu reads, and disposal before and after rebinding.

## Then

- Modal composes centered, legacy wrapper, and modern wrapper class names on the actual Dialog wrapper without losing mask, close, Cancel, or OK behavior.
- Modal repeated mount/unmount does not leave a duplicate wrapper or mask and does not require the removed `ReactDOM.render` entrypoint.
- Notification uses one React 18 root per cached placement/container instance, supports notice addition/removal, and removes both the root and host container on destroy.
- Notification repeated creation does not duplicate notices or leave empty host nodes, and no deprecated `ReactDOM.render` path is called.
- Rebinding Terminal context keys disposes the old scoped service before installing the new one.
- Terminal initialized/focused context values follow only the live DOM binding; calls made before a binding exists or during view replacement do not throw.

## Pass / Fail Judgment

- **PASS** - overlay roots retain existing visible behavior under React 18 and Terminal remounts replace context bindings without leaks or stale focus state.
- **FAIL** - Modal wrapper classes disappear, notifications duplicate/leak roots, deprecated rendering is invoked, Terminal keeps multiple live scoped context services, or lifecycle calls throw while the view is absent.
