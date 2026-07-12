# Scenario: Agentic Task List - Persistent Project Tasks and Safe Restore

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The deterministic ACP `history` fixture, plus the `permission` fixture for background-attention coverage. **Workspace mutation:** A temporary dirty editor is used only for Save All, Discard, and Cancel switching decisions. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` and `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`.

## Given

- Agentic Layout has loaded with the deterministic ACP fixture.
- The Task List, Main Conversation Area, editor, and file tree are visible together.
- The Task List has at least two persisted Task rows across its Project Groups.

## When

1. Read Project Group order and Task Row order, then search an immutable Task title.
2. Select a Task in the current Project and observe `acp_chat_get_session_state({})` without reloading the workspace.
3. Select a Task in another Project with a dirty editor and cover Save All, Discard, and Cancel outcomes.
4. Archive a ready Task, open Archived Tasks, then unarchive the same Task.
5. Create a pending permission in a background Task and observe its Task List attention marker without reading permission content.
6. Launch a cross-project Task from the Project-first New Task flow.
7. Reload the IDE and select the same Task List row again.
8. Switch to Classic Layout and verify the Classic inline ACP history remains available.

## Then

- Agentic layout has exactly the persistent Task List workbench affordance; `acp-chat-history-inline` is absent.
- Project Groups retain joined-time order and Task Rows retain newest-first creation order; searching only filters visible immutable Task titles.
- Current-project selection changes only the active ACP session. Cross-project selection preserves dirty-editor intent: Save All saves before switching, Discard closes changes before switching, and Cancel leaves the workspace and active Task unchanged.
- Archive removes the row from active Tasks; Unarchive returns it to active Tasks.
- A background pending permission renders only the permission-attention marker and no permission text or decision control on the Task List.
- Project-first launch and reload retain the stored `{ agentId, cwd }` target for the selected Task.
- Persisted Task-list/state evidence and metadata-only ACP tools exclude the fixture's prompt, assistant, thought, tool-result, and permission-content sentinels. Safe Task titles remain allowed metadata.
- Classic Layout retains `acp-chat-history-inline`; its regression coverage must not be removed while replacing Agentic history assertions.

## Pass / Fail Judgment

- **PASS** - all four visible regions, ordering/filtering, safe current/cross-project selection, archive lifecycle, attention, Project-first launch, reload, and metadata/storage redaction assertions pass with deterministic fixtures.
- **BLOCKED** - the required deterministic fixture, stable dirty-editor dialog selectors, or cross-project workspace fixture cannot start.
- **FAIL** - Agentic renders inline history, Task selection reloads the workspace unnecessarily, a dirty-editor choice is ignored, task storage leaks fixture content, or Classic history regresses.
