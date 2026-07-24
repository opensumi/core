# Scenario: ACP Chat Layout-Aware New Draft - Direct Task, Direct Chat, Shortcut, And Draft Preservation

**Trigger:** `packages/ai-native/src/browser/ai-core.contribution.ts`, `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/chat/chat.input.registry.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Deterministic ACP Agent catalog with at least one available Agent, one active Agentic Task, an editable ACP input draft, and user-facing Agentic/Classic layout switching. The workspace includes a focusable editor so the global New Draft shortcut can be invoked outside Chat. **Workspace mutation:** Temporarily changes `ai.native.panelLayout` between Agentic and Classic and restores the original value after the run. **Automation status:** Partially converted in `tools/playwright/src/tests/acp-chat-layout-aware-new-draft.test.ts`: direct Agentic primary/dropdown actions, Classic New Chat, panel close/reopen, shortcut routing, draft preservation, focus restoration, and inactive-session state are covered. Exact target Project/Agent identity, Project Agent Recall versus user default preference, and visible history-count invariants remain runtime/Jest-backed until stable metadata selectors are added.

**Acceptance coverage:** Layout-aware completion for `B-07`, `B-14`, and `E-08` from `test/bdd/feat-0710-acceptance.md`.

## Given

- Agentic Layout is active with an available Agent and an existing Task Conversation.
- The main ACP input can hold an unsent draft independently from the active Session.
- The effective New Draft shortcut is available from the editor/workbench focus context.

## When

### Part A - Agentic Direct New Task

1. Type an unsent Agentic draft and keep the input focused.
2. Click the Agentic header primary New Task `+`.
3. Record Agent-menu visibility, draft content, focus, Session state, target Project, and selected Agent.
4. Open the adjacent Choose Agent dropdown, select one Agent, and record the same state again.
5. Focus the editor and invoke the effective New Draft shortcut.

### Part B - Classic Direct New Chat

6. Switch to Classic Layout and show ACP Chat.
7. Type an unsent Classic draft, click the visible New Chat action, and record draft, focus, Session state, and history count.
8. Close and reopen ACP Chat, then record the draft and focus.
9. Close ACP Chat again, focus the editor, and invoke the same New Draft shortcut.

## Then

- In Agentic Layout, the primary `+` launches a Task Draft directly with the recalled Project/Agent and never opens Choose Agent or Choose Project UI.
- Choosing an Agent from the adjacent dropdown launches a Task Draft directly and updates only Project Agent recall, not the user default Agent preference.
- Agentic direct launch and shortcut preserve the unsent draft, restore input focus, and leave the draft inactive until its first accepted prompt.
- In Classic Layout, New Chat and the same shortcut enter a Chat Draft directly without rendering Agentic Task or Agent selection UI.
- Classic New Chat, panel close/reopen, and shortcut preserve the unsent draft and restore focus without eagerly creating an empty Session or history row.
- The same shortcut is layout-aware: Agentic routes to New Task; Classic/IDE routes to New Chat.

## Pass / Fail Judgment

- **PASS** - header actions and the global shortcut route directly according to layout while preserving draft, focus, target context, and lazy Session creation.
- **BLOCKED** - the run lacks an available Agent, stable Agentic split-action selectors, Classic New Chat, editor focus, or the configured shortcut.
- **FAIL** - Agentic primary launch opens a menu, Classic renders Agent selection, shortcut routes to the wrong action, draft/focus is lost, target Project/Agent drifts, or an empty Session/history row is eagerly created.
