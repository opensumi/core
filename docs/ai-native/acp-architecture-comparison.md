# ACP 架构对比：OpenSumi vs Zed

## OpenSumi 架构：标准能力 + 自定义扩展（WebMCP）

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent 子进程                              │
│                     (claude-agent-acp)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ACP Protocol (JSON-RPC over stdio)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenSumi IDE (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  标准 ACP Capabilities (ACP 规范定义)                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • fs.readTextFile / writeTextFile                       │   │
│  │  • terminal.createTerminal / terminalOutput              │   │
│  │  • auth.terminal                                         │   │
│  │  • requestPermission                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  自定义扩展 (通过 _meta + extMethod)                     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  clientCapabilities._meta.opensumi.webmcp = {            │   │
│  │    methods: [                                            │   │
│  │      "_opensumi/webmcp/list_groups",                     │   │
│  │      "_opensumi/webmcp/load_group",                      │   │
│  │      "_opensumi/webmcp/unload_group"                     │   │
│  │    ],                                                    │   │
│  │    groups: ["file", "terminal", "editor"],               │   │
│  │    defaultLoadedGroups: ["file", "terminal", "editor"]   │   │
│  │  }                                                       │   │
│  │                                                          │   │
│  │  Agent 调用:                                             │   │
│  │  extMethod("_opensumi/file/read", {path: "..."})        │   │
│  │  extMethod("_opensumi/editor/getCursor", {})            │   │
│  │  extMethod("_opensumi/terminal/sendText", {text: "..."})│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         WebMCP Handler (Node 侧)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ RPC                               │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │      WebMCP Group Registry (Browser 侧)                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • FileService (28 个文件操作工具)                        │   │
│  │  • EditorService (光标、选区、编辑操作)                   │   │
│  │  • TerminalService (终端交互)                            │   │
│  │  • WorkspaceService (工作区管理)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**特点：**

- ✅ 标准 ACP 能力 + 自定义扩展并存
- ✅ 通过 `_meta` 声明扩展能力，agent 可发现
- ✅ 通过 `extMethod` 调用 IDE 内部服务（文件、编辑器、终端等）
- ❌ 需要 agent 实现 `extMethod` 调用逻辑（claude-agent-acp 未实现）
- ❌ 超出 ACP 标准，其他 IDE/agent 不一定支持

---

## Zed 架构：仅标准 ACP Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent 子进程                              │
│                     (claude-agent-acp)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ACP Protocol (JSON-RPC over stdio)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Zed IDE (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  标准 ACP Capabilities (ACP 规范定义)                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • fs.readTextFile / writeTextFile                       │   │
│  │  • terminal.createTerminal / terminalOutput              │   │
│  │  • terminal.killTerminal / releaseTerminal               │   │
│  │  • terminal.waitForTerminalExit                          │   │
│  │  • auth.terminal                                         │   │
│  │  • requestPermission                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  _meta (仅用于向后兼容标记)                               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  clientCapabilities._meta = {                            │   │
│  │    "terminal_output": true,    // 支持终端内容块         │   │
│  │    "terminal-auth": true       // 支持终端认证扩展       │   │
│  │  }                                                       │   │
│  │                                                          │   │
│  │  ⚠️ 这些不是新能力，只是告诉 agent：                      │   │
│  │     "我支持你已知的这些扩展格式"                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ❌ 没有 extMethod 处理器                                        │
│  ❌ 没有自定义扩展方法                                           │
│  ❌ 没有 IDE 内部服务暴露机制                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**特点：**

- ✅ 严格遵守 ACP 标准，所有能力都在规范内
- ✅ Agent 无需额外实现，开箱即用
- ✅ 跨 IDE/agent 兼容性好
- ❌ 功能受限于 ACP 标准定义的能力
- ❌ 无法暴露 IDE 特有的高级功能（如编辑器光标操作、工作区管理等）

---

## 关键差异对比表

| 维度 | OpenSumi (WebMCP) | Zed (标准 ACP) |
| --- | --- | --- |
| **文件操作** | ✅ 标准 `readTextFile`/`writeTextFile`<br>✅ 扩展 `_opensumi/file/*` (28 个工具) | ✅ 标准 `readTextFile`/`writeTextFile` |
| **终端操作** | ✅ 标准 `createTerminal`/`terminalOutput`<br>✅ 扩展 `_opensumi/terminal/*` | ✅ 标准 `createTerminal`/`terminalOutput`/`killTerminal`/`releaseTerminal`/`waitForTerminalExit` |
| **编辑器操作** | ✅ 扩展 `_opensumi/editor/*` (光标、选区、编辑) | ❌ 无（ACP 标准未定义） |
| **工作区管理** | ✅ 扩展 `_opensumi/workspace/*` | ❌ 无（ACP 标准未定义） |
| **能力发现** | ✅ Agent 通过 `_meta.opensumi.webmcp` 发现 | ❌ Agent 只知道标准 ACP 能力 |
| **Agent 实现成本** | ❌ 需要实现 `extMethod` 调用逻辑 | ✅ 标准 ACP SDK 开箱即用 |
| **跨平台兼容性** | ❌ OpenSumi 特有 | ✅ 任何 ACP 兼容 IDE/agent |

---

## 流程对比：Agent 如何使用文件操作

### OpenSumi 流程

```
Agent 想读取文件
    │
    ├─ 方式 1: 标准 ACP
    │   └─> readTextFile({path: "/path/to/file"})
    │       └─> OpenSumi 标准 ACP handler 处理
    │
    └─ 方式 2: WebMCP 扩展
        └─> extMethod("_opensumi/file/read", {path: "/path/to/file"})
            └─> AcpWebMcpHandler.handleExtMethod()
                └─> RPC 到浏览器
                    └─> WebMcpGroupRegistry.executeTool("file", "read", ...)
                        └─> FileService.readFile()
```

### Zed 流程

```
Agent 想读取文件
    │
    └─ 唯一方式: 标准 ACP
        └─> readTextFile({path: "/path/to/file"})
            └─> Zed 标准 ACP handler 处理
```

---

## 总结

**"所有 IDE 能力都通过 ACP 规范的标准 capabilities 暴露"** 的含义：

Zed 选择**不发明任何自定义扩展协议**，只实现 ACP 规范明确定义的能力：

- 文件读写 → `readTextFile` / `writeTextFile`
- 终端操作 → `createTerminal` / `terminalOutput` / `killTerminal` 等
- 权限请求 → `requestPermission`

如果 ACP 规范没有定义某个能力（如编辑器光标操作），Zed 就**不提供**，而不是通过 `extMethod` 自己扩展。

OpenSumi 则选择**双轨制**：

- 实现标准 ACP 能力（保证基本兼容）
- 通过 `_meta` + `extMethod` 暴露 IDE 内部服务（提供高级功能）

这是两种不同的设计哲学：

- **Zed**: 简单、标准、兼容优先
- **OpenSumi**: 功能丰富、可扩展、创新优先
