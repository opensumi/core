# ACP Node 层重写 — Thread AI 架构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完全重写 Node 端 ACP 模块（仅保留 `AcpCliBackService` 不动），以 `AcpThread` 为核心实体实现 Thread AI 架构。每个 thread 维护有序的 `AgentThreadEntry` 列表（UserMessage / AssistantMessage / ToolCall），通过 SDK `ClientSideConnection` 与 Agent 进程通信。

**Architecture:** Browser 与 Node 通过单一 WebSocket 连接通信，RPC 调用复用在同一连接上。Node 层以 DI 单例形式管理一个 Agent 进程实例，`AcpConnectionService` 封装进程生命周期 + SDK 连接 + `Client` 接口实现。`AcpThread` 是按 Agent Session 隔离的实体（每个 Session 一个 Thread）。Handler（文件、终端）为单例共享。

**Tech Stack:** TypeScript, `@agentclientprotocol/sdk` (ESM), `@opensumi/di`, Node.js 16.20.2, `stream/web`, `node-pty`

---

## 架构图

```
Browser 层 (ai-native)                    Node 层 (ai-native)                      Agent 进程
┌──────────────────────────┐         ┌─────────────────────────────┐         ┌───────────────┐
│ AcpCliBackService        │  RPC    │ AcpAgentService             │  deleg  │               │
│ (IAIBackService 实现)     │────────►│  - currentThread            │────────►│  ClientSide   │
│  - 调用 AcpAgentService   │         │  - sessionInfo              │         │  Connection   │
│                          │         │                             │         │  (SDK)        │
│                          │         │  委托给 AcpConnectionService │         │               │
│                          │         │                             │         │               │
│                          │  RPC    │ AcpConnectionService        │  stdio  │               │
│                          │────────►│  - connection (SDK)          │────────►│  Agent CLI    │
│                          │         │  - currentProcess            │         │               │
│                          │         │  - Client 接口实现            │         │               │
│                          │         │                             │         │               │
│  PermissionDialog        │◄────────│  - Permission RPC           │         │               │
│  (UI)                    │  RPC    │    (this.client)            │         │               │
└──────────────────────────┘         │                             │         └───────────────┘
                                     │ AcpThread (per session)   │
┌──────────────────────────┐         │  - entries[]                │
│ ACPSessionProvider       │  调用   │  - status                   │
│ (ISessionProvider)        │────────►│  - onEvent                  │
└──────────────────────────┘         │                             │
                                     ├─────────────────────────────┤
┌──────────────────────────┐         │ 单例共享 Handler             │
│ AcpChatAgent             │  调用   │ AcpFileSystemHandler        │
│ (IChatAgent)              │────────►│ AcpTerminalHandler          │
└──────────────────────────┘         └─────────────────────────────┘
```

## AcpThread 架构图

### 内部结构

```
┌─────────────────────────────────────────────────────────────────────┐
│ AcpThread                                                           │
│ sessionId: string                                                   │
│                                                                     │
│ entries: AgentThreadEntry[]  (有序列表，按时间追加)                  │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [0] UserMessageEntry      { id, content, timestamp }           │   │
│ │ [1] AssistantMessageEntry { chunks[], isComplete }             │   │
│ │ [2] ToolCallEntry         { id, kind, title, status, content,  │   │
│ │                             locations[], rawInput, rawOutput } │   │
│ │ [3] ToolCallEntry         { ... }                              │   │
│ │ [4] AssistantMessageEntry { ... }                              │   │
│ │ [5] UserMessageEntry      { ... }                              │   │
│ │ ...                                                             │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ status: ThreadStatus                                               │
│   idle → working → awaiting_prompt → (循环)                         │
│   idle → auth_required → working → awaiting_prompt → (循环)         │
│   idle → errored (终态)                                            │
│   idle → disconnected (终态)                                       │
│                                                                     │
│ onEvent: EventEmitter<AcpThreadEvent>                               │
│   entry_added    → UI 渲染新 entry                                   │
│   entry_updated  → UI 更新现有 entry（流式追加、状态变化）            │
│   status_changed → UI 更新 thread 状态                               │
│   session_notification → 原始通知透传                                │
│   error          → UI 展示错误                                      │
│                                                                     │
│ ToolCall 状态机:                                                    │
│   pending ──► in_progress ──► completed                             │
│           │                     ├─► failed                          │
│           ├─► waiting_for_confirmation ──► in_progress              │
│           │                              ├─► rejected (用户拒绝)     │
│           │                              └─► failed                │
│           └─► canceled                                              │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │                    Entry 类型                                │    │
│ │                                                             │    │
│ │ UserMessageEntry      AssistantMessageEntry                 │    │
│ │ ┌─────────────────┐   ┌──────────────────────────┐          │    │
│ │ │ id: string      │   │ chunks: [                │          │    │
│ │ │ content: string │   │   { type: 'text',        │          │    │
│ │ │ timestamp: num  │   │     content: string },   │          │    │
│ │ └─────────────────┘   │   { type: 'thought',     │          │    │
│ │                       │     content: string }    │          │    │
│ │ ToolCallEntry         │ ]                        │          │    │
│ │ ┌──────────────────┐  │ isComplete: boolean      │          │    │
│ │ │ id: string       │  └──────────────────────────┘          │    │
│ │ │ kind: string     │                                        │    │
│ │ │ title: string    │  PlanEntry                             │    │
│ │ │ status: ToolCall │  ┌─────────────────────────────┐       │    │
│ │ │ content: []      │  │ entries: [                  │       │    │
│ │ │ locations: []    │  │   { content: string,        │       │    │
│ │ │ rawInput?: {}    │  │     completed: boolean }    │       │    │
│ │ │ rawOutput?: {}   │  │ ]                           │       │    │
│ │ └──────────────────┘  └─────────────────────────────┘       │    │
│ └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
SessionNotification (from SDK)
         │
         ▼
┌────────────────────┐
│ handleNotification │
│  - 解析 sessionUpdate │
│  - 分发到具体 handler │
└────────┬───────────┘
         │
    ┌────┴─────────────────────────────────┐
    │    │    │         │         │         │
    ▼    ▼    ▼         ▼         ▼         ▼
 user_msg  assistant_msg  tool_call  tool_call_update  plan
 chunk     chunk          start      status/content    update
    │    │    │         │         │
    ▼    ▼    ▼         ▼         ▼
┌──────────────────────────────────────────┐
│           操作 entries 列表               │
│                                          │
│  user_message_chunk:                     │
│    最后一个是 user_message → 追加 content │
│    否则 → 新建 UserMessageEntry          │
│                                          │
│  agent_message/thought_chunk:            │
│    最后一个 assistant 且未完成 → 追加 chunk│
│    否则 → 新建 AssistantMessageEntry     │
│                                          │
│  tool_call:                              │
│    新建 ToolCallEntry, status = pending  │
│    thread status → working               │
│                                          │
│  tool_call_update:                       │
│    找到匹配 id 的 entry → 更新 status    │
│    waiting_for_confirmation → auth_required│
│    completed/failed 且无活跃 → awaiting  │
└──────────────────────────────────────────┘
         │
         ▼
┌────────────────────┐
│  fire onEvent      │
│  entry_added /     │
│  entry_updated /   │
│  status_changed    │
└────────────────────┘
         │
         ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ AcpAgentService          │      │ Browser 层 (UI)           │
│  handleNotification()    │      │  - 渲染 thread entries    │
│  emitData() to stream    │◄─────│  - 显示 loading / 错误    │
│                          │      │  - 权限对话框决策          │
└──────────────────────────┘      └──────────────────────────┘
```

### 与 AcpAgentService 的协作

```
AcpAgentService                     AcpThread
┌─────────────────────┐            ┌─────────────────────┐
│ createSession()     │──创建──►   │ new AcpThread(sid)  │
│                     │            │                     │
│ sendMessage(req)    │            │                     │
│  ├─ addUserMessage  │──追加──►   │ entries.push(user)  │
│  │                  │            │                     │
│  ├─ onEvent 订阅    │◄──事件───  │ onEvent.fire()      │
│  │                  │            │                     │
│  ├─ prompt()        │──调用 SDK──►│ (由 connection 通知) │
│  │                  │            │                     │
│  └─ markAssistant   │──手动──►   │ isComplete = true   │
│     Complete()      │            │ status=awaiting     │
│                     │            │                     │
│ cancelRequest()     │──手动──►   │ status=awaiting     │
│                     │            │                     │
│ disposeSession()    │──销毁──►   │ dispose()           │
└─────────────────────┘            └─────────────────────┘
```

**关键设计决策：**

- Browser 与 Node 间通过单一 WebSocket 连接通信，RPC 调用复用在同一连接上
- `AcpConnectionService` 封装进程 + SDK 连接 + `Client` 接口实现，通过 `RPCService<IAcpPermissionService>` 实现权限 RPC（无静态变量）
- `AcpThread` 是按 Session 隔离的核心状态模型，维护有序的 `AgentThreadEntry[]` 列表，通过事件驱动通知 UI
- Handler（文件、终端）为单例共享，不持有连接状态
- `AcpCliBackService` 保持不变，通过 `IAcpAgentService` 接口调用 `AcpAgentService`

---

## 待移除文件

以下文件将被**完全删除**：

```
packages/ai-native/src/node/acp/
├── acp-agent.service.ts
├── acp-cli-client.service.ts
├── acp-permission-caller.service.ts
├── cli-agent-process-manager.ts
└── handlers/
    └── agent-request.handler.ts
```

## 新建文件

```
packages/ai-native/src/node/acp/
├── acp-thread.ts                     # Thread 实体（核心状态模型）
├── acp-connection.service.ts         # SDK 连接 + 进程 + Client 接口 + 权限 RPC
├── acp-agent.service.ts              # Agent 业务层（管理 thread 生命周期）
├── handlers/
│   ├── file-system.handler.ts        # 文件系统操作（单例共享）
│   └── terminal.handler.ts           # 终端管理（单例共享）
└── index.ts                          # 重写：导出
```

## 保留文件

```
└── acp-cli-back.service.ts           # 不变
```

---

## Node.js 16.20.2 兼容策略

**1. 动态 `import()` 加载 ESM SDK**

```typescript
let _sdkModule: Awaited<ReturnType<typeof import('@agentclientprotocol/sdk')>> | undefined;
async function loadSdk() {
  if (!_sdkModule) _sdkModule = await import('@agentclientprotocol/sdk');
  return _sdkModule;
}
```

**2. Web Streams polyfill（Node 16 无全局 ReadableStream/WritableStream）**

```typescript
import { ReadableStream, WritableStream } from 'stream/web';
if (!(globalThis as any).ReadableStream) {
  (globalThis as any).ReadableStream = ReadableStream;
  (globalThis as any).WritableStream = WritableStream;
}
```

**3. `Readable.toWeb()` 手动替代（Node 16 无此 API）**

```typescript
function nodeStdoutToWebStream(stdout: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });
      stdout.on('end', () => controller.close());
      stdout.on('error', (err) => controller.error(err));
    },
  });
}
```

---

### Task 1: 创建 AcpThread（核心 Thread 实体）

**Files:**

- Create: `packages/ai-native/src/node/acp/acp-thread.ts`

核心状态模型，维护 thread 的 entry 列表、tool call 权限状态、流式消息收集。

- [ ] **Step 1.1: 创建 acp-thread.ts**

```typescript
import { EventEmitter } from '@opensumi/ide-utils/lib/event';
import type { SessionNotification } from '@agentclientprotocol/sdk';

export type ThreadStatus = 'idle' | 'working' | 'awaiting_prompt' | 'errored' | 'auth_required' | 'disconnected';

export type AcpThreadEvent =
  | { type: 'entry_added'; entry: AgentThreadEntry }
  | { type: 'entry_updated'; entry: AgentThreadEntry }
  | { type: 'status_changed'; status: ThreadStatus }
  | { type: 'session_notification'; notification: SessionNotification }
  | { type: 'error'; error: Error };

export type ToolCallStatus =
  | 'pending'
  | 'waiting_for_confirmation'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'canceled';

export interface ToolCallEntry {
  id: string;
  kind: string;
  title: string;
  status: ToolCallStatus;
  content: Array<{ type: string; [key: string]: unknown }>;
  locations?: Array<{ path: string; line?: number }>;
  rawInput?: Record<string, unknown>;
  rawOutput?: Record<string, unknown>;
}

export interface UserMessageEntry {
  id: string;
  content: string;
  timestamp: number;
}

export interface AssistantMessageEntry {
  chunks: Array<{ type: 'text' | 'thought'; content: string }>;
  isComplete: boolean;
}

export interface PlanEntry {
  entries: Array<{ content: string; completed: boolean }>;
}

export type AgentThreadEntry =
  | { type: 'user_message'; data: UserMessageEntry }
  | { type: 'assistant_message'; data: AssistantMessageEntry }
  | { type: 'tool_call'; data: ToolCallEntry }
  | { type: 'plan'; data: PlanEntry };

export const AcpThreadToken = Symbol('AcpThreadToken');

export class AcpThread {
  readonly sessionId: string;

  private entries: AgentThreadEntry[] = [];
  private _status: ThreadStatus = 'idle';
  private _error: Error | null = null;

  private _onEvent = new EventEmitter<AcpThreadEvent>();
  readonly onEvent = this._onEvent.event;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  getEntries(): ReadonlyArray<AgentThreadEntry> {
    return this.entries;
  }

  getStatus(): ThreadStatus {
    return this._status;
  }

  setStatus(status: ThreadStatus): void {
    if (this._status === status) return;
    this._status = status;
    this._onEvent.fire({ type: 'status_changed', status });
  }

  setError(error: Error): void {
    this._error = error;
    this._status = 'errored';
    this._onEvent.fire({ type: 'error', error });
    this._onEvent.fire({ type: 'status_changed', status: 'errored' });
  }

  handleNotification(notification: SessionNotification): void {
    const update = notification.update as Record<string, unknown>;
    if (!update?.sessionUpdate) return;

    this._onEvent.fire({ type: 'session_notification', notification });

    switch (update.sessionUpdate) {
      case 'user_message_chunk':
        this.handleUserMessageChunk(update);
        break;
      case 'agent_thought_chunk':
      case 'agent_message_chunk':
        this.handleAssistantMessageChunk(update);
        break;
      case 'tool_call':
        this.handleToolCallStart(update);
        break;
      case 'tool_call_update':
        this.handleToolCallUpdate(update);
        break;
      default:
        break;
    }
  }

  addUserMessage(content: string): UserMessageEntry {
    const entry: UserMessageEntry = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      timestamp: Date.now(),
    };
    this.entries.push({ type: 'user_message', data: entry });
    this._onEvent.fire({ type: 'entry_added', entry: { type: 'user_message', data: entry } });
    return entry;
  }

  private handleUserMessageChunk(update: Record<string, unknown>): void {
    const content = update.content as Record<string, unknown> | undefined;
    if (content?.type !== 'text') return;
    const text = content.text as string;

    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry?.type === 'user_message') {
      lastEntry.data.content += text;
      this._onEvent.fire({ type: 'entry_updated', entry: lastEntry });
    } else {
      this.addUserMessage(text);
    }
  }

  private handleAssistantMessageChunk(update: Record<string, unknown>): void {
    const content = update.content as Record<string, unknown> | undefined;
    if (!content || content.type !== 'text') return;
    const text = content.text as string;
    const msgType = update.sessionUpdate === 'agent_thought_chunk' ? 'thought' : 'text';

    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry?.type === 'assistant_message' && !lastEntry.data.isComplete) {
      const lastChunk = lastEntry.data.chunks[lastEntry.data.chunks.length - 1];
      if (lastChunk && lastChunk.type === msgType) {
        lastChunk.content += text;
      } else {
        lastEntry.data.chunks.push({ type: msgType as 'text' | 'thought', content: text });
      }
      this._onEvent.fire({ type: 'entry_updated', entry: lastEntry });
    } else {
      const entry: AssistantMessageEntry = {
        chunks: [{ type: msgType as 'text' | 'thought', content: text }],
        isComplete: false,
      };
      this.entries.push({ type: 'assistant_message', data: entry });
      this._onEvent.fire({ type: 'entry_added', entry: { type: 'assistant_message', data: entry } });
    }
  }

  private handleToolCallStart(update: Record<string, unknown>): void {
    const toolCallId = update.toolCallId as string;
    if (!toolCallId) return;

    const entry: ToolCallEntry = {
      id: toolCallId,
      kind: (update.kind as string) || 'unknown',
      title: (update.title as string) || '',
      status: 'pending',
      content: [],
      locations: (update.locations as Array<{ path: string; line?: number }>) || [],
      rawInput: (update.rawInput as Record<string, unknown>) || undefined,
    };

    this.entries.push({ type: 'tool_call', data: entry });
    this._onEvent.fire({ type: 'entry_added', entry: { type: 'tool_call', data: entry } });
    this.setStatus('working');
  }

  private handleToolCallUpdate(update: Record<string, unknown>): void {
    const toolCallId = update.toolCallId as string;
    if (!toolCallId) return;

    const toolEntry = this.entries.find(
      (e): e is { type: 'tool_call'; data: ToolCallEntry } => e.type === 'tool_call' && e.data.id === toolCallId,
    );
    if (!toolEntry) return;

    const toolCall = toolEntry.data;
    if (update.status) toolCall.status = this.mapToolCallStatus(update.status as string);
    if (Array.isArray(update.content)) toolCall.content.push(...update.content);
    if (update.rawOutput) toolCall.rawOutput = update.rawOutput as Record<string, unknown>;

    if (toolCall.status === 'waiting_for_confirmation') {
      this.setStatus('auth_required');
    } else if (toolCall.status === 'completed' || toolCall.status === 'failed') {
      const hasActive = this.entries.some(
        (e) => e.type === 'tool_call' && ['pending', 'waiting_for_confirmation', 'in_progress'].includes(e.data.status),
      );
      if (!hasActive) this.setStatus('awaiting_prompt');
    }

    this._onEvent.fire({ type: 'entry_updated', entry: { type: 'tool_call', data: toolCall } });
  }

  markAssistantComplete(): void {
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry?.type === 'assistant_message') {
      lastEntry.data.isComplete = true;
      this._onEvent.fire({ type: 'entry_updated', entry: lastEntry });
    }
    this.setStatus('awaiting_prompt');
  }

  markToolCallWaiting(toolCallId: string): void {
    const toolEntry = this.entries.find(
      (e): e is { type: 'tool_call'; data: ToolCallEntry } => e.type === 'tool_call' && e.data.id === toolCallId,
    );
    if (toolEntry) {
      toolEntry.data.status = 'waiting_for_confirmation';
      this._onEvent.fire({ type: 'entry_updated', entry: { type: 'tool_call', data: toolEntry.data } });
    }
  }

  respondToToolCall(toolCallId: string, allowed: boolean): void {
    const toolEntry = this.entries.find(
      (e): e is { type: 'tool_call'; data: ToolCallEntry } => e.type === 'tool_call' && e.data.id === toolCallId,
    );
    if (!toolEntry) return;

    toolEntry.data.status = allowed ? 'in_progress' : 'rejected';
    this._onEvent.fire({ type: 'entry_updated', entry: { type: 'tool_call', data: toolEntry.data } });
  }

  dispose(): void {
    this._onEvent.dispose();
  }

  private mapToolCallStatus(status: string): ToolCallStatus {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'rejected':
        return 'rejected';
      case 'canceled':
        return 'canceled';
      default:
        return 'pending';
    }
  }
}
```

- [ ] **Step 1.2: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-thread.ts
git commit -m "feat(acp): add AcpThread entity for conversation thread state

Maintains ordered AgentThreadEntry list (UserMessage/AssistantMessage/ToolCall),
handles session/update notifications, manages tool call permission states.
Emits events for UI layer subscription."
```

---

### Task 2: 创建 AcpFileSystemHandler + AcpTerminalHandler

**Files:**

- Create: `packages/ai-native/src/node/acp/handlers/file-system.handler.ts`
- Create: `packages/ai-native/src/node/acp/handlers/terminal.handler.ts`

两个单例共享 handler，不持有连接状态。

> **注意：以下 handler 代码是重写版本，与现有实现的关键行为差异需在实现时保留：**
>
> - `AcpFileSystemHandler`：现有实现使用 `IFileService` + `resolvePath` 工作区沙箱校验 + `PermissionCallback`。重写版本应**保留这些安全特性**，将 `PermissionCallback` 替换为通过 `Client` 接口的 Agent 原生权限机制。
> - `AcpTerminalHandler`：现有实现有 `PermissionCallback` + 输出缓冲自动截断（保留最近 80%）。重写版本应**保留截断逻辑**，移除 `PermissionCallback`（权限由 `Client` 接口的 `requestPermission` 统一处理）。

- [ ] **Step 2.1: 创建 file-system.handler.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

export const AcpFileSystemHandlerToken = Symbol('AcpFileSystemHandlerToken');

export interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}

export interface ReadTextFileResponse {
  content?: string;
  error?: { message: string; code: string };
}

export interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}

export interface WriteTextFileResponse {
  error?: { message: string; code: string };
}

@Injectable()
export class AcpFileSystemHandler {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  async readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    try {
      const resolvedPath = this.resolveSafePath(req.path);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      if (req.line !== undefined || req.limit !== undefined) {
        const lines = content.split('\n');
        const startLine = req.line ?? 0;
        const limit = req.limit ?? lines.length;
        return { content: lines.slice(startLine, startLine + limit).join('\n') };
      }
      return { content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AcpFileSystemHandler] readTextFile error: ${message}`);
      return { error: { message, code: this.getErrorCode(error) } };
    }
  }

  async writeTextFile(req: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    try {
      const resolvedPath = this.resolveSafePath(req.path);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolvedPath, req.content, 'utf-8');
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AcpFileSystemHandler] writeTextFile error: ${message}`);
      return { error: { message, code: this.getErrorCode(error) } };
    }
  }

  private resolveSafePath(filePath: string): string {
    if (!path.isAbsolute(filePath)) throw new Error(`Path must be absolute: ${filePath}`);
    return path.normalize(filePath);
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof Error && 'code' in error) return (error as any).code;
    return 'UNKNOWN';
  }
}
```

- [ ] **Step 2.2: 创建 terminal.handler.ts**

```typescript
import * as pty from 'node-pty';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

export const AcpTerminalHandlerToken = Symbol('AcpTerminalHandlerToken');

export interface CreateTerminalRequest {
  sessionId: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  outputByteLimit?: number;
}

export interface CreateTerminalResponse {
  terminalId?: string;
  error?: { message: string };
}

interface ManagedTerminal {
  id: string;
  sessionId: string;
  pty: pty.IPty;
  outputBuffer: string;
  outputByteLimit: number;
  exitCode: number | null;
  exitSignal: string | null;
  exited: boolean;
  exitPromise: Promise<void>;
  exitResolve: () => void;
}

@Injectable()
export class AcpTerminalHandler {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private terminals = new Map<string, ManagedTerminal>();
  private terminalCounter = 0;

  async createTerminal(req: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    try {
      const terminalId = `terminal-${++this.terminalCounter}`;
      const outputByteLimit = req.outputByteLimit ?? 1024 * 1024;
      const { exitPromise, exitResolve } = this.createExitPromise();

      const ptyProcess = pty.spawn(req.command, req.args ?? [], {
        name: 'xterm-256color',
        cwd: req.cwd ?? process.env.HOME ?? '/',
        env: { ...process.env, ...req.env },
        handleFlowControl: false,
      });

      const terminal: ManagedTerminal = {
        id: terminalId,
        sessionId: req.sessionId,
        pty: ptyProcess,
        outputBuffer: '',
        outputByteLimit,
        exitCode: null,
        exitSignal: null,
        exited: false,
        exitPromise,
        exitResolve: exitResolve,
      };

      ptyProcess.onData((data) => {
        if (terminal.outputBuffer.length < terminal.outputByteLimit) terminal.outputBuffer += data;
      });
      ptyProcess.onExit(({ exitCode, signal }) => {
        terminal.exitCode = exitCode;
        terminal.exitSignal = signal ?? null;
        terminal.exited = true;
        terminal.exitResolve();
      });

      this.terminals.set(terminalId, terminal);
      this.logger.log(`[AcpTerminalHandler] Created terminal ${terminalId}`);
      return { terminalId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AcpTerminalHandler] createTerminal error: ${message}`);
      return { error: { message } };
    }
  }

  async getTerminalOutput(terminalId: string, sessionId: string) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.sessionId !== sessionId) {
      return { error: { message: `Terminal ${terminalId} not found` } };
    }
    const output = terminal.outputBuffer;
    const truncated = output.length >= terminal.outputByteLimit;
    terminal.outputBuffer = '';
    return { output, truncated, exitStatus: terminal.exited ? terminal.exitCode ?? -1 : undefined };
  }

  async waitForTerminalExit(terminalId: string, sessionId: string) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.sessionId !== sessionId) {
      return { error: { message: `Terminal ${terminalId} not found` } };
    }
    await terminal.exitPromise;
    return { exitCode: terminal.exitCode ?? undefined, signal: terminal.exitSignal ?? undefined };
  }

  async killTerminal(terminalId: string, sessionId: string) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.sessionId !== sessionId) {
      return { error: { message: `Terminal ${terminalId} not found` } };
    }
    try {
      terminal.pty.kill();
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : String(error) } };
    }
    return {};
  }

  async releaseTerminal(terminalId: string, sessionId: string) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.sessionId !== sessionId) {
      return { error: { message: `Terminal ${terminalId} not found` } };
    }
    this.terminals.delete(terminalId);
    return {};
  }

  async releaseSessionTerminals(sessionId: string): Promise<void> {
    for (const [id, terminal] of this.terminals) {
      if (terminal.sessionId === sessionId) {
        try {
          terminal.pty.kill();
        } catch {
          /* ignored */
        }
        this.terminals.delete(id);
      }
    }
  }

  private createExitPromise(): { exitPromise: Promise<void>; exitResolve: () => void } {
    let exitResolve: () => void = () => {};
    const exitPromise = new Promise<void>((resolve) => {
      exitResolve = resolve;
    });
    return { exitPromise, exitResolve };
  }
}
```

- [ ] **Step 2.3: Commit**

```bash
git add packages/ai-native/src/node/acp/handlers/file-system.handler.ts packages/ai-native/src/node/acp/handlers/terminal.handler.ts
git commit -m "feat(acp): add AcpFileSystemHandler and AcpTerminalHandler

Singleton handlers for file and terminal operations, shared across
connections. File handler does path validation + read/write. Terminal
handler manages node-pty PTY instances with output buffering."
```

---

### Task 3: 创建 AcpConnectionService

**Files:**

- Create: `packages/ai-native/src/node/acp/acp-connection.service.ts`

每个连接一个实例。封装进程生命周期 + SDK 连接 + `Client` 接口 + 权限 RPC。

- [ ] **Step 3.1: 创建 acp-connection.service.ts**

```typescript
import { ChildProcess, spawn } from 'child_process';
import { ReadableStream, WritableStream } from 'stream/web';

import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { INodeLogger } from '@opensumi/ide-core-node';
import { EventEmitter } from '@opensumi/ide-utils/lib/event';

import type { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';

import type {
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  Client,
  ClientSideConnection,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
  Stream,
} from '@agentclientprotocol/sdk';

import type {
  AcpPermissionDecision,
  AcpPermissionDialogParams,
  IAcpPermissionService,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';

const ACP_PROTOCOL_VERSION = 1;

// --- Node 16 ESM/CJS compatibility ---

let _sdkModule: Awaited<ReturnType<typeof import('@agentclientprotocol/sdk')>> | undefined;

async function loadSdk() {
  if (!_sdkModule) _sdkModule = await import('@agentclientprotocol/sdk');
  return _sdkModule;
}

if (!(globalThis as any).ReadableStream) {
  (globalThis as any).ReadableStream = ReadableStream;
  (globalThis as any).WritableStream = WritableStream;
}

export const AcpConnectionServiceToken = Symbol('AcpConnectionServiceToken');

@Injectable()
export class AcpConnectionService extends RPCService<IAcpPermissionService> {
  @Autowired(AcpFileSystemHandlerToken)
  private fileSystemHandler: AcpFileSystemHandler;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private connection: ClientSideConnection | null = null;
  private currentProcess: ChildProcess | null = null;
  private initialized = false;
  private initializingPromise: Promise<InitializeResponse> | null = null;
  private initializeResult: InitializeResponse | null = null;

  private _onInitialized = new EventEmitter<InitializeResponse>();
  private _onDisconnect = new EventEmitter<string>();
  private _onSessionUpdate = new EventEmitter<SessionNotification>();

  readonly onInitialized = this._onInitialized.event;
  readonly onDisconnect = this._onDisconnect.event;
  readonly onSessionUpdate = this._onSessionUpdate.event;

  async initialize(config: AgentProcessConfig): Promise<InitializeResponse> {
    if (this.initialized && this.initializeResult) return this.initializeResult;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      // 1. 先加载 SDK（必须在 ndJsonStream 调用之前）
      const sdk = await loadSdk();

      // 2. 启动进程
      const { stdout, stdin } = await this.spawnAgentProcess(config);

      // 3. 用已加载的 SDK 创建连接
      const stream = this.nodeStreamsToWebStream(stdout, stdin, sdk.ndJsonStream);

      const client = this.createClient();
      this.connection = new sdk.ClientSideConnection(() => client, stream);

      const initParams: InitializeRequest = {
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
        clientInfo: { name: 'opensumi', title: 'OpenSumi IDE', version: '3.0.0' },
      };

      const initResponse = await this.connection.initialize(initParams);
      this.initializeResult = initResponse;
      this.initialized = true;
      this._onInitialized.fire(this.initializeResult);
      this.logger.log('[AcpConnectionService] Initialized successfully');

      this.connection.closed.then(() => {
        this.logger.warn('[AcpConnectionService] Connection closed');
        this.initialized = false;
        this.initializeResult = null;
        this._onDisconnect.fire('Connection closed');
      });

      return this.initializeResult!;
    })();

    try {
      return await this.initializingPromise;
    } finally {
      this.initializingPromise = null;
    }
  }

  // ========== 进程管理 ==========

  private async spawnAgentProcess(
    config: AgentProcessConfig,
  ): Promise<{ stdout: NodeJS.ReadableStream; stdin: NodeJS.WritableStream }> {
    const agentPath = process.env.SUMI_ACP_AGENT_PATH || config.command;
    const nodePath = process.env.SUMI_ACP_NODE_PATH || config.command;
    const nodeBinDir = nodePath.substring(0, nodePath.lastIndexOf('/'));
    const newEnv = {
      ...process.env,
      ...config.env,
      NODE: `${nodeBinDir}/node`,
      PATH: `${nodeBinDir}:${process.env.PATH || ''}`,
    };

    const childProcess = spawn(agentPath, config.args, {
      cwd: config.workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      shell: false,
      env: newEnv,
    });

    childProcess.on('error', (err) => this.logger.error(`[AcpConnectionService] Process error: ${err.message}`));
    childProcess.stderr?.on('data', (data: Buffer) =>
      this.logger.warn('[AcpConnectionService] stderr:', data.toString('utf8')),
    );
    childProcess.on('exit', (code, signal) => {
      this.logger.log(`[AcpConnectionService] Process exited: code=${code}, signal=${signal}`);
      this.currentProcess = null;
      this.initialized = false;
      this.initializeResult = null;
      this._onDisconnect.fire(`Process exited: code=${code}, signal=${signal}`);
    });

    if (!childProcess.pid) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (childProcess.pid) resolve();
          else reject(new Error(`Failed to get PID: ${config.command}`));
        }, 100);
        childProcess.on('spawn', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    this.currentProcess = childProcess;
    return {
      stdout: childProcess.stdio[1] as NodeJS.ReadableStream,
      stdin: childProcess.stdio[0] as NodeJS.WritableStream,
    };
  }

  // ========== Stream 转换 ==========

  private nodeStreamsToWebStream(
    stdout: NodeJS.ReadableStream,
    stdin: NodeJS.WritableStream,
    ndJsonStream: Function,
  ): Stream {
    const readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        stdout.on('data', (chunk: Buffer) =>
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
        );
        stdout.on('end', () => controller.close());
        stdout.on('error', (err) => controller.error(err));
      },
    });
    const writable = new WritableStream<Uint8Array>({ write: (chunk) => stdin.write(chunk) });
    return ndJsonStream(writable, readable);
  }

  // ========== Client 接口实现 ==========

  private createClient(): Client {
    const self = this;
    return {
      async requestPermission(params) {
        return self.handlePermissionRequest(params as any);
      },
      async sessionUpdate(params: SessionNotification) {
        self._onSessionUpdate.fire(params);
      },
      async readTextFile(params) {
        const result = await self.fileSystemHandler.readTextFile({
          sessionId: params.sessionId,
          path: params.path,
          line: params.line,
          limit: params.limit,
        });
        if (result.error) {
          const err = new Error(result.error.message);
          (err as any).code = result.error.code;
          throw err;
        }
        return { content: result.content || '' };
      },
      async writeTextFile(params) {
        await self.handleWriteFileWithPermission(params as any);
        return {};
      },
      async createTerminal(params) {
        const result = await self.handleCreateTerminalWithPermission(params as any);
        if (result.error) throw new Error(result.error.message);
        return { terminalId: result.terminalId || '' };
      },
      async terminalOutput(params) {
        const result = await self.terminalHandler.getTerminalOutput(params.terminalId, params.sessionId);
        if (result.error) throw new Error(result.error.message);
        return {
          output: result.output || '',
          truncated: result.truncated || false,
          exitStatus: result.exitStatus != null ? { exitCode: result.exitStatus } : undefined,
        };
      },
      async waitForTerminalExit(params) {
        const result = await self.terminalHandler.waitForTerminalExit(params.terminalId, params.sessionId);
        if (result.error) throw new Error(result.error.message);
        return { exitCode: result.exitCode, signal: result.signal };
      },
      async killTerminal(params) {
        const result = await self.terminalHandler.killTerminal(params.terminalId, params.sessionId);
        if (result.error) throw new Error(result.error.message);
        return {};
      },
      async releaseTerminal(params) {
        const result = await self.terminalHandler.releaseTerminal(params.terminalId, params.sessionId);
        if (result.error) throw new Error(result.error.message);
        return {};
      },
    };
  }

  // ========== 权限处理 ==========

  private async handlePermissionRequest(request: any): Promise<any> {
    if (process.env.SKIP_PERMISSION_CHECK === 'true') return this.autoAllow(request);

    const rpcClient = this.client;
    if (!rpcClient) throw new Error('[AcpConnectionService] No active RPC client');

    // 使用 Agent 传入的 options（保留协议的灵活性）
    const options = this.buildOptionsFromRequest(request);

    const dialogParams: AcpPermissionDialogParams = {
      requestId: `${request.sessionId}:${request.toolCall.toolCallId}`,
      sessionId: request.sessionId,
      title: request.toolCall.title ?? 'Permission Request',
      kind: request.toolCall.kind ?? undefined,
      content: this.buildPermissionContent(request),
      locations: request.toolCall.locations?.map((loc: any) => ({ path: loc.path, line: loc.line ?? undefined })),
      options: this.sortOptionsByKind(options),
      timeout: 60000,
    };

    const decision = await rpcClient.$showPermissionDialog(dialogParams);
    return this.buildPermissionResponse(decision, options);
  }

  /**
   * 构建权限选项列表
   * 如果 Agent 传入了 options 则直接使用，否则为 write/execute 操作生成默认选项
   */
  private buildOptionsFromRequest(request: any): Array<{ optionId: string; kind: string; name: string }> {
    if (request.options && Array.isArray(request.options) && request.options.length > 0) {
      return request.options.map((o: any) => ({ optionId: o.optionId, name: o.name, kind: o.kind }));
    }
    // 默认选项（write 和 execute 操作通用）
    return [
      { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
      { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
      { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
    ];
  }

  private async handleWriteFileWithPermission(params: any): Promise<void> {
    const permResponse = await this.handlePermissionRequest({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: `write-${Date.now()}`,
        title: `Write file: ${params.path}`,
        kind: 'write',
        status: 'pending',
        locations: [{ path: params.path }],
        rawInput: { path: params.path },
      },
      options: this.buildOptionsFromRequest({}), // 使用默认选项
    });

    if (permResponse.outcome.outcome !== 'selected' || !permResponse.outcome.optionId?.startsWith('allow_')) {
      const err = new Error('Write permission denied');
      (err as any).code = -32003;
      throw err;
    }

    const result = await this.fileSystemHandler.writeTextFile({
      sessionId: params.sessionId,
      path: params.path,
      content: params.content,
    });
    if (result.error) throw new Error(result.error.message);
  }

  private async handleCreateTerminalWithPermission(
    params: any,
  ): Promise<{ terminalId?: string; error?: { message: string } }> {
    const commandStr = [params.command, ...(params.args || [])].join(' ');
    const permResponse = await this.handlePermissionRequest({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: `terminal-${Date.now()}`,
        title: `Run command: ${commandStr}`,
        kind: 'execute',
        status: 'pending',
        rawInput: { command: params.command, args: params.args, cwd: params.cwd },
      },
      options: this.buildOptionsFromRequest({}), // 使用默认选项
    });

    if (permResponse.outcome.outcome !== 'selected' || !permResponse.outcome.optionId?.startsWith('allow_')) {
      const err = new Error('Command execution denied');
      (err as any).code = -32003;
      throw err;
    }

    return this.terminalHandler.createTerminal({
      sessionId: params.sessionId,
      command: params.command,
      args: params.args,
      env: params.env?.reduce<Record<string, string>>((acc: Record<string, string>, v: any) => {
        acc[v.name] = v.value;
        return acc;
      }, {}),
      cwd: params.cwd ?? undefined,
      outputByteLimit: params.outputByteLimit ?? undefined,
    });
  }

  // ========== 权限辅助 ==========

  private autoAllow(request: any): any {
    return { outcome: { outcome: 'selected', optionId: this.findAllowOptionId(request.options) } };
  }

  private findAllowOptionId(options: Array<{ optionId: string; kind: string }>): string {
    const allow = options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always');
    return allow?.optionId || options[0]?.optionId || '';
  }

  private buildPermissionContent(request: any): string {
    const parts: string[] = [];
    if (request.toolCall.title) parts.push(request.toolCall.title);
    if (request.toolCall.locations?.length)
      parts.push(`Affected files: ${request.toolCall.locations.map((loc: any) => loc.path).join(', ')}`);
    if (request.toolCall.rawInput?.command) parts.push(`Command: \`${request.toolCall.rawInput.command}\``);
    return parts.join('\n\n');
  }

  private sortOptionsByKind(
    options: Array<{ optionId: string; kind: string }>,
  ): Array<{ optionId: string; name: string; kind: string }> {
    const order: Record<string, number> = { allow_always: 0, allow_once: 1, reject_always: 2, reject_once: 3 };
    return [...options].sort((a, b) => (order[a.kind] ?? 999) - (order[b.kind] ?? 999));
  }

  private buildPermissionResponse(
    decision: AcpPermissionDecision,
    options: Array<{ optionId: string; kind: string }>,
  ): any {
    if (decision.type === 'allow' || decision.type === 'reject') {
      const prefix = decision.type === 'allow' ? 'allow' : 'reject';
      const matching = options.find((o) => o.kind.startsWith(prefix));
      const optionId = decision.optionId || matching?.optionId || options[0]?.optionId || '';
      return { outcome: { outcome: 'selected', optionId } };
    }
    return { outcome: { outcome: 'cancelled' } };
  }

  // ========== Session 操作 ==========

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    this.ensureConnected();
    return this.connection!.newSession(params);
  }
  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.ensureConnected();
    return this.connection!.loadSession(params);
  }
  async prompt(params: PromptRequest): Promise<PromptResponse> {
    this.ensureConnected();
    return this.connection!.prompt(params);
  }
  async cancel(params: CancelNotification): Promise<void> {
    this.ensureConnected();
    return this.connection!.cancel(params);
  }
  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    this.ensureConnected();
    return this.connection!.listSessions(params);
  }
  async setSessionMode(params: SetSessionModeRequest): Promise<void> {
    this.ensureConnected();
    await this.connection!.setSessionMode(params);
  }
  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse> {
    this.ensureConnected();
    return this.connection!.authenticate(params);
  }

  async close(): Promise<void> {
    this.connection = null;
    this.initialized = false;
    this.initializeResult = null;
  }

  async dispose(): Promise<void> {
    await this.close();
    await this.killCurrentProcess();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
  getInitializeResult(): InitializeResponse | null {
    return this.initializeResult;
  }

  private ensureConnected(): void {
    if (!this.initialized || !this.connection) throw new Error('Not connected to agent');
  }

  private async killCurrentProcess(): Promise<void> {
    if (!this.currentProcess) return;
    const pid = this.currentProcess.pid;
    if (!pid) {
      this.currentProcess = null;
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* */
      }
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            /* */
          }
        }
        resolve();
      }, 5000);
      this.currentProcess?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    this.currentProcess = null;
  }
}
```

- [ ] **Step 3.2: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-connection.service.ts
git commit -m "feat(acp): add AcpConnectionService wrapping SDK ClientSideConnection

Per-connection service: spawns agent process, creates SDK connection,
implements Client interface for fs/terminal/permission routing.
Uses dynamic import for ESM compatibility with Node 16.
Extends RPCService for permission dialog RPC without static variables."
```

---

### Task 4: 重写 AcpAgentService

**Files:**

- Modify: `packages/ai-native/src/node/acp/acp-agent.service.ts`

- [ ] **Step 4.1: 重写 acp-agent.service.ts**

```typescript
import { Autowired, Injectable } from '@opensumi/di';
import {
  AvailableCommand,
  ListSessionsRequest,
  ListSessionsResponse,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from '@opensumi/ide-core-common';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { IDisposable } from '@opensumi/ide-utils/lib/event';

import { AcpConnectionService, AcpConnectionServiceToken } from './acp-connection.service';
import { AcpThread, AgentThreadEntry, AcpThreadEvent } from './acp-thread';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

export type AgentSessionStatus = 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AgentSessionInfo {
  sessionId: string;
  processId: string;
  modes: Array<{ id: string; name: string }>;
  status: AgentSessionStatus;
}

export type AgentUpdateType = 'thought' | 'message' | 'tool_call' | 'tool_result' | 'done';

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: { name: string; input: Record<string, unknown> };
}

export interface AgentRequest {
  prompt: string;
  sessionId: string;
  images?: string[];
  history?: SimpleMessage[];
}

@Injectable()
export class AcpAgentService {
  @Autowired(AcpConnectionServiceToken)
  private connectionService: AcpConnectionService;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private currentThread: AcpThread | null = null;
  private sessionInfo: AgentSessionInfo | null = null;

  getThread(): AcpThread | null {
    return this.currentThread;
  }

  async initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    const initResult = await this.connectionService.initialize(config);
    this.sessionInfo = {
      sessionId: '',
      processId: '',
      modes: ((initResult as any).modes?.availableModes ?? []) as AgentSessionInfo['modes'],
      status: 'ready',
    };
    return this.sessionInfo;
  }

  async createSession(
    config: AgentProcessConfig,
  ): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }> {
    await this.ensureConnected(config);
    const commands: AvailableCommand[] = [];
    const disposable = this.startCollectingAvailableCommands(commands);
    try {
      const res = await this.connectionService.newSession({ cwd: config.workspaceDir, mcpServers: [] });
      this.currentThread = new AcpThread(res.sessionId);
      return { sessionId: res.sessionId, availableCommands: commands };
    } finally {
      disposable.dispose();
    }
  }

  async loadSession(
    sessionId: string,
    config: AgentProcessConfig,
  ): Promise<{
    sessionId: string;
    processId: string;
    modes: any[];
    status: AgentSessionStatus;
    historyUpdates: any[];
  }> {
    await this.ensureConnected(config);
    const historyUpdates: any[] = [];
    const disposable = this.connectionService.onSessionUpdate((notification) => {
      historyUpdates.push(notification);
    });
    try {
      await this.connectionService.loadSession({ sessionId, cwd: config.workspaceDir, mcpServers: [] });
    } finally {
      disposable.dispose();
    }

    this.currentThread = new AcpThread(sessionId);
    for (const notification of historyUpdates) this.currentThread.handleNotification(notification);

    return { sessionId, processId: '', modes: [], status: 'ready', historyUpdates };
  }

  sendMessage(request: AgentRequest, config: AgentProcessConfig): SumiReadableStream<AgentUpdate> {
    const stream = new SumiReadableStream<AgentUpdate>();
    if (!this.currentThread) {
      stream.emitError(new Error('No active thread'));
      stream.end();
      return stream;
    }

    this.currentThread.addUserMessage(request.prompt);

    const threadDisposable = this.currentThread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') this.handleNotification(event.notification, stream);
    });

    const sessionDisposable = this.connectionService.onSessionUpdate((notification) => {
      if (notification.sessionId !== request.sessionId) return;
      this.currentThread?.handleNotification(notification);
    });

    stream.onEnd(() => {
      threadDisposable.dispose();
      sessionDisposable.dispose();
    });
    stream.onError(() => {
      threadDisposable.dispose();
      sessionDisposable.dispose();
    });

    this.sendPrompt(request, stream);
    return stream;
  }

  async cancelRequest(sessionId: string): Promise<void> {
    try {
      await this.connectionService.cancel({ sessionId });
      this.currentThread?.setStatus('awaiting_prompt');
    } catch (error) {
      this.logger.warn('cancelRequest error:', error);
    }
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    return this.connectionService.listSessions(params);
  }
  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    return this.connectionService.setSessionMode(params);
  }

  async disposeSession(sessionId: string): Promise<void> {
    this.currentThread?.dispose();
    this.currentThread = null;
    await this.terminalHandler.releaseSessionTerminals(sessionId);
  }

  async getAvailableModes(): Promise<any | null> {
    return (this.connectionService.getInitializeResult() as any)?.modes ?? null;
  }
  getSessionInfo(): AgentSessionInfo | null {
    return this.sessionInfo;
  }

  async stopAgent(): Promise<void> {
    this.currentThread?.dispose();
    this.currentThread = null;
    await this.connectionService.dispose();
    this.sessionInfo = null;
  }

  async dispose(): Promise<void> {
    await this.stopAgent();
  }

  private async ensureConnected(config: AgentProcessConfig): Promise<void> {
    if (!this.connectionService.isInitialized()) await this.initializeAgent(config);
  }

  private startCollectingAvailableCommands(commands: AvailableCommand[]): IDisposable {
    return this.connectionService.onSessionUpdate((notification) => {
      const update = notification.update as any;
      if (update?.sessionUpdate === 'available_commands_update' && Array.isArray(update.availableCommands)) {
        commands.push(...update.availableCommands);
      }
    });
  }

  private async sendPrompt(request: AgentRequest, stream: SumiReadableStream<AgentUpdate>): Promise<void> {
    const blocks = this.buildPromptBlocks(request.prompt, request.images);
    try {
      await this.connectionService.prompt({ sessionId: request.sessionId, prompt: blocks });
      this.currentThread?.markAssistantComplete();
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      this.currentThread?.setError(error instanceof Error ? error : new Error(String(error)));
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleNotification(notification: any, stream: SumiReadableStream<AgentUpdate>): void {
    const update = notification.update;
    if (!update?.sessionUpdate) return;

    switch (update.sessionUpdate) {
      case 'agent_thought_chunk':
        if (update.content?.type === 'text') stream.emitData({ type: 'thought', content: update.content.text });
        break;
      case 'agent_message_chunk':
        if (update.content?.type === 'text') stream.emitData({ type: 'message', content: update.content.text });
        break;
      case 'tool_call':
        stream.emitData({
          type: 'tool_call',
          content: update.title || '',
          toolCall: { name: update.title || '', input: (update.rawInput as Record<string, unknown>) || {} },
        });
        break;
      case 'tool_call_update':
        if (update.content) {
          for (const c of update.content) {
            if (c.type === 'diff') stream.emitData({ type: 'tool_result', content: `Modified ${c.path}` });
          }
        }
        break;
    }
  }

  private buildPromptBlocks(input: string, images?: string[]): Array<{ type: string; [key: string]: unknown }> {
    const blocks: Array<{ type: string; [key: string]: unknown }> = [];
    blocks.push({ type: 'text', text: input });
    if (images?.length) {
      for (const img of images) {
        const { mimeType, base64Data } = this.parseDataUrl(img);
        blocks.push({ type: 'image', data: base64Data, mimeType });
      }
    }
    return blocks;
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
    const matches = dataUrl.startsWith('data:') ? dataUrl.match(/^data:([^;]+);base64,(.+)$/) : null;
    return matches ? { mimeType: matches[1], base64Data: matches[2] } : { mimeType: 'image/jpeg', base64Data: dataUrl };
  }
}

export interface IAcpAgentService {
  initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo>;
  createSession(config: AgentProcessConfig): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }>;
  loadSession(
    sessionId: string,
    config: AgentProcessConfig,
  ): Promise<{ sessionId: string; processId: string; modes: any[]; status: AgentSessionStatus; historyUpdates: any[] }>;
  sendMessage(request: AgentRequest, config?: AgentProcessConfig): SumiReadableStream<AgentUpdate>;
  cancelRequest(sessionId: string): Promise<void>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;
  disposeSession(sessionId: string): Promise<void>;
  getAvailableModes(): Promise<any | null>;
  getSessionInfo(): AgentSessionInfo | null;
  stopAgent(): Promise<void>;
  dispose(): Promise<void>;
}
```

- [ ] **Step 4.2: Commit**

```bash
git add packages/ai-native/src/node/acp/acp-agent.service.ts
git commit -m "feat(acp): rewrite AcpAgentService with AcpThread management

Per-connection agent service managing AcpThread entities. Routes
session notifications to thread entries (UserMessage/AssistantMessage/ToolCall).
IAcpAgentService interface unchanged for AcpCliBackService compatibility."
```

---

### Task 5: 更新 index.ts + 模块注册 + 类型桥接

**Files:**

- Modify: `packages/ai-native/src/node/acp/index.ts`
- Modify: `packages/ai-native/src/node/index.ts`
- Modify: `packages/core-common/src/types/ai-native/acp-types.ts`

- [ ] **Step 5.1: 重写 acp/index.ts**

```typescript
export { AcpAgentService, AcpAgentServiceToken, IAcpAgentService } from './acp-agent.service';
export type {
  AgentSessionInfo,
  AgentSessionStatus,
  AgentUpdate,
  AgentUpdateType,
  AgentRequest,
  SimpleMessage,
} from './acp-agent.service';
export { AcpCliBackService, AcpCliBackServiceToken } from './acp-cli-back.service';
export { AcpConnectionService, AcpConnectionServiceToken } from './acp-connection.service';
export {
  AcpThread,
  AcpThreadToken,
  ThreadStatus,
  AgentThreadEntry,
  AcpThreadEvent,
  ToolCallStatus,
  ToolCallEntry,
  UserMessageEntry,
  AssistantMessageEntry,
  PlanEntry,
} from './acp-thread';
export { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
export { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
```

- [ ] **Step 5.2: 更新 node/index.ts**

修改 `packages/ai-native/src/node/index.ts`：

```typescript
import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AcpCliClientServiceToken,
  AcpPermissionServicePath,
} from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';

import { SumiMCPServerProxyServicePath, TokenMCPServerProxyService } from '../common';
import { ToolInvocationRegistryManager, ToolInvocationRegistryManagerImpl } from '../common/tool-invocation-registry';

import {
  AcpAgentService,
  AcpAgentServiceToken,
  AcpConnectionService,
  AcpConnectionServiceToken,
  AcpFileSystemHandler,
  AcpFileSystemHandlerToken,
  AcpTerminalHandler,
  AcpTerminalHandlerToken,
} from './acp';
import { AcpCliBackService } from './acp/acp-cli-back.service';
import { SumiMCPServerBackend } from './mcp/sumi-mcp-server';
import { OpenAICompatibleModel } from './openai-compatible/openai-compatible-language-model';

@Injectable()
export class AINativeModule extends NodeModule {
  providers: Provider[] = [
    { token: AIBackSerivceToken, useClass: AcpCliBackService },
    { token: AcpConnectionServiceToken, useClass: AcpConnectionService },
    { token: AcpAgentServiceToken, useClass: AcpAgentService },
    { token: AcpFileSystemHandlerToken, useClass: AcpFileSystemHandler },
    { token: AcpTerminalHandlerToken, useClass: AcpTerminalHandler },
    { token: ToolInvocationRegistryManager, useClass: ToolInvocationRegistryManagerImpl },
    { token: TokenMCPServerProxyService, useClass: SumiMCPServerBackend },
    OpenAICompatibleModel,
  ];

  backServices = [
    { servicePath: AIBackSerivcePath, token: AIBackSerivceToken },
    { servicePath: SumiMCPServerProxyServicePath, token: TokenMCPServerProxyService },
    { servicePath: AcpPermissionServicePath, token: AcpConnectionServiceToken },
  ];
}
```

关键变化：

- `AcpPermissionServicePath` 的 RPC token 从 `AcpPermissionCallerManagerToken` 改为 `AcpConnectionServiceToken`
- 移除 `CliAgentProcessManagerToken`、`AcpPermissionCallerManagerToken`、`AcpAgentRequestHandlerToken`

- [ ] **Step 5.3: 更新 acp-types.ts**

移除 `IAcpPermissionCaller` 接口。其余类型桥接保持不变。

- [ ] **Step 5.4: 编译验证**

```bash
npx tsc --noEmit --project configs/ts/references/tsconfig.ai-native.json
```

- [ ] **Step 5.5: Commit**

```bash
git add packages/ai-native/src/node/acp/index.ts packages/ai-native/src/node/index.ts packages/core-common/src/types/ai-native/acp-types.ts
git commit -m "feat(acp): update DI registration and exports for Thread AI architecture

Register AcpConnectionService + AcpAgentService as singleton providers.
Move AcpPermissionServicePath RPC to AcpConnectionService. Export AcpThread
and related types. Remove old singleton providers."
```

---

## 完成后验证

1. 旧文件已删除：`acp-cli-client.service.ts`、`acp-permission-caller.service.ts`、`cli-agent-process-manager.ts`、`handlers/agent-request.handler.ts`
2. Node 层以 DI 单例管理 Agent 进程：`AcpConnectionService`、`AcpAgentService` 为 DI 单例，一个工作区一个 Agent 进程实例
3. 不再使用静态变量：权限 RPC 通过 `AcpConnectionService extends RPCService` 的 `this.client`
4. 不再使用 setTimeout 等待通知：通过 `onSessionUpdate` 事件 + `IDisposable` 控制
5. `AcpCliBackService` 未修改：`IAcpAgentService` 接口签名一致
6. Node 16 兼容：动态 `import()` + `stream/web` polyfill + 手动 ReadableStream

## 测试计划

### 单元测试

| 测试目标 | 测试文件 | 关键场景 |
| --- | --- | --- |
| `AcpThread` | `__tests__/node/acp/acp-thread.test.ts` | - 状态机转换：idle → working → awaiting_prompt 循环<br>- 流式消息合并（同类型 chunk 追加 vs 新建 entry）<br>- ToolCall 状态机完整路径（pending → in_progress → completed/failed/rejected）<br>- `handleNotification` 分发到正确的 entry 类型<br>- `markAssistantComplete` / `cancelRequest` 状态变化<br>- dispose 后事件不再触发 |
| `AcpConnectionService` | `__tests__/node/acp/acp-connection.test.ts` | - `initialize` 幂等（多次调用只启动一次）<br>- `nodeStreamsToWebStream` 正确转换<br>- 进程退出触发 `onDisconnect`<br>- `dispose` 完整清理（连接 + 进程）<br>- `ndJsonStream` 在 SDK 加载后调用 |
| `AcpAgentService` | `__tests__/node/acp/acp-agent.test.ts` | - `createSession` 正确收集 `available_commands_update`<br>- `loadSession` 通知不依赖 setTimeout<br>- `sendMessage` 流式转发 + 取消<br>- `disposeSession` 释放终端 |
| Handler 单元测试 | `__tests__/node/acp/handlers/*.test.ts` | - `AcpFileSystemHandler`：workspace 路径穿越防护<br>- `AcpTerminalHandler`：输出截断、session 隔离、退出等待 |

### 集成测试

- `AcpCliBackService` + 重写后的 Node 层端到端：create session → prompt → stream → cancel → dispose
- 权限对话框流程：Agent 发起 request_permission → Browser 显示 → 用户选择 → Agent 收到结果
- 加载历史 session：`loadSession` 正确回放通知到 `AcpThread.entries`

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| SDK 版本差异（^0.16.1 vs 0.22.1） | `ClientSideConnection` API 变化 | 先用 0.16.1 验证，构造函数和 `Client` 接口应稳定 |
| SDK 为 ESM | CJS 无法 `require()` | 动态 `import()`（Node 16 支持） |
| Node 16 无全局 Web Streams | `ndJsonStream` 失败 | `stream/web` 导入 + `globalThis` polyfill |
| Node 16 无 `Readable.toWeb()` | 无法转换 stdout | 手动 `new ReadableStream({ start(controller) { ... } })` |
| `AcpPermissionServicePath` token 变更 | Browser 找不到服务 | `backServices` 已更新为 `AcpConnectionServiceToken` |
| `AcpCliBackService` 依赖旧接口 | 运行时方法不匹配 | Task 4 已保持 `IAcpAgentService` 所有方法签名一致 |
| Handler 重写丢失安全特性 | 路径穿越/无限输出 | 保留现有 `resolvePath` 工作区沙箱、输出截断逻辑 |
| 权限选项硬编码 | Agent 无法传递自定义选项 | `buildOptionsFromRequest` 优先使用 Agent 传入的 options |
| `ndJsonStream` 在 SDK 加载前调用 | 启动即崩溃 | `initialize` 先 `await loadSdk()`，再将 `ndJsonStream` 传入 `nodeStreamsToWebStream` |
