# Scenario: ACP Thread Pool LRU - Recycle, Reload, And Failure Recovery

**Trigger:** `packages/ai-native/src/node/acp/acp-agent.service.ts` or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

## Given

- Common preflight in `test/bdd/README.md` passes if this is run through the IDE.
- ACP agent mode is enabled.
- The ACP thread pool limit is 3.
- ACP sessions use raw node-side ACP session ids; browser session ids may use the `acp:` prefix only in browser models.
- A reusable thread is one whose status is `idle` or `awaiting_prompt`, is not reserved by an in-flight `createSession`, and is not part of `pendingSessionLoads`.
- A non-reusable thread is any thread in `working`, `auth_required`, reserved, or pending-load state.

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
- Part D fails with `Thread pool is full (3), no reusable LRU thread available`.
- Part D logs `thread-pool-switch-failed` with a `candidates` array.
- Each failure candidate includes `threadId`, `sessionId`, `status`, `reserved`, `pendingLoad`, and `reusable`.
- Part D resets browser session loading state to false and shows a create session failure message instead of leaving the page stuck in loading.
- Part E directly reuses the unbound idle thread.
- Part E does not emit `thread-pool-switch` because no active session is evicted.

## Pass / Fail Judgment

- **PASS** - ACP can open or switch more than 3 sessions by LRU-recycling only safe threads, evicted sessions can be lazily reloaded before prompts, create and load races do not steal reserved threads, and failure leaves the UI usable with diagnostic logs.
- **FAIL** - a fourth session creates a fourth thread, an active working or permission-waiting session is evicted, an evicted session cannot send a message after reload, load steals an in-flight create thread, or New Session failure leaves the browser stuck in loading.
