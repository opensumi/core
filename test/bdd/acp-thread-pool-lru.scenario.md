# Scenario: ACP Thread Pool LRU - Recycle, Reload, And Failure Recovery

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts` or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Deterministic ACP thread pool with controllable statuses, reservations, and pending loads. Process-backed subcases may use the mock ACP agent `--fixture=history` for reloadable sessions, `--fixture=long-stream` for `working` threads, and `--fixture=auth-required` for auth-required status/error recovery, but reservation and pending-load races still require a dedicated service harness. **Workspace mutation:** None. **Automation status:** Automated contract spec; visible loading-state checks may also run through the IDE.

## Given

- Common preflight in `test/bdd/README.md` passes if this is run through the IDE.
- ACP agent mode is enabled, with the mock ACP agent configured for process-backed session/status subcases when the scenario is run through the real ACP process path.
- The ACP thread pool limit is 3.
- ACP sessions use raw node-side ACP session ids; browser session ids may use the `acp:` prefix only in browser models.
- Process reuse and capacity reclamation are separate decisions:
  - A process is reusable only when its status is `idle` or `awaiting_prompt`, its runtime configuration (including `cwd`) is compatible, and it is not warming, reserved, or part of `pendingSessionLoads`.
  - A `disconnected` process is not reusable, but its process capacity is reclaimable without deleting the durable ACP Session.
  - An ordinary prompt or Session operation failure does not make a still-connected process reclaimable.
  - A process in `working`, `auth_required`, reserved, warming, pending-load, or undefined `errored` state is protected from automatic reclamation.
- Startup warmup is a one-shot optimization that prepares at most one ACP process and does not refill a consumed standby process.
- The pool limit is a global ACP process-capacity ceiling shared across Workspace Targets; foreground Session demand has priority over background warmup.

## When

### Part A - Create A Fourth Session

1. Create 3 ACP sessions so the pool is full.
2. Ensure all 3 bound threads are in `awaiting_prompt`.
3. Make `session-1` the least recently used session.
4. Click New Session or call `createSession`.

### Part B - Send To An Evicted Session

5. Let `session-1` be evicted by LRU and no longer present in the node active session map.
6. Keep the browser chat model for `session-1`.
7. Send a message from the `session-1` chat input.

### Part C - Concurrent Create And Load

8. Start `createSession` and pause it after a thread is created but before the real ACP session id is known.
9. Start `loadSession` for another historical session while the create thread is reserved.
10. Allow both operations to complete.

### Part D - Pool Full Without Reusable Threads

11. Fill the pool with 3 active sessions.
12. Put all bound threads into non-reusable states such as `working`, `auth_required`, reserved, or pending load.
13. Click New Session.

### Part E - Existing Idle Thread

14. Dispose or unbind a session so the pool contains an unbound idle thread.
15. Create or load another ACP session.

### Part F - Incompatible Startup Warmup

16. Configure a size-1 pool and start one warming ACP process for Workspace Target A.
17. Before A finishes initialization, start foreground Session creation for Workspace Target B with an incompatible `cwd`.
18. Verify the foreground request remains pending instead of reporting saturation.
19. Complete A initialization.
20. Allow the foreground allocation to dispose A after initialization settles and create the B-configured process.

### Part G - Disconnected Process Recovery

21. Fill a capacity slot with a bound `disconnected` process whose durable Session remains in browser history.
22. Create or load a different ACP Session while the pool is otherwise full.
23. Select the disconnected Session again after its old process mapping has been reclaimed.

## Then

- Part A reuses the least recently used reusable thread instead of creating a fourth thread.
- Part A keeps the pool size at 3.
- Part A logs `thread-pool-switch` with `reason=create-session`, `evictSessionId`, `nextSessionId`, `threadId`, `status`, and `pool=3/3`.
- Part B automatically calls `loadSession(session-1)` before sending the message.
- Part B does not show `No active session for sessionId: session-1`.
- Part B sends the user prompt after `session-1` is reloaded.
- Part C does not let `loadSession` reuse the reserved create thread.
- Part C leaves the completed created session bound to the originally reserved thread.
- Part D does not recycle `working` or `auth_required` threads.
- Part D fails fast with `error.name === ACP_THREAD_POOL_SATURATED`.
- Part D shows one actionable localized browser message explaining that the configured concurrent-task limit has been reached and suggesting switching to or stopping an active task before retrying; it does not expose internal LRU terminology.
- Part D logs `thread-pool-switch-failed` with a `candidates` array.
- Each failure candidate includes `threadId`, `sessionId`, `status`, `reserved`, `warming`, `pendingLoad`, `runtimeCompatible`, `processReusable`, `capacityReclaimable`, and explicit `exclusionReasons`.
- Candidate diagnostics do not include Agent command arguments, environment values, tokens, authentication material, or MCP headers.
- Part D resets browser session loading state to false and shows a create session failure message instead of leaving the page stuck in loading.
- Part E directly reuses the unbound idle thread.
- Part E does not emit `thread-pool-switch` because no active session is evicted.
- Part F keeps the global process count at or below 1 throughout the race.
- Part F reserves the warming slot for one foreground owner, waits for A initialization to settle before disposal, then creates the B-configured process and succeeds without `ACP_THREAD_POOL_SATURATED`.
- Part F does not continuously warm a replacement process after the foreground Session claims capacity.
- Part G disposes the disconnected process instance and releases its terminal, permission routing, listeners, references, and active node mapping.
- Part G preserves the durable Session metadata and conversation history, so the Session remains discoverable and can be lazily loaded through a new process.
- Part G keeps other Session selection available throughout recovery and does not treat an ordinary prompt failure on a connected process as a reason to reclaim it.

## Pass / Fail Judgment

- **PASS** - ACP warms at most one process, foreground demand safely replaces incompatible warmup without exceeding the global limit, ready Sessions remain LRU-reloadable, disconnected processes release capacity without deleting durable Sessions, reserved operations retain exclusive ownership, and genuine saturation leaves the UI usable with a stable actionable error and safe diagnostics.
- **FAIL** - warmup fills the pool or causes false saturation, foreground demand disposes an initializing process concurrently, a fourth resident process exceeds the configured ceiling, an active working or permission-waiting Session is evicted, a disconnected durable Session is deleted, an evicted Session cannot send after reload, load steals an in-flight create thread, diagnostics leak sensitive runtime configuration, or New Session failure leaves the browser stuck in loading.
