# Scenario: ACP Agent Session Lifecycle - Create, Load, Stream, Cancel, Dispose

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts` or `packages/ai-native/src/browser/chat/session-provider-acp.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Deterministic ACP agent with session, load, stream, cancellation, and HTTP MCP capability controls. **Workspace mutation:** None. **Automation status:** Automated contract spec; browser preflight is optional when validating the visible provider path.

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
7. Repeat create with duplicate command names in `available_commands_update`.
8. Repeat create with no `available_commands_update` before the timeout.

### Part B - Send Message Stream

9. Browser sends a prompt through the ACP session.
10. `AcpAgentService.sendMessage({ sessionId, prompt, images, history }, config)` is called.
11. The stream emits the current `thread_status` before prompt updates.
12. The thread transitions `awaiting_prompt -> working -> awaiting_prompt`.
13. User and assistant updates are converted into chat stream updates.
14. Repeat send with a deterministic agent error after the user update.
15. The stream emits `done` or `error` and closes.

### Part C - Load Or Resume Session

16. Load an existing `sessionId`.
17. If already active, return the bound thread result without creating a new process.
18. If an idle thread exists, reuse it and call `loadSession`.
19. If load fails in `loadSessionOrNew`, call `newSession` and bind the returned actual session id.

### Part D - Cancel And Dispose

20. While a request is working, call `cancelRequest(sessionId)`.
21. Dispose the session with `force=false`.
22. Dispose another active session with `force=true`.
23. Emit a late status update from a disposed thread.
24. Stop or dispose the agent service.

## Then

- Part A returns a raw ACP `sessionId` and a deduplicated `availableCommands` array.
- Part A returns an empty `availableCommands` array if no command update arrives before the timeout, without blocking session creation.
- The service never registers a synthetic `acp:<id>` session id on the node session map.
- Permission routing is registered for every live raw ACP session id.
- If the agent supports HTTP MCP and no configured server uses the built-in server name, `newSession` receives one `opensumi-ide` HTTP MCP server.
- Message prompts, images, history, and per-send config are forwarded to the ACP thread with raw session ids.
- Part B emits at least one status update and eventually returns to `awaiting_prompt` after a successful prompt.
- Part B emits a normalized error and returns the thread to a recoverable terminal state after an agent failure.
- Streamed updates for unrelated session ids are ignored.
- `cancelRequest` is idempotent when the session is missing.
- `disposeSession(force=false)` releases session terminals, unregisters permission routing, removes the session mapping, and keeps the thread eligible for reuse.
- `disposeSession(force=true)` also disposes the thread and removes it from the pool.
- Late status updates from disposed or unbound threads do not recreate session mappings or browser status subscriptions.
- If the pool has 3 live non-idle threads, creating or loading another session fails with a thread-pool-full error.
- `stopAgent` or `dispose` releases every thread and leaves no active sessions.

## Pass / Fail Judgment

- **PASS** - session lifecycle operations preserve raw session ids, status events, permission routing, MCP bridge injection, and pool cleanup.
- **FAIL** - sessions leak across disposals, status changes are not observable, wrong session updates are streamed, or the MCP bridge is not injected when the agent supports HTTP MCP.
