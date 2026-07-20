# Scenario: Agentic Task Archive, Status, and Restore

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/layout/panel-layout.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic `history` fixture with ordered current-Project Tasks, ready/running/stopped/error states, permission/input attention, unread state, and bounded rich history. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` for current-workspace lifecycle, filtering, selection persistence, Archive/Unarchive, reload restore, metadata safety, and Classic boundary behavior. Rich replay details remain covered by `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`.

## Given

- Agentic Task List contains ordered Tasks with default and non-default status, attention, unread, and archivable states.
- Classic and Agentic layout preferences are both available.

## When

1. Filter and activate current-Project Tasks, reload, and restore the persisted selection and bounded history.
2. Reveal Archive by hover and keyboard focus on eligible rows; archive and unarchive ready, stopped, and error Tasks.
3. Inspect running, unknown, missing-status, attention, unread, and unavailable-Project behavior.
4. Expand the Archived Area and inspect restored Project membership and row presentation.
5. Switch Agentic to Classic and back to Agentic.

## Then

- Task ordering and immutable titles survive filtering, activation, reload, archive, and restore. Registry metadata remains free of prompt, assistant, reasoning, tool, permission, and file content.
- Ready, stopped, and error Tasks expose an icon-only accessible Archive action; running, unknown, and missing-status Tasks do not.
- Ready rows remain undecorated. Revealing Archive or Unarchive overlays the action area without shifting the title; non-default metadata hides visually while actionable and returns afterward, while assistive detail remains available.
- Permission or input attention replaces ordinary status and contributes to the visible attention count. Unavailable Projects contribute no rows or attention.
- Unarchive returns the Task to its original Project with title, status, and Project reference intact. The Archived Area starts collapsed and uses the same compact list vocabulary.
- Classic retains its ACP history popover/button behavior. Returning to Agentic restores Agent Tasks and Header `New Task` without changing IDE layout outside the Agentic surface.

## Pass / Blocked Judgment

- **PASS** - status, attention, unread, archive eligibility, persistence, rich restore, metadata safety, and Classic/Agentic boundaries satisfy every assertion.
- **BLOCKED** - deterministic status/attention history, archive controls, reload persistence, or stable layout selectors are unavailable.
- **FAIL** - ordering or selection is lost, metadata leaks content, archive eligibility drifts, rows shift, restore changes Project identity, or Classic behavior regresses.

## Codegen Plan

- Keep `acp-chat-agentic-history.test.ts` as the primary hardened spec and `acp-chat-agentic-rich-history-restore.test.ts` for rich replay; do not duplicate either workflow.
