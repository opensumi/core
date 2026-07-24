# Scenario: ACP Chat Agentic Input and Send - Draft Lifecycle and Recovery

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** `acp-chat-agentic-startup.scenario.md` has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` for successful send assertions, a separate `--fixture=long-stream` pass keeps queued editors observable, separate `--fixture=create-failure` and `--fixture=send-failure` passes cover recovery assertions, mixed text/image paste inputs include multiple small images with one controlled upload rejection, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only for live shell/send coverage. **Workspace mutation:** None. **Automation status:** Recovery subcases are converted in `tools/playwright/src/tests/acp-chat-agentic-error-taxonomy.test.ts`: `send-failure` preserves the user row and exposes retry, `create-failure` leaves the draft input recoverable, and each is followed by a separate `stream-rich` recovery pass. Broader input, command, Mention, image, mixed-paste, focus, expansion, attachment, and scroll checks remain governed by this scenario. Deterministic IME, rejection, clipboard lifetime, and partial-upload details are hardened in the Jest-backed `acp-chat-interaction-contract.scenario.md`.

**Acceptance coverage:** Runtime coverage for `C-13` through `C-16` from `test/bdd/feat-0710-acceptance.md`; deterministic edge completion is in `acp-chat-interaction-contract.scenario.md`.

## Given

- The Agentic chat surface is visible and focusable.
- Parts that send a message run against the process-level mock ACP agent through the real `AcpThread` stdio/JSON-RPC path.
- First-send assertions start from a fresh Task Draft. If the page opens on an existing or stale active Task, use the Agentic header primary New Task action before Step 1; record any stale-session send failure as reload/session-recovery evidence instead of the primary input-send verdict.
- The scenario may assert bounded session title metadata, but must not assert full prompt/message bodies, assistant response text, or tool-call result content through ACP Chat state tools.

## When

1. Ensure the Agentic input is in a fresh New Task draft state, then `mcp`: `acp_chat_get_session_state({})` -> record `STATE_BEFORE_SEND`.
2. Record the visible empty/welcome state, header title, close action, input editor state, placeholder, send action state, shortcut command buttons, and model/mode controls if rendered.
3. Focus the input, type whitespace only, and attempt to submit.
4. Record whether any user message row was added and whether the send action stayed disabled.
5. Type a multi-line prompt using `Shift+Enter`, then submit with the normal send shortcut or send button.
6. Wait until the input returns to an idle editable state or the mock `stream-rich` fixture reaches a terminal stream state.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_SEND`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_SEND`.
9. Record user-row count, assistant-row count, duplicate ids/rows, loading controls, final input value, and whether the latest row is visible. Do not assert assistant text.
10. Open the slash command surface by typing `/`, select one visible command, and record command list focus plus selected command chip/theme.
11. If `acp_chat_get_available_commands` is exposed, compare visible command names with tool results.
12. Open the mention/context picker by typing `@`, select `editor.js` or the current editor when available, and remove the chip.
13. If attachment controls are enabled, attach a small test file, verify preview/remove state, remove it, and verify no stale attachment is sent.
14. With the message list taller than the viewport, verify bottom auto-scroll for new output and verify an upward user scroll is not overwritten until a new send or explicit bottom-scroll action.
15. Run the mock ACP agent once with `--fixture=create-failure` and once with `--fixture=send-failure`, record visible recovery state for each pass, then retry with `--fixture=stream-rich`.
16. In the main input, place the caret between two deterministic text fragments and paste clipboard data containing both text and one image. Record the text and caret immediately, move focus/selection to another editable surface before image upload settles, then record both editors after upload completion.
17. Add a deterministic Mention and image to a main draft, start the `long-stream` pass, and submit later drafts until at least two Queued Turns are visible. Begin editing the second Queued Turn and record queued-editor focus, serialized Mention display, and image preview.
18. Modify the second queued draft, confirm the edit with the queued editor's normal `Send` control or Enter, reopen it, and confirm its Mention and image remain attached without changing its queue index. Also confirm the independent main draft is not overwritten by queued-editor changes.
19. Exercise an accepted queued-editor `Send`/Enter, Cancel, Delete, and Immediate Send from the queued surface and record the active element after each action settles. Exercise one rejected empty `Send`/Enter and record that the queued editor, draft, and focus remain in place.
20. In the main input, create a draft with text, a Mention, and an image; place the caret in the middle; toggle expansion with `Shift+Alt+Escape` and the visible expand/collapse action; record the contenteditable node identity, focus, selection, draft, Mention, image, and expanded state after each toggle.
21. Paste HTML-looking `text/plain` and confirm it remains literal. Then paste deterministic text plus multiple images while one image upload is forced to fail; record the text, successful previews, failed-count message, caret, and current editor before and after all uploads settle.
22. In the queued editor, press `Shift+Enter` and confirm a native newline is inserted. Press `Cmd/Ctrl+Shift+Enter` and confirm the same edited Queued Turn follows Immediate Send without creating a second queue row.
23. Repeat queued-editor Save and Immediate Send with deterministic rejected empty, cancellation-failed, and start-failed outcomes; confirm the visible draft, queue index, edit lease, and focus remain recoverable. Use `acp-chat-interaction-contract.scenario.md` for the exact race/identity assertions that are not stable in browser timing.
24. In a controllably delayed main-input submission, repeat Enter or click Send while the first submission is pending, then type or attach new draft content before the accepted submission settles.
25. Submit a contenteditable blank-markup draft and a command-only draft in separate passes.

## Then

- Whitespace-only submits do not create a session, message, or request.
- `STATE_BEFORE_SEND` is draft/inactive before first-send checks, and the first valid send creates or activates an ACP session before writing history.
- `STATE_AFTER_SEND.result.active === true`, with non-empty `sessionId` and a raw id that has no `acp:` prefix.
- The input preserves line breaks before send and clears after successful send. It is disabled while session creation or Active Session switching owns the editor; during an active stream it remains editable so later turns can be queued while Stop is visible.
- The user row appears exactly once and before the assistant row.
- Assistant loading/streaming renders a single active row and resolves to a stable final row without duplicate ids or duplicate DOM rows.
- Send/cancel/stop controls reflect loading state and do not expose old direct ACP tools.
- Commands, mentions, and attachments update visible chips/control state without leaking raw payloads through state, list, or permission tools outside allowed title metadata.
- Mixed text/image paste inserts text synchronously at the originating caret, starts one image upload, and does not later apply text or selection changes to another editor after focus moves.
- HTML-looking `text/plain` remains literal. Mixed multi-image paste preserves text and successful images, reports only failed images, and keeps all results attached to the editor where paste occurred.
- Main and queued editors keep independent draft state. The queued editor preserves Mention tokens and images across edit/Send/reopen without moving the item or overwriting the main draft.
- Beginning a queued edit focuses its editor. Accepted queued-editor `Send`/Enter, Cancel, Delete, and settled Immediate Send return focus to the main input; a rejected empty `Send`/Enter keeps the queued editor, draft, and focus in place.
- Queued-editor `Shift+Enter` inserts a newline; `Cmd/Ctrl+Shift+Enter` saves and Immediately Sends the same Queued Turn without changing its identity or producing a duplicate row.
- Cancellation/start rejection keeps the queued draft and edit state visibly recoverable; the deterministic contract scenario proves exact ID, FIFO, and lease restoration.
- Expanding or collapsing the main input keeps the same contenteditable node, focus, caret/selection, text, Mention, and image state. Expansion-state changes do not submit, clear, or replace the draft.
- A pending main-input submission is single-flight: repeated submission does not create a duplicate request, row, or queue entry, and accepted cleanup does not erase text, images, Agent, or command changes made after submission began.
- Contenteditable blank markup remains inert, while a command-only draft remains a valid submission.
- User-visible errors re-enable input, clear stale loading/error state after retry, and do not persist half-created empty sessions.

## Live Agent Execution

- A real LLM-backed ACP agent may verify input focus, draft/send lifecycle, user row creation, loading or streaming transition, input recovery, expansion focus preservation, and metadata-only state.
- Live-agent mode must not claim queued-editor ordering, mixed-paste upload timing, generated assistant text, exact response timing, model-selected tool choices, command-derived titles, or retry content. Those assertions and failure injection still require deterministic fixtures before Playwright conversion.

## Pass / Fail Judgment

- **PASS** - draft input, first send, commands, Mentions, images, partial-failure mixed paste, queued-editor shortcuts/recovery, main/queued focus, expansion preservation, scroll, and recovery behave as a complete Agentic chat surface.
- **BLOCKED** - the run lacks interactive profile, a required mock ACP agent pass, a stable New Chat/fresh draft entry point, controlled mixed-paste image success/failure inputs, or stable main/queued focus selectors.
- **FAIL** - valid sends from the fresh draft fail, duplicate messages appear, mixed paste loses successful content or corrupts another editor, queued shortcuts change identity/order or lose recoverable edits, expansion replaces or clears input state, raw message/tool content leaks through state tools outside allowed title metadata, or recovery leaves stale loading/session state.
