# Scenario: ACP Agent Session Lifecycle - Create, Load, Stream, Detach, Reattach, Cancel, Dispose

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts`, `packages/ai-native/src/node/acp/acp-cli-back.service.ts`, `packages/ai-native/src/node/index.ts`, or `packages/ai-native/src/browser/chat/acp-session-provider.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** The mock ACP agent at `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs` covers session creation/loading, `--fixture=stream-rich` streaming, `--fixture=long-stream` detach/reattach and cancellation, `--fixture=send-failure` prompt errors, `--fixture=load-failure` load fallback, and advertised HTTP MCP capability controls. The service harness can create two browser-scoped `AcpCliBackService` instances over one container-scoped `AcpAgentService`. **Workspace mutation:** None. **Automation status:** Automated contract spec; browser preflight is optional when validating the visible provider path.

## Given

- Common preflight in `test/bdd/README.md` passes if this is run through the IDE.
- The ACP agent command points to the mock ACP agent and can complete `initialize`.
- The agent advertises `sessionCapabilities.list` and `loadSession` when saved session checks are executed.
- The agent advertises `mcpCapabilities.http` when MCP bridge injection checks are executed.
- One container-scoped `AcpAgentService` can outlive multiple browser-scoped `AcpCliBackService` connections.

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

### Part D - Browser Connection Detach And Reattach

20. Start a `long-stream` prompt through the first browser back service and wait for `working` output.
21. Dispose the first browser back service while the prompt is still running.
22. Emit output and thread-status updates while no browser connection is attached.
23. Create a replacement browser back service and call `attachSession(existingSessionId)`.
24. Emit one update during the attachment snapshot race window, then emit later live output.
25. Complete the original prompt without sending a second prompt.
26. Repeat with completion or failure occurring while no browser is attached, then attach a replacement client.
27. End the replacement attachment and dispose the replacement browser back service.

### Part E - Cancel And Container-Owned Dispose

28. Start another working request, detach, reattach, and call `cancelRequest(sessionId)` from the replacement browser connection.
29. Dispose the session with `force=false`.
30. Dispose another active session with `force=true`.
31. Emit a late status update from a disposed thread.
32. Stop the application or dispose the container-owned agent service.

## Then

- Part A returns a raw ACP `sessionId` and a deduplicated `availableCommands` array.
- Part A returns an empty `availableCommands` array if no command update arrives before the timeout, without blocking session creation.
- The service never registers a synthetic `acp:<id>` session id on the node session map.
- Permission routing is registered for every live raw ACP session id.
- If the agent supports HTTP MCP and no configured server uses the built-in server name, `newSession` receives one `opensumi-ide` HTTP MCP server.
- Message prompts, images, history, and per-send config are forwarded to the ACP thread with raw session ids.
- Part B emits at least one status update and eventually returns to `awaiting_prompt` after a successful prompt.
- Part B emits a normalized error and returns the thread to a recoverable terminal state after the mock `send-failure` fixture fails.
- Streamed updates for unrelated session ids are ignored.
- Disposing a browser back service releases that connection's prompt, attachment, cancellation, and thread-status listeners without disposing the shared agent service, terminating the ACP thread, cancelling the prompt, or killing the agent process.
- `attachSession(existingSessionId)` observes the existing session; it does not create a session, load a replacement session, or send/repeat a prompt.
- The first attachment snapshot restores messages, assistant output, reasoning, tool calls and their status, session state, and authoritative thread status.
- Updates emitted during the subscribe/snapshot race are delivered once in order, and later updates continue through the replacement connection.
- If the prompt completes or fails while detached, the replacement client receives the resulting authoritative session state.
- `cancelRequest` is idempotent when the session is missing.
- Explicit cancellation from the replacement browser connection still reaches the running session after reattachment.
- `disposeSession(force=false)` releases session terminals, unregisters permission routing, removes the session mapping, and keeps the thread eligible for reuse.
- `disposeSession(force=true)` also disposes the thread and removes it from the pool.
- Late status updates from disposed or unbound threads do not recreate session mappings or browser status subscriptions.
- If the pool has 3 live non-idle threads, creating or loading another session fails with a thread-pool-full error.
- Application shutdown or container-owned `dispose` releases every thread and child process and leaves no active sessions.

## Pass / Fail Judgment

- **PASS** - session lifecycle operations preserve raw session ids, status events, permission routing, MCP bridge injection, browser detach/reattach continuity, explicit cancellation, and container-owned cleanup.
- **FAIL** - browser disconnect terminates a running prompt, attachment resends work or loses/duplicates updates, sessions leak across disposals, status changes are not observable, wrong session updates are streamed, or the MCP bridge is not injected when the agent supports HTTP MCP.
