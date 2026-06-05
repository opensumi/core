# Scenario: ACP Agent Protocol Client - Handshake, Status, Entries, Notifications

**Trigger:** `packages/ai-native/src/node/acp/acp-thread.ts`

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

### Part B - Session Binding

6. Call `newSession({ cwd, mcpServers })`.
7. Call `loadSession({ sessionId, cwd, mcpServers })` for an existing session.
8. Call `loadSessionOrNew` with a missing session id.

### Part C - Prompt And Notification Handling

9. Call `prompt({ sessionId, prompt })`.
10. Emit ACP session notifications for:
    - user message chunks
    - assistant message chunks
    - tool call updates
    - plan updates
11. Emit a notification for a different session id.
12. Mark the final assistant message complete.

### Part D - Tool And Permission Hooks

13. Agent calls client `readTextFile`.
14. Agent calls client `writeTextFile`.
15. Agent calls client terminal create/output/wait/kill/release.
16. Agent calls client `requestPermission`.

### Part E - Process Exit And Reset

17. Agent process exits.
18. Call `reset` before reusing the thread.
19. Call `dispose`.

## Then

- Part A sets `initialized=true`, `isConnected=true`, and stores `agentCapabilities`.
- If the agent reports a future unsupported protocol version, initialization fails before creating a session.
- `newSession` and `loadSession` set the raw ACP `sessionId`, set `needsReset=true`, and transition to `awaiting_prompt`.
- `loadSessionOrNew` falls back to `newSession` only after load failure.
- `prompt` transitions to `working` before the agent call and back to `awaiting_prompt` after completion.
- Session notifications for non-current sessions do not mutate entries.
- User, assistant, tool call, and plan notifications produce typed thread entries and `entry_added`/`entry_updated` events.
- Permission requests are routed through the permission routing service using the current raw session id.
- File and terminal client hooks delegate to ACP handlers and surface handler errors as agent-call errors.
- Process exit sets `isProcessRunning=false`, `isConnected=false`, and `threadStatus=disconnected`.
- `reset` clears entries/session binding enough for safe thread reuse.
- `dispose` kills the process and releases event resources.

## Pass / Fail Judgment

- **PASS** - the thread behaves as a protocol-safe ACP client with observable status and entry state.
- **FAIL** - unsupported protocol versions are accepted, foreign session notifications mutate state, or process exit leaves the thread appearing connected.
