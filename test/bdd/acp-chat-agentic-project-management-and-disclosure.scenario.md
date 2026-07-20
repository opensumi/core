# Scenario: Agentic Project Management and Disclosure

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/components/agentic-project-label.ts`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** A deterministic multi-Project Task registry with two available Projects, one unavailable Project, colliding derived Project names, and the standard Project rename and directory-picker surfaces. **Workspace mutation:** Fixture setup may create disposable Project directories and labels; it must not navigate, delete, or mutate a user workspace. **Automation status:** Available/unavailable Project filtering and core Project interactions are exercised in `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`; collision labels, rename semantics, disclosure state, and filtering invariants are additionally hardened by focused component/service tests.

## Given

- The registry contains available current and secondary Projects plus a Project whose cwd is missing.
- Available Projects contain ordered immutable Task titles; at least one manually added Project is empty.

## When

1. Observe derived, custom, and colliding Project labels and their full-cwd hover detail.
2. Search for a Task inside a collapsed Project, then clear the search.
3. Toggle Project disclosure by pointer, `Enter`, and `Space`, and operate the sibling `+` and `…` actions.
4. Rename an unnamed Project, cancel a change, save a trimmed custom name, then clear it with whitespace-only input.
5. Add an existing directory and attempt to add it again; remove an empty manually added Project.

## Then

- Custom Project names render exactly; otherwise the final normalized cwd segment is used, with the shortest distinguishing parent suffix for collisions.
- Search does not reorder Tasks or alter stored titles. It temporarily reveals a matching collapsed Project and restores the user's disclosure state after clearing.
- Each non-empty Project label/count is one semantic disclosure with `aria-expanded`; sibling `+` and `…` actions never toggle disclosure. Empty Projects have no false disclosure state.
- Rename uses the OpenSumi Modal with a focused `Project name` input, derived-name placeholder, and full cwd. Rename changes only the label, not Project identity, Task membership, session identity, or ordering.
- Add Project uses the existing directory picker without navigating the IDE. Re-adding a directory revalidates rather than duplicates it; Remove Project appears only for an empty manually added Project.
- Unavailable Projects remain persisted for recovery but contribute no visible Project, Task, archived row, search result, count, attention, launch action, or workspace navigation.

## Pass / Blocked Judgment

- **PASS** - labels, search, disclosure, rename, add/remove, and unavailable filtering preserve Project and Task identity without navigating the workbench.
- **BLOCKED** - the multi-Project fixture, rename modal, directory picker, or stable disclosure selectors are unavailable.
- **FAIL** - labels drift, search destroys disclosure state, sibling actions toggle disclosure, Project identity changes, duplicates appear, or an unavailable cwd is opened.

## Codegen Plan

- Extend `acp-chat-agentic-task-workbench.test.ts` only when the remaining rename/collision fixtures are stable; keep collision algorithms covered at the component/service seam.
