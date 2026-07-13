# Agentic Task List Usability Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Agent Layout Task List resizable when space is available, use workspace paths for unnamed projects, and let users rename projects safely.

**Architecture:** The registry remains the single durable source for optional custom project labels and task-to-project identity. The Task List derives one display name from that record, while a local modal invokes the registry rename API. Width remains local presentation state on `#ai_chat_view`; its dynamic limit is driven by the slot’s measured width, never by IDE Layout state.

**Tech Stack:** TypeScript, React, Less modules, OpenSumi DI/storage, Jest/jsdom, `@opensumi/ide-components` Modal.

## Global Constraints

- Change only Agent Layout ACP files under `packages/ai-native`; do not alter IDE Layout or `packages/ai-native/src/browser/layout/`.
- Preserve a 360px minimum Main Conversation Area, a 208px Task List minimum, and a 480px hard Task List maximum.
- Project IDs remain canonical workspace URIs; no task/session migration or workspace switch behavior changes.
- Empty or whitespace-only custom names mean “display the workspace path.”

---

### Task 1: Persist optional custom project names

**Files:**

- Modify: `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts`

**Interfaces:**

- Produces: `renameProject(projectId: string, label: string): Promise<AgenticProjectRecord | undefined>`.
- Produces: an optional `label` on `AgenticProjectRecord`; consumers derive `label?.trim() || workspacePath`.

- [ ] **Step 1: Write the failing registry tests**

```ts
await registry.registerProject({ ...project, label: undefined });
expect((await registry.getProject(project.id))?.label).toBeUndefined();

await registry.renameProject(project.id, '  Payments  ');
expect(await registry.getProject(project.id)).toMatchObject({ id: project.id, label: 'Payments' });

await registry.renameProject(project.id, '   ');
expect((await registry.getProject(project.id))?.label).toBeUndefined();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

Expected: failure because project labels are required and `renameProject` does not exist.

- [ ] **Step 3: Implement normalization and rename persistence**

```ts
async renameProject(projectId: string, label: string): Promise<AgenticProjectRecord | undefined> {
  await this.ensureInitialized();
  const project = this.findProject(projectId);
  if (!project) return undefined;
  const normalizedLabel = label.trim();
  if (normalizedLabel) project.label = normalizedLabel;
  else delete project.label;
  await this.persist();
  return { ...project };
}
```

Normalize legacy automatic labels away and accept omitted labels on new registrations.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

Expected: PASS.

### Task 2: Render and edit project display names

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`

**Interfaces:**

- Consumes: `registry.renameProject(projectId, label)` from Task 1.
- Consumes: `getProjectDisplayLabel(project) => project.label?.trim() || project.workspacePath`.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(container.textContent).toContain('/work/a');
(container.querySelector('[aria-label="Rename /work/a"]') as HTMLButtonElement).click();
// enter a label, save, and assert active groups plus launcher use “Payments”.
expect(services.registry.renameProject).toHaveBeenCalledWith('project-a', 'Payments');
```

Also assert Cancel does not call the registry and an empty Save passes an empty string.

- [ ] **Step 2: Run the component test to verify it fails**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: failure because no rename action/modal or fallback display name exists.

- [ ] **Step 3: Implement the modal and shared display-label helper**

Use `Modal` with controlled text state, autofocus, Save/Cancel controls, and an accessible project-header edit button. Reuse the helper in active/archived headers and the Project-first launcher; do not add editable controls to archived groups.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: PASS.

### Task 3: Make list width responsive to available conversation space

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`
- Modify: `packages/ai-native/src/browser/chat/chat.module.less`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`

**Interfaces:**

- Produces: a shared `getTaskListMaximumWidth(chatSlotWidth)` returning `min(480, chatSlotWidth - 360)`, never below 208.

- [ ] **Step 1: Write failing resize tests**

```tsx
mockChatSlotWidth(1000);
dragResize(handle, 240);
expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('480px');

mockChatSlotWidth(640);
dragResize(handle, 240);
expect(chatView.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: failure because all three layout layers cap width at 280px.

- [ ] **Step 3: Implement one dynamic resize bound**

Measure `#ai_chat_view` with a `ResizeObserver`, store the bound in `--agentic-task-list-max-width`, clamp pointer and keyboard moves with that bound, and replace the fixed 280px Less caps with the same CSS variable. Preserve the default 244px and clamp an oversized persisted width after a slot resize.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: PASS.

### Task 4: Verify the ACP boundary

**Files:**

- Test: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts`

- [ ] **Step 1: Run all relevant tests**

Run: `yarn test packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.injection.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 2: Type-check the affected package**

Run: `yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false`

Expected: exit code 0.

- [ ] **Step 3: Check the patch scope**

Run: `git diff --check && git diff -- packages/ide-layout packages/main-layout packages/ai-native/src/browser/layout`

Expected: no whitespace errors and no IDE/Layout-boundary edits.
