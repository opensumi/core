# Scenario: ACP Chat Agentic Layout - Runtime Capability Coverage

**Trigger:** `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP.
- The IDE is opened with `ai.native.panelLayout = "agentic"` or with no explicit layout preference, because the normalized default layout is Agentic.
- Use a fresh browser profile, or clear the layout storage keys before the run:
  - `layout.ai.agentic`
  - `layout.state`
- The workspace contains at least `editor.js` and `test/test.js`.
- The MCP `opensumi-ide` server is connected with a fresh MCP session.
- The current external WebMCP/MCP contract uses lower-snake canonical tool names:
  - `opensumi_discover_capabilities`
  - `opensumi_enable_capability_group`
  - `opensumi_invoke_capability_tool`
  - `acp_chat_get_session_state`
  - `acp_chat_get_permission_state`
  - `acp_chat_show_chat_view`
- The test must not use legacy direct ACP tools such as `acp_sendMessage`, `acp_createSession`, `acp_switchSession`, `acp_clearSession`, `acp_cancelRequest`, or `acp_handlePermissionDialog`.
- Parts that send a chat message must run against a deterministic test ACP provider or a safe local fallback provider. They must not assert prompt text, assistant response text, or tool-call result content through ACP Chat state tools.

## When

### Part A - Agentic Startup and Chat Visibility

1. `chrome-devtools-mcp`: Open `http://localhost:8080/?workspaceDir=<absolute workspace path>`.
2. `chrome-devtools-mcp-wait`: Wait until `#main` is visible, `.loading_indicator` is detached, and the page text includes `EXPLORER`.
3. `chrome-devtools-mcp-evaluate`: record `location.href`, the visible layout label, and the bounding boxes for:
   - AI Chat slot
   - main editor/workbench
   - Explorer/view slot
   - status bar
4. `mcp`: `tools/list` -> record `TOOLS_DEFAULT`.
5. `mcp`: `acp_chat_show_chat_view({})`.
6. `chrome-devtools-mcp-wait`: wait until the Agentic AI Chat input/header is visible.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_OPEN`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_OPEN`.
9. `chrome-devtools-mcp-evaluate`: record fatal UI text, visible retry/timeout text, and any uncaught stack text.

### Part B - Default Tool Surface and Capability Boundary

10. Assert every OpenSumi tool in `TOOLS_DEFAULT` matches lower-snake naming: `/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/`.
11. Assert `TOOLS_DEFAULT` includes only the default ACP Chat tools:
    - `acp_chat_get_session_state`
    - `acp_chat_get_permission_state`
    - `acp_chat_show_chat_view`
12. Assert `TOOLS_DEFAULT` does not include older camelCase ACP Chat names:
    - `acp_chat_getSessionState`
    - `acp_chat_getPermissionState`
    - `acp_chat_showChatView`
13. Assert `TOOLS_DEFAULT` does not include old direct ACP mutation tools:
    - `acp_sendMessage`
    - `acp_createSession`
    - `acp_switchSession`
    - `acp_clearSession`
    - `acp_cancelRequest`
    - `acp_handlePermissionDialog`
14. `mcp`: `opensumi_discover_capabilities({ task: "agentic acp chat", includeDisabled: true })`.
15. `mcp`: `opensumi_enable_capability_group({ group: "acp_chat" })`.
16. Refresh `tools/list`.
17. If the refreshed list contains `acp_chat_list_sessions`, call it directly.
18. If the MCP client cannot refresh the list, call:
    ```js
    opensumi_invoke_capability_tool({
      tool: 'acp_chat_list_sessions',
      arguments: {},
    });
    ```
19. If available in the active profile, call `acp_chat_get_available_commands({})` directly or through the fallback broker.

### Part C - Chat Surface, Input, Commands, and First Send

20. Starting from the opened Agentic chat view, record `STATE_BEFORE_SEND` with `acp_chat_get_session_state({})`.
21. `chrome-devtools-mcp-evaluate`: record `CHAT_SURFACE_BEFORE_SEND`:
    - visible empty/welcome state
    - visible chat header title
    - visible close action
    - visible workspace cwd selector/switch action, if multi-root workspace is active
    - visible input textbox/editor state
    - placeholder text
    - send action enabled/disabled state
    - visible shortcut command buttons
    - visible model/mode selectors or command badges, if rendered
22. `chrome-devtools-mcp`: Focus the input, type whitespace only, and attempt to submit.
23. `chrome-devtools-mcp-evaluate`: record `INPUT_EMPTY_SUBMIT_STATE`, including whether any user message row was added and whether the send action stayed disabled.
24. `chrome-devtools-mcp`: Type a multi-line prompt using `Shift+Enter`, then submit with the normal send shortcut or send button.
25. `chrome-devtools-mcp-wait`: wait until the input returns to an idle editable state or the deterministic test provider emits a terminal assistant update.
26. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_SEND`.
27. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_SEND`.
28. `chrome-devtools-mcp-evaluate`: record `CHAT_SURFACE_AFTER_SEND`:
    - user message count
    - assistant message count
    - duplicate message ids or duplicated visible message rows
    - input disabled/loading state while the request is active
    - send/cancel/stop action visibility while the request is active, if the UI exposes one
    - final input value after send
    - final scroll position and whether the latest message is visible
    - message action visibility after loading finishes
29. If full profile exposes `acp_chat_read_session_messages`, call it with the active session id and tight caps:
    ```js
    acp_chat_read_session_messages({
      sessionId: STATE_AFTER_SEND.result.session.sessionId,
      maxMessages: 5,
      maxChars: 1000,
    });
    ```
    -> record `READ_MESSAGES_AFTER_SEND`.
30. Open the slash command surface by typing `/` in an empty input and record `SLASH_COMMAND_STATE`:
    - command item count
    - command names and descriptions
    - command list keyboard focus
    - selected command chip/theme after choosing one command
31. If `acp_chat_get_available_commands` is available, compare the visible ACP command names with `acp_chat_get_available_commands({})` and record `AVAILABLE_COMMANDS_FOR_UI`.
32. If a deterministic custom slash command fixture is registered, select it and send a prompt through the UI. Record whether the custom slash renderer appears and completes without creating duplicate assistant messages.
33. Open the mention/context picker by typing `@` in an empty input and record `MENTION_CONTEXT_STATE`:
    - visible default categories, such as files, folders, current file/code, or rules when those providers are available
    - selecting `editor.js` or the current editor creates a visible context chip
    - removing the chip updates the input without leaving stale attached text
34. If image/file attachment controls are enabled in the active input implementation, attach a small test image or file, record preview/remove state, remove it, and verify no stale attachment is sent.
35. With the message list taller than the viewport, record scroll behavior:
    - when the user is at the bottom, a new streamed/finished message scrolls into view
    - when the user manually scrolls up, the view does not jump until an explicit scroll-to-bottom action or new send path requires it
36. Run a deterministic failing send/session-create fixture and record `CHAT_ERROR_RECOVERY_STATE`:
    - user-facing error message is visible
    - input re-enables
    - no half-created empty session is persisted
    - a subsequent successful send still works

### Part D - Chat History Details and Session Switching

37. `chrome-devtools-mcp`: Click the Agentic chat header New Chat action.
38. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_NEW_CHAT`.
39. If `acp_chat_list_sessions` is available, call it and record `SESSIONS_AFTER_NEW_CHAT`.
40. Send one short prompt through the UI in the new draft.
41. Wait for the deterministic provider to finish the request.
42. Open the Agentic chat history surface from the header.
43. `chrome-devtools-mcp-evaluate`: record `HISTORY_OPEN_STATE`:
    - whether the history surface is visible
    - visible history item count
    - item ids, titles, timestamps, and current/selected markers
    - visible New Chat action count
    - visible collapse/expand action state
    - pending permission badge count, if any badge is rendered
44. `mcp`: call `acp_chat_list_sessions({})` directly or through the fallback broker and record `SESSIONS_WITH_HISTORY_OPEN`.
45. Assert the current draft or just-created empty draft does not create an extra persisted empty history row before the next successful send.
46. If at least two ACP sessions are visible in the history list, click the older history item.
47. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_HISTORY_SELECT`.
48. `chrome-devtools-mcp-evaluate`: record `HISTORY_AFTER_SELECT`, including selected/current marker, header title, visible message count, scroll position, and pending permission badge count.
49. Click the newer history item and record `STATE_AFTER_HISTORY_RESELECT`.
50. `chrome-devtools-mcp-evaluate`: record `HISTORY_AFTER_RESELECT`.
51. Collapse the history surface, then expand it again.
52. `chrome-devtools-mcp-evaluate`: record `HISTORY_COLLAPSE_REOPEN_STATE`.
53. If any session has pending permission outside the active session, record whether the history/header badge shows the non-active pending count without exposing permission content.

### Part E - Workspace and Editor Interop While Chat Is Leftmost

54. `chrome-devtools-mcp`: Open Explorer in Agentic layout.
55. `chrome-devtools-mcp`: Expand `test`, open `test/test.js`, then open `editor.js`.
56. `mcp`: call read-only editor/workspace tools that are exposed by the active profile:
    - `workspace_get_info({})`
    - `editor_get_active({})`
    - `workspace_list_open_files({})`
57. If file tools are exposed, call only read-only file tools:
    - `file_exists({ path: "editor.js" })`
    - `file_read({ path: "package.json", maxBytes: 4096 })` only if the file exists

### Part F - Resize, Reload, and Layout Switch Regression

58. `chrome-devtools-mcp`: Drag the Agentic AI Chat/workbench horizontal splitter smaller and larger.
59. `chrome-devtools-mcp-evaluate`: record AI Chat and workbench geometry after each drag.
60. `chrome-devtools-mcp`: Drag the Agentic Explorer/workbench splitter smaller and larger.
61. `chrome-devtools-mcp-evaluate`: record Explorer and workbench geometry after each drag.
62. `chrome-devtools-mcp`: Reload the page without changing the workspace URL.
63. Repeat Part A steps 2, 3, 6, 7, and 8 after reload.
64. Repeat Part C steps 21, 28, 30, and 33 after reload.
65. Repeat Part D steps 42-44 after reload.
66. `chrome-devtools-mcp`: Switch `Agentic -> Classic -> Agentic` through the user-facing layout selector.
67. Repeat Part A steps 3, 6, 7, and 8 after the final Agentic switch.
68. Repeat Part C steps 21, 28, 30, and 33 after the final Agentic switch.
69. Repeat Part D steps 42-44 after the final Agentic switch.
70. Repeat Part E steps 54-56 after the final Agentic switch.

### Part G - Agentic Fallback When ACP Backend Is Unavailable

71. Start the IDE with ACP backend readiness forced to fail, or use a test provider where `aiBackService.ready()` rejects before chat initialization.
72. Open the same workspace in Agentic layout.
73. `mcp` or `chrome-devtools-mcp`: show the AI Chat view.
74. `chrome-devtools-mcp-wait`: wait for the chat view to render without waiting for a real ACP session.
75. `chrome-devtools-mcp-evaluate`: record visible chat UI, fatal UI text, and loading/retry text.
76. Try the default ACP Chat state tools if the MCP bridge is available.

## Then

### Agentic Layout and Rendering

- The page does not navigate away from the original workspace URL.
- The visible layout label or preference state is Agentic.
- AI Chat is the leftmost major column: `aiChat.left <= workbench.left`.
- With cleared Agentic layout storage, AI Chat opens near the Agentic default size and always stays within its Agentic bounds:
  - `640px <= AI Chat width <= 1440px`
- The workbench remains usable:
  - `workbench.width >= 480px`
  - Explorer/view slot is visible or can be restored through the Explorer activity item.
  - Status bar remains visible.
- No step shows fatal UI text such as `SERVICE_UNAVAILABLE`, `EXECUTION_ERROR`, uncaught stack traces, or an initialization timeout that blocks the chat view.

### ACP Chat Default State

- `acp_chat_show_chat_view({})` returns `success: true` and `{ shown: true }`.
- Opening Agentic AI Chat is allowed to be a draft:
  - `STATE_AFTER_OPEN.result.active === false` and `STATE_AFTER_OPEN.result.session === null`, or
  - an active session exists with `historyMessageCount === 0` and `requestCount === 0`.
- `STATE_AFTER_OPEN`, `STATE_AFTER_SEND`, and all list/session responses are metadata-only. They must not contain prompt text, assistant response text, file contents, relay digest bodies, permission prompt content, or tool-call result content.
- Permission state exposes only counts and active session id:
  - `activeDialogCount`
  - `activeSessionId`
  - `pendingCountExcludingActive`
- No ACP Chat tool approves or rejects a permission decision.

### Capability Surface

- The default MCP tool list exposes lower-snake canonical names only.
- Older camelCase ACP Chat names are absent from `tools/list`, catalog descriptions, direct calls, and fallback broker calls.
- Old direct ACP mutation tools are absent and fail with tool-not-found if called directly.
- `opensumi_discover_capabilities` returns an `acp_chat` group.
- `opensumi_enable_capability_group({ group: "acp_chat" })` succeeds.
- After enabling, exposed ACP Chat tools are still limited by the active profile:
  - default/minimal profiles expose safe read/ui tools only.
  - full profile may expose `acp_chat_set_session_mode`, `acp_chat_post_prepared_relay`, and `acp_chat_read_session_messages`.
- Fallback broker calls use the same canonical target tool names and return the same success/failure class as direct calls.

### Draft and Session Lifecycle

- If `STATE_BEFORE_SEND` is draft/inactive, the first UI send creates or activates an ACP session before writing user or assistant history.
- `STATE_AFTER_SEND.result.active === true`.
- `STATE_AFTER_SEND.result.session.sessionId` is a non-empty string and `rawSessionId` is the same id without an `acp:` prefix.
- `STATE_AFTER_SEND.result.session.historyMessageCount >= 1`.
- `STATE_AFTER_SEND.result.session.requestCount >= 1` unless the deterministic fallback provider records history without request objects; in that case the failure output must include the provider mode.
- Chat surface details behave like a complete Agentic AI Chat:
  - The empty/welcome state renders before the first send and disappears after the first user message without hiding the input.
  - The input is focusable in draft state and disabled only while session creation or request sending is active.
  - Whitespace-only submits do not create a session, message, or request.
  - Multi-line input preserves line breaks until send and clears the input after a successful send.
  - The user message appears exactly once and before the assistant response.
  - Assistant loading/streaming renders a single active assistant row and resolves to a stable final row without duplicate ids or duplicate DOM rows.
  - Send/cancel/stop controls, when rendered, reflect loading state and do not expose old direct ACP tools.
  - Message actions are hidden or disabled while the assistant row is loading and become usable only after the request is complete.
  - User-visible errors re-enable the input and allow a later successful send without preserving a stale loading row.
  - Auto-scroll keeps the newest message visible when the user is already at the bottom, and manual upward scrolling is not overwritten until an explicit bottom-scroll or send path.
- Slash command and context entry points stay wired:
  - Typing `/` opens the command list with command names/descriptions from the registered feature commands plus ACP available commands when present.
  - Selecting a command updates the command chip/theme and sends the stripped prompt with the selected command id.
  - Custom slash renderers, when registered by the fixture, render once and complete without duplicating assistant messages.
  - Typing `@` opens mention/context categories allowed by the active input implementation, such as file, folder, current file/code, or rules.
  - Selecting and removing a context chip updates the serialized input context without leaving stale attached-text wrappers in the visible input.
  - Attachment previews, when enabled, can be removed before send and removed attachments are not sent.
  - Commands, mentions, and attachments do not leak their raw payloads through `acp_chat_get_session_state`, `acp_chat_list_sessions`, or permission state.
- Header details stay usable:
  - The close action hides only the AI Chat view and does not reload the IDE.
  - The workspace cwd selector is visible in multi-root mode, switches the draft cwd, and does not eagerly create an empty ACP session before send.
  - Header title changes follow the active session or safe generated title and never expose long prompt bodies beyond the configured title cap.
- Clicking New Chat in Agentic enters a draft state and does not eagerly create another empty ACP session before the next send.
- Chat history list details stay consistent:
  - History opens from the Agentic header and can be collapsed/reopened without losing the active session selection.
  - The inline header renders exactly one New Chat action and one collapse/expand action.
  - History item order matches the session list order expected by ACP: newest first by `createdAt` or first-message timestamp.
  - Each visible item has a stable session id and a non-empty title derived from safe metadata. Empty draft sessions do not add duplicate `(untitled)` or `New Session` rows before a successful send.
  - The selected/current marker follows `acp_chat_get_session_state` after history item selection and reselection.
  - History item titles and `acp_chat_list_sessions` results remain metadata-only and do not expose prompt text, assistant response text, tool-call result content, file contents, relay digest bodies, or permission prompt content.
  - Pending permission badges show counts/scoped state only; they do not expose approval/rejection controls or permission content.
  - Reload and `Agentic -> Classic -> Agentic` switching preserve a usable history surface and the active session marker.
- Selecting a history item activates that session, updates session state, updates the header title/message view, and keeps permission state scoped to the selected session.

### Editor and Layout Interop

- Explorer remains interactive while AI Chat is leftmost.
- Opening files updates `editor_get_active` and `workspace_list_open_files`.
- Read-only workspace/editor/file WebMCP calls continue to work before send, after send, after resize, after reload, and after `Agentic -> Classic -> Agentic` switching.
- Agentic AI Chat/workbench resizing respects:
  - `640px <= AI Chat width <= 1440px`
  - `workbench.width >= 480px`
- Agentic Explorer/workbench resizing keeps Explorer recoverable and does not collapse the file tree to a permanent `0px` width.
- Reload preserves Agentic mode and restores a usable AI Chat + workbench layout.

### Fallback

- If the ACP backend is unavailable, Agentic AI Chat still renders a usable chat surface through the local fallback path.
- The fallback path does not create an infinite loading state, does not require a real ACP session to render children, and does not expose hidden ACP mutation tools.
- ACP Chat state tools either return a structured service-unavailable result or safe metadata for the fallback session. They must not throw an unstructured browser/MCP error.

## Pass / Fail Judgment

- **PASS** - Agentic AI Chat opens as the leftmost chat surface, exposes only the current canonical safe ACP Chat tools by default, handles draft-to-session creation through the UI, keeps history/session observability metadata-only, preserves Explorer/editor interop, and survives resize, reload, layout switch, and ACP backend fallback checks.
- **PARTIAL** - default Agentic layout, safe tool surface, and read-only state checks pass, but send/history/full-profile sections are skipped because the run lacks a deterministic ACP provider or full WebMCP profile.
- **FAIL** - AI Chat is not usable in Agentic layout, the page enters a blocked loading/error state, tool names drift or expose legacy mutation tools, opening chat eagerly creates empty sessions when draft mode is expected, session state leaks content, Explorer/editor interaction breaks, resize bounds fail, reload loses the Agentic layout, or fallback errors are unstructured.
