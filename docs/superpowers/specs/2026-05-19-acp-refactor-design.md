# ACP 模块重构设计文档

**日期**: 2026-05-19 **状态**: 草稿 **分支**: feat/acp-v2

---

## 1. 背景

OpenSumi 的 ACP（Agent Client Protocol）模块当前嵌入在 `@opensumi/ide-ai-native` 包中。经过探索发现以下架构问题，需要在长期开发前彻底重构。

## 2. 当前问题

### 2.1 Node 层缓存了过多业务状态

| 位置                                            | 状态                     | 应归属  |
| ----------------------------------------------- | ------------------------ | ------- |
| `AcpAgentService.sessionInfo`                   | sessionId, modes, status | Browser |
| `AcpAgentService.currentNotificationHandler`    | 流式通知订阅             | Browser |
| `AcpCliClientService.negotiatedProtocolVersion` | 协议版本协商结果         | Browser |
| `AcpCliClientService.agentCapabilities`         | Agent 能力               | Browser |
| `AcpCliClientService.agentInfo`                 | Agent 信息               | Browser |
| `AcpCliClientService.authMethods`               | 认证方法                 | Browser |
| `AcpCliClientService.sessionModes`              | Session 模式状态         | Browser |

### 2.2 跨层共享 hack

- `AcpPermissionCallerManager.currentRpcClient` 使用 **静态变量** 在所有连接间共享，需要 `setConnectionClientId` + `Promise.resolve()` 延迟赋值的 workaround
- `AcpCliClientService` 的 `handleIncomingRequest` 硬编码了所有请求方法的路由

### 2.3 通知收集靠超时等待

- `createSession` 用 `setTimeout(2000)` 等待 `availableCommands` 通知到达
- `loadSession` 用 `setTimeout(500)` 等待历史通知
- 这些延迟通知本应由 Browser 层直接订阅

### 2.4 `AcpCliBackService` 职责过重

- 实现 `IAIBackService` 接口
- 管理 agent 初始化、session 创建/加载
- 流式数据转换（AgentUpdate → IChatProgress）
- session 列表、模式切换这些应该分别归属：Node 只负责消息透传，Browser 负责业务逻辑

### 2.5 缺乏清晰边界

当前所有 ACP 代码都在 `ai-native/src/{browser,node}/acp/` 下，与 AI Native 的其他功能（inline chat, code completion, MCP）混在一起。 ACP 是一个独立的协议适配器，应独立成包。

## 3. 重构目标

**核心原则：Node 层专注进程生命周期 + 消息透传，Browser 层负责业务状态管理**

1. **独立包** — `@opensumi/ide-acp` 包，清晰的依赖边界
2. **Node 层无业务状态** — 只维护进程句柄、传输连接、请求队列
3. **Browser 层集中状态** — Session、Negotiation、Permission 状态统一管理
4. **事件驱动** — Node 通过事件将消息/状态变化推送给 Browser，不再用 setTimeout 收集
5. **消除静态变量 hack** — 通过 DI 实例管理连接

## 4. 新架构

### 4.1 包职责边界

```
@opensumi/ide-acp          ← ACP 协议层（新包）
├── Node: 进程生命周期、JSON-RPC 传输、消息路由、权限调用
├── Browser: Session 状态管理、协议协商缓存、权限对话框状态
└── Common: DI tokens、事件类型

@opensumi/ide-ai-native    ← AI 应用层（原有包）
├── Chat UI 组件（AcpChatView, AcpChatInput, permission dialog UI 等）
├── AcpChatAgent（IChatAgent 实现）
├── ACPSessionProvider（ISessionProvider 实现，调用 ide-acp）
├── AcpChatManagerService / AcpChatInternalService / AcpChatProxyService
└── DefaultACPConfigProvider
```

### 4.2 包结构

```
packages/ide-acp/
├── src/
│   ├── common/              # 共享类型和 token
│   │   └── index.ts
│   ├── node/                # Node 层（进程 + 传输 + 路由）
│   │   ├── index.ts
│   │   ├── process-manager.ts      # 进程生命周期
│   │   ├── client-service.ts       # 封装 ClientSideConnection（SDK）+ Client 实现
│   │   ├── agent-service.ts        # Session RPC（无业务状态），委托 ClientService
│   │   ├── request-handler.ts      # Agent → Client 请求路由（实现 Client 接口）
│   │   ├── handlers/               # 具体处理器
│   │   │   ├── file-system.handler.ts
│   │   │   └── terminal.handler.ts
│   │   ├── permission-caller.ts    # 权限请求调用方
│   │   └── acp-node.module.ts      # Node 模块注册
│   └── browser/             # Browser 层（业务状态，无 UI）
│       ├── index.ts
│       ├── session-manager.ts      # Session 状态管理
│       ├── negotiation-state.ts    # 协议协商结果缓存
│       ├── permission-bridge.ts    # 权限对话框状态（非 UI）
│       └── acp-browser.module.ts   # Browser 模块注册
```

**不在 ide-acp 中的内容（保留在 ai-native）：**

- 聊天 UI 组件（AcpChatView, AcpChatInput, AcpChatHeader 等）
- 权限对话框 UI（PermissionDialog, PermissionDialogContainer）
- AcpChatAgent / ACPSessionProvider
- AcpChatManagerService / AcpChatInternalService / AcpChatProxyService
- AcpChatMentionInput / ChatReply / MentionInput 等渲染组件

### 4.3 数据流

```
Browser 层                          Node 层                         Agent 进程
┌─────────────────┐          ┌─────────────────┐          ┌───────────────┐
│ SessionManager  │◄────────►│ AgentService    │◄────────►│               │
│  - sessions     │  事件     │  (无业务状态)    │  stdio   │  Agent CLI    │
│  - activeMode   │◄────────►│                 │          │               │
│                 │          │                 │          │               │
│ NegotiationState│◄────────►│ ClientService   │◄────────►│               │
│  - capabilities │  事件     │  (传输层)        │  JSON-RPC│               │
│  - modes        │          │                 │          │               │
│                 │          │                 │          │               │
│ PermissionBridge│◄────────►│ PermissionCaller│◄────────►│               │
│  - dialogs      │  RPC     │  (调用方)        │          │               │
└─────────────────┘          └─────────────────┘          └───────────────┘
```

**与当前架构的关键区别：**

- `SessionManager`（ide-acp/Browser）管理 session 状态，ACPSessionProvider（ai-native）调用它
- `NegotiationState`（ide-acp/Browser）订阅 Node 事件缓存协商结果
- `ClientService`（ide-acp/Node）不再手动实现 JSON-RPC 传输，而是封装 `@agentclientprotocol/sdk` 的 `ClientSideConnection`
- `ClientSideConnection` 已经实现了完整的 JSON-RPC 2.0 协议（请求队列、响应匹配、错误处理、连接状态）
- Node 只需实现 `Client` 接口来处理 Agent 发来的请求（fs、terminal、permission）
- **ide-acp 的 Browser 层不包含任何 UI 组件**，仅提供状态服务供 ai-native 消费

### 4.3 各层职责定义

#### Node: `ProcessManager`

- spawn / stop / kill agent 进程
- 检查进程状态、退出码
- **不持有** session、config 等业务状态

#### Node: `ClientService`（封装 `@agentclientprotocol/sdk` 的 `ClientSideConnection`）

- 通过 `ProcessManager` 获取 stdout/stdin，用 `ndJsonStream` 创建 `Stream`
- 实现 `Client` 接口：`requestPermission`、`sessionUpdate`、`readTextFile`、`writeTextFile`、`createTerminal`、`terminalOutput`、`waitForTerminalExit`、`killTerminal`、`releaseTerminal`
- 将 `Client` 接口的具体实现委托给 `RequestHandler`（fs handler、terminal handler、permission caller）
- 通过 `ClientSideConnection` 暴露的 `Agent` 接口提供：`initialize`、`newSession`、`loadSession`、`prompt`、`cancel`、`listSessions`、`setSessionMode`、`closeSession`、`authenticate` 等
- 发出事件：`onInitialize`（来自 initialize 响应）、`onDisconnect`（来自 `connection.closed`）、`onSessionUpdate`（来自 `sessionUpdate` 回调）
- **不再缓存** protocolVersion、capabilities、authMethods、sessionModes — 这些数据通过事件发出，由 Browser 层缓存

#### Node: `AgentService`

- 提供 RPC 接口：`startAgent`、`stopAgent`、`createSession`、`loadSession`、`prompt`、`cancel`、`listSessions`、`setSessionMode`、`disposeSession`
- 内部持有 `ClientService`，将所有 session 操作委托给 `ClientService` 的 `Agent` 接口
- 将 `ClientService` 的事件转发给 Browser
- **不再持有** sessionInfo、notificationHandler 等业务状态

#### Node: `RequestHandler`（实现 `Client` 接口的具体逻辑）

- 接收 `ClientService` 转发的 Agent 请求（fs/read_text_file、terminal/create、session/request_permission 等）
- 调用对应的 handler（FileSystemHandler、TerminalHandler、PermissionCaller）
- 返回结果给 `ClientService`，由其通过 `ClientSideConnection` 的内部 `Connection` 自动回复 Agent

#### Node: `PermissionCaller`

- 接收权限请求，通过 RPC 通知 Browser 层
- 等待 Browser 层返回用户决策
- **不再使用静态变量** `currentRpcClient`，改为 DI 实例管理

#### Browser: `SessionManager`

- 管理 session 列表、当前活跃 session
- 通过 RPC 调用 `AgentService` 创建/加载/切换 session
- 订阅 `ClientService` 的 `onSessionUpdate` 事件更新 UI 状态
- 维护 `availableCommands`、`currentMode` 等业务状态

#### Browser: `NegotiationState`

- 订阅 `ClientService.onInitialize` 事件存储 capabilities、authMethods、protocolVersion
  - 注：Node 的 `ClientService` 在 `initialize()` 成功后通过事件回调通知 Browser
- 订阅 `ClientService.onSessionUpdate` 更新 sessionModes
  - 注：通过 `ClientSideConnection` 的 `Client.sessionUpdate` 回调传递

#### Browser: `PermissionBridge`（ide-acp）

- 管理权限请求的状态流（替代当前 `AcpPermissionBridgeService` 的非 UI 部分）
- 通过 `PermissionCaller`（Node）接收请求、触发事件、返回决策
- 消除 `currentRpcClient` 静态变量，改为通过 DI 实例获取连接
- **不负责 UI 渲染**，仅发出 `onDidRequestPermission` 事件，由 ai-native 的 `PermissionDialogManager` 监听并显示对话框

#### Browser: `ai-native` 保留部分

- `ACPSessionProvider` — 实现 `ISessionProvider` 接口，内部调用 `ide-acp` 的 `SessionManager`
- `AcpChatAgent` — 实现 `IChatAgent` 接口，通过 `ACPSessionProvider` 获取 session 信息
- `AcpChatManagerService` / `AcpChatInternalService` — 聊天会话管理，消费 `ide-acp` 的状态事件
- `AcpPermissionBridgeService` / `PermissionDialogManager` / `PermissionDialog` — 权限对话框 UI

## 5. 接口定义（草案）

### 5.1 使用 `@agentclientprotocol/sdk`

SDK 提供了完整的 JSON-RPC 2.0 实现，我们直接使用：

```typescript
// Node 层核心用法
import { ClientSideConnection, Client, ndJsonStream } from '@agentclientprotocol/sdk';

// 1. ProcessManager spawn 进程后，用 ndJsonStream 包装 stdio
const stream = ndJsonStream(
  new WritableStream<Uint8Array>({ ... }),  // stdin
  new ReadableStream<Uint8Array>({ ... }),  // stdout
);

// 2. 创建 Client 实现，处理 Agent 发来的请求
const clientImpl: Client = {
  requestPermission: (params) => permissionCaller.request(params),
  sessionUpdate: (params) => eventEmitter.emit('sessionUpdate', params),
  readTextFile: (params) => fileSystemHandler.readTextFile(params),
  writeTextFile: (params) => fileSystemHandler.writeTextFile(params),
  createTerminal: (params) => terminalHandler.createTerminal(params),
  terminalOutput: (params) => terminalHandler.terminalOutput(params),
  waitForTerminalExit: (params) => terminalHandler.waitForTerminalExit(params),
  killTerminal: (params) => terminalHandler.killTerminal(params),
  releaseTerminal: (params) => terminalHandler.releaseTerminal(params),
};

// 3. 创建连接，SDK 返回的 ClientSideConnection 实现 Agent 接口
const connection = new ClientSideConnection(() => clientImpl, stream);

// 4. 直接调用 SDK 暴露的 Agent 方法
await connection.initialize({ protocolVersion: 1, clientCapabilities: {...}, clientInfo: {...} });
const session = await connection.newSession({ cwd: '/path', mcpServers: [] });
await connection.prompt({ sessionId: session.sessionId, prompt: [...] });
```

SDK 已经处理了：

- JSON-RPC 2.0 请求/响应匹配
- 请求队列（按顺序发送）
- 连接状态管理（`signal`、`closed`）
- NDJSON 解析（`ndJsonStream`）
- 错误处理（`RequestError`）
- 类型验证（Zod schema）
- 所有 ACP 协议方法（包括 unstable 方法）

### 5.2 Node → Browser 事件

```typescript
// Node 层发出的事件
interface AcpEvents {
  'agent/initialized': {
    protocolVersion: number;
    capabilities: AgentCapabilities;
    agentInfo: Implementation;
    authMethods: AuthMethod[];
    modes: SessionModeState;
  };
  'agent/disconnected': { reason: string };
  'session/notification': SessionNotification;
  'session/created': { sessionId: string; modes: SessionMode[] };
}
```

### 5.3 Browser → Node RPC

```typescript
interface AgentServiceRPC {
  // 进程
  startAgent(config: AgentProcessConfig): Promise<{ processId: string }>;
  stopAgent(): Promise<void>;

  // 传输（内部使用 ClientSideConnection）
  initialize(): Promise<void>;

  // Session（委托给 ClientSideConnection 的 Agent 接口）
  createSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;
  setSessionMode(params: SetSessionModeRequest): Promise<void>;
  disposeSession(sessionId: string): Promise<void>;
}
```

## 6. 迁移策略

### Phase 1: 创建独立包

- 搭建 `@opensumi/ide-acp` 包结构
- 迁移类型定义（common 层）
- 实现 Node 层（无业务状态版本）
- 实现 Browser 层（状态管理版本）
- 编写模块注册代码

### Phase 2: 集成与替换

- 在 `ai-native` 模块中依赖 `@opensumi/ide-acp`
- 将 `ai-native/src/node/acp/` 的旧代码替换为新包的 Node 模块
- `ACPSessionProvider` 改为调用 `ide-acp` 的 `SessionManager`
- 权限对话框 UI 保留在 `ai-native`，状态管理迁移到 `ide-acp`
- 逐步删除 `ai-native/src/{browser,node}/acp/` 下的旧代码

### Phase 3: 清理

- 删除旧 ACP 代码
- 更新 `core-common` 中的 ACP 类型引用指向新包
- 更新集成文档

## 7. 依赖关系

新包 `@opensumi/ide-acp` 的依赖：

**runtime:**

- `@agentclientprotocol/sdk` — ACP 协议 SDK（`ClientSideConnection`、`Client` 接口、`ndJsonStream`、类型定义、`RequestError`）
- `@opensumi/ide-core-common` — 基础类型、DI 系统
- `@opensumi/ide-utils` — 工具函数、Stream

**devDependencies（仅编译时）:**

- `@opensumi/ide-core-browser` — Browser 层 DI 模块
- `@opensumi/ide-core-node` — Node 层日志、logger
- `@opensumi/ide-connection` — RPC 通信
- `@opensumi/ide-file-service` — 文件操作（handler 依赖）
- `@opensumi/ide-terminal-next` — 终端操作（handler 依赖）

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| SDK 类型与现有 `acp-types.ts` 不兼容 | 编译错误 | `@agentclientprotocol/sdk` 导出的类型（`InitializeRequest`、`SessionNotification` 等）替代 `core-common` 中手写的类型定义 |
| SDK 版本升级导致 breaking change | 运行时错误 | 锁定 `@agentclientprotocol/sdk` 版本，升级前跑通集成测试 |
| `ndJsonStream` 基于 Web Streams API，Node.js 环境兼容性 | Node.js 兼容性 | Node.js 18+ 原生支持 `ReadableStream`/`WritableStream`，无需 polyfill |
| 旧代码删除时遗漏引用 | 运行时错误 | Phase 2 保留兼容适配器，先跑通再删旧代码 |
| 进程管理行为变化 | Agent 崩溃/挂起 | `ProcessManager` 尽量 1:1 迁移现有逻辑，不改变 spawn/kill 行为 |
| 静态变量替换导致多连接冲突 | 权限对话框不显示 | 使用 ConnectionService 管理活跃连接，不再用静态变量 |

## 9. 成功标准

1. `@opensumi/ide-acp` 可独立编译
2. Node 层服务（`AgentService`、`ClientService`）**不持有** session 业务状态
   - 可通过检查：所有 state 字段仅为进程句柄、传输缓冲、请求队列
3. Browser 层（ide-acp）有 `SessionManager` 管理所有 session 相关状态，无 UI 代码
4. 不再使用 `setTimeout` 等待通知
5. 不再使用静态变量共享连接状态
6. ai-native 的聊天 UI（AcpChatView, PermissionDialog 等）继续正常工作
7. 旧 `ai-native/src/{browser,node}/acp/` 代码可完全删除且功能不变
