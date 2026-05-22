# ACP Module WebMCP Testing Example

> 演示 WebMCP-native Testing 方案下，ACP 模块的 E2E 自动化测试流程。测试场景：**用户发送消息要求 Agent 创建一个文件，验证 Agent 执行、文件系统变更、UI 更新的完整链路。**

---

## 1. 基础设施注册（开发阶段）

### 1.1 WebMCP 工具注册

IDE 在启动时通过 `navigator.modelContext.registerTool` 向 AI agent 暴露一组测试工具。ACP 场景下注册的工具包括：

| 工具名称              | 描述                                    | 输入                                    |
| --------------------- | --------------------------------------- | --------------------------------------- |
| `acp_sendMessage`     | 向 ACP chat 发送用户消息                | `{ sessionId, message }`                |
| `acp_getSessionState` | 获取 Agent 会话状态（运行中/空闲/错误） | `{ sessionId }`                         |
| `acp_getChatHistory`  | 获取 chat 历史记录                      | `{ sessionId, limit? }`                 |
| `acp_getLastToolCall` | 获取 Agent 最近一次 tool call 的详情    | `{ sessionId }`                         |
| `file_read`           | 读取文件内容                            | `{ path }`                              |
| `file_exists`         | 检查文件是否存在                        | `{ path }`                              |
| `file_tree_list`      | 列出文件树目录                          | `{ path? }`                             |
| `terminal_getOutput`  | 获取终端最近输出                        | `{ sessionId? }`                        |
| `ui_assert`           | 通过 `data-testid` 断言 UI 状态         | `{ testId, assertion, expectedValue? }` |
| `ui_screenshot`       | 对指定区域截图                          | `{ testId? }`                           |

### 1.2 DOM 测试锚点

在 ACP 组件中为关键 UI 元素添加 `data-testid`：

- `acp-chat-view` — 聊天视图容器
- `acp-chat-input` — 输入框
- `acp-chat-message-user` — 用户消息气泡
- `acp-chat-message-assistant` — Agent 回复气泡
- `acp-chat-tool-call` — Tool call 卡片
- `acp-chat-tool-result` — Tool result 卡片
- `acp-permission-dialog` — 权限确认弹窗
- `acp-session-status` — 会话状态指示器

---

## 2. Agent 启动与能力发现（测试执行开始）

### 2.1 Agent 接入

```
Agent 通过 Chrome DevTools MCP 连接到打开的 IDE 页面 (http://localhost:8080)
```

### 2.2 发现可用工具

Agent 在页面 context 中执行：

```
navigator.modelContext.getTools()
```

返回当前注册的所有工具列表（name + description + inputSchema）。Agent 由此知道自己**能做什么**，不需要猜测 DOM 结构。

### 2.3 加载测试用例

Agent 读取预设的测试用例文件（Markdown/YAML 格式），了解要执行什么测试：

```
Test Case: ACP Agent File Creation Flow
Scenario: User asks agent to create a file, verify end-to-end execution
Steps:
  1. Send message "Please create a file at test-workspace/hello.js with content 'console.log(\"hello\")'"
  2. Wait for agent to process
  3. Verify file was created with correct content
  4. Verify chat UI shows the tool call and result
  5. Verify file explorer reflects the new file
```

---

## 3. 测试执行流程

### Step 1: 发送用户消息

```
Agent 调用: acp_sendMessage({ sessionId: "default", message: "Please create a file..." })
```

**IDE 内部执行**：

1. `acp_sendMessage` 将消息写入 ACP 会话的消息队列
2. 触发 Agent 处理流程
3. UI 层渲染用户消息气泡（`data-testid="acp-chat-message-user"`）

**返回**：`{ status: "queued", messageId: "msg_001" }`

### Step 2: 等待 Agent 处理

Agent 进入轮询等待：

```
循环调用: acp_getSessionState({ sessionId: "default" })
```

- 返回 `running` → 继续等待
- 返回 `idle` 或 `error` → 进入验证阶段
- 超时（如 60s）→ 标记失败

### Step 3: 验证 Agent 调用了正确的工具

```
Agent 调用: acp_getLastToolCall({ sessionId: "default" })
```

**返回**：

```json
{
  "toolName": "file_system",
  "action": "createFile",
  "parameters": { "path": "test-workspace/hello.js", "content": "console.log(\"hello\")" },
  "status": "completed"
}
```

Agent 比对：toolName 是否为 `file_system`，action 是否为 `createFile`，path 是否正确。

### Step 4: 验证文件是否真实创建

```
Agent 调用: file_exists({ path: "test-workspace/hello.js" })
→ 返回: true

Agent 调用: file_read({ path: "test-workspace/hello.js" })
→ 返回: "console.log(\"hello\")"
```

Agent 比对文件内容与预期是否一致。

### Step 5: 验证 UI 渲染

```
Agent 调用: ui_assert({
  testId: "acp-chat-tool-call",
  assertion: "exists",
  expectedValue: null
})
→ 返回: { pass: true }

Agent 调用: ui_assert({
  testId: "acp-chat-tool-result",
  assertion: "containsText",
  expectedValue: "File created successfully"
})
→ 返回: { pass: true }
```

可选：截图留存证据

```
Agent 调用: ui_screenshot({ testId: "acp-chat-view" })
→ 返回: base64 截图
```

### Step 6: 验证文件树更新

```
Agent 调用: file_tree_list({ path: "test-workspace" })
→ 返回: { files: ["hello.js", "index.js", "package.json"] }
```

Agent 确认 `hello.js` 出现在文件列表中。

---

## 4. 测试报告生成

Agent 汇总各步骤结果，生成结构化测试报告：

```
Test: ACP Agent File Creation Flow
Status: PASSED
Duration: 12.4s

Steps:
  ✅ Step 1: Send message (0.2s)
  ✅ Step 2: Wait for agent (8.1s, 16 polls)
  ✅ Step 3: Verify tool call - file_system.createFile (0.1s)
  ✅ Step 4: Verify file exists with correct content (0.3s)
  ✅ Step 5: Verify UI shows tool call and result (0.2s)
  ✅ Step 6: Verify file tree updated (0.1s)

Screenshot: saved to test-results/acp-file-creation-20260522.png
```

---

## 5. 为什么这个流程对 AI agent 友好

### 不需要理解 DOM 结构

传统 E2E 中，Agent 需要分析 DOM 树来找到"发送按钮"或"消息气泡"：

```
div[class*="chat_view__"] > div[class*="message_list__"] > div:last-child
```

WebMCP 方案中，Agent 只需要调用 `acp_sendMessage()` 和 `acp_getChatHistory()`。DOM 结构完全对 Agent **透明**。

### 自我描述的工具接口

每个工具都有 `name` + `description` + `inputSchema`，Agent 可以像读 API 文档一样理解工具用途，不需要人工写测试映射。

### 可组合的验证能力

Agent 可以自由组合工具：

- 操作层：`acp_sendMessage`、`openFile`
- 验证层：`file_exists`、`file_read`、`terminal_getOutput`
- UI 层：`ui_assert`、`ui_screenshot`

Agent 根据测试用例的描述，自主选择需要的工具组合。

### 失败自动诊断

当某个步骤失败时，Agent 可以自行诊断：

- 文件没创建？→ 检查 `acp_getLastToolCall` 看 Agent 是否执行了正确的 tool call
- Tool call 不对？→ 检查 `acp_getChatHistory` 看 Agent 是否理解了用户意图
- UI 没更新？→ 用 `ui_screenshot` 截图看渲染结果，用 `ui_assert` 检查具体元素

---

## 6. 扩展场景

### 权限确认流程测试

```
1. acp_sendMessage → 触发需要权限的操作（如执行终端命令）
2. ui_assert({ testId: "acp-permission-dialog", assertion: "exists" })
3. ui_assert({ testId: "acp-permission-allow-btn", assertion: "exists" })
4. 点击允许按钮（通过 DOM 操作或新增 ui_click 工具）
5. acp_getSessionState → 等待恢复 idle
6. terminal_getOutput → 验证命令执行结果
```

### Agent 多步骤操作测试

```
1. acp_sendMessage → "Search for 'TODO' in all files and replace with 'FIXME'"
2. acp_getSessionState → 轮询等待
3. acp_getChatHistory → 获取完整交互历史
4. 验证 Agent 依次调用了：search → file_system.read × N → file_system.write × N
5. file_read → 逐个验证文件内容已替换
```

### 错误恢复测试

```
1. acp_sendMessage → 触发一个会失败的操作（如写入只读文件）
2. acp_getLastToolCall → 验证 tool call 返回了 error
3. acp_getChatHistory → 验证 Agent 向用户报告了错误
4. ui_assert({ testId: "acp-chat-tool-result", assertion: "containsClass", expectedValue: "error" })
```

---

## 7. 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   AI Agent (Claude)                 │
│                                                     │
│  1. getTools() 发现能力                              │
│  2. 读取测试用例                                     │
│  3. 调用 WebMCP 工具执行操作                          │
│  4. 调用 WebMCP 工具验证结果                          │
│  5. 生成测试报告                                     │
└──────────────────────┬──────────────────────────────┘
                       │ navigator.modelContext
                       │ executeTool()
                       ▼
┌─────────────────────────────────────────────────────┐
│              OpenSumi IDE (Web App)                 │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ ACP 测试工具  │  │ 文件系统工具  │  │ 终端工具   │  │
│  │ registerTool │  │ registerTool │  │registerTool│  │
│  │ acp_*       │  │ file_*      │  │ terminal_* │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                │                │         │
│         ▼                ▼                ▼         │
│  ┌──────────────────────────────────────────────┐   │
│  │            OpenSumi Service Layer             │   │
│  │  AcpThread · FileService · TerminalService   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  UI 验证工具 │  │ 截图工具      │  │ DOM 断言   │  │
│  │ ui_assert   │  │ ui_screenshot │  │ query_dom │  │
│  └─────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────┘
```

关键点：

- **WebMCP 工具** 是 IDE 自身注册的，不依赖外部 Playwright 脚本
- Agent 通过 **标准 API** (`registerTool` / `executeTool`) 与 IDE 交互
- `data-testid` 仅用于 **UI 渲染验证**，操作层完全走 WebMCP
- 新增测试能力 = 新增一个 `registerTool` 调用，不需要改测试框架
