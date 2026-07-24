# Scenario: ACP Debug Log - Protocol Trace, Entry Bounds, and Viewer

**Trigger:** `packages/ai-native/src/node/acp/acp-debug-log.ts`, `packages/ai-native/src/browser/acp/debug-log/acp-debug-log.contribution.ts`, or `packages/ai-native/src/browser/acp/debug-log/acp-debug-log.view.tsx`

**Layer:** `runtime-ui` **Required profile:** `full` with ACP debug logging enabled. **Fixtures:** ACP debug log store, one thread driven by `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` or synthetic store records that emit protocol lines, optionally a real LLM-backed ACP agent for live redacted-log viewer smoke coverage, and the browser debug-log contribution. **Workspace mutation:** None. **Automation status:** Automated with store-level Jest assertions plus Playwright/Chrome DevTools MCP viewer, copy, clear, and redaction checks.

## Given

- ACP debug logging is enabled by the active test profile.
- At least one ACP thread has started through the mock ACP agent or synthetic store harness and can write stdout/stderr protocol lines.
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

### Part D - Sensitive Transport Data Audit

16. Use the product redacted debug-log render/copy contract.
17. Create a session where the built-in `opensumi-ide` MCP server is injected.
18. Open the debug log viewer and copy all entries.
19. Search the copied log text for:
    - raw MCP URL paths matching `/mcp/[a-f0-9]{32}`
    - known API token/key patterns
    - full relay digest bodies or permission prompt content

## Then

- Valid JSON lines populate `payload`; non-JSON stderr lines keep `payload` empty and preserve raw text.
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
- The node store retains raw local diagnostics, while the browser viewer and Copy All redact MCP bridge tokens, API keys, prompts/content/text, tool arguments/results, full relay digests, and permission content.
- Part D verifies that the debug log UI does not expose unredacted MCP bridge tokens, API keys, full relay digests, permission prompt contents, or deterministic prompt/assistant/tool sentinels.

## Live Agent Execution

- A real LLM-backed ACP agent may be used only for live viewer smoke coverage: entries appear, refresh/copy/clear controls work, and session/thread metadata is visible.
- Live-agent mode must not be used for store bounds, defensive-copy, partial-line parsing, or redaction pass/fail assertions. Any captured live logs must redact raw prompts, assistant text, API keys, MCP tokens, permission content, relay digests, and tool results.

## Pass / Fail Judgment

- **PASS** - ACP debug logging captures useful raw store traces, keeps the newest 2000 entries, preserves session/thread metadata, and presents a usable redacted viewer/copy surface.
- **BLOCKED** - the run lacks full profile, debug logging, viewer command, deterministic entries, or clipboard observability.
- **FAIL** - entry counts grow unbounded, partial lines become corrupt entries, session ids are not backfilled, the viewer cannot refresh/clear/copy correctly, or the redaction audit runs and copied logs contain unredacted MCP tokens or sensitive content.
