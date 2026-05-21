# AcpThread Full Delegation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all AcpThread methods through AcpAgentService and AcpCliBackService, completing the 30% gap in the current delegation chain.

**Architecture:** Direct 1:1 delegation — each new `IAcpAgentService` method finds the thread by sessionId and delegates to the corresponding `AcpThread` method. `AcpCliBackService` adds thin proxy methods that forward to `AcpAgentService`.

**Tech Stack:** TypeScript, OpenSumi DI framework, ACP SDK

---

## Files to modify

- `packages/ai-native/src/node/acp/acp-agent.service.ts` — Add 7 interface methods + 6 implementations + fix 1 existing implementation
- `packages/ai-native/src/node/acp/acp-cli-back.service.ts` — Add 7 proxy methods

---

### Task 1: Fix `setSessionMode` — from log-only to actual delegation

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts:588-597`

- [ ] **Step 1: Replace the log-only `setSessionMode` with actual delegation**

The current implementation at line 588-597 only logs and does nothing. Replace it with:

```typescript
async setSessionMode(params: { sessionId: string; modeId: string }): Promise<void> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }

  await thread.setSessionMode({
    sessionId: params.sessionId,
    modeId: params.modeId,
  } as any);
}
```

- [ ] **Step 2: Verify compilation of the changed file**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20
```

Expected: No new errors related to `acp-agent.service.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "fix(ai-native): delegate setSessionMode to AcpThread instead of log-only"
```

---

### Task 2: Add `loadSessionOrNew` to interface and implementation

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts` (interface + implementation)

- [ ] **Step 1: Add method signature to `IAcpAgentService` interface**

Insert after line 128 (`disposeSession`) in the interface:

```typescript
/**
 * Load existing session, fallback to new session if load fails.
 */
loadSessionOrNew(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult>;
```

- [ ] **Step 2: Add implementation to `AcpAgentService` class**

Insert after the `buildSessionLoadResult` method (around line 479):

```typescript
// -----------------------------------------------------------------------
// loadSessionOrNew — with fallback
// -----------------------------------------------------------------------

async loadSessionOrNew(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
  this.logger.log(`[AcpAgentService] loadSessionOrNew() — sessionId=${sessionId}`);

  const existingThread = this.sessions.get(sessionId);
  if (existingThread && existingThread.getStatus() !== 'disconnected') {
    return this.buildSessionLoadResult(sessionId, existingThread);
  }

  const thread = await this.findOrCreateThread(sessionId, config);
  try {
    if (!thread.initialized) {
      await thread.initialize(config as any);
    }
    if (thread.needsReset) {
      thread.reset();
    }
    await thread.loadSessionOrNew({
      sessionId,
      cwd: config.cwd,
      mcpServers: [],
    } as any);
    return this.buildSessionLoadResult(sessionId, thread);
  } catch (e) {
    this.sessions.delete(sessionId);
    throw e;
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "feat(ai-native): add loadSessionOrNew with fallback to new session"
```

---

### Task 3: Add `setSessionConfigOption` to interface and implementation

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`

- [ ] **Step 1: Add method signature to `IAcpAgentService` interface**

```typescript
/**
 * Set session configuration options (e.g. permission levels).
 */
setSessionConfigOption(params: { sessionId: string; options: Record<string, unknown> }): Promise<void>;
```

- [ ] **Step 2: Add implementation**

Insert after `loadSessionOrNew`:

```typescript
// -----------------------------------------------------------------------
// setSessionConfigOption
// -----------------------------------------------------------------------

async setSessionConfigOption(params: { sessionId: string; options: Record<string, unknown> }): Promise<void> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }
  await thread.setSessionConfigOption({
    sessionId: params.sessionId,
    options: params.options,
  } as any);
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "feat(ai-native): add setSessionConfigOption delegation to AcpThread"
```

---

### Task 4: Add unstable session methods (fork, resume, close, setModel)

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`

- [ ] **Step 1: Add 4 method signatures to `IAcpAgentService` interface**

```typescript
/** Fork a session (create a copy based on existing session state) */
forkSession(params: { sessionId: string; cwd?: string; mcpServers?: string[] }): Promise<{ sessionId: string }>;

/** Resume a closed session */
resumeSession(params: { sessionId: string }): Promise<void>;

/** Close a session without disposing the thread */
closeSession(params: { sessionId: string }): Promise<void>;

/** Switch the AI model for the session */
setSessionModel(params: { sessionId: string; model: string }): Promise<void>;
```

- [ ] **Step 2: Add 4 implementations**

```typescript
// -----------------------------------------------------------------------
// forkSession
// -----------------------------------------------------------------------

async forkSession(params: { sessionId: string; cwd?: string; mcpServers?: string[] }): Promise<{ sessionId: string }> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }
  const response = await thread.unstable_forkSession({
    sessionId: params.sessionId,
    cwd: params.cwd,
    mcpServers: params.mcpServers,
  } as any);
  return { sessionId: response.sessionId };
}

// -----------------------------------------------------------------------
// resumeSession
// -----------------------------------------------------------------------

async resumeSession(params: { sessionId: string }): Promise<void> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }
  await thread.unstable_resumeSession({ sessionId: params.sessionId } as any);
}

// -----------------------------------------------------------------------
// closeSession
// -----------------------------------------------------------------------

async closeSession(params: { sessionId: string }): Promise<void> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }
  await thread.unstable_closeSession({ sessionId: params.sessionId } as any);
}

// -----------------------------------------------------------------------
// setSessionModel
// -----------------------------------------------------------------------

async setSessionModel(params: { sessionId: string; model: string }): Promise<void> {
  const thread = this.sessions.get(params.sessionId);
  if (!thread) {
    throw new Error(`No active session for sessionId: ${params.sessionId}`);
  }
  await thread.unstable_setSessionModel({ sessionId: params.sessionId, model: params.model } as any);
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "feat(ai-native): add fork/resume/close/setSessionModel delegation to AcpThread"
```

---

### Task 5: Add proxy methods to `AcpCliBackService`

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

- [ ] **Step 1: Add 7 proxy methods**

Also import `SetSessionConfigOptionRequest` type if needed from acp-agent.service. Insert before the `ready()` method (around line 396):

```typescript
async setSessionMode(sessionId: string, modeId: string): Promise<void> {
  await this.agentService.setSessionMode({ sessionId, modeId });
}

async loadSessionOrNew(
  config: AgentProcessConfig,
  sessionId: string,
): Promise<{ sessionId: string; messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }> }> {
  const result = await this.agentService.loadSessionOrNew(sessionId, config);
  const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);
  return { sessionId, messages };
}

async setSessionConfigOption(sessionId: string, options: Record<string, unknown>): Promise<void> {
  await this.agentService.setSessionConfigOption({ sessionId, options });
}

async forkSession(
  sessionId: string,
  options?: { cwd?: string; mcpServers?: string[] },
): Promise<{ sessionId: string }> {
  return this.agentService.forkSession({ sessionId, ...options });
}

async resumeSession(sessionId: string): Promise<void> {
  await this.agentService.resumeSession({ sessionId });
}

async closeSession(sessionId: string): Promise<void> {
  await this.agentService.closeSession({ sessionId });
}

async setSessionModel(sessionId: string, model: string): Promise<void> {
  await this.agentService.setSessionModel({ sessionId, model });
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-cli-back.service.ts
git commit -m "feat(ai-native): add proxy methods for new AcpAgentService session operations"
```

---

### Task 6: Run full test suite and verify

**Files:**

- Test: `packages/ai-native/__tests__/node/acp/*.test.ts`
- Test: `packages/ai-native/__test__/node/acp/*.test.ts`

- [ ] **Step 1: Run existing ACP tests**

```bash
npx jest packages/ai-native/__test__/node/acp/ --passWithNoTests 2>&1 | tail -30
npx jest packages/ai-native/__tests__/node/acp/ --passWithNoTests 2>&1 | tail -30
```

Expected: All existing tests pass. No new test files are required since this is pure delegation (the `AcpThread` tests already cover the underlying behavior).

- [ ] **Step 2: Final compilation check**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1
```

Expected: No errors.

- [ ] **Step 3: Final commit**

```bash
git status
```

Ensure all changes are committed. The branch should have:

1. `fix(ai-native): delegate setSessionMode to AcpThread instead of log-only`
2. `feat(ai-native): add loadSessionOrNew with fallback to new session`
3. `feat(ai-native): add setSessionConfigOption delegation to AcpThread`
4. `feat(ai-native): add fork/resume/close/setSessionModel delegation to AcpThread`
5. `feat(ai-native): add proxy methods for new AcpAgentService session operations`

---

## Self-review against spec

1. **Spec coverage:**

   - ✅ `setSessionMode` fix — Task 1
   - ✅ `loadSessionOrNew` — Task 2
   - ✅ `setSessionConfigOption` — Task 3
   - ✅ `forkSession` — Task 4
   - ✅ `resumeSession` — Task 4
   - ✅ `closeSession` — Task 4
   - ✅ `setSessionModel` — Task 4
   - ✅ `AcpCliBackService` proxies — Task 5

2. **Placeholder scan:** No TBD, TODO, or empty sections.

3. **Type consistency:** All methods use `sessionId: string` consistently. `AgentProcessConfig` imported from same path. Return types match `IAcpAgentService` interface.

4. **YAGNI:** Only methods that exist on `AcpThread` are exposed. No hypothetical features.
