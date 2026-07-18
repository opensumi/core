# Scenario: ACP RPC Bridge and Thread Status - Browser/Node Synchronization

**Trigger:** `packages/core-common/src/types/ai-native/index.ts`, `packages/ai-native/src/browser/acp/acp-webmcp-rpc.service.ts`, `packages/ai-native/src/node/acp/acp-webmcp-caller.service.ts`, `packages/ai-native/src/browser/acp/acp-thread-status-rpc.service.ts`, `packages/ai-native/src/node/acp/acp-thread-status-caller.service.ts`, or `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Browser WebMCP registry, node RPC caller services, controllable RPC client spies, an existing ACP session snapshot, and two browser back-service connections. **Workspace mutation:** None. **Automation status:** Automated contract spec for browser/node RPC synchronization and existing-session attachment.

## Given

- Common preflight in `test/bdd/README.md` passes when this scenario is run through the IDE.
- The browser injector has registered the WebMCP group registry and ACP Chat group.
- The Node side has an `AcpWebMcpCallerService` and `AcpThreadStatusCallerService`.
- The browser chat manager has at least one ACP chat model whose browser id is `acp:<rawSessionId>`.
- The test harness can replace or spy on the RPC client used by the node caller services.
- The node service owns an existing ACP session that may remain active while the browser RPC connection is replaced.

## When

### Part A - WebMCP Group Definition RPC

1. Set the node caller's RPC client to the browser `AcpWebMcpRpcService`.
2. Call `AcpWebMcpCallerService.getGroupDefinitions({ includeAllTools: true })`.
3. Call `AcpWebMcpCallerService.getGroupDefinitions({ includeAllTools: false })`.
4. Inspect the returned ACP Chat group definition and its tool names.

### Part B - WebMCP Tool Execution RPC

5. Execute `acp_chat_get_session_state` through `AcpWebMcpCallerService.executeTool("acp_chat", "acp_chat_get_session_state", {})`.
6. Execute a missing tool name through the same RPC path.
7. Execute a valid tool while the browser-side service dependency is unavailable.

### Part C - Missing RPC Client

8. Clear both the instance RPC client and static RPC client.
9. Call `getGroupDefinitions` and `executeTool`.

### Part D - Thread Status Push

10. Restore the status RPC client.
11. Call `AcpThreadStatusCallerService.notifyThreadStatusChange(rawSessionId, "working")`.
12. Call `notifyThreadStatusChange("acp:" + rawSessionId, "awaiting_prompt")`.
13. Call `notifyThreadStatusChange` for an unknown raw session id.
14. Clear the status RPC client and call `notifyThreadStatusChange(rawSessionId, "disconnected")`.

### Part E - Existing Session Attachment RPC

15. Dispose the first browser back-service RPC connection while its ACP prompt is `working`.
16. Create a replacement connection and call the existing AI back-service RPC method `attachSession(rawSessionId)`.
17. Observe the attachment snapshot and emit an update during snapshot construction plus another update afterward.
18. End the attachment stream and dispose the replacement connection.

## Then

- Part A returns group definitions from the browser registry without constructing a separate node-side catalog.
- Returned tool names use the lower-snake canonical `tool.name` values from the registry.
- `includeAllTools: true` includes profile-gated ACP Chat tools such as `acp_chat_set_session_mode`; `includeAllTools: false` returns only currently exposed tools.
- Part B returns the same success/failure class and payload shape as a direct browser registry execution.
- Missing tool execution fails with a structured not-found or invalid-tool result; it must not throw an unstructured RPC exception to the MCP transport.
- Service-unavailable executions return `{ success: false, error: "SERVICE_UNAVAILABLE" }` with a bounded `details` string.
- Part C fails fast with an error that identifies the missing browser RPC connection; it must not hang or retry indefinitely.
- Part D updates the browser chat model when the session id is passed either raw or prefixed with `acp:`.
- Unknown-session status notifications are ignored without creating a new chat model.
- Missing status RPC clients are ignored silently so node-side ACP streaming does not fail just because the browser is not ready.
- A later valid status notification still updates the existing model after the RPC client is restored.
- Session recovery uses the existing AI back-service RPC surface; it does not introduce a separate HTTP recovery endpoint.
- `attachSession` accepts the existing raw ACP session id and returns a snapshot-first stream without invoking prompt submission.
- Connection disposal releases only connection-owned subscriptions; the shared agent service and running thread remain node-owned.
- The attachment stream preserves the snapshot/live-update boundary without losing or duplicating the race-window update.

## Pass / Fail Judgment

- **PASS** - WebMCP definitions/execution, thread-status updates, and existing-session attachment cross the browser/node RPC boundary with canonical names, structured failures, raw/prefixed session id normalization, and no hangs when RPC is missing.
- **FAIL** - node builds a divergent catalog, tool names drift from the browser registry, missing RPC causes a stuck MCP call, attachment repeats a prompt or loses updates, status updates miss valid ACP sessions, or unknown status updates create phantom sessions.
