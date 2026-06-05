# Scenario: ACP Session Advanced Operations - Config, Fork, Resume, Close, Model

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts` or `packages/ai-native/src/node/acp/acp-thread.ts`

## Given

- An ACP session has been created and is registered in `AcpAgentService` using the raw ACP `sessionId`.
- The backing `AcpThread` is initialized and connected.
- The test agent implements the ACP session extension methods:
  - `setSessionConfigOption`
  - `unstable_forkSession`
  - `unstable_resumeSession`
  - `unstable_closeSession`
  - `unstable_setSessionModel`
- The test harness can observe calls made through the ACP SDK connection.

## When

### Part A - Session Config Options

1. Call `setSessionConfigOption({ sessionId, configId, value: true })`.
2. Call `setSessionConfigOption({ sessionId, configId, value: "custom" })`.
3. Call `setSessionConfigOption` for a missing session id.

### Part B - Fork

4. Call `forkSession({ sessionId, cwd, mcpServers })`.
5. Call `forkSession` for a missing session id.

### Part C - Resume And Close

6. Call `resumeSession({ sessionId, cwd })`.
7. Call `closeSession({ sessionId })`.
8. Call `resumeSession` and `closeSession` for missing session ids.

### Part D - Model Selection

9. Call `setSessionModel({ sessionId, model })`.
10. Call `setSessionModel` for a missing session id.

### Part E - Available Modes

11. Initialize an agent with `modes.availableModes`.
12. Call `getAvailableModes()`.

## Then

- Boolean config values are sent to ACP with `type: "boolean"` and the boolean value preserved.
- String config values are sent without incorrectly adding `type: "boolean"`.
- Missing-session config changes fail with a clear `No active session` error and do not call the ACP connection.
- `forkSession` forwards the raw source session id, optional `cwd`, and optional `mcpServers`, then returns the raw forked session id from the agent.
- Missing-session fork calls fail before touching the ACP connection.
- `resumeSession` forwards the raw session id and uses the supplied `cwd`, or the thread cwd when none is provided.
- `closeSession` forwards the raw session id and does not unregister or dispose the OpenSumi session mapping by itself.
- Missing-session resume, close, and model-selection calls fail before touching the ACP connection.
- `setSessionModel` forwards the raw session id and requested model string.
- `getAvailableModes()` returns the initialized mode metadata when the agent reports it; if no modes are reported, it returns `null` or an empty value consistently.
- All failures preserve the raw ACP session id in diagnostics and never convert it to an `acp:<id>` browser id.

## Pass / Fail Judgment

- **PASS** - all advanced session operations delegate to the ACP connection with raw session ids, correct request shape, and clear missing-session failures.
- **FAIL** - boolean config shape is wrong, browser-prefixed session ids reach node ACP calls, fork/model/close/resume calls silently no-op, or available modes cannot be observed after initialization.
