# ACP `tool_call` 入参传递的两个潜在 Bug

> 整理时间：2026-05-28 影响分支：`feat/acp-v2` 影响范围：ACP 链路下 `IChatToolCall.function.arguments` 的展示与内部状态字段 `ToolCallEntry.toolCall.rawInput`

## 背景

ACP（Agent Client Protocol）规定 agent 通过 `SessionNotification` 向 client 汇报工具调用状态，相关结构详见 SDK 类型定义：

- `tool_call` 通知：携带初始调用信息，入参字段为 `rawInput`（`@agentclientprotocol/sdk` `types.gen.d.ts:2846-2874`）
- `tool_call_update` 通知：用于补充 / 更新已发出的 `tool_call`，**同样声明了可选的 `rawInput`**（`types.gen.d.ts:2955-2981`）

OpenSumi 这侧把 ACP notification 翻译成两份数据：

1. **`AcpThread._entries`**：Thread 内部状态，由 `createToolCallEntry` / `updateToolCallEntry` 维护（`packages/ai-native/src/node/acp/acp-thread.ts`）
2. **`AgentUpdate` 流**：经 `toAgentUpdate` 输出，再被 `AcpCliBackService.convertAgentUpdateToChatProgress` 转成 `IChatToolCall`，最终由 `ChatToolRender.tsx` 渲染

下面两个 bug 分别命中这两条通路。

---

## Bug 1：`createToolCallEntry` 把 `rawInput` 字段名读错

### 位置

`packages/ai-native/src/node/acp/acp-thread.ts:1313-1335`

```ts
private createToolCallEntry(update: any): void {
  const toolCall: ToolCall = {
    toolCallId: update.toolCallId,
    title: update.toolName || update.title || update.toolCallId,
    kind: update.kind,
    rawInput: update.input,        // ❌ 应为 update.rawInput
    status: 'pending',
  };
  ...
}
```

### 调用方

`packages/ai-native/src/node/acp/acp-thread.ts:1094-1097`

```ts
case 'tool_call': {
  this.createToolCallEntry(update as any);
  break;
}
```

`update` 是 SDK 的 `ToolCall & { sessionUpdate: 'tool_call' }`，规范字段是 `rawInput`，没有 `input`。所以 `update.input` 永远是 `undefined`，写进 `_entries` 的 `ToolCallEntry.toolCall.rawInput` 也永远是 `undefined`。

### 当前可见性

UI 路径走的是 `toAgentUpdate`（同文件 `1146-1157`），**那里读的字段是正确的**：

```ts
input: (update.rawInput as Record<string, unknown>) || {},
```

所以现在没人感知到 Bug 1。但凡有任何调用方开始从 `AcpThread._entries[i].data.toolCall.rawInput` 取参（例如未来要做「Tool Call 详情面板」从 thread 状态取数据），都会瞬间发现入参全是 undefined。

### 单测覆盖情况

`packages/ai-native/__test__/node/acp/acp-thread.test.ts` 里的相关用例只断言 entry 的 `toolCallId` / `title` / `status`，**没有断言 `rawInput`**，所以这个错字段一直没被测试拦下。

### 修复

```ts
rawInput: update.rawInput,
```

并补一个断言：

```ts
expect(thread.entries[idx].data.toolCall.rawInput).toEqual({ path: '/test/file.ts' });
```

---

## Bug 2：`tool_call_update` 携带的 `rawInput` 不会被合并

### 位置

#### 内部状态层

`packages/ai-native/src/node/acp/acp-thread.ts:1337-1363`

```ts
private updateToolCallEntry(update: ToolCallUpdate & { sessionUpdate: 'tool_call_update' }): void {
  for (let i = this._entries.length - 1; i >= 0; i--) {
    const e = this._entries[i];
    if (e.type === 'tool_call' && e.data.toolCall.toolCallId === update.toolCallId) {
      const entry = e.data as ToolCallEntry;

      if (update.status === 'completed') { ... }
      else if (update.status === 'failed') { ... }
      else if (update.status === 'in_progress') { ... }

      this.fireEntryUpdated(e);
      break;
    }
  }
}
```

只读 `update.status` / `update.rawOutput`，不读也不合并 `update.rawInput`。

#### AgentUpdate 输出层

`packages/ai-native/src/node/acp/acp-thread.ts:1159-1201`

```ts
case 'tool_call_update': {
  if (update.status === 'completed' || update.status === 'failed') {
    if (update.rawOutput != null) { return { type: 'tool_result', ... } }
    return null;
  }
  if (update.status === 'in_progress') {
    return { type: 'tool_call_status', ... };  // 也没用 rawInput
  }
  if (update.content) {
    for (const item of update.content) {
      if (item.type === 'diff') { return { type: 'tool_result', content: `Modified ${item.path}` } }
    }
  }
  return null;
}
```

只产出 `tool_result` / `tool_call_status`，从不带 `rawInput`。

#### 下游消费层

`packages/ai-native/src/node/acp/acp-cli-back.service.ts:308-338` 处理 `tool_result` 时，是从 `toolCallCache` 拿之前缓存的 `IChatToolCall` 再 spread 更新：

```ts
const cached = toolCallCache.get(toolCallId);
const updated: IChatToolCall = cached
  ? { ...cached, result: update.content, state: 'result' }
  : { id: toolCallId, type: 'function', function: { name: ..., arguments: '' }, result: ..., state: 'result' };
```

这里 `arguments` 是初始 `tool_call` 阶段写入的，后续 update 不会再改。

### 触发条件

ACP spec 允许 agent 这样发送：

```jsonc
// 阶段 1：先开个坑，没参数
{ "sessionUpdate": "tool_call",        "toolCallId": "abc", "title": "terminal_readOutput" }
// 阶段 2：补参数
{ "sessionUpdate": "tool_call_update", "toolCallId": "abc", "rawInput": { "id": "term-1", "maxLines": 200 } }
// 阶段 3：完成
{ "sessionUpdate": "tool_call_update", "toolCallId": "abc", "status": "completed", "rawOutput": { ... } }
```

这种序列下，UI 上 `Arguments:` 会一直停留在 `{}`，明明 agent 是带参调用的。

### 当前是否会触发

Claude Code (`@zed-industries/claude-code-acp` 等当前主流实现) 习惯在第一条 `tool_call` 上就把 `rawInput` 一并发出，所以**目前生产环境还碰不到**。但只要将来：

- 接入了「先 stream 工具名再 stream 参数」的 agent，或
- claude-code-acp 改实现把入参延后到 `tool_call_update`

UI 就会瞬间出现「Arguments 永远是 `{}`」的回归。

### 修复方向

两层都要补：

#### 1) `updateToolCallEntry` 内合并 `rawInput`

```ts
if (update.rawInput !== undefined) {
  entry.toolCall.rawInput = update.rawInput;
}
```

#### 2) `toAgentUpdate(tool_call_update)` 在带 `rawInput` 时输出一条参数更新

新增一条 AgentUpdate 类型，例如 `tool_call_args`：

```ts
{ type: 'tool_call_args', toolCall: { toolCallId, input: update.rawInput } }
```

#### 3) `convertAgentUpdateToChatProgress` 消费这条新事件

从 `toolCallCache` 取出已有 `IChatToolCall`，重写其 `function.arguments`：

```ts
case 'tool_call_args': {
  const cached = toolCallCache.get(update.toolCall.toolCallId);
  if (!cached) return null;
  cached.function.arguments = JSON.stringify(update.toolCall.input);
  toolCallCache.set(cached.id, cached);
  return { kind: 'toolCall', content: cached };
}
```

注意 `IChatToolCall` 是引用复用的（`toolCallCache` 里是同一对象），但 chat-model 那侧会比对 id 做合并替换，发一条 progress 即可让 UI 重渲染。

---

## 关联现象（非 bug，仅说明）

工程师常会把「`Arguments: {}` 显示」误判为本类 bug。绝大多数时候它是合法的：

- 工具的入参 schema 全部 optional，LLM 选择不传
- e.g. `terminal_readOutput`，`id` / `maxLines` / `stripAnsi` 都可选，agent 传 `{}` 让其走默认值（活动终端、120 行、stripAnsi=true）

排查时第一步建议在 `acp-thread.ts` 的 `tool_call` case 加临时日志打印 `rawInput`，确认是 agent 端真没传，还是 client 端丢了，再决定是否走 Bug 2 的修复路径。

---

## 测试建议

### 针对 Bug 1

`packages/ai-native/__test__/node/acp/acp-thread.test.ts` 在已有的 `tool_call` 用例后追加：

```ts
it('createToolCallEntry should preserve rawInput from notification', () => {
  thread._fireEvent({
    type: 'session_notification',
    notification: {
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tc-1',
        title: 'ReadFile',
        rawInput: { path: '/a.ts' },
      },
    },
  });
  const entry = thread.entries.find((e) => e.type === 'tool_call');
  expect((entry?.data as ToolCallEntry).toolCall.rawInput).toEqual({ path: '/a.ts' });
});
```

### 针对 Bug 2

```ts
it('tool_call_update with rawInput should update existing entry rawInput', () => {
  // 先发一个不带参数的 tool_call
  fire({ sessionUpdate: 'tool_call', toolCallId: 'tc-1', title: 'X' });
  // 后发 tool_call_update 带 rawInput
  fire({ sessionUpdate: 'tool_call_update', toolCallId: 'tc-1', rawInput: { foo: 'bar' } });

  const entry = thread.entries.find((e) => e.type === 'tool_call');
  expect((entry?.data as ToolCallEntry).toolCall.rawInput).toEqual({ foo: 'bar' });
});
```

并在 `acp-agent.service.test.ts` 增加一条断言，确认 stream 里有一条新的 `tool_call_args` AgentUpdate。

---

## 修复优先级

| Bug   | 严重度 | 建议                                                                           |
| ----- | ------ | ------------------------------------------------------------------------------ |
| Bug 1 | 低     | 字段名错字，影响潜在的内部状态消费方，顺手修                                   |
| Bug 2 | 中     | 当前不可观察，但 spec 允许的合法 agent 行为会导致回归，**接入新 agent 前应修** |
