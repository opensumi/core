# ACP WebMCP Groups: 渐进式 IDE 能力暴露设计

## 背景

OpenSumi 已通过 WebMCP 在浏览器侧注册了 28 个工具（12 ACP、10 file、10 terminal），用于 BDD 测试。现在需要让 AI agent（如 Claude Code）通过 ACP 协议使用这些 IDE 能力，为用户提供 AI 陪伴体验。

### 问题

1. **工具数量过多** — 全部注册会占满 agent 上下文窗口
2. **WebMCP 仅限浏览器** — 依赖 CDP，不适合 AI 陪伴场景
3. **缺乏渐进暴露机制** — agent 无法按需加载/卸载能力

### 方案

通过 ACP 扩展方法（extension methods）暴露 IDE 能力，按 WebMCP Group 分组管理，agent 按需加载。

## 架构

```
AI Agent (ACP 客户端)
    │
    │ ACP JSON-RPC
    ▼
ACP Server (Node 侧)
    │
    │ 1. 初始化时 capability 协商，声明 webmcp groups
    │ 2. 注册 _opensumi/webmcp/* 元方法（始终可用）
    │ 3. load_group 时注册 _opensumi/{group}/* 扩展方法
    │ 4. 扩展方法内部调用统一 command
    │
    ▼ commandService.executeCommand('opensumi.webmcp.execute', ...)
    │
    │ OpenSumi Command RPC (Node → Browser)
    ▼
Browser 侧 Command Handler
    │
    │ 查找 group → 查找 tool → 调用 execute(params)
    ▼
WebMCP Tool 实现 (复用现有)
    │
    │ DI container.get(Service)
    ▼
IDE Service
```

### 双通道

| 通道         | 用途     | 调用方式                               |
| ------------ | -------- | -------------------------------------- |
| ACP 扩展方法 | AI 陪伴  | JSON-RPC `_opensumi/*`                 |
| WebMCP + CDP | BDD 测试 | `navigator.modelContext.executeTool()` |

两条通道共享工具实现，仅注册和调用方式不同。

## 核心类型

```typescript
interface WebMcpGroup {
  name: string; // "editor", "git", ...
  description: string; // 给 agent 看的描述
  defaultLoaded: boolean; // ACP 连接时是否自动注册
  tools: WebMcpTool[];
}

interface WebMcpTool {
  method: string; // "_opensumi/file/read"
  description: string;
  inputSchema: object; // JSON Schema
  execute: (params: any) => Promise<WebMcpToolResult>;
}

interface WebMcpToolResult {
  success: boolean;
  result?: any;
  error?: string;
}
```

## ACP 协议交互

### Capability 声明

ACP 初始化时在 `agentCapabilities._meta` 中声明可用 groups：

```json
{
  "agentCapabilities": {
    "loadSession": true,
    "_meta": {
      "opensumi": {
        "version": "1.0",
        "webmcpGroups": ["file", "terminal", "editor", "acp", "git", "search", "debug", "workspace"],
        "defaultLoadedGroups": ["file", "terminal", "editor"]
      }
    }
  }
}
```

### 元方法（始终可用）

| 方法                            | 参数             | 返回                                                    |
| ------------------------------- | ---------------- | ------------------------------------------------------- |
| `_opensumi/webmcp/list_groups`  | `{}`             | `{ groups: [{name, description, toolCount, loaded}] }`  |
| `_opensumi/webmcp/load_group`   | `{name: string}` | `{ group, methods: string[], loadedToolCount }`         |
| `_opensumi/webmcp/unload_group` | `{name: string}` | `{ group, unloadedMethods: string[], loadedToolCount }` |

### Group 内方法（按需注册）

命名规则：`_opensumi/{group}/{action}`

示例：

- `_opensumi/file/read` `{path: string}`
- `_opensumi/editor/open` `{file: string, line?: number}`
- `_opensumi/git/status` `{}`

加载 group 后，其方法作为 ACP extension method 可直接调用。

## Group 分组

| Group     | 方法前缀                | 默认加载 | 方法数 | 来源                   |
| --------- | ----------------------- | -------- | ------ | ---------------------- |
| file      | `_opensumi/file/*`      | 是       | ~10    | 现有 `file_*` 工具     |
| terminal  | `_opensumi/terminal/*`  | 是       | ~10    | 现有 `terminal_*` 工具 |
| editor    | `_opensumi/editor/*`    | 是       | ~8     | 新增                   |
| acp       | `_opensumi/acp/*`       | 否       | ~12    | 现有 `acp_*` 工具      |
| search    | `_opensumi/search/*`    | 否       | ~3     | 新增                   |
| git       | `_opensumi/git/*`       | 否       | ~6     | 新增                   |
| debug     | `_opensumi/debug/*`     | 否       | ~6     | 新增                   |
| workspace | `_opensumi/workspace/*` | 否       | ~3     | 新增                   |

默认加载 file + terminal + editor（约 28 个方法），覆盖最常用的 IDE 操作。默认 group 在 ACP `initialize` 响应后自动加载，agent 无需显式调用 `load_group`。

## 统一 Command 代理

Node 侧通过一个统一 command 桥接到 Browser 侧：

```typescript
// Node 侧 ACP handler
'_opensumi/file/read': (params) =>
  commandService.executeCommand('opensumi.webmcp.execute', {
    group: 'file', tool: 'read', params
  })

// Browser 侧注册一个 command
commands.registerCommand('opensumi.webmcp.execute', async ({ group, tool, params }) => {
  const registry = getWebMcpGroupRegistry();
  return registry.execute(group, tool, params);
});
```

选择统一代理而非逐个注册的原因：

- ACP 层已做方法路由，command 层无需重复
- group load/unload 只需管理内存 Map，无需动态注册/注销 command
- 这些工具面向 agent，不需要出现在 command palette

## 数据流示例

以 `_opensumi/editor/open` 为例：

```
1. Agent 调用 _opensumi/webmcp/load_group({name: "editor"})
   → ACP Server 注册 _opensumi/editor/* 扩展方法
   → Browser 侧 Group Registry 加载 editor group 到内存 Map
   → 返回 { group: "editor", methods: ["editor/open", ...], loadedToolCount: 28 }

2. Agent 调用 _opensumi/editor/open({file: "/src/app.ts", line: 42})
   → ACP Server 调用 commandService.executeCommand('opensumi.webmcp.execute', {
       group: 'editor', tool: 'open', params: { file: '/src/app.ts', line: 42 }
     })
   → Browser 侧 handler 从 Map 查找 editor group → open tool → execute(params)
   → IEditorService.open(Uri.parse(file), { selection: ... })
   → 返回 { success: true, result: { uri: '/src/app.ts' } }

3. Agent 调用 _opensumi/webmcp/unload_group({name: "editor"})
   → ACP Server 注销 _opensumi/editor/* 扩展方法
   → Browser 侧从 Map 移除 editor group
   → 返回 { loadedToolCount: 20 }
```

## 错误处理

复用现有 WebMCP 错误分类：

| 错误码                | 含义                              |
| --------------------- | --------------------------------- |
| `SERVICE_UNAVAILABLE` | DI 服务不可用                     |
| `TOOL_NOT_LOADED`     | group 未加载，需先调用 load_group |
| `TOOL_NOT_FOUND`      | group 已加载但工具不存在          |
| `PERMISSION_DENIED`   | 权限不足                          |
| `EXECUTION_ERROR`     | 执行失败                          |

## 文件组织

```
packages/ai-native/src/
  browser/acp/
    webmcp-group-registry.ts          # Group 注册表（Browser 侧）
    webmcp-groups/
      file.webmcp-group.ts            # 从 webmcp-file-tools.registry.ts 提取定义
      terminal.webmcp-group.ts        # terminal group 定义
      editor.webmcp-group.ts          # editor group 定义（新增）
      git.webmcp-group.ts             # git group 定义（新增）
      search.webmcp-group.ts          # search group 定义（新增）
      debug.webmcp-group.ts           # debug group 定义（新增）
      workspace.webmcp-group.ts       # workspace group 定义（新增）
      acp.webmcp-group.ts             # 从 webmcp-tools.registry.ts 提取定义
    webmcp-tools.registry.ts          # 保留，BDD 测试用
    webmcp-file-tools.registry.ts     # 保留，BDD 测试用

  node/acp/
    acp-webmcp-handler.ts             # ACP 扩展方法注册 + 元方法逻辑
    acp-webmcp-bridge.ts              # Node→Browser command 注册和调用

packages/terminal-next/src/browser/
  webmcp-tools.registry.ts            # 保留，BDD 测试用
```

## 实现优先级

### P0 — 基础设施

- `WebMcpGroup` / `WebMcpTool` 类型定义
- `webmcp-group-registry.ts`（Browser 侧 group 注册表 + 统一 command handler）
- `acp-webmcp-handler.ts`（ACP 元方法注册：list_groups / load_group / unload_group）
- `acp-webmcp-bridge.ts`（Node→Browser command 桥接）
- ACP capability 声明

### P1 — 默认加载的 group

- file group（从现有 `webmcp-file-tools.registry.ts` 提取）
- terminal group（从现有 `terminal-next/webmcp-tools.registry.ts` 提取）
- editor group（新增，依赖 IEditorService）

### P2 — 按需加载的 group

- acp group（从现有 `webmcp-tools.registry.ts` 提取）
- search group（新增，依赖 ISearchService）
- git group（新增，依赖 IGitService）
- debug group（新增，依赖 IDebugService）
- workspace group（新增，依赖 IWorkspaceService）

## 与现有代码的关系

- 现有 `webmcp-tools.registry.ts`、`webmcp-file-tools.registry.ts`、`terminal-next/webmcp-tools.registry.ts` **保留不动**，BDD 测试继续使用
- 新增的 `webmcp-groups/*.webmcp-group.ts` 从现有 registry 中**提取工具定义和 execute 函数**，复用实现
- 工具定义提取后，现有 registry 可以改为引用 group 定义，避免重复维护（P2 优化）
