# ACP Pool Warmup Capacity Repair Implementation Plan

> **For implementers:** Execute this plan task-by-task. Preserve unrelated working-tree changes, especially the existing `ACPSessionProvider.cancelSession` edits.

**Goal:** Prevent background ACP pool warmup from causing false thread-pool exhaustion while preserving the global process limit, durable Session switching, and fail-fast behavior for genuine concurrency saturation.

**Architecture:** Treat the ACP pool size as a global capacity ceiling, not a startup target. Warm one compatible standby process once at startup. Separate process reuse from capacity reclamation, allow foreground create/load operations to wait for and replace an incompatible warming process, and reclaim disconnected process instances without treating ordinary Session failures as process failures.

**Decision record:** `docs/adr/0021-prioritize-session-demand-over-acp-pool-warmup.md`

**Tech stack:** TypeScript, OpenSumi DI/RPC, Jest node/jsdom projects, BDD Markdown.

## Global Constraints

- Keep `maxPoolSize` as a global ACP process limit shared across Workspace Targets.
- Keep `cwd` in the Agent process compatibility key.
- Warm at most one process at startup and do not continuously replenish a standby process.
- Foreground create/load may wait for an incompatible warming process to settle, but must not fail solely because of warmup.
- Do not concurrently dispose an `AcpThread` whose `initialize()` is still running; the current startup lifecycle is not safely cancellable.
- Reclaim `disconnected` process instances, but do not reclaim a process because an ordinary prompt or Session operation failed.
- Exclude the currently undefined production meaning of `errored` from automatic reclamation.
- Preserve active `working`, permission/input-waiting, reserved, and pending-load Sessions.
- Preserve current LRU lazy reload behavior for `awaiting_prompt` Sessions.
- Do not add a capacity wait queue. Genuine saturation remains fail-fast.
- Preserve the browser/node/common boundary and use a common runtime-neutral constant for the stable error identity.

---

### Task 1: Lock the new pool contract with failing node tests

**Files:**

- Modify: `packages/ai-native/__test__/node/acp-agent.service.test.ts`

- [ ] **Step 1: Change the startup warmup expectation from pool-size threads to one thread**

Update the existing `warmUpAgentPool()` test so a pool size of 3 creates and initializes exactly one thread and creates no ACP Session.

- [ ] **Step 2: Add a one-shot warmup regression test**

After the warmed thread is claimed by `createSession`, invoke `warmUpAgentPool` again with the same runtime configuration. Assert that no replacement standby thread is created while the claimed matching process remains in the pool.

- [ ] **Step 3: Add the different-cwd warmup race test**

Use `threadPoolSize: 1` and a deferred `initialize()`:

1. Start warmup for `/workspace-a`.
2. Start `createSession` for `/workspace-b`.
3. Assert the foreground create remains pending rather than rejecting.
4. Resolve warmup initialization.
5. Assert the warmed A thread is disposed and removed.
6. Assert a B-configured thread is created and the Session succeeds.

- [ ] **Step 4: Add concurrent ownership coverage**

While the first foreground request is waiting on the incompatible warming thread, start a second foreground request with `threadPoolSize: 1`. Assert only the first request owns the warming slot; the second request observes genuine foreground capacity ownership and receives the stable saturation error.

- [ ] **Step 5: Add disconnected reclamation coverage**

Fill the pool with a bound `disconnected` thread, then create or load another Session. Assert the dead process instance is removed and disposed, the old Session mapping is released without deleting durable Session data, and the new operation succeeds.

- [ ] **Step 6: Strengthen genuine saturation coverage**

Keep all pool threads `working`. Assert create/load rejects with `error.name === ACP_THREAD_POOL_SATURATED_ERROR_NAME`, does not dispose or unbind active Sessions, and logs candidate exclusion reasons.

- [ ] **Step 7: Run the focused node test and verify RED**

Run:

```sh
yarn jest packages/ai-native/__test__/node/acp-agent.service.test.ts --runInBand
```

Expected: new tests fail against the current fill-the-pool warmup and warming-thread exclusion behavior.

---

### Task 2: Separate reuse, reclamation, warmup ownership, and saturation

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Interfaces:**

- Preserve: `IAcpAgentService.warmUpAgentPool(config): Promise<void>`.
- Preserve: the global `threadPool`, `sessions`, `reservedThreads`, `warmingThreads`, and `pendingSessionLoads` ownership model.
- Add internal eligibility helpers; do not expose pool internals through public APIs.

- [ ] **Step 1: Make startup warmup target one matching process**

In `doWarmUpAgentPool`, calculate a target of at most one matching non-disconnected process. Treat active, idle, or currently warming compatible processes as satisfying the one-time target so repeated calls do not replenish a standby process.

- [ ] **Step 2: Split the current reusable predicate**

Replace the overloaded `isThreadReusableForLRU` concept with explicit internal predicates:

```ts
isThreadProcessReusable(thread): boolean;
isThreadCapacityReclaimable(thread, sessionId?): boolean;
```

`idle` and `awaiting_prompt` are process-reusable. `disconnected` is not reusable but is capacity-reclaimable. `working`, reserved, warming, pending-load, and undefined `errored` states are not reclaimable.

- [ ] **Step 3: Preserve candidate priority during allocation**

Use the following order for `createSession`, `loadSession`, and `loadSessionOrNew` acquisition:

1. Reuse an unbound compatible idle/awaiting process.
2. Claim and await a compatible warming process.
3. Create a process when below the global capacity limit.
4. When full, reclaim an unbound disconnected or incompatible idle process without evicting a Session.
5. Reclaim a bound disconnected process instance; keep the durable Session reloadable.
6. LRU-switch a compatible `awaiting_prompt` Session.
7. LRU-dispose an incompatible `awaiting_prompt` Session and create the requested process.
8. Claim an incompatible warming process, await its warmup promise, dispose it after settlement, and create the requested process.
9. Throw genuine saturation only when all remaining slots have foreground owners or active work.

Keep the changes local to the existing helpers instead of introducing a second pool manager.

- [ ] **Step 4: Add safe incompatible-warmup reclamation**

Before awaiting a warming process, add it to `reservedThreads` so concurrent foreground requests cannot claim it. After the warmup promise settles:

- If initialization failed and the warmup cleanup already removed the thread, release the reservation and create when capacity is available.
- If initialization succeeded, dispose and remove the thread before creating the requested configuration.
- Release reservations on every success and failure path.

Do not call `dispose()` while `initialize()` is still unresolved.

- [ ] **Step 5: Reclaim disconnected mappings safely**

When reclaiming a bound disconnected thread, release terminals, permission routing, status listeners, reference counts, and the active node mapping using the same cleanup sequence as LRU eviction. Do not delete browser Task metadata or remote ACP Session history; later selection/send must continue through `loadSession` on a new process.

- [ ] **Step 6: Make diagnostics explain every exclusion**

Replace the misleading status-only `reusable` field with diagnostic fields sufficient to explain allocation:

```ts
{
  threadId,
  sessionId,
  status,
  reserved,
  warming,
  pendingLoad,
  runtimeCompatible,
  processReusable,
  capacityReclaimable,
  exclusionReasons,
}
```

Keep Agent command arguments, environment values, tokens, and MCP headers out of logs.

- [ ] **Step 7: Run the focused node test and verify GREEN**

Run:

```sh
yarn jest packages/ai-native/__test__/node/acp-agent.service.test.ts --runInBand
```

Expected: all warmup, LRU, reservation, pending-load, disconnected, and saturation tests pass.

---

### Task 3: Add a stable saturation error contract and actionable browser message

**Files:**

- Modify: `packages/core-common/src/types/ai-native/agent-types.ts`
- Modify: `packages/core-common/src/types/ai-native/index.ts` only if required by the existing barrel export shape
- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`
- Modify: `packages/ai-native/src/browser/chat/acp-session-provider.ts`
- Test: `packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts`
- Test: `packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts`

**Working-tree warning:** `acp-session-provider.ts` already contains unrelated user edits adding `cancelSession`; preserve them exactly.

- [ ] **Step 1: Define the runtime-neutral error identity**

Export:

```ts
export const ACP_THREAD_POOL_SATURATED_ERROR_NAME = 'ACP_THREAD_POOL_SATURATED';
```

Do not add a custom Error subclass whose prototype would be lost over RPC.

- [ ] **Step 2: Throw the named error only for genuine saturation**

Create a small node-side helper that assigns the stable name and includes the configured limit in a non-sensitive message. Warmup conflict paths must resolve through reclamation and never throw this error.

- [ ] **Step 3: Map the named error at the browser provider boundary**

In `ACPSessionProvider.createSession`, recognize the revived `error.name`, create an actionable localized message with `localize`, and rethrow the mapped Error. Use the serialized node message only to recover the numeric limit on a best-effort basis; the localized fallback must remain useful without it.

Recommended user meaning:

> ACP concurrent tasks have reached the configured limit. Switch to or stop an active task, then try again.

- [ ] **Step 4: Avoid duplicate notifications**

Remove the direct `messageService.error(e.message)` side effect from the provider's `createSession` catch. Let the existing presentation caller display the mapped error once. Leave `loadSessions` behavior unchanged.

- [ ] **Step 5: Add browser tests**

Cover:

- A named saturation error becomes the actionable localized message.
- An unrelated Agent startup or Session error retains its original message.
- Session creation rejection leaves loading false and preserves the previously active Session/draft state.
- Only one user notification is emitted for the failed create path.

- [ ] **Step 6: Run focused browser tests**

Run:

```sh
yarn jest packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand --selectProjects jsdom
```

Expected: PASS with one actionable notification and no stuck loading state.

---

### Task 4: Update the executable behavior specification

**Files:**

- Modify: `test/bdd/acp-thread-pool-lru.scenario.md`

- [ ] **Step 1: Replace the overloaded reusable terminology**

Define process reuse and capacity reclamation separately. State that `disconnected` is reclaimable but not reusable, and ordinary prompt failure does not imply process failure.

- [ ] **Step 2: Add a startup warmup section**

Add a scenario part that:

1. Starts one warming process for Workspace Target A.
2. Starts foreground Session creation for Workspace Target B with a full size-1 pool.
3. Verifies the foreground request waits.
4. Completes A initialization.
5. Verifies A is disposed, B is created, and no saturation error is shown.

- [ ] **Step 3: Update genuine saturation expectations**

Replace the raw `Thread pool is full ... no reusable LRU` expectation with the stable error identity and actionable browser meaning. Require diagnostic candidates to include `warming`, compatibility, reclaimability, and exclusion reasons.

- [ ] **Step 4: Add disconnected recovery expectations**

Verify a disconnected process releases capacity, its durable Session remains discoverable/reloadable, and selecting a different Session remains available throughout recovery.

---

### Task 5: Final verification and handoff

- [ ] **Step 1: Run focused Jest suites**

```sh
yarn jest packages/ai-native/__test__/node/acp-agent.service.test.ts --runInBand
yarn jest packages/ai-native/__test__/browser/acp-pool-warmup.contribution.test.ts packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand --selectProjects jsdom
```

- [ ] **Step 2: Run affected TypeScript references**

```sh
yarn tsc --build configs/ts/references/tsconfig.core-common.json configs/ts/references/tsconfig.ai-native.json --pretty false
```

- [ ] **Step 3: Run the relevant BDD contract path**

Read `test/bdd/README.md`, then execute only the ACP thread-pool LRU scenario through its documented node-contract runner/profile.

- [ ] **Step 4: Check repository hygiene**

```sh
git diff --check
git status --short
```

Confirm no temporary diagnostic files remain and no unrelated user changes were modified.

## Completion Criteria

- Startup creates at most one warm ACP process.
- A foreground request for another cwd cannot fail solely because that process is warming.
- The global process count never exceeds `maxPoolSize`.
- Same-config foreground demand still claims the warmed process without duplicate initialization.
- Disconnected process instances release capacity without deleting durable Sessions.
- Ordinary prompt/Session errors do not trigger process reclamation.
- Truly active saturation preserves every active Session and fails with the stable error identity.
- The browser shows one actionable message and clears loading state.
- Existing LRU Session switching and lazy reload behavior remain intact.
