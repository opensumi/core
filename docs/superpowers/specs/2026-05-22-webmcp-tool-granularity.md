# WebMCP Tool Granularity Standard

> 通用的 WebMCP 工具粒度判断标准，覆盖测试、用户交互、开发调试等多用途场景。

---

## 核心原则：工具 = 用户意图，不是实现步骤

**判断标准一句话**：工具的粒度应该对应一个**人类用户能完整表达意图的动作**，而不是实现这个动作需要执行的步骤。

如果人类用户可以说"帮我创建文件 hello.js，内容是 console.log('hello')"，那 `createFile({ path, content })` 就是一个工具。如果人类需要说"先点击菜单，再选新建，再输入文件名，再输入内容，再点保存"——那说明你的工具粒度太细了。

---

## 三层判断矩阵

### 第一层：意图层级（Intent Level）

| 层级         | 定义                 | 示例                                                                |
| ------------ | -------------------- | ------------------------------------------------------------------- |
| **业务意图** | 用户想达成的业务目标 | `bookFlight({ from, to, date })`、`submitApplication({ formData })` |
| **交互意图** | 用户想完成的具体交互 | `searchFiles({ query })`、`openSettings({ section })`               |
| **验证意图** | 系统需要确认的状态   | `getEditorState()`、`checkFileExists({ path })`                     |

**规则**：一个工具只属于一个层级，不跨层混用。

### 第二层：参数完整性（Parameter Completeness）

工具必须接收**完成意图所需的全部信息**，不需要额外上下文或前置步骤。

```
❌ 不好: startFileCreation() → 返回一个 token → 再传文件名 → 再传内容
✅ 好:   createFile({ path, content }) → 完成
```

### 第三层：返回值语义（Return Semantics）

返回值应该是**结果描述**，不是过程信息。

```
❌ 不好: 返回 { success: true, step: "file_written", nextStep: "refresh_tree" }
✅ 好:   返回 "File created at path/to/hello.js"
```

---

## 多用途场景下的粒度统一

WebMCP 服务于三种用途，但**工具的粒度标准是统一的**。区别在于同一组工具在不同用途下被组合的方式不同。

### 用途 A：用户代理（Agent 帮用户完成任务）

```
用户说："帮我在项目里搜一下所有 TODO"
Agent 调用: searchFiles({ query: "TODO", scope: "workspace" })
返回: { results: [{ path: "src/index.js", line: 12 }, ...] }
```

### 用途 B：E2E 自动化测试（Agent 自己验证功能）

```
测试用例：搜索功能应该返回匹配结果
Agent 调用: searchFiles({ query: "console.log", scope: "workspace" })
Agent 验证: 返回结果包含 test-workspace/editor.js
Agent 断言: ui_assert({ testId: "search-results", assertion: "contains", expected: "editor.js" })
```

### 用途 C：开发调试（Agent 诊断问题）

```
用户说："为什么文件搜索不工作了？"
Agent 调用: runDiagnostics({ component: "fileSearch" })
Agent 调用: getEditorState()
Agent 调用: searchFiles({ query: "test" })  // 实际触发一次搜索验证
返回: 诊断报告
```

**关键点**：三种用途用的是同一组工具（`searchFiles`、`getEditorState`、`runDiagnostics`），只是调用顺序和验证方式不同。不需要为测试单独注册一套 `test_searchFiles`。

---

## 粒度反模式

### 反模式 1：流程绑定（Workflow Binding）

```javascript
// ❌ 一个工具做完整个流程，Agent 失去自主性
navigator.modelContext.registerTool({
  name: 'testFileCreationFlow',
  description: 'Test that file creation works end-to-end',
  execute: async () => {
    await createFile();
    await verifyFileExists();
    await checkUI();
    return 'PASSED';
  },
});
```

**问题**：Agent 只是一个触发器，无法组合、无法诊断、无法适应不同测试用例。

### 反模式 2：步骤拆分过细（Step Over-Splitting）

```javascript
// ❌ 每个 UI 交互都拆成单独工具
navigator.modelContext.registerTool({ name: 'focusFileTree', ... });
navigator.modelContext.registerTool({ name: 'navigateToFile', ... });
navigator.modelContext.registerTool({ name: 'pressEnterOnFile', ... });
navigator.modelContext.registerTool({ name: 'waitForEditorOpen', ... });
```

**问题**：Agent 需要知道 IDE 的内部交互步骤，一旦 UI 改版，所有测试都要重写。

### 反模式 3：内部实现泄露（Internal Leakage）

```javascript
// ❌ 暴露了内部实现细节
navigator.modelContext.registerTool({
  name: 'dispatchMessageToQueue',
  description: 'Write message to AcpThread message queue',
  execute: async ({ sessionId, message }) => {
    const queue = container.get(MessageQueue);
    queue.push({ sessionId, message });
    return { queueLength: queue.length };
  },
});
```

**问题**：暴露了"消息队列"这个内部实现。如果将来改成 event-driven，这个工具就废了。应该用 `acp_sendMessage` 替代。

### 反模式 4：多意图混用（Mixed Intent）

```javascript
// ❌ 一个工具既发消息又验证又截图
navigator.modelContext.registerTool({
  name: 'sendMessageAndVerify',
  description: 'Send message and verify response',
  execute: async ({ message }) => {
    await sendMessage(message);
    const response = await getResponse();
    const screenshot = await takeScreenshot();
    return { response, screenshot, passed: response.length > 0 };
  },
});
```

**问题**：混合了 action + query + assert 三个意图。Agent 无法单独验证某一步。

---

## 粒度决策流程图

```
开始：要不要注册一个新工具？
    │
    ▼
┌──────────────────────────────────────┐
│ Q1: 人类用户能不能用自己的话描述      │
│     这个意图？                        │
│     例如 "搜索文件"、"查看编辑器状态"  │
└────────────────┬─────────────────────┘
                 │
      ┌──────────┴──────────┐
      │ 能                   │ 不能
      ▼                      ▼
┌─────────────────┐  ┌──────────────────┐
│ Q2: 这个意图需要  │  │ 不注册，这是内部  │
│     多少信息才能  │  │ 实现细节          │
│     完整表达？    │  └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Q3: 有没有已有的工具能覆盖这个意图的     │
│     80% 以上场景？                        │
│     有 → 不注册新工具，用已有工具         │
│     没有 → 注册                           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Q4: 这个工具的返回值是不是结果描述，     │
│     不是过程信息？                        │
│     是 → 可以注册                         │
│     不是 → 重构返回值                     │
└────────────────┬────────────────────────┘
                 │
                 ▼
            注册工具
```

---

## ACP 模块工具清单（按此标准筛选后）

### 操作层（Action）—— 用户能做的事

| 工具                      | 意图描述           | 参数完整性               |
| ------------------------- | ------------------ | ------------------------ |
| `acp_sendMessage`         | 向 Agent 发送消息  | 需要 sessionId + message |
| `acp_cancelTask`          | 取消正在运行的任务 | 需要 sessionId           |
| `acp_setSessionMode`      | 切换 Agent 模式    | 需要 sessionId + mode    |
| `acp_setSessionModel`     | 切换 AI 模型       | 需要 sessionId + model   |
| `editor_openFile`         | 在编辑器中打开文件 | 需要 path                |
| `terminal_executeCommand` | 在终端执行命令     | 需要 command             |
| `file_create`             | 创建文件           | 需要 path + content      |
| `file_delete`             | 删除文件           | 需要 path                |

### 查询层（Query）—— 用户能看到的状态

| 工具                  | 意图描述           | 返回值语义           |
| --------------------- | ------------------ | -------------------- |
| `acp_getSessionState` | Agent 当前在干什么 | 状态描述             |
| `acp_getChatHistory`  | 对话历史           | 消息列表             |
| `acp_getLastToolCall` | 最近一次 tool call | tool call 详情       |
| `editor_getState`     | 编辑器当前状态     | 打开的文件、光标位置 |
| `terminal_getOutput`  | 终端输出内容       | 输出文本             |
| `file_exists`         | 文件是否存在       | true/false           |
| `file_read`           | 读取文件内容       | 文件内容             |
| `file_tree_list`      | 列出文件树         | 文件列表             |

### 断言层（Assert）—— 验证需要的工具

| 工具                | 意图描述                 | 为什么需要          |
| ------------------- | ------------------------ | ------------------- |
| `ui_assert`         | 通过 testId 断言 UI 状态 | 通用 UI 验证        |
| `ui_screenshot`     | 截图                     | 视觉回归 / 留存证据 |
| `acp_assertNoError` | 断言 Agent 没有报错      | 快捷断言            |

### 不注册的工具（按标准排除）

| 候选                       | 为什么排除                                                      |
| -------------------------- | --------------------------------------------------------------- |
| `acp_focusInput`           | 用户不会说"聚焦输入框"——意图层级太低                            |
| `acp_typeInInput(text)`    | 已有 `acp_sendMessage` 覆盖                                     |
| `acp_dispatchMessage`      | 内部实现泄露                                                    |
| `acp_verifyToolCallResult` | 混合了 query + assert，拆成 `acp_getLastToolCall` + `ui_assert` |
| `acp_runFullTest`          | 流程绑定，Agent 失去自主性                                      |

---

## 总结

**工具粒度 = 人类用户能用自己的话完整表达的一个意图。**

- 用户能说"帮我搜索文件"→ 一个工具
- 用户能说"看看现在编辑器打开了什么文件"→ 一个工具
- 用户不会说"帮我 dispatch message 到 queue"→ 不注册
- 用户不会说"先点击 A 再点击 B 再输入 C"→ 太细了，合并

三种用途（用户代理、E2E 测试、开发调试）共享同一组工具，通过不同组合方式实现不同目的。不需要为每种用途单独注册工具集。
