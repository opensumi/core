# AcpThread 原生 SessionUpdate 状态改造方案

## 背景

当前 OpenSumi ACP 实现里，`AcpThread` 在收到 ACP `SessionNotification` 后会立即更新本地 `AgentThreadEntry[]`，并在 `AcpThread.toAgentUpdate()` 中把 ACP 原生 `SessionUpdate` 转成 legacy `AgentUpdate`。

这会带来两个问题：

- ACP 原生信息在核心层过早被压扁，例如 `tool_call_update.content`、`rawOutput`、`meta`、`usage_update`、`current_mode_update`、`config_option_update` 等信息很容易丢失。
- `AcpThread` 同时承担协议状态维护和 UI legacy 格式转换，边界不清晰，后续要对齐 Zed 的 ACP 状态模型会越来越困难。

Zed 的模型更清晰：ACP 连接层收到 `SessionNotification` 后，把原生 `SessionUpdate` 交给 thread 处理；mode/config/session list 等协议状态单独维护；UI 层再基于 thread state 做展示。

## 目标

- `AcpThread` 内部直接保留 ACP 原生 `SessionNotification` / `SessionUpdate` 状态。
- `AcpThread` 不再知道 legacy `AgentUpdate`。
- legacy `AgentUpdate` 只保留在 UI adapter / back service 兼容层。
- `loadSession()` 返回的 `historyUpdates` 使用原生历史，不再从 `AgentThreadEntry[]` 反向伪造。
- 在保持当前 UI 行为不破坏的前提下，为后续完整展示 tool call、diff、usage、mode、config、session info 打基础。

## 非目标

- 不在本次改造中重写 ACP Chat UI。
- 不一次性删除 `AgentUpdate` 类型。
- 不改变 ACP agent 子进程协议。
- 不改变已经完成的 pending session / ref-count lifecycle 修复。

## 当前问题示例

ACP agent 可能发送如下原生更新：

```ts
{
  sessionUpdate: 'tool_call_update',
  toolCallId: 'edit-1',
  status: 'completed',
  content: [
    {
      type: 'diff',
      path: 'src/a.ts',
      oldText: '...',
      newText: '...',
    },
  ],
  rawOutput: {
    changedFiles: ['src/a.ts'],
  },
  meta: {
    terminal_output: {
      terminal_id: 'term-1',
      data: '...',
    },
  },
}
```

当前 `AcpThread.toAgentUpdate()` 会把它压缩成类似：

```ts
{
  type: 'tool_result',
  content: 'Modified src/a.ts',
}
```

压缩后，diff 内容、raw output、terminal meta 都不再是核心状态的一部分。后续 `loadSession()` 又从 `AgentThreadEntry[]` 反向构造 `SessionNotification`，进一步导致工具调用、usage、mode/config 等历史状态无法恢复。

## 目标架构

```
ACP Agent Process
    |
    | JSON-RPC sessionUpdate(SessionNotification)
    v
AcpThread
    - 保存原生 SessionNotification 历史
    - 维护 ACP-derived thread projection
    - 发出原生 session_notification 事件
    |
    v
AcpAgentService
    - session lifecycle
    - pending load / ref count
    - thread pool
    - legacy stream 兼容入口
    |
    v
UI Adapter
    - SessionNotification -> AgentUpdate
    - AgentUpdate -> IChatProgress
```

## 职责边界

### AcpThread

`AcpThread` 是 ACP 协议状态容器，负责：

- 保存原生 `SessionNotification[]`。
- 提供 `getSessionNotifications()`。
- 基于 `SessionUpdate` 维护当前 thread projection：
  - user message
  - assistant message
  - tool call
  - plan
  - mode
  - model
  - config option
  - usage
  - session info
- 发出 `session_notification` 原生事件。

`AcpThread` 不负责：

- 转换成 `AgentUpdate`。
- 转换成 `IChatProgress`。
- 为 legacy UI 构造简化文本。

### AcpAgentService

`AcpAgentService` 负责 session 生命周期和兼容 stream：

- `createSession()` / `loadSession()` / `disposeSession()`。
- pending load / ref-count。
- thread pool 复用。
- `buildSessionLoadResult()` 从 `thread.getSessionNotifications()` 读取原生历史。
- `sendMessage()` 短期继续返回 `SumiReadableStream<AgentUpdate>`，但转换逻辑委托给 adapter。

### UI Adapter

新增 adapter 层，例如：

- `acp-agent-update-adapter.ts`
- 或后续更直接的 `acp-chat-progress-adapter.ts`

职责：

- `SessionNotification -> AgentUpdate | AgentUpdate[] | null`
- `AgentUpdate -> IChatProgress`
- 后续逐步演进为 `SessionNotification -> IChatProgress`

## 分阶段方案

### Phase 1: 保留原生历史，保持行为兼容

改动点：

- 在 `AcpThread` 增加字段：

```ts
private _sessionNotifications: SessionNotification[] = [];
```

- 增加只读访问方法：

```ts
getSessionNotifications(): ReadonlyArray<SessionNotification> {
  return this._sessionNotifications;
}
```

- 在 `sessionUpdate()` handler 中先记录原生通知：

```ts
self.recordSessionNotification(params);
self.handleNotification(params);
self.fireEvent({ type: 'session_notification', notification: params });
```

- `reset()` 清理 `_sessionNotifications`。
- `loadSession()` replay 期间收到的通知也进入 `_sessionNotifications`。
- `buildSessionLoadResult()` 改为：

```ts
historyUpdates: [...thread.getSessionNotifications()];
```

验收：

- `loadSession()` 返回的 `historyUpdates` 包含 tool call、plan、usage、mode/config 等原生 update。
- 当前 UI 流式输出不变。

### Phase 2: 移出 `toAgentUpdate()`

改动点：

- 新增 `packages/ai-native/src/node/acp/acp-agent-update-adapter.ts`。
- 把 `AcpThread.toAgentUpdate()` 的转换逻辑移动到 adapter 函数：

```ts
export function toAgentUpdate(notification: SessionNotification): AgentUpdate | AgentUpdate[] | null;
```

- `AcpAgentService.sendMessage()` 改为调用 adapter：

```ts
const agentUpdates = toAgentUpdate(event.notification);
```

- 从 `IAcpThread` 和 `AcpThread` 中删除 `toAgentUpdate()`。

验收：

- `AcpThread` 不再 import `AgentUpdate`。
- `acp-update-types.ts` 只被 service / adapter / UI compatibility 层引用。
- 现有 `sendMessage()` 行为保持兼容。

### Phase 3: 完善 ACP-derived 状态

改动点：

- 在 `AcpThread` 内补齐以下原生状态：
  - current mode
  - available modes
  - current model
  - available models
  - config options
  - usage
  - session info
- 增加读取 API：

```ts
getSessionState(): AcpSessionState;
```

建议结构：

```ts
interface AcpSessionState {
  notifications: ReadonlyArray<SessionNotification>;
  entries: ReadonlyArray<AgentThreadEntry>;
  currentModeId?: string;
  modes?: Array<{ id: string; name: string }>;
  currentModelId?: string;
  models?: Array<{ id: string; name: string }>;
  configOptions?: unknown[];
  usage?: unknown;
  sessionInfo?: unknown;
}
```

验收：

- `current_mode_update` 不再只被忽略。
- `config_option_update` 不再只被忽略。
- `usage_update` / `session_info_update` 可以从 thread state 读取。

### Phase 4: UI 直接消费 ACP 原生 update

改动点：

- 新增 `SessionNotification -> IChatProgress` adapter。
- `AcpCliBackService` 从 `AgentUpdate` 中转逐步迁移到 ACP 原生 update。
- `AgentUpdate` 只保留给旧 API 或过渡测试。

验收：

- tool call diff、terminal meta、usage、mode/config 可以被 UI 单独展示。
- 删除大部分 `SessionNotification -> AgentUpdate -> IChatProgress` 的重复转换。

## 测试计划

### 单元测试

- `AcpThread` 收到 `sessionUpdate` 后会保存原生 notification。
- `reset()` 会清理原生 notification 历史。
- `loadSession()` replay 的历史通知能完整进入 `historyUpdates`。
- tool call update 中的 `content/rawOutput/meta` 不会在核心状态中丢失。
- `current_mode_update`、`config_option_update`、`usage_update`、`session_info_update` 能进入 thread state。

### 兼容测试

- `sendMessage()` 仍然输出现有 `AgentUpdate`。
- `AcpCliBackService.requestStream()` 仍然输出现有 `IChatProgress`。
- 旧 UI 不需要同步改动即可工作。

### 回归测试

- 并发 `loadSession()` 只执行一次真实 load RPC。
- load 中 close session 不返回 orphan thread。
- 多引用 session dispose 只有最后一个引用释放时才清理。
- session notification 不串 session。

## 风险与处理

- 风险：保存完整 `SessionNotification[]` 增加内存占用。
  - 处理：先完整保存，后续按 session 历史大小引入 cap 或压缩策略。
- 风险：adapter 移动后测试引用路径变化。
  - 处理：先导出 `toAgentUpdateForTest` 或直接测试 adapter。
- 风险：原生状态和 `AgentThreadEntry[]` projection 不一致。
  - 处理：把原生 notification 作为 canonical state，`entries` 明确标注为 projection。

## 建议落地顺序

1. 实现 Phase 1，先修正历史状态来源。
2. 实现 Phase 2，切干净 `AcpThread -> AgentUpdate` 依赖。
3. 补齐 Phase 1 / Phase 2 的单元测试。
4. 再进入 Phase 3，完善 mode/config/usage/session info 状态。
5. 最后做 Phase 4，让 UI adapter 直接消费 ACP 原生 update。

## 完成标准

- `AcpThread` 内部保留完整 ACP 原生 session notification 历史。
- `buildSessionLoadResult()` 不再从 `AgentThreadEntry[]` 反造历史。
- `AcpThread` 不再包含 `toAgentUpdate()`。
- legacy `AgentUpdate` 转换逻辑只存在于 adapter / UI compatibility 层。
- 新增测试覆盖原生历史保留、legacy stream 兼容和 load replay 场景。
