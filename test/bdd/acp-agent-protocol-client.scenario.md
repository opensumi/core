# Scenario: ACP Agent Protocol Client - Handshake, Status, Entries, Notifications

**Trigger:** `packages/ai-native/src/node/acp/acp-thread.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Deterministic ACP protocol process with controllable responses and notifications. **Workspace mutation:** None. **Automation status:** Automated contract spec; no browser click path is required.

## Given

- An `AcpThread` is created with a valid `AgentProcessConfig`.
- The spawned agent speaks ACP protocol version `1`.
- The test harness can observe thread events and status changes.

## When

### Part A - Initialize

1. Call `thread.initialize(config)`.
2. The thread spawns the configured process.
3. The thread creates an ACP `ClientSideConnection` over stdio.
4. The thread sends client capabilities for file read/write and terminal.
5. The thread receives `InitializeResponse`.
6. Repeat initialization with an agent that exits before responding.
7. Repeat initialization with an unsupported future protocol version.

### Part B - Session Binding

8. Call `newSession({ cwd, mcpServers })`.
9. Call `loadSession({ sessionId, cwd, mcpServers })` for an existing session.
10. Call `loadSessionOrNew` with a missing session id.

### Part C - Prompt And Notification Handling

11. Call `prompt({ sessionId, prompt })`.
12. Emit ACP session notifications for:
    - user message chunks
    - assistant message chunks
    - tool call updates
    - plan updates
13. Emit an update for an existing entry id.
14. Emit malformed or unknown notification payloads.
15. Emit a notification for a different session id.
16. Mark the final assistant message complete.

### Part D - Tool And Permission Hooks

17. Agent calls client `readTextFile`.
18. Agent calls client `writeTextFile`.
19. Agent calls client terminal create/output/wait/kill/release.
20. Agent calls client `requestPermission`.

### Part E - Process Exit And Reset

21. Agent process writes stderr lines while connected.
22. Agent process exits.
23. Call `reset` before reusing the thread.
24. Call `dispose`.

## Then

- Part A sets `initialized=true`, `isConnected=true`, and stores `agentCapabilities`.
- If the agent exits before initialize completes, initialization fails with a normalized command/startup error and leaves `isConnected=false`.
- If the agent reports a future unsupported protocol version, initialization fails before creating a session.
- `newSession` and `loadSession` set the raw ACP `sessionId`, set `needsReset=true`, and transition to `awaiting_prompt`.
- `mcpServers` passed to `newSession` and `loadSession` preserve names, urls, and headers without duplication.
- `loadSessionOrNew` falls back to `newSession` only after load failure.
- `prompt` transitions to `working` before the agent call and back to `awaiting_prompt` after completion.
- Session notifications for non-current sessions do not mutate entries.
- User, assistant, tool call, and plan notifications produce typed thread entries in arrival order.
- Updates for an existing entry id emit `entry_updated` instead of adding duplicate rows.
- Malformed or unknown notification payloads are logged or ignored without crashing the thread.
- Permission requests are routed through the permission routing service using the current raw session id.
- File and terminal client hooks delegate to ACP handlers and surface handler errors as agent-call errors.
- ACP stdout/stderr lines are recorded in the debug log with direction, agent id, thread id, and session id when known.
- Process exit sets `isProcessRunning=false`, `isConnected=false`, and `threadStatus=disconnected`.
- `reset` clears entries/session binding enough for safe thread reuse.
- `dispose` kills the process and releases event resources.

## Pass / Fail Judgment

- **PASS** - the thread behaves as a protocol-safe ACP client with observable status and entry state.
- **FAIL** - unsupported protocol versions are accepted, foreign session notifications mutate state, or process exit leaves the thread appearing connected.
