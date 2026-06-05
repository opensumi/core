# Scenario: ACP Error and Recovery - Structured Failures Without Stale UI State

**Trigger:** `packages/ai-native/src/node/acp/acp-error.ts`, `packages/ai-native/src/node/acp/acp-agent.service.ts`, `packages/ai-native/src/node/acp/acp-cli-back.service.ts`, `packages/ai-native/src/browser/acp/webmcp-utils.ts`, or `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`

**Layer:** `node-contract` **Required profile:** `full` for complete WebMCP and browser recovery coverage. **Fixtures:** Deterministic failure injection for ACP process, node service, browser provider, and WebMCP registry. **Workspace mutation:** None. **Automation status:** Automated contract spec with runtime recovery checks through Chrome DevTools MCP.

## Given

- ACP agent mode is enabled.
- The test harness can force deterministic failures from the ACP process, node service, browser provider, and WebMCP tool registry.
- Common preflight in `test/bdd/README.md` passes for browser recovery checks.
- The run records browser console errors, MCP tool responses, chat model loading flags, and visible fatal UI text through Chrome DevTools MCP.

## When

### Part A - Node Error Normalization

1. Pass a native `Error("plain failure")` through `normalizeAcpError`.
2. Pass a string error through `normalizeAcpError`.
3. Pass an ACP SDK error object with `message`, `code`, and `data`.
4. Pass an object with nested `{ error: { message } }`.
5. Pass a circular object.

### Part B - Service Operation Failures

6. Force `createSession` to fail after a thread is allocated but before a session id is returned.
7. Force `loadSession` to fail for a historical session and then succeed through `loadSessionOrNew`.
8. Force `sendMessage` to fail while the thread is `working`.
9. Call mode/config/fork/resume/close/model operations with a missing raw session id.
10. Dispose a session while a pending load is still in flight.

### Part C - WebMCP Error Shape

11. Call `acp_chat_get_session_state` when `IChatInternalService` is unavailable.
12. Call `acp_chat_prepare_session_digest({ sourceSessionId: "" })`.
13. Call a WebMCP tool whose implementation throws an error containing `token=secret-value` and an `sk-...` style token.
14. Call `opensumi_invoke_capability_tool` with invalid nested arguments.

### Part D - Browser Recovery

15. Start the IDE with `aiBackService.ready()` rejecting before ACP chat initialization.
16. Open or show the ACP chat view.
17. Trigger a deterministic create-session failure from the UI.
18. Trigger a deterministic send failure from the UI.
19. Retry with a successful create/send fixture.

## Then

- Native `Error` instances preserve object identity.
- String, nested-object, and SDK error objects become `Error` instances with readable messages.
- SDK `code` and `data` fields are preserved on the normalized error.
- Circular error objects do not crash normalization.
- Failed `createSession` releases reserved threads, unregisters permission routing, and resets browser loading state.
- `loadSessionOrNew` falls back only after the load failure is observed and binds the actual new raw session id.
- Failed `sendMessage` emits an error update, returns the thread to a non-working terminal state, and does not duplicate the user message on retry.
- Missing-session service operations fail before touching the ACP connection and include the raw requested session id in diagnostics.
- Disposing a pending load resolves the pending operation with a structured disposed/cancelled failure and does not leave `pendingSessionLoads` stuck.
- WebMCP service-unavailable responses use `{ success: false, error: "SERVICE_UNAVAILABLE" }`.
- Invalid input responses use `{ success: false, error: "INVALID_INPUT" }`.
- WebMCP `details` strings are bounded and redact token/key/secret/password patterns.
- Invalid fallback broker arguments return `INVALID_ARGUMENTS` and describe `{ tool: string, arguments?: object }`.
- Browser fallback renders a usable chat surface instead of an infinite loading state.
- Visible UI may show a concise user-facing error, but must not show uncaught stack traces, raw JSON-RPC payloads, MCP tokens, or full prompt/assistant content.
- A successful retry after either create or send failure clears stale loading/error state and produces a single active session/message stream.

## Pass / Fail Judgment

- **PASS** - ACP failures are normalized, redacted, and recoverable across node service, MCP tool, and browser UI boundaries.
- **FAIL** - failures leak secrets or content, leave thread/session loading state stuck, silently no-op missing-session operations, or prevent a later successful UI send.
