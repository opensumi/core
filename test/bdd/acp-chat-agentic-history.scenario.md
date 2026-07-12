# Scenario: Agentic Task List - Same-Project Persistence and Safe Restore

**Trigger:** `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixture:** Deterministic ACP `history` fixture, which supplies one workspace and no pending permission event. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` and `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`.

## Runtime coverage

1. Open Agentic Layout and assert the Task List, Main Conversation Area, editor, and file tree are visible together.
2. Create two Tasks through the Project-first menu, selecting an ACP Agent rather than the Project back row.
3. Assert newest-first Task Row order within the current Project and search immutable Task titles.
4. Select a current-project Task and assert `acp_chat_get_session_state({})` changes without a main-frame navigation.
5. Archive and unarchive a ready Task.
6. Read the actual `GLOBAL_RECENT_DATA` browser cache (`localStorage["global:recent"]`) and its `agentic.task-registry.v2` record.
7. Reload the same workspace, select the persisted Task again, and check bounded rich-history recovery.
8. Open Classic Layout and assert the ACP history is available through `acp-chat-history-button` and its popover.

## Then

- Agentic uses the persistent Task List and does not render `acp-chat-history-inline`.
- Project-first launch closes the menu after an actual Agent selection; it creates a draft before a Task is sent.
- Current-project selection changes only the active ACP session and does not navigate the main frame.
- The `GLOBAL_RECENT_DATA` registry and metadata-only ACP tools exclude deterministic prompt, assistant, thought, tool-result, and permission-result sentinels. The history fixture does not create a permission request; node restore coverage supplies the static sentinel check for that content class.
- Classic mode is protected by its popover/button behavior, not by the Agentic-only inline-history selector.

## Pending runtime prerequisites

- Joined-time Project Group ordering needs a deterministic multi-project catalog fixture. Existing registry and Task List unit coverage protect the ordering contract.
- Cross-project selection, Save All, Discard, and Cancel need a second workspace plus a controllable dirty-editor dialog in the runtime fixture. Existing `agentic-workspace-switch.service` unit coverage protects those decisions.
- Cross-project Project-first launch and target restoration need the same multi-workspace fixture.
- Background permission attention needs a runtime pass that combines a second Task with the `permission` fixture; the current `history` fixture cannot exercise it.

## Pass / Blocked Judgment

- **PASS** - the listed runtime coverage succeeds with the deterministic `history` fixture.
- **BLOCKED** - the IDE dev server, deterministic fixture, or stable runtime selector is unavailable.
- **PENDING** - the explicit multi-project and background-permission prerequisites above are not claimed by this scenario until their fixture support exists.
