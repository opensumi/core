# Scenario: ACP Agent Session Lifecycle - Create, Load, Stream, Cancel, Dispose

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts` or `packages/ai-native/src/browser/chat/session-provider-acp.ts`

## Given

- Common preflight in `test/bdd/README.md` passes if this is run through the IDE.
- The ACP agent command is configured and can complete `initialize`.
- The agent advertises `sessionCapabilities.list` and `loadSession` when saved session checks are executed.
- The agent advertises `mcpCapabilities.http` when MCP bridge injection checks are executed.

## When

### Part A - Create Session

1. Browser or provider calls `createSession`.
2. Node calls `AcpAgentService.createSession(config)`.
3. The selected `AcpThread` initializes if needed.
4. The thread calls `newSession({ cwd, mcpServers })`.
5. The service records `sessionId -> thread`, registers permission routing, and subscribes to thread status changes.
6. The service waits up to 5 seconds for `available_commands_update`.

### Part B - Send Message Stream

7. Browser sends a prompt through the ACP session.
8. `AcpAgentService.sendMessage({ sessionId, prompt, images, history }, config)` is called.
9. The stream emits the current `thread_status` before prompt updates.
10. The thread transitions `awaiting_prompt -> working -> awaiting_prompt`.
11. User and assistant updates are converted into chat stream updates.
12. The stream emits `done` and closes.

### Part C - Load Or Resume Session

13. Load an existing `sessionId`.
14. If already active, return the bound thread result without creating a new process.
15. If an idle thread exists, reuse it and call `loadSession`.
16. If load fails in `loadSessionOrNew`, call `newSession` and bind the returned actual session id.

### Part D - Cancel And Dispose

17. While a request is working, call `cancelRequest(sessionId)`.
18. Dispose the session with `force=false`.
19. Dispose another active session with `force=true`.
20. Stop or dispose the agent service.

## Then

- Part A returns a raw ACP `sessionId` and a deduplicated `availableCommands` array.
- The service never registers a synthetic `acp:<id>` session id on the node session map.
- Permission routing is registered for every live raw ACP session id.
- If the agent supports HTTP MCP and no configured server uses the built-in server name, `newSession` receives one `opensumi-ide` HTTP MCP server.
- Part B emits at least one status update and eventually returns to `awaiting_prompt` after a successful prompt.
- Streamed updates for unrelated session ids are ignored.
- `cancelRequest` is idempotent when the session is missing.
- `disposeSession(force=false)` releases session terminals, unregisters permission routing, removes the session mapping, and keeps the thread eligible for reuse.
- `disposeSession(force=true)` also disposes the thread and removes it from the pool.
- If the pool has 3 live non-idle threads, creating or loading another session fails with a thread-pool-full error.
- `stopAgent` or `dispose` releases every thread and leaves no active sessions.

## Pass / Fail Judgment

- **PASS** - session lifecycle operations preserve raw session ids, status events, permission routing, MCP bridge injection, and pool cleanup.
- **FAIL** - sessions leak across disposals, status changes are not observable, wrong session updates are streamed, or the MCP bridge is not injected when the agent supports HTTP MCP.
