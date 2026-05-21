# Design: Full AcpThread Delegation in AcpAgentService

**Date:** 2026-05-21 **Status:** Draft **Author:** Claude Code

## Context

`AcpAgentService` 是 ACP 模块的线程池管理器，负责管理多个 `AcpThread` 实例。当前 `AcpAgentService` 只接入了 `AcpThread` 约 70% 的能力，部分方法（`setSessionMode`、`setSessionConfigOption`、`loadSessionOrNew`）和所有 `unstable_*` 方法未被暴露。

## Problem

`AcpThread` 提供了 20+ 个 public 方法，但 `AcpAgentService` 只暴露了其中一部分。这导致：

1. `setSessionMode` 已定义在 `IAcpAgentService` 接口中，但实现只打日志，没有真正转发到 `AcpThread`
2. `AcpCliBackService` 需要这些能力来支持 Browser 层的完整功能
3. 无法通过 service 层使用 session fork/resume/close/model switch 等功能

## Design

### Approach: Direct 1:1 delegation

每个 `AcpThread` 方法对应一个 `IAcpAgentService` 方法，通过 sessionId 找到 thread 后直接透传。unstable 方法去掉 `unstable_` 前缀，直接暴露为普通方法。

### Decision: Why not namespace or callback approach?

- **Namespace (`.unstable`)**：增加实现复杂度，调用方需要额外实例化
- **Callback (`executeOnThread`)**：破坏封装，调用方需要了解 `AcpThread` 内部结构
- **1:1 delegation**：最直观，类型签名清晰，与现有模式一致

## Architecture

### New interface methods on `IAcpAgentService`

```
┌─────────────────────────────────────────┐
│         IAcpAgentService                │
├─────────────────────────────────────────┤
│ (existing 14 methods)                   │
│                                         │
│ loadSessionOrNew()          ← NEW       │
│ setSessionConfigOption()    ← NEW       │
│ forkSession()               ← NEW       │
│ resumeSession()             ← NEW       │
│ closeSession()              ← NEW       │
│ setSessionModel()           ← NEW       │
│ setSessionMode()            ← FIXED     │
└──────────────┬──────────────────────────┘
               │ delegates via sessionId lookup
               ▼
┌─────────────────────────────────────────┐
│            AcpThread                    │
├─────────────────────────────────────────┤
│ loadSessionOrNew()                      │
│ setSessionConfigOption()                │
│ unstable_forkSession()                  │
│ unstable_resumeSession()                │
│ unstable_closeSession()                 │
│ unstable_setSessionModel()              │
│ setSessionMode()                        │
└─────────────────────────────────────────┘
```

### Implementation pattern

All new methods follow the same pattern:

```
sessions.get(sessionId) → throw if not found → thread.method(params)
```

Exception: `loadSessionOrNew` needs thread creation path when session doesn't exist yet.

## File changes

### 1. `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Interface changes** — Add 7 new methods to `IAcpAgentService`:

| Method | Parameters | Return | Source on AcpThread |
| --- | --- | --- | --- |
| `loadSessionOrNew` | `(sessionId, config)` | `Promise<SessionLoadResult>` | `thread.loadSessionOrNew()` |
| `setSessionConfigOption` | `{ sessionId, options }` | `Promise<void>` | `thread.setSessionConfigOption()` |
| `forkSession` | `{ sessionId, cwd?, mcpServers? }` | `Promise<{ sessionId }>` | `thread.unstable_forkSession()` |
| `resumeSession` | `{ sessionId }` | `Promise<void>` | `thread.unstable_resumeSession()` |
| `closeSession` | `{ sessionId }` | `Promise<void>` | `thread.unstable_closeSession()` |
| `setSessionModel` | `{ sessionId, model }` | `Promise<void>` | `thread.unstable_setSessionModel()` |

**Implementation** — Fix `setSessionMode` to actually delegate to `thread.setSessionMode()`.

### 2. `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

Add 7 proxy methods to `AcpCliBackService`:

| Method                   | Parameters              | Delegates to                            |
| ------------------------ | ----------------------- | --------------------------------------- |
| `setSessionMode`         | `(sessionId, modeId)`   | `agentService.setSessionMode()`         |
| `loadSessionOrNew`       | `(config, sessionId)`   | `agentService.loadSessionOrNew()`       |
| `setSessionConfigOption` | `(sessionId, options)`  | `agentService.setSessionConfigOption()` |
| `forkSession`            | `(sessionId, options?)` | `agentService.forkSession()`            |
| `resumeSession`          | `(sessionId)`           | `agentService.resumeSession()`          |
| `closeSession`           | `(sessionId)`           | `agentService.closeSession()`           |
| `setSessionModel`        | `(sessionId, model)`    | `agentService.setSessionModel()`        |

## Risks

- **`as any` continuation**: These methods use `as any` to bridge ACP SDK types. This is consistent with existing code but should be cleaned up separately.
- **forkSession behavior**: The forked session gets a new sessionId. Need to verify if the forked session stays on the same thread or needs a new thread. Current implementation assumes same thread.
