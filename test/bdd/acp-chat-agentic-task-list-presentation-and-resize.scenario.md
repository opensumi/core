# Scenario: Agentic Task List Presentation and Resize

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`, or `packages/ai-native/src/browser/chat/chat.module.less`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic Layout with the deterministic `history` fixture, available Project groups containing ready and non-default-status Tasks, and stable Agentic Chat Slot resize geometry. **Workspace mutation:** None. **Automation status:** Core workbench visibility and Task-row presentation are covered by `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`; deterministic resize bounds and the full status/attention presentation matrix remain hardened primarily by focused component tests until the browser fixture exposes stable injection for every state.

## Given

- Agentic AI Chat, Agent Tasks, Explorer, and the editor are visible together.
- The Task List contains multiple Projects and Tasks, including a default ready Task and Tasks with non-default status or attention.

## When

1. Inspect the Task List header, search field, Project headers, Task rows, archive actions, Archived toggle, and resize separator.
2. Keyboard-tab through every icon-only action and the resize separator.
3. Resize the Task List by pointer and keyboard, narrow the Agentic Chat Slot, then widen it again and reload the page.
4. Inspect computed typography, row heights, icon sizes, truncation behavior, and focus treatment.

## Then

- The Task List remains a persistent left subregion inside the AI Chat Slot while the Main Conversation Area, Explorer, and editor remain usable.
- Project Groups and Tasks use compact OpenSumi tree/list rows rather than card containers or decorative rails.
- A ready Task has no visible status metadata; non-default status or attention renders one semantic icon plus visible text, while unread remains an independent marker.
- Icon-only actions have accessible names, tooltips, and visible keyboard focus. Truncated Project and Task text retains its full hover or accessible detail.
- The default width is approximately `244px`; the minimum is `208px`; the maximum is `min(280px, chatSlotWidth - 360px)`.
- The Main Conversation Area remains at least `360px` wide. A stored preferred width clamps while narrow, survives reload, and returns when space is available without exceeding `280px`.
- Pointer dragging continues outside the narrow handle, keyboard arrows resize predictably, and resize-bound refresh occurs before the next interaction.
- Project headers, Task rows, and the Archived toggle are `22px` high; search is `28px`; Task titles use the OpenSumi base font; focus uses theme tokens; disclosure changes add no animation.

## Pass / Blocked Judgment

- **PASS** - presentation, accessibility, responsive clamping, persistence, and resize behavior satisfy every assertion without overlapping the conversation.
- **BLOCKED** - stable Task status fixtures, resize geometry, or browser selectors are unavailable.
- **FAIL** - the Task List becomes unreadable, overlaps the conversation, loses accessible controls, violates its bounds, or fails to restore the preferred width.

## Codegen Plan

- Extend the existing Agentic history or Task Workbench specs when deterministic browser fixture injection covers the remaining resize and status cases; do not create duplicate broad workflow specs.
