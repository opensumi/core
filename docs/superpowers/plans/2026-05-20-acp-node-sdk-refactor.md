# ACP Node 层重写 — Thread AI 架构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完全重写 Node 端 ACP 模块，以 `AcpThread` 为核心实体实现 Thread AI 架构。`AcpThread` 封装完整的 Agent 进程生命周期、SDK `ClientSideConnection`、以及有序的 `AgentThreadEntry` 列表。`AcpCliBackService` 保持 `IAIBackService` 接口签名不变，但内部实现需调整为依赖新的 ACP 组件。

**Architecture:** 浏览器通过单一 WebSocket 连接与 Node 通信（RPC）。根据 ACP 协议，`ClientSideConnection` 原生支持管理多个 Session（`newSession`/`loadSession`/`listSessions`），但每个 Agent 进程同一时间只能运行一个 Session。`AcpThread` 是唯一的 Thread AI 核心实体——每个 `AcpThread` 实例封装一个 `ClientSideConnection`（即一个 Agent 进程），同时维护该 Session 的对话状态（entries 有序列表）。`AcpPermissionRpcService`（singleton）封装统一的权限 RPC 通道，通过 `PermissionRoutingService` 将多 session 的权限请求路由到正确的 UI 上下文。Handler（文件、终端）为单例共享。

**关键概念：**

- **Thread** = 一个 `AcpThread` = 一个 `ClientSideConnection` = 一个 Agent 进程 + 一个 Session 的完整状态管理
- **本方案的 threads** = 多个 Agent SDK 实例的管理（每个 thread 对应一个 Agent 的当前运行 Session）
- **Thread Pool** = `AcpAgentService` 管理的线程池，固定上限（默认 10 个进程）。非活跃 thread 可被复用来加载历史 session，避免频繁创建/销毁进程

**Tech Stack:** TypeScript, `@agentclientprotocol/sdk` (ESM), `@opensumi/di`, Node.js 16.20.2, `stream/web`, `node-pty`, `zod ^3.25.0` (SDK peer dep, upgrade from ^3.23.8)

---

## 架构图

```
Browser 层 (ai-native) - 单一连接, 多 Session      Node 层 (ai-native)                       Agent 进程
┌──────────────────────────────────────────┐         ┌──────────────────────────────┐
│ Session A                                │         │                              │         ┌───────────────┐
│ AcpCliBackService                        │         │ AcpAgentService              │  SDK    │               │
│ (IAIBackService 实现)                     │──RPC───►│  - threads (Map<id, Thread>)  │────────►│  ClientSide   │
│  - @Autowired                            │         │                              │  per-t. │  Connection   │
│    AcpAgentService                       │         │ AcpThread (per session)      │  hread  │  (SDK)        │
│                                          │         │  - ClientSideConnection      │────────►│               │
├──────────────────────────────────────────┤         │  - entries[]                 │  stdio │  Agent CLI A  │
│ Session B                                │         │  - status                    │         │               │
│ AcpCliBackService                        │         │  - onEvent                   │         └───────────────┘
│                                          │         │  - 进程生命周期管理           │
│                                          │         │  - Client 接口实现(fs/term)   │         ┌───────────────┐
└──────────────────────────────────────────┘         │                              │  SDK    │               │
                                                     │ AcpThread (per session)      │────────►│  ClientSide   │
┌──────────────────────────────────────────┐         │  - ClientSideConnection      │         │  Connection   │
│ AcpPermissionRpcService                  │◄──RPC────│  - entries[]                 │         │  (SDK)        │
│ (Browser, singleton)                     │         │  - status                    │  stdio │               │
│  - 显示权限对话框                          │         │  - onEvent                   │────────►│  Agent CLI B  │
│                                          │         │  - 进程生命周期管理           │         │               │
└──────────────────────────────────────────┘         │  - Client 接口实现(fs/term)   │         └───────────────┘
                                                     ├──────────────────────────────┤
                                                     │ 单例共享 Handler              │
                                                     │ AcpFileSystemHandler          │
                                                     │ AcpTerminalHandler            │
                                                     └──────────────────────────────┘

关键点：
1. 单一浏览器连接，多 Session 共享同一 Node 层服务
2. AcpThread 是唯一核心实体（per-session），封装 ClientSideConnection + Agent 进程 + entries 状态
3. AcpPermissionRpcService 是 singleton，所有 session 共享同一权限 RPC 通道
4. AcpAgentService 是 singleton（在 providers），管理所有 AcpThread 实例 + 线程池
5. 每个 Thread 有独立的 ClientSideConnection 和 Agent 进程，崩溃隔离，互不影响
6. Handler（文件、终端）为单例共享，不持有连接状态
7. Thread Pool 默认上限 10 个进程，非活跃 thread 可复用以加载历史 session
```

## AcpThread 架构图

### 内部结构

```
┌─────────────────────────────────────────────────────────────────────┐
│ AcpThread                                                           │
│ sessionId: string                                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 进程生命周期（AcpThread 自行 spawn/kill）                     │    │
│ │                                                             │    │
│ │ initialize(config):                                         │    │
│ │   1. child_process.spawn(cliPath, args, { cwd, env })       │    │
│ │   2. 获取 stdout(stdin) → 手动封装 Web Stream               │    │
│ │   3. await loadSdk() → 获取 { ClientSideConnection,         │    │
│ │      ndJsonStream }                                         │    │
│ │   4. ndJsonStream(stdin, stdout) → Stream                   │    │
│ │   5. new ClientSideConnection(toClient, stream)             │    │
│ │   6. connection.initialize(params) → 等待初始化完成          │    │
│ │                                                             │    │
│ │ dispose():                                                  │    │
│ │   1. connection.cancel() → 取消 SDK 连接                    │    │
│ │   2. child.kill() → 终止 Agent 进程                         │    │
│ │   3. 清理 stream/controller，移除监听器                      │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ SDK 连接 + Client 实现                                       │    │
│ │                                                             │    │
│ │ connection: ClientSideConnection (SDK)                      │    │
│ │ initialized: boolean                                        │    │
│ │ needsReset: boolean   // 曾绑定过 session，复用前需 reset()  │    │
│ │                                                             │    │
│ │ toClient(agent) → Client 实现:                               │    │
│ │   requestPermission(params)                                 │    │
│ │     → 内部 emit('permission_request', params)               │    │
│ │     → AcpAgentService 订阅后委托给                          │    │
│ │       PermissionRoutingService → AcpPermissionCallerService  │    │
│ │                                                             │    │
│ │   sessionUpdate(notification)                               │    │
│ │     → handleNotification(notification)                      │    │
│ │     → 更新 entries → emit AcpThreadEvent                    │    │
│ │                                                             │    │
│ │   readTextFile/writeTextFile → AcpFileSystemHandler         │    │
│ │   createTerminal/terminalOutput/... → AcpTerminalHandler    │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ entries: AgentThreadEntry[]  (有序列表，按时间追加)                  │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [0] UserMessageEntry      { id, content, timestamp }           │   │
│ │ [1] AssistantMessageEntry { chunks: ContentBlock[], complete } │   │
│ │ [2] ToolCallEntry         { toolCall: ToolCall(SDK), status,   │   │
│ │                             result }                           │   │
│ │ [3] ToolCallEntry         { ... }                              │   │
│ │ [4] AssistantMessageEntry { ... }                              │   │
│ │ [5] UserMessageEntry      { ... }                              │   │
│ │ [6] Plan                  (SDK type, 完整替换)                  │   │
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
│ │                    Entry 类型 (SDK 类型 + 本地状态)           │    │
│ │                                                             │    │
│ │ UserMessageEntry      AssistantMessageEntry                 │    │
│ │ ┌─────────────────┐   ┌──────────────────────────────┐      │    │
│ │ │ id: string      │   │ chunks: ContentBlock[] (SDK)  │      │    │
│ │ │ content: string │   │ isComplete: boolean           │      │    │
│ │ │ timestamp: num  │   │ messageId?: string            │      │    │
│ │ └─────────────────┘   └──────────────────────────────┘      │    │
│ │                       ContentBlock (SDK 联合类型)             │    │
│ │                       ┌─────────────────────────────┐       │    │
│ │                       │ { type: 'text', text }       │       │    │
│ │                       │ { type: 'image', data }      │       │    │
│ │                       │ { type: 'resource_link' }    │       │    │
│ │                       │ { type: 'resource' }         │       │    │
│ │                       └─────────────────────────────┘       │    │
│ │                                                             │    │
│ │ ToolCallEntry                   Plan (SDK 类型)              │    │
│ │ ┌──────────────────────────┐   ┌─────────────────────────┐  │    │
│ │ │ toolCall: ToolCall (SDK) │   │ entries: [              │  │    │
│ │ │ status: ToolCallStatus   │   │   { content, completed }│  │    │
│ │ │ result?: unknown         │   │ ]                       │  │    │
│ │ └──────────────────────────┘   └─────────────────────────┘  │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 公开方法（原 AcpProcessManager 功能合并进来）                 │    │
│ │ initialize(config) → Promise<InitializeResponse>             │    │
│ │ newSession(params)   → Promise<NewSessionResponse>           │    │
│ │ loadSession(params)  → Promise<LoadSessionResponse>          │    │
│ │ loadSessionOrNew(params) → Promise<void>                     │    │
│ │   (复用 thread 时智能选择 newSession 或 loadSession)          │    │
│ │ prompt(params)       → Promise<PromptResponse>               │    │
│ │ cancel(params)       → Promise<void>                         │    │
│ │ listSessions()       → Promise<ListSessionsResponse>         │    │
│ │ reset()              → void (pool 复用前清空状态)             │    │
│ │ dispose()            → Promise<void>                         │    │
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
AcpAgentService                                    AcpThread
┌─────────────────────────────┐     ┌──────────────────────────────────────┐
│ createSession()             │──创建──►│ new AcpThread(sessionId)            │
│                             │        │  → initialize()                     │
│                             │        │  → newSession()                     │
│ sendMessage(req)            │        │                                     │
│  ├─ addUserMessage          │──追加──►│ entries.push(user)                  │
│  │                          │        │                                     │
│  ├─ onEvent 订阅            │◄──事件─ │ ←─ SDK notification                 │
│  │                          │        │                                     │
│  ├─ prompt()                │──调用─► │  → prompt()                         │
│  │                          │        │                                     │
│  └─ markAssistantComplete() │──手动─► │  isComplete = true                  │
│                             │        │  status = awaiting_prompt           │
│                             │        │                                     │
│ cancelRequest()             │──手动─► │  → cancel()                         │
│                             │        │  status = awaiting_prompt           │
│                             │        │                                     │
│ disposeSession()            │──销毁─► │  → dispose()                        │
└─────────────────────────────┘     └──────────────────────────────────────┘
```

**关键设计决策：**

- 单一浏览器连接，多 Session 并发运行，共享 Node 层服务
- `AcpThread` 是唯一核心实体（per-session），封装 `ClientSideConnection` + Agent 进程生命周期 + entries 状态管理。进程级崩溃隔离，一个 Thread 的崩溃不影响其他 Thread
- 权限 RPC 分层：Node 端 `AcpPermissionCallerService`（调用方，extends `RPCService`）→ RPC → Browser 端 `AcpPermissionRpcService`（实现方，实现 `IAcpPermissionService`）
- `PermissionRoutingService` 是 Node 端 singleton（在 providers），按 sessionId 路由权限请求到 `AcpPermissionCallerService`。多 session 并发请求互不阻塞
- `AcpThread` 的 `Client.requestPermission` 通过构造函数回调委托给外部路由逻辑，避免 `AcpThread` 直接依赖权限服务
- `AcpAgentService` 是 singleton（在 providers），采用 Thread Pool 管理 `AcpThread` 实例，默认上限 10 个进程
- Thread Pool 复用策略：非活跃 thread 可被 `loadSession` 复用来加载历史 session，避免频繁创建/销毁进程
- Handler（文件、终端）为单例共享，不持有连接状态
- `AcpCliBackService` 保持 `IAIBackService` 接口不变，内部实现调整为依赖新的 singleton `AcpAgentService`

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
├── acp-thread.ts                     # 核心实体：ClientSideConnection + 进程管理 + entries 状态
├── acp-permission-caller.service.ts  # 权限调用器（singleton，Node→Browser RPC 调用方）
├── acp-agent.service.ts              # Agent 业务层（singleton，管理所有 AcpThread 实例）
├── handlers/
│   ├── file-system.handler.ts        # 文件系统操作（单例共享）
│   └── terminal.handler.ts           # 终端管理（单例共享）
└── index.ts                          # 重写：导出

保留：
├── acp-cli-back.service.ts           # 接口不变，内部实现调整

Browser 侧保留并调整：
├── acp-permission-rpc.service.ts     # 权限 RPC 实现（Browser 端，实现 IAcpPermissionService）
└── permission-bridge.service.ts      # 权限对话框桥接（Browser 端，管理 UI 状态）
```

**关键设计：**

- `AcpThread`（per-session）：封装 `ClientSideConnection` + Agent 进程生命周期 + entries 状态管理，进程级崩溃隔离
- **权限 RPC 分层（Node 调用 → Browser 实现）：**
  - Node 端：`AcpPermissionCallerService`（singleton，调用方）—— 通过 `RPCService<IAcpPermissionService>.client` 调用 Browser 端 `$showPermissionDialog()`
  - Browser 端：`AcpPermissionRpcService`（singleton，实现方）—— 实现 `IAcpPermissionService`，接收 Node 调用后委托给 `AcpPermissionBridgeService`
  - `PermissionRoutingService`（singleton，在 Node 端 providers）：按 sessionId 路由权限请求，调用 `AcpPermissionCallerService`。多 session 并发请求互不阻塞

## 保留并调整的文件

```
└── acp-cli-back.service.ts           # 接口不变，内部实现调整（移除对已删除服务的依赖）
```

---

## Node.js 16.20.2 兼容策略

**1. 动态 `import()` 加载 ESM SDK** — `@agentclientprotocol/sdk` 声明 `"type": "module"`，CJS 环境无法 `require()`。通过 `async function loadSdk()` 缓存 `await import('@agentclientprotocol/sdk')` 结果，确保只加载一次。`ndJsonStream` 的调用必须在 `loadSdk()` resolve 之后。

**2. Web Streams polyfill** — Node 16 无全局 `ReadableStream` / `WritableStream`。从 `stream/web` 导入后挂载到 `globalThis`。

**3. 手动 Node Stream → Web Stream 转换** — Node 16 无 `Readable.toWeb()`。通过 `new ReadableStream({ start(controller) { stdout.on('data', ...); stdout.on('end', ...) } })` 手动封装。`stdin.write()` 返回 `boolean`，需用 `new Promise(resolve => stdin.write(chunk, () => resolve()))` 包装为 `Promise<void>`。

---

## 各组件接口定义

### Task 1: `AcpThread` — 线程状态模型

**职责：** 维护单个 Agent Session 的对话历史（entries 有序列表），接收 SDK `SessionNotification` 并更新 entries，通过事件通知上层。每个 `AcpThread` 对应一个 Agent 的当前运行 Session。

#### 类型定义

```typescript
export type ThreadStatus = 'idle' | 'working' | 'awaiting_prompt' | 'errored' | 'auth_required' | 'disconnected';

// SDK 原生 ToolCallStatus（仅 4 种）
import type { ToolCallStatus as SDKToolCallStatus } from '@agentclientprotocol/sdk';
// SDKToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

/** 本地扩展状态机 — 在 SDK 基础上增加等待确认、拒绝、取消等中间态 */
export type ToolCallStatus =
  | SDKToolCallStatus
  | 'waiting_for_confirmation' // 本地扩展：Agent 请求确认，等待用户操作
  | 'rejected' // 本地扩展：用户拒绝执行
  | 'canceled'; // 本地扩展：操作被取消
```

#### Entry 数据契约

**核心原则：** 内容结构直接使用 SDK 类型，仅添加本地追踪的聚合字段（`isComplete`、`status`、`timestamp`）。

```typescript
import type { ContentBlock, ToolCall, Plan } from '@agentclientprotocol/sdk';
// ToolCallStatus 使用本地扩展类型，见上文定义

/** 用户消息 — 纯本地类型，SDK 的 PromptRequest.prompt 是 ContentBlock[]，
    但用户输入通常只有 text，简化为 string 即可 */
export interface UserMessageEntry {
  id: string;
  content: string;
  timestamp: number;
}

/** 助手消息 — chunks 直接使用 SDK 的 ContentBlock，保留流式聚合语义 */
export interface AssistantMessageEntry {
  chunks: ContentBlock[]; // SDK 类型：TextContent | ImageContent | AudioContent | ResourceLink | EmbeddedResource
  isComplete: boolean;
  messageId?: string;
}

/** Tool Call — toolCall 字段直接使用 SDK 的 ToolCall，
    额外添加本地追踪的状态和执行结果 */
export interface ToolCallEntry {
  toolCall: ToolCall; // SDK 原始数据（toolCallId, name, arguments, content, locations, status）
  status: ToolCallStatus; // 本地状态机：pending → waiting_for_confirmation → in_progress → completed/failed
  result?: unknown; // 工具执行结果（来自 tool_call_update 的 content）
}

/** Plan — 直接用 SDK 的 Plan 类型，无需包装 */
// Plan = { entries: Array<{ content: string; completed: boolean }> }

export type AgentThreadEntry =
  | { type: 'user_message'; data: UserMessageEntry }
  | { type: 'assistant_message'; data: AssistantMessageEntry }
  | { type: 'tool_call'; data: ToolCallEntry }
  | { type: 'plan'; data: Plan };
```

#### 事件契约

```typescript
export type AcpThreadEvent =
  | { type: 'entry_added'; entry: AgentThreadEntry }
  | { type: 'entry_updated'; entry: AgentThreadEntry }
  | { type: 'status_changed'; status: ThreadStatus }
  | { type: 'session_notification'; notification: SessionNotification }
  | { type: 'error'; error: Error };
```

#### 公开接口

```typescript
export const AcpThreadToken = Symbol('AcpThreadToken');

export interface IAcpThread {
  readonly sessionId: string;
  readonly onEvent: Event<AcpThreadEvent>;
  readonly initialized: boolean;
  readonly needsReset: boolean;

  // === 进程生命周期（仅 AcpAgentService 调用）===
  initialize(config: AgentProcessConfig): Promise<InitializeResponse>;
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  loadSessionOrNew(params: LoadSessionOrNewRequest): Promise<void>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelRequest): Promise<void>;
  listSessions(): Promise<ListSessionsResponse>;

  // === 状态管理（内部 + 测试）===
  getEntries(): ReadonlyArray<AgentThreadEntry>;
  getStatus(): ThreadStatus;
  setStatus(status: ThreadStatus): void;
  setError(error: Error): void;
  handleNotification(notification: SessionNotification): void;

  // === 消息操作 ===
  addUserMessage(content: string): UserMessageEntry;
  markAssistantComplete(): void;

  // === ToolCall 交互 ===
  markToolCallWaiting(toolCallId: string): void;
  respondToToolCall(toolCallId: string, allowed: boolean): void;

  // === 生命周期 ===
  reset(): void;
  dispose(): Promise<void>;
}
```

#### 行为契约

| 方法 | 输入 | 行为 | 输出/副作用 |
| --- | --- | --- | --- |
| `handleNotification` | `SessionNotification` | 解析 `update.sessionUpdate` 分发到对应 handler | 修改 entries，fire `entry_added`/`entry_updated` |
| `addUserMessage` | `content: string` | 创建 `UserMessageEntry` 并追加到 entries | fire `entry_added`，返回 entry |
| `markAssistantComplete` | — | 将最后一条 assistant entry 标记 complete，status → `awaiting_prompt` | fire `entry_updated` + `status_changed` |
| `respondToToolCall` | `toolCallId, allowed` | 更新对应 tool call entry 的 status | fire `entry_updated` |
| `reset` | — | 清空 entries 列表，status → `idle`，释放 terminal 映射 | Thread 回到可复用状态 |
| `dispose` | — | 清理 EventEmitter 监听器 | 后续事件不再触发 |

#### 状态机

```
ThreadStatus:  idle → working → awaiting_prompt → (循环)
               idle → auth_required → working → awaiting_prompt → (循环)
               idle → errored (终态)
               idle → disconnected (终态)

ToolCallStatus:  pending ──► in_progress ──► completed
                 │              ├─► failed
                 ├─► waiting_for_confirmation ──► in_progress
                 │                               ├─► rejected
                 │                               └─► failed
                 └─► canceled
```

- [ ] **Step 1.1: 实现 acp-thread.ts（含 entries 状态 + 进程生命周期 + SDK ClientSideConnection + Client 接口）**
- [ ] **Step 1.2: 单元测试 — 状态机、消息合并、tool call 生命周期、进程初始化幂等、dispose 清理**
- [ ] **Step 1.3: 注册 AcpThreadFactory（useFactory 模式，在 providers 中）**
- [ ] **Step 1.4: Commit**

---

### Task 2: `AcpThreadFactory` — DI 工厂

**职责：** 通过 DI 容器自动注入 `AcpThread` 的所有依赖，返回 `(sessionId: string) => AcpThread` 工厂函数。`AcpAgentService` 调用工厂创建 Thread，无需手动传递依赖。

```typescript
export const AcpThreadFactoryToken = Symbol('AcpThreadFactoryToken');

export type AcpThreadFactory = (sessionId: string) => AcpThread;

// 在 providers 中注册：
{
  token: AcpThreadFactoryToken,
  useFactory: (fs, term, routing, logger) => {
    return (sessionId: string) =>
      new AcpThread(sessionId, {
        fileSystemHandler: fs,
        terminalHandler: term,
        onPermissionRequest: (params, sid) =>
          routing.routePermissionRequest(params, sid),
        logger,
      });
  },
  deps: [
    AcpFileSystemHandlerToken,
    AcpTerminalHandlerToken,
    PermissionRoutingServiceToken,
    ILogger,
  ],
}
```

**优势：**

- `AcpAgentService` 只需调用 `this.threadFactory(sessionId)`，无需知道 Thread 的内部依赖
- 依赖声明集中在工厂一处，新增依赖时只需改工厂和 deps 列表
- `sessionId` 作为运行时参数传入，DI 不管理 Thread 生命周期
- 测试时可直接替换 `AcpThreadFactoryToken` 为 mock factory

**行为契约：**

| 调用方            | 行为                                               |
| ----------------- | -------------------------------------------------- |
| `AcpAgentService` | 调用 `this.threadFactory(sessionId)` 创建新 Thread |
| 测试              | 注入 mock factory，返回 fake `IAcpThread`          |

---

### Task 3: Handler — 文件 + 终端操作

**职责：** 单例共享的底层操作能力，不持有连接状态、不依赖 `AcpPermissionRpcService`。

#### 3.1 `AcpFileSystemHandler` 接口

```typescript
export const AcpFileSystemHandlerToken = Symbol('AcpFileSystemHandlerToken');

export interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}
export interface ReadTextFileResponse {
  content?: string;
  error?: { message: string; code: number };
}
export interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}
export interface WriteTextFileResponse {
  error?: { message: string; code: number };
}

export interface IAcpFileSystemHandler {
  configure(options: { workspaceDir: string; maxFileSize?: number }): void;
  readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(req: WriteTextFileRequest): Promise<WriteTextFileResponse>;
}
```

**安全约束：**

- 必须注入 `IFileService` 执行实际文件操作，**不得直接使用原生 `fs` 读写**
- 必须实现 `resolvePath` 方法：用 `fs.realpathSync` 解析 symlink 防穿越，路径相对 `workspaceDir` 校验
- 读取前检查文件大小（默认 1MB 上限），过大则返回错误
- 写入前通过 `IFileService` 创建父目录（如不存在）

**行为契约：**

| 方法 | 安全校验 | 实际执行 | 错误返回 |
| --- | --- | --- | --- |
| `readTextFile` | `resolvePath` → 路径在 workspace 内 → 文件大小 ≤ limit | `IFileService.resolveContent()` | `ACPErrorCode.RESOURCE_NOT_FOUND` / `SERVER_ERROR` |
| `writeTextFile` | `resolvePath` → 路径在 workspace 内 | `IFileService.createFile()` 或 `setContent()` | `ACPErrorCode.SERVER_ERROR` |

**依赖：** `IFileService`, `ILogger`

- [ ] **Step 3.1: 实现 file-system.handler.ts**
- [ ] **Step 3.2: 单元测试 — 路径穿越防护、文件大小限制、读写正常流程**

#### 3.2 `AcpTerminalHandler` 接口

```typescript
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

export interface IAcpTerminalHandler {
  createTerminal(req: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  getTerminalOutput(
    terminalId: string,
    sessionId: string,
  ): Promise<{ output?: string; truncated?: boolean; exitStatus?: number; error?: { message: string } }>;
  waitForTerminalExit(
    terminalId: string,
    sessionId: string,
  ): Promise<{ exitCode?: number; signal?: string; error?: { message: string } }>;
  killTerminal(terminalId: string, sessionId: string): Promise<{} | { error: { message: string } }>;
  releaseTerminal(terminalId: string, sessionId: string): Promise<{} | { error: { message: string } }>;
  releaseSessionTerminals(sessionId: string): Promise<void>;
}
```

**行为契约：**

| 方法 | 行为 | 关键约束 |
| --- | --- | --- |
| `createTerminal` | `node-pty.spawn` 创建 PTY 实例，分配 terminalId | 输出 buffer 上限默认 1MB，超限时停止追加但不丢弃已积累数据 |
| `getTerminalOutput` | 返回当前 buffer 并清空 | 返回 `truncated: true` 如果 buffer 曾触及上限 |
| `waitForTerminalExit` | 等待 PTY 进程退出 | 内部用 `Promise` 封装 `onExit` 事件，不得轮询 |
| `killTerminal` | `pty.kill()` 终止进程 | — |
| `releaseTerminal` | 从 Map 移除 terminal 引用 | 不 kill 进程，仅释放跟踪 |
| `releaseSessionTerminals` | 批量 kill + 释放指定 session 的所有终端 | 用于 session 清理 |

**依赖：** `ILogger`, `node-pty`

- [ ] **Step 3.3: 实现 terminal.handler.ts**
- [ ] **Step 3.4: 单元测试 — 输出截断、session 隔离、退出等待**
- [ ] **Step 3.5: Commit**

---

### Task 4: 权限 RPC — Node 调用方 + Browser 实现方

**职责：** 权限请求从 Node 端 Agent 进程发出，经 `AcpPermissionCallerService`（Node 调用方）通过 RPC 传递到 `AcpPermissionRpcService`（Browser 实现方），最终由 `AcpPermissionBridgeService`（Browser）管理 UI 对话框。`PermissionRoutingService`（Node）负责按 sessionId 路由请求。

**权限调用全链路（5 层）：**

```
AcpThread (Node)
  │ Client.requestPermission(params)  ← SDK 回调，当 Agent 需要权限时触发
  │   → 内部 emit('permission_request', params, sessionId)
  ▼
PermissionRoutingService (Node, singleton)
  │ routePermissionRequest(params, sessionId)
  │   → 按 sessionId 路由到正确的 UI 上下文
  ▼
AcpPermissionCallerService (Node, singleton)
  │ extends RPCService<IAcpPermissionService>
  │ requestPermission(params) → this.client.$showPermissionDialog(params)
  ▼
          ──────── RPC (WebSocket) ────────
  ▼
AcpPermissionRpcService (Browser, singleton)
  │ implements IAcpPermissionService
  │ $showPermissionDialog(params) → AcpPermissionBridgeService
  ▼
AcpPermissionBridgeService (Browser)
    → 显示权限对话框，等待用户决策，返回结果
    → 结果沿 RPC 链路返回 → Promise resolve → AcpThread 继续执行
```

#### 4.1 `AcpPermissionCallerService` — Node 端调用方（Singleton）

**位置：** `packages/ai-native/src/node/acp/acp-permission-caller.service.ts` **注册：** 在 `providers` 中注册为 singleton，同时在 `backServices` 中注册 `AcpPermissionServicePath`。

```typescript
export const AcpPermissionCallerServiceToken = Symbol('AcpPermissionCallerServiceToken');

/**
 * Node 端权限调用方。继承 RPCService 以获取 this.client（Browser 端代理）。
 * 注意：IAcpPermissionService 定义的是 Browser 端暴露的方法（$showPermissionDialog 等），
 * 这里我们通过 this.client 调用它们。
 */
export class AcpPermissionCallerService extends RPCService<IAcpPermissionService> {
  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // SKIP_PERMISSION_CHECK 环境变量：自动允许（开发/测试用）
    if (process.env.SKIP_PERMISSION_CHECK === 'true') {
      return { outcome: 'allowAlways' };
    }
    return this.client.$showPermissionDialog(params);
  }
}
```

#### 4.2 `PermissionRoutingService` — Node 端路由（Singleton）

**位置：** `packages/ai-native/src/node/acp/permission-routing.service.ts` **注册：** 在 `providers` 中注册为 singleton。

```typescript
export const PermissionRoutingServiceToken = Symbol('PermissionRoutingServiceToken');

export interface IPermissionRoutingService {
  registerSession(sessionId: string): void;
  unregisterSession(sessionId: string): void;
  setActiveSession(sessionId: string): void;
  routePermissionRequest(params: RequestPermissionRequest, sessionId: string): Promise<RequestPermissionResponse>;
}
```

**路由策略：**

1. 验证 `sessionId` 在已注册 session 中 → 携带 sessionId 发起权限请求
2. 若无匹配，使用当前活跃 Session（`setActiveSession` 设置）的上下文
3. 若无活跃 Session，返回 `{ outcome: 'cancelled' }`

**并发保证：**

- `routePermissionRequest()` 每次调用独立执行 `this.permissionCallerService.requestPermission(params)`
- 不持有全局锁，多个请求可并发运行
- 每个 session 的结果独立返回，不会串线

#### 4.3 `AcpThread` 中 `Client.requestPermission` 实现

`AcpThread` 的 `Client` 实现中，`requestPermission` **不是直接调用** `PermissionRoutingService`，而是通过内部事件机制：

```typescript
// 在 AcpThread 的 Client 实现中：
async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
  // 1. 触发内部事件，携带 sessionId 和 params
  const result = await this.handlePermissionRequest(params, this.sessionId);
  return result;
}

// AcpThread 构造函数接收一个回调：
interface AcpThreadOptions {
  // 由 AcpAgentService 传入：将权限请求委托给 PermissionRoutingService
  onPermissionRequest: (params: RequestPermissionRequest, sessionId: string) => Promise<RequestPermissionResponse>;
}

// 内部：
private async handlePermissionRequest(params: RequestPermissionRequest, sessionId: string) {
  return this.options.onPermissionRequest(params, sessionId);
}
```

**为什么用回调而不是直接依赖注入？** `AcpThread` 不通过 DI 创建（手动 `new`），通过构造函数回调将路由逻辑注入，避免 `AcpThread` 直接依赖 `PermissionRoutingService` 或 `AcpPermissionCallerService`。

#### 4.4 Browser 端 `AcpPermissionRpcService` — 保留并调整

Browser 端 `AcpPermissionRpcService` 保留现有实现（`extends RPCService`，实现 `IAcpPermissionService`），仅需调整：

- 确保 `$showPermissionDialog()` 正确携带 `sessionId` 参数
- 支持多对话框并行显示（每个对话框通过 `sessionId` 标识归属）

#### 并发处理策略

多个 Session 同时发起权限请求时：

```
Session A: tool_call X needs permission ─┐
                                          ├─► AcpThread.requestPermission()
Session B: tool_call Y needs permission ─┘       │
                                                  ▼
                                         PermissionRoutingService (按 sessionId 路由)
                                                  │
                                                  ▼
                                         AcpPermissionCallerService (并发 RPC 调用)
                                                  │
                                                  ▼
                                    ───── RPC ─────
                                                  │
                                                  ▼
                                         AcpPermissionRpcService (Browser)
                                                  │
                                                  ▼
                                         AcpPermissionBridgeService
                                            → Session A 对话框（独立）
                                            → Session B 对话框（独立）
                                            → 用户分别确认/拒绝，互不影响
```

关键点：

- `requestPermission()` 是 `async` 方法，每个调用独立运行，互不阻塞
- Browser 端支持同时显示多个权限对话框（每个对话框携带 `sessionId` 标识）
- 用户操作后，结果通过各自的 Promise 返回给对应的 session

- [ ] **Step 4.1: 实现 acp-permission-caller.service.ts（Node 调用方，singleton）**
- [ ] **Step 4.2: 实现 permission-routing.service.ts（Node 路由，singleton，在 providers）**
- [ ] **Step 4.3: 确认 Browser 端 AcpPermissionRpcService 支持多对话框 + sessionId 标识**
- [ ] **Step 4.4: 单元测试 — Session 路由、活跃 Session 切换、并发权限请求互不阻塞、无 Session 时取消**
- [ ] **Step 4.5: Commit**

---

### Task 5: `AcpAgentService` — Agent 业务编排（Singleton）

**位置：** 在 `providers` 中注册（singleton），共享给所有 Session 的 `AcpCliBackService` 使用。

#### 公开接口（保持与 `AcpCliBackService` 兼容）

```typescript
export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

export type AgentSessionStatus = 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

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

export interface IAcpAgentService {
  initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo>;
  createSession(config: AgentProcessConfig): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }>;
  loadSession(
    sessionId: string,
    config: AgentProcessConfig,
  ): Promise<{
    sessionId: string;
    processId: string;
    modes: any[];
    status: AgentSessionStatus;
    historyUpdates: any[];
  }>;
  sendMessage(request: AgentRequest, config?: AgentProcessConfig): SumiReadableStream<AgentUpdate>;
  cancelRequest(sessionId: string): Promise<void>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;
  disposeSession(sessionId: string): Promise<void>;
  getAvailableModes(): Promise<any | null>;
  getSessionInfo(sessionId?: string): AgentSessionInfo | AgentSessionInfo[] | null;
  stopAgent(): Promise<void>;
  dispose(): Promise<void>;
}
```

#### 内部依赖与状态管理

`AcpAgentService` 采用 **Thread Pool** 模式管理 `AcpThread` 实例：

```typescript
// Session → Thread 映射（活跃会话的精确查找）
private sessions = new Map<string, AcpThread>();

// 线程池：所有 thread 实例（含活跃 + 非活跃/空闲）
private threadPool: AcpThread[] = [];

// 池上限（可配置）
private readonly maxPoolSize = 10;
```

**Thread 状态分类：**

| 状态          | 判定条件                                                             | 可被复用                     |
| ------------- | -------------------------------------------------------------------- | ---------------------------- |
| 活跃 (active) | `sessions.has(sessionId)` 且 `thread.getStatus() !== 'disconnected'` | 否                           |
| 空闲 (idle)   | `thread.getStatus() === 'idle'` 或 `'awaiting_prompt'`               | 是 — 通过 `loadSession` 切换 |
| 非活跃终端态  | `thread.getStatus() === 'errored'` 或 `'disconnected'`               | 是 — 通过 `dispose` 后重建   |
| 工作中        | `thread.getStatus() === 'working'`                                   | 否                           |

**查找/获取 Thread 的策略（核心流程）：**

```
用户请求 (sessionId)
  │
  ▼
① sessions.get(sessionId)  ──有──► 返回该 Thread
  │
  │无
  ▼
② threadPool 中找空闲 Thread ──有──► thread.loadSession({ sessionId, ... })
  │                                     sessions.set(sessionId, thread)
  │                                     返回该 Thread
  │
  │无
  ▼
③ threadPool.length < maxPoolSize  ──是──► 新建 Thread
  │                                         sessions.set(sessionId, thread)
  │                                         threadPool.push(thread)
  │                                         thread.initialize() + newSession/loadSession
  │                                         返回该 Thread
  │
  │否（池满，无非空闲 thread）
  ▼
④ 抛出错误：Thread pool is full, no idle thread available
```

创建 Thread 时，通过 DI 工厂：

```typescript
private createThread(sessionId: string): AcpThread {
  const thread = this.threadFactory(sessionId);
  this.threadPool.push(thread);
  return thread;
}
```

| 依赖                       | Token                           | 用途                                                |
| -------------------------- | ------------------------------- | --------------------------------------------------- |
| `AcpThreadFactory`         | `AcpThreadFactoryToken`         | 创建 Thread 实例（自动注入 fs/term/routing/logger） |
| `PermissionRoutingService` | `PermissionRoutingServiceToken` | AcpAgentService 持有，封装为回调传入工厂            |

#### 方法行为契约

| 方法 | 前置条件 | 行为 | 后置条件 |
| --- | --- | --- | --- |
| `initializeAgent` | — | 不再需要（每个 Thread 独立初始化），保留接口兼容性 | 无操作 |
| `createSession` | — | 优先复用空闲 Thread（`loadSession` 行为）；若无空闲且池未满，新建 Thread → `initialize()` → `newSession()`，**等待 `available_commands_update` 事件而非 setTimeout** | 返回 sessionId + availableCommands |
| `loadSession` | — | ① `sessions.get(sessionId)` 已有 → 直接返回<br>② 池中有空闲 Thread → `thread.loadSession({ sessionId })` → `sessions.set()`<br>③ 池未满 → 新建 Thread → `initialize()` → `loadSession()`<br>④ 池满且无空闲 → 抛错 | 返回 sessionId + historyUpdates |
| `sendMessage` | `sessions.get(sessionId)` 有 thread | 获取 Thread → `thread.addUserMessage(prompt)` → 订阅 thread.events → 调用 `thread.prompt()` | 返回 `SumiReadableStream<AgentUpdate>` |
| `cancelRequest` | `sessions.get(sessionId)` 有 thread | 获取 Thread → 调用 `thread.cancel()` | thread status → `awaiting_prompt` |
| `disposeSession` | — | 获取 Thread → `sessions.delete(sessionId)` → thread 进入空闲态，**不销毁进程** | Thread 回到 pool 中可被复用 |
| `forceDisposeSession` | — | 获取 Thread → `thread.dispose()` → 释放终端 → `sessions.delete()` → `threadPool` 中移除 | 彻底销毁 Thread |
| `stopAgent` | — | 遍历 `threadPool` → `thread.dispose()` → 释放终端 → 清空池 | `threadPool` 和 `sessions` 为空 |

#### Thread Pool 查找 + 创建

**核心逻辑 — `findOrCreateThread`：**

```typescript
async findOrCreateThread(sessionId: string, config: AgentProcessConfig): Promise<AcpThread> {
  // ① 活跃 session 映射中已有
  const existing = this.sessions.get(sessionId);
  if (existing && existing.getStatus() !== 'disconnected') {
    return existing;
  }

  // ② 池中有空闲 Thread（idle 或 awaiting_prompt，且无活跃 sessionId 绑定）
  const idleThread = this.threadPool.find(
    t => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus())
  );
  if (idleThread) {
    this.sessions.set(sessionId, idleThread);
    return idleThread;
  }

  // ③ 池未满，新建
  if (this.threadPool.length < this.maxPoolSize) {
    const thread = this.createThread(sessionId);
    this.sessions.set(sessionId, thread);
    return thread;
  }

  throw new Error(`Thread pool is full (${this.maxPoolSize}), no idle thread available`);
}

// 判断 thread 是否绑定了活跃 session
private hasActiveSession(thread: AcpThread): boolean {
  for (const [sid, t] of this.sessions) {
    if (t === thread) return true;
  }
  return false;
}
```

#### setTimeout 替换方案

**问题：** 当前 `createSession` 使用 `setTimeout(resolve, 2000)` 等待 `available_commands_update` 通知。

**解决方案：** 使用 `Event` + `Deferred` 模式：

```typescript
async createSession(config: AgentProcessConfig): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }> {
  const sessionId = crypto.randomUUID();
  const existingThread = this.threadPool.find(t => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()));
  const wasExisting = !!existingThread;
  const thread = await this.findOrCreateThread(sessionId, config);

  const availableCommands: AvailableCommand[] = [];
  const deferred = new Deferred<void>();

  // AcpThread 内部在 Client.sessionUpdate() 回调中触发 entry_added 事件，
  // 我们通过 AcpThread.onEvent 订阅 session_notification 来捕获 available_commands_update
  const sub = thread.onEvent((event: AcpThreadEvent) => {
    if (event.type === 'session_notification') {
      const update = event.notification.update as any;
      if (update?.sessionUpdate === 'available_commands_update') {
        availableCommands.push(...update.availableCommands);
        deferred.resolve();
      }
    }
  });

  try {
    // 区分：新建 vs 复用
    if (!thread.initialized) {
      await thread.initialize(config);
    }
    // 如果 thread 之前绑定过其他 session，先 reset() 清空状态，再 loadSession 恢复
    if (thread.needsReset) {
      thread.reset();
    }
    await thread.loadSessionOrNew({ sessionId, cwd: config.workspaceDir, mcpServers: [] });

    await Promise.race([
      deferred.promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Wait for commands timeout')), 5000))
    ]);

    return { sessionId, availableCommands };
  } catch (e) {
    this.sessions.delete(sessionId);
    // 新建失败时，thread 是刚创建的半成品，需从 pool 中移除并销毁，
    // 避免后续复用该 thread 时遇到残留状态。复用场景失败时仅需 reset 让 thread 回归空闲。
    if (!wasExisting) {
      const idx = this.threadPool.indexOf(thread);
      if (idx !== -1) this.threadPool.splice(idx, 1);
      await thread.dispose();
    } else {
      thread.reset();
    }
    throw e;
  } finally {
    sub.dispose();
  }
}
```

**关键点：**

- SDK `ClientSideConnection` **没有事件发射器**。session notifications 通过构造时传入的 `Client.sessionUpdate(params)` 回调接收
- `AcpThread` 内部在 `Client.sessionUpdate()` 中调用 `handleNotification()` 更新 entries，然后通过 `onEvent` 发射 `session_notification` 事件
- `AcpAgentService` 通过 `thread.onEvent` 订阅该事件来捕获 `available_commands_update`，**不是** `thread.onSessionUpdate()`
- 使用 `Deferred` 等待事件，而非 setTimeout 固定延迟
- 保留超时保护（5s），避免无限等待
- 事件触发后立即返回，减少延迟
- Thread 复用前必须先 `reset()` 清空 entries、释放 terminal 映射，再 `loadSession`

#### `sendMessage` 流式转发策略

```
1. this.sessions.get(sessionId) → 获取 Thread
2. thread.addUserMessage(prompt)
3. 订阅 thread.onEvent:
   - session_notification → emitData to stream
4. stream.onEnd / onError → 清理订阅
5. thread.prompt() → 完成后 markAssistantComplete → emitData('done') → stream.end()
```

#### `disposeSession` 语义

```
// 用户关闭/切换 session 时的默认行为
// Thread 不销毁，仅从 sessions 映射中移除 → 回到 pool 可被复用
this.sessions.delete(sessionId);

// 如果需要彻底清理（如用户退出、pool 收缩）：
await thread.dispose();
this.threadPool = this.threadPool.filter(t => t !== thread);
```

#### `handleNotification` 映射表

| SDK `sessionUpdate`                             | 映射为 `AgentUpdate`                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `agent_thought_chunk` (content.type === 'text') | `{ type: 'thought', content }`                                     |
| `agent_message_chunk` (content.type === 'text') | `{ type: 'message', content }`                                     |
| `tool_call`                                     | `{ type: 'tool_call', content: title, toolCall: { name, input } }` |
| `tool_call_update` (content with diff)          | `{ type: 'tool_result', content: "Modified {path}" }`              |

- [ ] **Step 5.1: 重写 acp-agent.service.ts（管理所有 AcpThread 实例）**
- [ ] **Step 5.2: 单元测试 — createSession 创建 Thread、sendMessage 流式转发、disposeSession 清理**
- [ ] **Step 5.3: Commit**

---

### Task 6: 模块注册 + 导出 + 类型桥接

#### 6.1 `acp/index.ts` 导出契约

```
export { AcpAgentService, AcpAgentServiceToken, IAcpAgentService }
export { AcpThreadFactory, AcpThreadFactoryToken }
export { AcpCliBackService, AcpCliBackServiceToken }
export { AcpPermissionCallerService, AcpPermissionCallerServiceToken }
export { PermissionRoutingService, PermissionRoutingServiceToken }
export { AcpThread, AcpThreadToken, ThreadStatus, AgentThreadEntry, AcpThreadEvent, ToolCallEntry, UserMessageEntry, AssistantMessageEntry }
export { AcpFileSystemHandler, AcpFileSystemHandlerToken }
export { AcpTerminalHandler, AcpTerminalHandlerToken }
export type { AgentSessionInfo, AgentSessionStatus, AgentUpdate, AgentUpdateType, AgentRequest, SimpleMessage }
```

#### 6.2 `AINativeModule` 注册变更

**当前 providers（旧）：**

- `AcpCliClientServiceToken`, `CliAgentProcessManagerToken`, `AcpPermissionCallerManagerToken`, `AcpAgentRequestHandlerToken`

**新 providers（Node 端 singleton + 工厂）：**

- `AcpAgentServiceToken`, `AcpThreadFactoryToken`, `PermissionRoutingServiceToken`, `AcpPermissionCallerServiceToken`, `AcpFileSystemHandlerToken`, `AcpTerminalHandlerToken`

**新 backServices（Node 端 RPC 暴露）：**

- `AcpPermissionServicePath` → `AcpPermissionCallerServiceToken`（通过 RPCService.client 调用 Browser 端）

> **Browser 端保持不变：** `AcpPermissionRpcService`（实现 `IAcpPermissionService`）和 `AcpPermissionBridgeService` 继续在 Browser 端 providers 中注册。

> **注意：** `AcpThread` 不通过 DI 注册。由 `AcpAgentService.createSession()` 手动 `new` 创建。

#### 6.3 `acp-types.ts` 变更

- 移除 `IAcpPermissionCaller` 接口（由 `AcpPermissionCallerService.requestPermission()` 替代）
- 添加 `IPermissionRoutingService` 接口
- 其余 SDK 类型桥接保持不变

- [ ] **Step 6.1: 重写 acp/index.ts**
- [ ] **Step 6.2: 更新 node/index.ts（AINativeModule providers + backServices）**
- [ ] **Step 6.3: 更新 acp-types.ts（移除 IAcpPermissionCaller，添加 IPermissionRoutingService）**
- [ ] **Step 6.4: 编译验证 `tsc --noEmit`**
- [ ] **Step 6.5: Commit**

---

### Task 7: `AcpCliBackService` — 内部实现调整

**职责：** 保持 `IAIBackService` 接口签名不变，调整内部实现以适配新的 ACP 组件体系。

**现状问题：**

- 当前依赖旧的 `AcpCliClientServiceToken`、`CliAgentProcessManagerToken`（将被删除）
- `IAcpAgentService` 方法签名保持兼容，但依赖注入需要调整

#### 需要调整的内容

**1. 依赖注入变更**

```diff
 @Autowired(AcpAgentServiceToken)
- private agentService: IAcpAgentService;    // 旧实现（通过旧链依赖 AcpCliClientService）
+ private agentService: IAcpAgentService;    // 新实现（通过 AcpThread + SDK）
```

- `@Autowired(AcpCliClientServiceToken)` 和 `@Autowired(CliAgentProcessManagerToken)` 需移除（如果存在）
- 仅保留 `AcpAgentServiceToken` 的依赖（新 `AcpAgentService` 内部封装了所有底层逻辑）

**2. `requestStream()` 方法**

当前 `requestStream()` 通过 `options.agentSessionConfig` 判断走 ACP 还是 OpenAI fallback。新实现保持此逻辑不变：

- 有 `agentSessionConfig` → 调用 `agentRequestStream()` → 委托给新的 `IAcpAgentService.sendMessage()`
- 无 `agentSessionConfig` → 调用 `openAIRequestStream()` → 委托给 `OpenAICompatibleModel`（保持不变）

**3. `convertAgentUpdateToChatProgress()` 映射**

保持现有映射逻辑不变：

- `'thought'` → `{ kind: 'reasoning', content }`
- `'message'` → `{ kind: 'content', content }`
- `'tool_call'` → `null`（过滤掉）
- `'tool_result'` → `{ kind: 'content', content }`
- `'done'` → `null`（流结束信号）

**4. 新增方法（如需）**

- `disposeSession()`、`cancelSession()` 保持原有方法签名，内部委托给新的 `IAcpAgentService`
- `loadAgentSession()` 历史转换逻辑保持不变

- [ ] **Step 7.1: 调整 acp-cli-back.service.ts 依赖注入（移除对已删除服务的引用）**
- [ ] **Step 7.2: 验证 requestStream / createSession / loadAgentSession 方法调用链兼容**
- [ ] **Step 7.3: 编译验证 `tsc --noEmit`**
- [ ] **Step 7.4: Commit**

---

## 完成后验证

1. 旧文件已删除：`acp-cli-client.service.ts`、`acp-permission-caller.service.ts`（旧实现）、`cli-agent-process-manager.ts`、`handlers/agent-request.handler.ts`
2. `AcpThread` 是唯一核心实体（per-session），封装 `ClientSideConnection` + Agent 进程生命周期 + entries 状态
3. 权限调用链路正确：`AcpThread.Client.requestPermission` → 内部事件 → `PermissionRoutingService` → `AcpPermissionCallerService` → RPC → `AcpPermissionRpcService`（Browser）→ `AcpPermissionBridgeService` → UI 对话框
4. 权限请求路由正确：`PermissionRoutingService` 按 sessionId 路由 + 活跃 Session fallback，多 session 并发请求互不阻塞
5. `AcpPermissionServicePath` backService 绑定到新的 `AcpPermissionCallerServiceToken`
6. 不再使用 setTimeout 等待通知：通过 `AcpThread.onEvent`（`session_notification` 事件类型）+ `Deferred` 模式，保留超时保护
7. `AcpCliBackService` 接口签名不变：内部实现已调整为新的 ACP 组件依赖，`IAIBackService` 方法行为保持
8. Node 16 兼容：动态 `import()` + `stream/web` polyfill + 手动 ReadableStream
9. 文件系统安全：`AcpFileSystemHandler` 使用 `IFileService` + `resolvePath` 沙箱校验
10. 每个 Thread 有独立的 Agent 进程和 SDK 连接，崩溃隔离，互不影响
11. Thread Pool 默认上限 10 个进程，非活跃 thread 通过 `loadSession` 复用来加载历史 session，避免频繁创建/销毁进程
12. `disposeSession` 仅从 sessions 映射解绑，Thread 回到 pool 可复用；彻底销毁需调用 `forceDisposeSession`
13. Thread 复用前必须先调用 `reset()` 清空 entries、释放 terminal 映射

## 测试计划

### 单元测试

| 测试目标 | 测试文件 | 关键场景 |
| --- | --- | --- |
| `AcpThread` | `__tests__/node/acp/acp-thread.test.ts` | - 状态机转换：idle → working → awaiting_prompt 循环<br>- 流式消息合并（同类型 chunk 追加 vs 新建 entry）<br>- ToolCall 状态机完整路径<br>- `handleNotification` 分发到正确的 entry 类型<br>- `markAssistantComplete` / `cancelRequest` 状态变化<br>- `reset` 后 entries 清空、status → idle<br>- dispose 后事件不再触发<br>- **进程生命周期**：`initialize` 幂等、stream 转换、进程退出触发 `onDisconnect`、`dispose` 完整清理、`ndJsonStream` 在 SDK 加载后调用 |
| `PermissionRoutingService` | `__tests__/node/acp/permission-routing.test.ts` | - Session 注册/注销<br>- 路由到持有 session 的连接<br>- 路由到活跃 Session（fallback）<br>- 无 Session 时返回 cancelled<br>- **并发权限请求互不阻塞** |
| `AcpAgentService` | `__tests__/node/acp/acp-agent.test.ts` | - `createSession` 创建 Thread 实例<br>- `loadSession` 通知不依赖 setTimeout<br>- `sendMessage` 流式转发 + 取消（多 session 并发）<br>- **Thread Pool**：池满时拒绝新建、空闲 Thread 被复用加载历史 session、`disposeSession` 仅解绑不销毁<br>- **多 Thread 隔离**：同时创建 2+ Thread，各自独立进程，互不影响 |
| Handler 单元测试 | `__tests__/node/acp/handlers/*.test.ts` | - `AcpFileSystemHandler`：workspace 路径穿越防护<br>- `AcpTerminalHandler`：输出截断、session 隔离、退出等待 |

### 集成测试

- `AcpCliBackService` + 重写后的 Node 层端到端：create session → prompt → stream → cancel → dispose
- 权限对话框流程：Agent 发起 request_permission → `PermissionRoutingService` 路由 → Browser 显示 → 用户选择 → Agent 收到结果
- 多 Thread 并发：Thread A 和 Thread B 同时运行，各自独立 Agent 进程，权限请求路由到对应 session
- Thread 崩溃隔离：杀掉 Thread A 的 Agent 进程，Thread B 不受影响
- 加载历史 session：`loadSession` 正确回放通知到 `AcpThread.entries`
- **Thread Pool 复用**：创建 10 个 session 填满 pool → dispose 其中一个 → 创建第 11 个 session 复用空闲 Thread → 验证进程数仍为 10
- **Thread Pool 满拒绝**：创建 10 个活跃 session → 尝试创建第 11 个（无空闲 thread）→ 抛错

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| SDK 版本差异（^0.16.1 vs 0.22.1） | `ClientSideConnection` API 变化 | 先用 0.16.1 验证，构造函数和 `Client` 接口应稳定 |
| SDK 为 ESM | CJS 无法 `require()` | 动态 `import()`（Node 16 支持） |
| Node 16 无全局 Web Streams | `ndJsonStream` 失败 | `stream/web` 导入 + `globalThis` polyfill |
| Node 16 无 `Readable.toWeb()` | 无法转换 stdout | 手动 `new ReadableStream({ start })` |
| **zod peer dependency 冲突** | SDK 要求 `zod ^3.25.0+`，项目当前 `^3.23.8` | 在 ai-native/package.json 中将 zod 升级到 `^3.25.0` |
| `AcpPermissionServicePath` token 变更 | backService 未绑定到新调用方 | `backServices` 中 `AcpPermissionServicePath` 绑定到新的 `AcpPermissionCallerServiceToken` |
| `AcpCliBackService` 依赖旧服务 | 运行时找不到已删除的 provider | 移除对 `AcpCliClientServiceToken` / `CliAgentProcessManagerToken` 的依赖，仅保留 `AcpAgentServiceToken` |
| Handler 重写丢失安全特性 | 路径穿越/无限输出 | `AcpFileSystemHandler` 使用 `IFileService` + `resolvePath` 沙箱 + 文件大小限制 |
| 权限选项硬编码 | Agent 无法传递自定义选项 | `buildOptionsFromRequest` 优先使用 Agent 传入的 options |
| `ndJsonStream` 在 SDK 加载前调用 | 启动即崩溃 | `initialize` 先 `await loadSdk()` 再创建 stream |
| **权限请求路由失败** | 多 Session 场景下权限对话框显示在错误的上下文 | `PermissionRoutingService` 按 sessionId 路由 + 活跃 Session fallback + 无 Session 时返回 cancelled。多个权限请求并发运行，互不阻塞 |
| **Thread 崩溃影响其他 Thread** | 一个 Thread 的 Agent 进程崩溃导致其他 Thread 不可用 | 每个 Thread 有独立的 Agent 进程和 SDK 连接，崩溃隔离，互不影响 |
| **Session 结束时未清理进程** | orphan Agent 进程占用系统资源 | `AcpAgentService.disposeSession(sessionId)` 从 sessions 映射中解绑，Thread 回到 pool 可复用；pool 收缩时彻底 dispose |
| **并发权限对话框 UI 冲突** | Browser 端同时显示多个权限对话框时相互遮挡 | Browser 端 `AcpPermissionBridgeService` 通过 `activeDialogs` Map 管理多对话框，每个对话框携带 `sessionId` 标识，UI 层负责并行渲染 |
| **Thread Pool 泄漏** | `disposeSession` 仅解绑不 dispose，空闲 thread 残留占位 | pool 满时优先复用空闲 Thread；pool 定期清理长期空闲的进程；`stopAgent` 彻底清空 pool |
| **复用 Thread 时状态残留** | 复用空闲 Thread 加载新 session 时，残留旧 session entries 或 terminal | `thread.loadSession()` 前必须调用 `thread.reset()` 清空 entries、释放 terminal 映射 |
