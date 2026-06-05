# Scenario: ACP Debug Log - Protocol Trace, Bounds, and Safe Viewer

**Trigger:** `packages/ai-native/src/node/acp/acp-debug-log.ts`, `packages/ai-native/src/browser/acp/debug-log/acp-debug-log.contribution.ts`, or `packages/ai-native/src/browser/acp/debug-log/acp-debug-log.view.tsx`

**Layer:** `runtime-ui` **Required profile:** `full` with ACP debug logging enabled. **Fixtures:** ACP debug log store, one thread that emits protocol lines, and the browser debug-log contribution. **Workspace mutation:** None. **Automation status:** Automated with store-level assertions and Chrome DevTools MCP viewer checks.

## Given

- ACP debug logging is enabled by the active test profile.
- At least one ACP thread has started and can write stdout/stderr protocol lines.
- The IDE command registry contains `ai.native.acp.openDebugLog`.
- Common preflight in `test/bdd/README.md` passes when validating the browser viewer.

## When

### Part A - Store Recording

1. Record an outgoing JSON-RPC line with `agentId`, `threadId`, and no `sessionId`.
2. Record an incoming JSON-RPC line with an explicit raw ACP `sessionId`.
3. Record a stderr line that is not valid JSON.
4. Record one chunk containing two newline-delimited protocol messages and one trailing partial message through `createLineRecorder`.
5. Complete the trailing partial message with a later chunk.

### Part B - Session Backfill and Bounds

6. Call `setThreadSessionId(threadId, rawSessionId)` after earlier entries were recorded without a session id.
7. Record more than 2000 entries for the same thread.
8. Call `getEntries()`, mutate the returned first entry locally, and call `getEntries()` again.
9. Call `clear()`.

### Part C - Viewer

10. Execute `ai.native.acp.openDebugLog`.
11. Chrome DevTools MCP waits for an editor tab named `ACP Debug Log`.
12. Click Refresh.
13. Click Copy All when entries exist.
14. Click Clear.
15. Let the auto-refresh timer tick at least once.

### Part D - Sensitive Transport Data

16. Create a session where the built-in `opensumi-ide` MCP server is injected.
17. Open the debug log viewer and copy all entries.
18. Search the copied log text for:
    - raw MCP URL paths matching `/mcp/[a-f0-9]{32}`
    - known API token/key patterns
    - full relay digest bodies or permission prompt content

## Then

- Valid JSON lines populate `payload`; non-JSON stderr lines keep `payload` empty but preserve bounded raw text.
- Empty lines are ignored by `createLineRecorder`.
- Partial chunks are not recorded until a newline completes the message.
- `setThreadSessionId` backfills earlier entries for the same thread that did not yet have a session id.
- The store keeps only the newest 2000 entries.
- `getEntries()` returns defensive copies; local mutation of a returned entry does not mutate the store.
- `clear()` resets the entry list and starts ids from `1` for the next record.
- The viewer opens as a normal editor component, not as a modal that blocks chat usage.
- Refresh reloads entries from `IAIBackService.getAcpDebugLog`.
- Clear calls `IAIBackService.clearAcpDebugLog` and updates the UI to the empty state.
- Copy All is disabled when there are no entries and writes the rendered log when entries exist.
- Auto-refresh does not duplicate existing entries or reset scroll/focus unexpectedly.
- Debug log UI must not expose unredacted MCP bridge tokens, API keys, full relay digests, or permission prompt contents. If raw protocol capture needs to include sensitive transport fields for diagnosis, the viewer must redact them before rendering and copying.

## Pass / Fail Judgment

- **PASS** - ACP debug logging captures useful bounded protocol traces, keeps session/thread metadata consistent, presents a usable viewer, and avoids leaking transport tokens or sensitive chat/permission bodies.
- **FAIL** - logs grow unbounded, partial lines become corrupt entries, session ids are not backfilled, the viewer cannot refresh/clear/copy correctly, or copied logs contain unredacted MCP tokens or sensitive content.
