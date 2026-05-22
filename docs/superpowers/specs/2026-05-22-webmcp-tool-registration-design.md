# Design: AI-Driven WebMCP Tool Registration

**Date:** 2026-05-22 **Status:** Draft **Author:** Claude Code

## Context

OpenSumi IDE 需要为 AI agent 提供稳定的测试交互锚点。传统 E2E 依赖 CSS Modules 哈希类名匹配（如 `[class*="file_tree_node__"]`），脆弱且不可维护。WebMCP（`navigator.modelContext`）允许 Web 应用主动向 AI agent 暴露带 schema 的工具，使 agent 能够**自发现、自执行、自验证**。

当前问题：**这些工具应该由谁来注册？如何持续维护？** 手动注册容易与实现不同步，且 IDE 代码量大（3000+ 文件），人工维护成本高。

## Problem

1. 谁来决定哪些能力应该暴露为 WebMCP 工具？
2. 工具注册代码放在哪里？如何与业务代码保持同步？
3. 当业务代码变更时，工具如何自动更新？
4. 如何将这个过程交给 AI 自动化完成？

## Solution: AI Skill + Centralized Registry

### Architecture

```
┌─────────────────────────────────────────────────────┐
│              开发阶段（AI Skill 执行）                │
│                                                     │
│  开发者告诉 AI: "帮我为新功能注册 WebMCP 工具"         │
│       │                                             │
│       ▼                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │  webmcp-tool-registrar skill                │   │
│  │                                             │   │
│  │  1. codegraph_explore 扫描新增/变更的服务     │   │
│  │  2. 应用粒度标准筛选候选工具                    │   │
│  │  3. 生成 tool registry 代码                   │   │
│  │  4. 生成 data-testid 补丁                     │   │
│  │  5. 输出 PR                                   │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ 生成的文件
                       ▼
┌─────────────────────────────────────────────────────┐
│              代码仓库（持久化）                        │
│                                                     │
│  packages/ai-native/src/browser/acp/                │
│    └── webmcp-tools.registry.ts  ← 工具注册中心      │
│                                                     │
│  packages/core-browser/src/                         │
│    └── webmcp-tools.registry.ts  ← 通用 IDE 工具     │
└──────────────────────┬──────────────────────────────┘
                       │ IDE 启动时加载
                       ▼
┌─────────────────────────────────────────────────────┐
│              运行阶段（浏览器环境）                     │
│                                                     │
│  IDE 启动 → import webmcp-tools.registry            │
│       │                                             │
│       ▼                                             │
│  navigator.modelContext.registerTool(...)           │
│       │                                             │
│       ▼                                             │
│  Agent 连接 → navigator.modelContext.getTools()     │
│       │                                             │
│       ▼                                             │
│  Agent 发现工具 → executeTool → 验证/操作            │
└─────────────────────────────────────────────────────┘
```

### 关键设计决策

#### 1. 工具注册放在哪里？

**选择：集中式 Registry 文件**，按模块拆分：

```
packages/
  ai-native/src/browser/acp/
    webmcp-tools.registry.ts    ← ACP 模块的工具注册
  core-browser/src/
    webmcp-tools.registry.ts    ← 通用 IDE 工具（文件、编辑器、终端）
```

每个 registry 文件是一个纯函数，接收 DI 容器，注册工具：

```typescript
// packages/ai-native/src/browser/acp/webmcp-tools.registry.ts
export function registerAcpWebMCPTools(container: IInjector): IDisposable {
  const acpService = container.get(AcpCliBackService);
  const fileService = container.get(IFileService);

  const controller = new AbortController();

  navigator.modelContext.registerTool(
    {
      name: 'acp_sendMessage',
      description: 'Send a message to the ACP agent in the current session',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message to send to the agent' },
        },
        required: ['message'],
      },
      execute: async ({ message }: { message: string }) => {
        // Call actual ACP service
        // ...
        return `Message sent: ${message.substring(0, 50)}...`;
      },
    },
    { signal: controller.signal },
  );

  // ... more tools

  return { dispose: () => controller.abort() };
}
```

**为什么不分散注册？** 如果每个 service 自己注册工具，AI 难以追踪哪些工具有没有注册、注册是否完整。集中式 registry 让 AI 可以一次性看到全貌，便于审查和维护。

#### 2. Browser ↔ Node 通信怎么处理？

OpenSumi 的架构是：浏览器（React 组件 + browser service）↕ RPC ↔ Node（node service）。

WebMCP 工具运行在**浏览器**，但很多能力（如 ACP agent 操作）在**Node 侧**。解决方案：

```
Browser WebMCP Tool
    │
    │ 通过 DI 获取 browser service
    ▼
AcpCliBackService (browser proxy)
    │
    │ 通过 OpenSumi RPC / CommandService
    ▼
AcpAgentService (node side, actual execution)
    │
    ▼
AcpThread (subprocess)
```

WebMCP 工具的 `execute` 函数只需调用已有的 browser service，由 framework 处理 RPC 桥接。**AI 不需要创建新的通信层**——它只需要知道哪些 browser service 可以被调用。

#### 3. AI Skill 的工作流程

**Skill 名称：** `webmcp-tool-registrar`

**触发条件：** 开发者说"帮我注册 WebMCP 工具"或"为 X 功能暴露 WebMCP 工具"

**执行流程：**

```
Step 1: 确定变更范围
  └── git diff 查看当前分支改动
  └── 或直接询问开发者"要为哪些模块注册工具？"

Step 2: 扫描能力面
  └── codegraph_explore 扫描目标模块的服务接口
  └── 找出所有 public 方法、接口定义

Step 3: 应用粒度标准过滤
  └── 对照 docs/superpowers/specs/2026-05-22-webmcp-tool-granularity.md
  └── 筛选出符合标准的候选工具

Step 4: 与开发者确认
  └── 列出候选工具清单，让开发者选择要暴露哪些
  └── "我建议暴露以下 8 个工具，你觉得哪些不需要？"

Step 5: 生成代码
  └── 生成 webmcp-tools.registry.ts
  └── 为相关组件生成 data-testid 补丁
  └── 生成 JSON Schema 定义

Step 6: 输出 PR
  └── 创建 commit
  └── 开发者 review 后合并
```

**Skill 的输入输出：**

| 输入                    | 输出                       |
| ----------------------- | -------------------------- |
| 模块名或文件路径        | `webmcp-tools.registry.ts` |
| 粒度标准文档            | 组件 `data-testid` 补丁    |
| 代码库结构（codegraph） | JSON Schema 定义文件       |
| 开发者确认/排除决策     | PR commit                  |

#### 4. 持续维护策略

**新功能开发时：**

1. 开发者实现功能后，运行 skill
2. Skill 自动识别新增的服务/方法
3. 生成工具注册代码
4. 开发者 review 后合并

**已有功能变更时：**

1. CI 检测 service 接口变更
2. 对比 registry 文件中的工具列表
3. 如果有新增 public 方法但没注册工具 → 自动创建 issue 或 PR

**工具废弃时：**

1. Registry 中的 `AbortController` 模式允许运行时取消注册
2. 代码删除时，skill 自动从 registry 中移除对应工具

### 工具分类与注册优先级

#### Phase 1: ACP 核心（当前最需要）

| 工具                  | 来源服务                       | 复杂度 |
| --------------------- | ------------------------------ | ------ |
| `acp_sendMessage`     | AcpCliBackService.sendMessage  | 中     |
| `acp_getSessionState` | AcpAgentService.getSessionInfo | 低     |
| `acp_getChatHistory`  | AcpCliBackService.listSessions | 中     |
| `acp_getLastToolCall` | AcpCliBackService (新增)       | 低     |
| `acp_cancelTask`      | AcpAgentService.cancelRequest  | 低     |

#### Phase 2: 文件与编辑器

| 工具              | 来源服务         | 复杂度 |
| ----------------- | ---------------- | ------ |
| `file_exists`     | IFileService     | 低     |
| `file_read`       | IFileService     | 低     |
| `file_create`     | IFileService     | 低     |
| `file_tree_list`  | IFileServiceNext | 中     |
| `editor_getState` | IEditorService   | 中     |
| `editor_openFile` | IEditorService   | 中     |

#### Phase 3: 终端与其他

| 工具                      | 来源服务           | 复杂度 |
| ------------------------- | ------------------ | ------ |
| `terminal_getOutput`      | ITerminalService   | 高     |
| `terminal_executeCommand` | ITerminalService   | 高     |
| `settings_getValue`       | IPreferenceService | 中     |

### 数据流示例：ACP 文件创建测试

```
1. AI Agent 启动，连接 IDE 页面
2. Agent 调用: navigator.modelContext.getTools()
   → 收到 [acp_sendMessage, acp_getSessionState, ..., file_exists, file_read, ...]

3. Agent 读取测试用例 → 开始执行

4. acp_sendMessage({ message: "创建文件 hello.js" })
   → 浏览器: WebMCP execute 函数
   → 浏览器: AcpChatInternalService.sendMessage()
   → RPC → Node: AcpAgentService.sendMessage()
   → Node: AcpThread.prompt()
   → 返回: "Message queued"

5. Agent 轮询: acp_getSessionState()
   → 返回: { status: "running" } → 继续等待
   → 返回: { status: "ready" } → 进入验证

6. Agent 验证: file_exists({ path: "hello.js" })
   → 浏览器: WebMCP execute
   → RPC → Node: IFileService.exists()
   → 返回: true ✅

7. Agent 验证: file_read({ path: "hello.js" })
   → 返回: "console.log('hello')" ✅

8. Agent 验证: ui_assert({ testId: "acp-chat-tool-call", assertion: "exists" })
   → DOM 查询: document.querySelector('[data-testid="acp-chat-tool-call"]')
   → 返回: { pass: true } ✅

9. Agent 生成报告: PASSED (6/6 steps)
```

### 风险与缓解

| 风险                | 影响                       | 缓解                                                        |
| ------------------- | -------------------------- | ----------------------------------------------------------- |
| WebMCP 浏览器兼容性 | 只有 Chrome dev trial 可用 | Phase 1 仅用于本地测试；保留 Playwright E2E 作为降级方案    |
| 工具注册遗漏        | Agent 无法执行某些操作     | CI 检测接口变更，自动提醒                                   |
| 工具描述不清晰      | Agent 选错工具或传错参数   | 工具描述和 schema 需要 review；可参考 WebMCP best practices |
| RPC 延迟            | 工具执行慢                 | 工具 execute 应异步非阻塞；agent 侧用 getTools + 轮询       |

### 文件变更清单

新增文件：

- `packages/ai-native/src/browser/acp/webmcp-tools.registry.ts` — ACP 工具注册
- `packages/core-browser/src/webmcp-tools.registry.ts` — 通用 IDE 工具注册
- `docs/superpowers/specs/2026-05-22-webmcp-tool-registration-design.md` — 本设计文档

修改文件：

- ACP 相关组件添加 `data-testid`（AI 生成补丁，人工 review）
- Browser module 初始化时 import registry
