# Agentic Task List CWD Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace long unnamed Project paths in Agentic Layout's Task List with compact, collision-aware cwd labels while preserving full cwd context and custom-name behavior.

**Architecture:** Keep `workspacePath` and the optional custom `label` as the only persisted Project data. A presentation-only helper derives default labels from the complete available Project catalog; `AgenticTaskList` owns that catalog snapshot and supplies the map to active groups, archived groups, and the rename modal. No registry schema, workspace switch, IDE Layout, or task/session identity change is required.

**Tech Stack:** TypeScript, React, Jest/jsdom, Playwright, OpenSumi DI, Less modules.

## Global Constraints

- Modify Agentic Layout files only; do not change IDE Layout or `packages/ai-native/src/browser/layout/`.
- The full `workspacePath` remains persisted and is always the Project-label `title` / hover value.
- A custom non-empty `label` renders exactly as entered and may duplicate another label.
- An unnamed available Project renders the last segment of its normalized cwd; `/` renders `/`.
- Only collisions between unnamed available Projects add the minimum parent-path suffix needed to distinguish each label. Search must not alter labels; catalog availability/add/remove changes recompute them.
- An unnamed rename modal starts empty, uses the derived default as placeholder, and visibly presents the full cwd. Whitespace-only Save clears the custom name and restores the default.
- Derived labels are presentation data only and must not be persisted by `AgenticTaskRegistryService`.

---

### Task 1: Derive stable default labels in a pure helper

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/agentic-project-label.ts`
- Create: `packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts`

**Interfaces:**

- Produces: `getAgenticProjectDisplayLabels(projects: AgenticProjectRecord[]): ReadonlyMap<string, string>`.
- Produces: `getAgenticProjectDisplayLabel(project, labels?): string`.
- Consumes only Project record fields; it has no registry or React dependency.

- [ ] **Step 1: Write the failing helper tests**

```ts
import {
  getAgenticProjectDisplayLabel,
  getAgenticProjectDisplayLabels,
} from '../../../src/browser/acp/components/agentic-project-label';

const project = (id: string, workspacePath: string, overrides = {}) => ({
  id,
  workspaceUri: 'file://' + workspacePath,
  workspacePath,
  joinedAt: 1,
  availability: 'available' as const,
  ...overrides,
});

it('uses the normalized final cwd segment for an unnamed Project', () => {
  expect(getAgenticProjectDisplayLabels([project('w', '/ossfs/w/')]).get('w')).toBe('w');
});

it('uses the root marker for an unnamed filesystem root', () => {
  expect(getAgenticProjectDisplayLabels([project('root', '/')]).get('root')).toBe('/');
});

it('adds the minimum parent suffix only to colliding unnamed Projects', () => {
  const labels = getAgenticProjectDisplayLabels([
    project('first', '/ossfs/a/w'),
    project('second', '/work/b/w'),
    project('unique', '/workspace/core'),
  ]);

  expect(labels).toEqual(
    new Map([
      ['first', 'a/w'],
      ['second', 'b/w'],
      ['unique', 'core'],
    ]),
  );
});

it('does not let a custom or unavailable Project change an unnamed label', () => {
  const custom = project('custom', '/other/w', { label: 'w' });
  const unnamed = project('unnamed', '/ossfs/w');
  const unavailable = project('unavailable', '/work/w', { availability: 'unavailable' as const });
  const labels = getAgenticProjectDisplayLabels([custom, unnamed, unavailable]);

  expect(getAgenticProjectDisplayLabel(custom, labels)).toBe('w');
  expect(getAgenticProjectDisplayLabel(unnamed, labels)).toBe('w');
});
```

- [ ] **Step 2: Run the helper test to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts --runInBand`

Expected: FAIL because `getAgenticProjectDisplayLabels` is not exported.

- [ ] **Step 3: Implement normalization and collision resolution**

```ts
function pathSegments(workspacePath: string): string[] {
  const normalized = workspacePath.replace(/\\/g, '/');
  if (/^\/+$/.test(normalized)) {
    return [];
  }
  return normalized.replace(/\/+$/, '').split('/').filter(Boolean);
}

export function getAgenticProjectDisplayLabels(projects: AgenticProjectRecord[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  const pending = projects
    .filter((project) => project.availability === 'available' && !project.label?.trim())
    .map((project) => ({ project, segments: pathSegments(project.workspacePath), depth: 1 }));

  while (pending.length) {
    const buckets = new Map<string, typeof pending>();
    for (const candidate of pending) {
      const label = candidate.segments.slice(-candidate.depth).join('/') || '/';
      buckets.set(label, [...(buckets.get(label) || []), candidate]);
    }

    for (const [label, bucket] of buckets) {
      const exhausted = bucket.every((candidate) => candidate.depth >= candidate.segments.length);
      if (bucket.length === 1 || exhausted) {
        for (const candidate of bucket) {
          labels.set(candidate.project.id, label);
          pending.splice(pending.indexOf(candidate), 1);
        }
      } else {
        for (const candidate of bucket) {
          candidate.depth = Math.min(candidate.depth + 1, candidate.segments.length);
        }
      }
    }
  }

  return labels;
}

export function getAgenticProjectDisplayLabel(
  project: AgenticProjectRecord,
  labels?: ReadonlyMap<string, string>,
): string {
  return project.label?.trim() || labels?.get(project.id) || pathSegments(project.workspacePath).at(-1) || '/';
}
```

An irreducible duplicate path remains its full normalized path; do not synthesize or persist an artificial label.

- [ ] **Step 4: Run the helper tests to verify GREEN**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit the isolated helper change**

```bash
git add packages/ai-native/src/browser/acp/components/agentic-project-label.ts \
  packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts
git commit -m "feat(agentic): derive compact project labels"
```

### Task 2: Apply catalog-derived labels in the Task List

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`

**Interfaces:**

- Consumes: `getAgenticProjectDisplayLabels(projects)` from Task 1.
- Produces: a current catalog snapshot and one derived label map for active groups, archived groups, and the rename modal.

- [ ] **Step 1: Write the failing component tests**

```tsx
it('uses the cwd leaf for an unnamed Project while retaining the full cwd tooltip', async () => {
  const services = createServices();
  const unnamed = { ...projectA, label: undefined, workspacePath: '/ossfs/w/' };
  services.registry.listProjects.mockResolvedValue([unnamed]);
  services.registry.listActiveGroups.mockResolvedValue([{ project: unnamed, tasks: [] }]);

  await renderTaskList(services);

  expect(container.querySelector('[title="/ossfs/w/"]')?.textContent).toContain('w');
  expect(container.querySelector('[aria-label="Manage w"]')).not.toBeNull();
});

it('keeps collision-aware labels stable while filtering Task titles', async () => {
  const services = createServices();
  const first = { ...projectA, id: 'first', label: undefined, workspacePath: '/ossfs/a/w' };
  const second = { ...projectB, id: 'second', label: undefined, workspacePath: '/work/b/w' };
  services.registry.listProjects.mockResolvedValue([first, second]);
  services.registry.listActiveGroups.mockResolvedValue([
    {
      project: first,
      tasks: [
        {
          sessionId: 'first-task',
          projectId: first.id,
          agentId: 'agent-a',
          title: 'first task',
          createdAt: 1,
          archived: false,
          unread: false,
        },
      ],
    },
    {
      project: second,
      tasks: [
        {
          sessionId: 'second-task',
          projectId: second.id,
          agentId: 'agent-a',
          title: 'second task',
          createdAt: 1,
          archived: false,
          unread: false,
        },
      ],
    },
  ]);

  await renderTaskList(services);
  expect(container.textContent).toContain('a/w');
  expect(container.textContent).toContain('b/w');
  const search = container.querySelector('input[type="search"]') as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'first');
  await act(async () => {
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
  });
  expect(container.textContent).toContain('a/w');
});

it('shows an empty rename value, a derived placeholder, and the full cwd for an unnamed Project', async () => {
  const services = createServices();
  const unnamed = { ...projectA, label: undefined, workspacePath: '/ossfs/w/' };
  services.registry.listProjects.mockResolvedValue([unnamed]);
  services.registry.listActiveGroups.mockResolvedValue([{ project: unnamed, tasks: [] }]);
  await renderTaskList(services);

  await act(async () => {
    (container.querySelector('[aria-label="Manage w"]') as HTMLButtonElement).click();
  });
  await act(async () => {
    (container.querySelector('[aria-label="Rename w"]') as HTMLButtonElement).click();
  });
  const input = document.querySelector('[aria-label="Project name"]') as HTMLInputElement;

  expect(input.value).toBe('');
  expect(input.placeholder).toBe('w');
  expect(document.body.textContent).toContain('/ossfs/w/');
});
```

Retain the custom-name test and assert that a custom `label: 'w'` remains `w` beside an unnamed `/ossfs/w` Project.

- [ ] **Step 2: Run the component test to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: FAIL because the current component renders `workspacePath`, has no catalog-derived label map, and uses the full path as rename placeholder.

- [ ] **Step 3: Implement catalog state and pass labels to all Project surfaces**

```tsx
const [projects, setProjects] = React.useState<AgenticProjectRecord[]>([]);
const projectLabels = React.useMemo(() => getAgenticProjectDisplayLabels(projects), [projects]);

const refreshProjectCatalog = React.useCallback(async () => {
  await workspaceSwitch.seedProjectCatalog();
  const catalog = await registry.listProjects();
  await Promise.all(catalog.map((project) => workspaceSwitch.refreshProjectAvailability(project)));
  const refreshedCatalog = await registry.listProjects();
  setProjects(refreshedCatalog);
  return refreshedCatalog;
}, [registry, workspaceSwitch]);
```

Change `ProjectGroup` to accept `projectLabel: string`, and pass `projectLabels.get(group.project.id) || getAgenticProjectDisplayLabel(group.project)` to active groups, archived groups, and `ProjectRenameModal`. Use that value in the modal title and input `placeholder`; add a separate `Workspace: {project.workspacePath}` node and replace the old hint with `Clear the name to use the default project name.`

Do not add a registry field or migration. Do not feed `query` to the helper. `refreshProjectCatalog` already runs after catalog, availability, add, remove, and registry-change events.

- [ ] **Step 4: Run the component test to verify GREEN**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: PASS, including existing resize, archive, project-management, and launch assertions.

- [ ] **Step 5: Commit the Task List integration**

```bash
git add packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx \
  packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx
git commit -m "feat(agentic): show compact unnamed project labels"
```

### Task 3: Protect the browser-visible BDD behavior

**Files:**

- Modify: `test/bdd/acp-chat-agentic-history.scenario.md`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`

**Interfaces:**

- Consumes: Project headers with the full cwd in their `title` attribute.
- Produces: a Playwright assertion that the unnamed current Project displays `path.basename(currentWorkspaceDir)` before setup applies its custom name.

- [ ] **Step 1: Write the failing Playwright assertion**

Add this after the current-workspace Tasks are created and before `renameProjectForTask(currentNewerSessionId, 'Project Current')`:

```ts
const unnamedCurrentGroup = page.locator('[data-testid="agentic-task-project-group"]').filter({
  has: page.getByTestId('agentic-task-row-' + currentNewerSessionId),
});
await expect(unnamedCurrentGroup.getByTitle(currentWorkspaceDir, { exact: true })).toContainText(
  path.basename(currentWorkspaceDir),
);
```

- [ ] **Step 2: Run the browser test to verify RED**

```bash
yarn workspace @opensumi/playwright build
OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test \
  acp-chat-agentic-task-workbench --config ./configs/playwright.config.ts --reporter=line
```

Expected: FAIL because the current unnamed Project still renders its complete workspace path.

- [ ] **Step 3: Preserve the detailed BDD contract**

Keep the accepted default-label, collision, search-stability, custom-name, and full-cwd-hover clauses in `test/bdd/acp-chat-agentic-history.scenario.md`. The browser fixture covers the deterministic single-project slice; Task 1 and Task 2's Jest tests directly cover collisions.

- [ ] **Step 4: Run the browser test to verify GREEN**

Run the Step 2 command again.

Expected: PASS with fresh evidence under `test/bdd/evidence/2026-07-14/acp-chat-agentic-history/`.

- [ ] **Step 5: Commit the BDD protection**

```bash
git add test/bdd/acp-chat-agentic-history.scenario.md \
  tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
git commit -m "test(agentic): cover compact project labels"
```

### Task 4: Verify and review the completed feature

**Files:**

- Review: `packages/ai-native/src/browser/acp/components/agentic-project-label.ts`
- Review: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Review: `packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts`
- Review: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`

- [ ] **Step 1: Run focused Jest regression tests**

```bash
yarn jest \
  packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts \
  packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx \
  packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx \
  packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts \
  packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run affected TypeScript references**

```bash
yarn tsc --build configs/ts/references/tsconfig.ai-native.json \
  configs/ts/references/tsconfig.playwright.json --pretty false
```

Expected: exit code 0.

- [ ] **Step 3: Run Agentic BDD regression**

```bash
yarn workspace @opensumi/playwright build
OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test \
  acp-chat-agentic-task-workbench \
  acp-chat-agentic-history \
  acp-chat-agentic-rich-history-restore \
  --config ./configs/playwright.config.ts --reporter=line
```

Expected: PASS with fresh PASS / CONVERT evidence.

- [ ] **Step 4: Run the repository test suite**

Run: `yarn test --runInBand`

Expected: exit code 0. If an unrelated pre-existing failure prevents completion, report its path separately from the focused feature checks.

- [ ] **Step 5: Check the final diff and conduct code review**

```bash
git diff --check
git diff -- packages/ai-native/src/browser/acp/components/agentic-project-label.ts \
  packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx \
  packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts \
  packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx \
  test/bdd/acp-chat-agentic-history.scenario.md \
  tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
```

Review for: persisted derived labels, unavailable Projects affecting collisions, query-dependent labels, active/archived mismatch, missing full-cwd tooltip, or any IDE Layout import/change.

- [ ] **Step 6: Commit the verified feature**

```bash
git add packages/ai-native/src/browser/acp/components/agentic-project-label.ts \
  packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx \
  packages/ai-native/__test__/browser/acp/agentic-project-label.test.ts \
  packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx \
  test/bdd/acp-chat-agentic-history.scenario.md \
  tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
git commit -m "feat(agentic): compact unnamed project labels"
```

## Plan Self-Review

- **Spec coverage:** Task 1 covers normalization, roots, custom names, unavailable Projects, and collisions. Task 2 covers active/archived rendering, search stability, full cwd hover, and rename-modal behavior. Task 3 protects the browser-visible default. Task 4 covers Jest, TypeScript, BDD, full-suite, diff, and review gates.
- **Persistence:** Tasks 1 and 2 derive labels outside `AgenticTaskRegistryService`; Task 4 reviews that no derived string is stored.
- **Scope:** Production changes stay in `packages/ai-native/src/browser/acp/components/`; IDE Layout, editor, and workspace lifecycle remain untouched.
