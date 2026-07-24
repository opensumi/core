# Scenario: Agentic Task Launch and Activation

**Trigger:** `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`, `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic `history` fixture with at least two named Agents, multiple current-Project Tasks, and deterministic activation failure and deferred-completion seams. **Workspace mutation:** None. **Automation status:** Direct Agentic Task launch and current-Project session activation are covered across `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`, `tools/playwright/src/tests/acp-chat-layout-aware-new-draft.test.ts`, and `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`; failure and last-selection-wins races are additionally hardened by focused service tests.

## Given

- Agentic Layout is active with `Agent A` and `Agent B` available.
- The current Project contains at least two Tasks and one selected durable Task.

## When

1. Inspect the split header action containing primary `New Task` and the adjacent `Choose Agent` dropdown.
2. Launch directly, choose a different Agent, then launch again from the header and from a Project-group `+`.
3. Send the first prompt for a draft and observe Task registration and selection.
4. Activate an older current-Project Task, reload, and select it again.
5. Trigger a deterministic activation failure, then issue two activation requests whose completions arrive out of order.
6. Repeat the launch surface with no ACP Agent available.

## Then

- Primary `New Task` immediately opens an Agent-bound draft and never opens a Project picker. The dropdown opens only on click, shows Agents, the next-Agent check mark, and Agent Configuration.
- Direct launch uses the selected durable Task's Project when present, otherwise the current IDE workspace. Project-group `+` uses that Project and its recalled Agent.
- Explicit Agent choice launches immediately and updates only Project Agent Recall, not the user's default Agent preference. A later primary launch reuses the recall.
- A draft receives a Task List row only after its first accepted prompt; the new row becomes active and the previous row clears selection.
- Current-Project activation changes `acp_chat_get_session_state({})`, clears unread only after success, preserves URL/workspace, survives reload, restores bounded rich history, and stores content-free registry metadata.
- Failed activation preserves the previous conversation/selection and target unread state. Out-of-order completion cannot override the latest requested selection.
- With no Agent available, primary and Project launch controls are disabled with recovery guidance, the dropdown still exposes Agent Configuration, and Add Project remains available.

## Pass / Blocked Judgment

- **PASS** - launch, Agent recall, registration, activation, reload, failure, and race behavior satisfy every assertion without changing the default Agent or workspace.
- **BLOCKED** - named Agents, deterministic failure/deferred seams, session-state surface, or stable launch selectors are unavailable.
- **FAIL** - a Project picker appears, the wrong Agent/Project is used, activation corrupts selection, unread clears early, metadata stores content, or an older request wins.

## Codegen Plan

- Reuse the existing layout-aware New Draft, history, and Task Workbench specs; add browser assertions only for deterministic fixture cases not already covered.
