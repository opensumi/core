# OpenSumi WebMCP-via-MCP-Server 设计方案

## 背景与目标

### 问题

OpenSumi 通过 `_meta.opensumi.webmcp` + `extMethod` 自定义协议向 ACP agent 暴露 28+ 个 IDE 内部工具（file/terminal/editor），但 `claude-agent-acp` 等主流 ACP agent 不实现 `extMethod` 接收方逻辑，导致 WebMCP 链路无法被实际使用。

经验证（参见 `acp-architecture-comparison.md`）：

- OpenSumi 的 `_meta.opensumi.webmcp` 能力声明已正确发送给 agent
- Agent 完全不读取该字段，从未发起任何 `_opensumi/*` extMethod 调用
- Zed 等其他 ACP 客户端均未实现类似机制，agent 端缺乏推动力

### 目标

在**不修改 agent**的前提下，让 OpenSumi 现有的 WebMCP 工具能够被任何标准 ACP agent 使用。

### 关键观察

Agent 在 `InitializeResponse.agentCapabilities` 中明确声明：

```json
"mcpCapabilities": { "http": true, "sse": true }
```

**Agent 原生支持 HTTP MCP server**。OpenSumi 可以在 Node 进程内托管一个 HTTP MCP server，通过 `newSession.mcpServers` 把 URL 传给 agent。这样不需要 bridge 进程、自定义 IPC 协议，也不需要 agent 改动。

实现上需要注意两点：

- 当前 WebMCP 工具定义使用 JSON Schema，而 `@modelcontextprotocol/sdk@1.11.4` 的高阶 `McpServer.tool()` API 接收 Zod raw shape。为避免 JSON Schema → Zod 的额外转换，HTTP server 应使用低阶 `Server + ListToolsRequestSchema + CallToolRequestSchema`，直接返回现有 `inputSchema`。
- `mcpServers` 的注入应放在 `AcpAgentService.getSessionMcpServers()` 附近，而不是直接写进 `AcpThread.newSession()`。现有 service 层已经负责按 `agentCapabilities.mcpCapabilities` 过滤 HTTP/SSE MCP server，create/load/loadOrNew 等路径也都经过这里。

## 方案：OpenSumi Node 内嵌 HTTP MCP Server

### 整体架构

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  WebMcpGroupRegistry (现有)                         │ │
│  │  • file/terminal/editor 等 28 个工具                │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                          ▲ RPC (现有)
                          │
┌──────────────────────────────────────────────────────────┐
│  OpenSumi Node                                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  AcpWebMcpCallerService (现有)                      │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  OpenSumiMcpHttpServer (新增)                       │ │
│  │  • @modelcontextprotocol/sdk 在 Node 内启动        │ │
│  │  • 监听 http://127.0.0.1:{随机端口}/mcp/{token}     │ │
│  │  • tools/list   → groupDefs                         │ │
│  │  • tools/call   → executeTool                       │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
│                          │ HTTP (loopback)                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  AcpAgentService 注入:                              │ │
│  │  mcpServers: [..., {                                │ │
│  │    name: "opensumi-ide",                            │ │
│  │    type: "http",                                    │ │
│  │    url: "http://127.0.0.1:PORT/mcp/TOKEN"           │ │
│  │  }]                                                 │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                           │ HTTP
                           ▼
┌──────────────────────────────────────────────────────────┐
│  claude-agent-acp (unchanged)                             │
│  • 自动发现并注册 opensumi-ide 的所有 tools                │
│  • LLM 可直接调用 mcp__opensumi-ide__file_read 等         │
└──────────────────────────────────────────────────────────┘
```

### 与 Bridge 方案的对比

| 维度             | Bridge 方案（已废弃）            | HTTP MCP Server 方案 |
| ---------------- | -------------------------------- | -------------------- |
| 新进程           | 需要 spawn bridge                | ❌ 不需要            |
| IPC 协议         | 自定义 JSON-RPC over Unix Socket | ❌ 用现成 MCP HTTP   |
| 端口/Socket 管理 | Unix socket + env var            | 随机端口             |
| 跨平台           | Unix socket 需特殊处理 Windows   | HTTP 天然跨平台      |
| 新代码量         | ~350 行                          | ~180-250 行          |
| 调用链           | 进程间 IPC + RPC                 | 仅 RPC               |
| 维护成本         | 高                               | 低                   |

**简化的关键洞察**：MCP 协议已经有 HTTP transport，Agent 已经实现 HTTP MCP client，那我们就直接当一个标准 HTTP MCP server，不需要自己发明 IPC 协议。

## 数据流

### 启动流程（工具发现）

```
1. Browser RPC ready 后，OpenSumiMcpHttpServer 按需启动
       ▼
2. 监听 127.0.0.1:{随机端口}，路径 /mcp/{随机 token}
       ▼
3. AcpAgentService 根据 agentCapabilities.http 注入 MCP server URL
       ▼
4. claude-agent-acp 收到 newSession
       ▼
5. agent 通过 HTTP MCP 协议调用 tools/list
       ▼
6. OpenSumiMcpHttpServer 懒加载 AcpWebMcpCallerService.getGroupDefinitions()
       ▼
7. 返回 MCP tools (file_read, file_write, terminal_create, ...)
       ▼
8. agent 把这些工具注册给 LLM
```

### 调用流程（工具执行）

```
1. LLM 决定调用 mcp__opensumi-ide__file_read({path: "..."})
       ▼
2. claude-agent-acp 通过 HTTP MCP 协议 POST tools/call
       ▼
3. OpenSumiMcpHttpServer 收到请求
       ▼
4. 调用 AcpWebMcpCallerService.executeTool("file", "read", {...})
       ▼
5. 通过现有 RPC 调用浏览器侧 WebMcpGroupRegistry
       ▼
6. 结果原路返回，封装为 MCP tools/call 响应
```

## MCP 工具命名约定

| WebMCP                       | MCP Tool Name      | 说明                     |
| ---------------------------- | ------------------ | ------------------------ |
| `_opensumi/file/read`        | `file_read`        | 下划线分隔，保留组名前缀 |
| `_opensumi/terminal/create`  | `terminal_create`  |                          |
| `_opensumi/editor/getCursor` | `editor_getCursor` | 保留驼峰                 |

MCP server name 为 `opensumi-ide`，最终 LLM 看到的工具名形如 `mcp__opensumi-ide__file_read`（agent 自动加前缀）。

## 关键文件

| 文件 | 职责 | 代码量估计 |
| --- | --- | --- |
| `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts` | HTTP MCP server，桥接到 `AcpWebMcpCallerService` | ~180 行 |
| `packages/ai-native/src/node/acp/acp-agent.service.ts` | 按 agent capability 追加内置 MCP server URL，并更新 create/load/loadOrNew 调用点 | +40 行 |
| `packages/ai-native/src/node/index.ts` | 注册 `OpenSumiMcpHttpServer` DI provider | +5 行 |
| `packages/ai-native/__test__/node/opensumi-mcp-http-server.test.ts` | 单元测试 | ~120 行 |

## 核心代码示意

```typescript
import { randomBytes, randomUUID } from 'node:crypto';
import * as http from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

@Injectable()
export class OpenSumiMcpHttpServer {
  @Autowired(AcpWebMcpCallerServiceToken)
  private caller: AcpWebMcpCallerService;

  private httpServer?: http.Server;
  private transports = new Map<string, StreamableHTTPServerTransport>();
  private token = randomBytes(16).toString('hex');
  port = 0;

  async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(0, '127.0.0.1', () => resolve());
    });
    this.port = (this.httpServer.address() as any).port;
  }

  private createServer(): Server {
    const server = new Server({ name: 'opensumi-ide', version: '1.0.0' }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const groupDefs = await this.caller.getGroupDefinitions();
      return {
        tools: groupDefs.flatMap((group) =>
          group.tools.map((tool) => ({
            name: this.toMcpToolName(group.name, tool.method),
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        ),
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const target = await this.resolveTool(request.params.name);
      if (!target) {
        return {
          content: [{ type: 'text', text: `Tool not found: ${request.params.name}` }],
          isError: true,
        };
      }

      const result = await this.caller.executeTool(
        target.groupName,
        target.action,
        (request.params.arguments ?? {}) as Record<string, unknown>,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: !result.success,
      };
    });

    return server;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!req.url?.startsWith(`/mcp/${this.token}`) || !this.isAllowedHost(req.headers.host)) {
      res.writeHead(404).end();
      return;
    }

    try {
      let transport: StreamableHTTPServerTransport | undefined;
      const sessionId = req.headers['mcp-session-id'];

      if (typeof sessionId === 'string') {
        transport = this.transports.get(sessionId);
        if (!transport) {
          res.writeHead(404).end();
          return;
        }
      } else {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (id) => this.transports.set(id, transport!),
        });
        await this.createServer().connect(transport);
      }

      await transport.handleRequest(req, res);
      if (req.method === 'DELETE' && typeof sessionId === 'string') {
        this.transports.delete(sessionId);
      }
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}/mcp/${this.token}`;
  }

  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.transports.values()).map((transport) => transport.close()));
    this.transports.clear();
    this.httpServer?.close();
  }

  private toMcpToolName(groupName: string, method: string): string {
    const action = method.split('/').pop()!;
    return `${groupName}_${action}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  }

  private async resolveTool(toolName: string): Promise<{ groupName: string; action: string } | undefined> {
    const groupDefs = await this.caller.getGroupDefinitions();
    for (const group of groupDefs) {
      for (const tool of group.tools) {
        const action = tool.method.split('/').pop()!;
        if (this.toMcpToolName(group.name, tool.method) === toolName) {
          return { groupName: group.name, action };
        }
      }
    }
    return undefined;
  }

  private isAllowedHost(host?: string): boolean {
    return !host || host.startsWith('127.0.0.1:') || host.startsWith('localhost:');
  }
}
```

`AcpAgentService.getSessionMcpServers()` 注入。当前方法是同步实现；落地时可以改成 async 并在 create/load/loadOrNew 调用点补 `await`，也可以拆成 `ensureOpenSumiMcpServer()` + 同步过滤函数：

```typescript
private async getSessionMcpServers(thread: AcpThread, config: AgentProcessConfig): Promise<McpServer[]> {
  const configuredServers = this.filterByCapabilities(thread, config.mcpServers ?? []);

  if (thread.agentCapabilities?.mcpCapabilities?.http !== true) {
    return configuredServers;
  }

  try {
    await this.opensumiMcpHttpServer.start();
    return [
      ...configuredServers,
      {
        name: 'opensumi-ide',
        type: 'http',
        url: this.opensumiMcpHttpServer.getUrl(),
        headers: [],
      },
    ];
  } catch (err) {
    this.logger.warn('[AcpAgentService] OpenSumi MCP HTTP server is unavailable:', err);
    return configuredServers;
  }
}
```

## 安全性

- **监听地址**：`127.0.0.1`（loopback），不暴露到外部网络
- **URL Token**：路径含 32 字符随机 token，攻击者无法猜测 URL
- **端口**：操作系统分配的随机高位端口（`listen(0)`）
- **请求来源校验**：校验 `Host` header，拒绝非 `localhost` / `127.0.0.1` 请求
- **会话隔离**：MCP transport 按 `Mcp-Session-Id` 管理，避免多个 agent MCP session 共享同一个 transport
- **最小可见范围**：默认只追加给声明 `mcpCapabilities.http === true` 的 agent
- **降级策略**：HTTP MCP server 启动失败时只跳过内置 MCP server，不影响 ACP 标准文件/终端能力

**安全边界说明**：URL token + loopback 只能降低误连和远程访问风险，不能抵御同机恶意进程。因为 WebMCP 工具包含文件写入、终端和编辑器操作，后续如需更强隔离，应引入 per window/client/session token，并把 token 与当前 workspace/cwd 绑定。

## 生命周期管理

| 事件 | 行为 |
| --- | --- |
| Browser RPC ready 后首次创建 ACP session | `OpenSumiMcpHttpServer.start()`，监听端口 |
| `newSession` / `loadSession` / `loadSessionOrNew` | `AcpAgentService` 按 capability 注入 URL 到 `mcpServers` |
| Agent MCP 初始化 | 创建独立 `StreamableHTTPServerTransport`，按 `Mcp-Session-Id` 存储 |
| Agent 重启/重连 | 复用 HTTP server，重新建立 MCP transport session |
| Browser RPC 未就绪 | `tools/list` 或 `tools/call` 返回 MCP error，不阻塞 ACP session 创建 |
| OpenSumi Node 退出 | `dispose()`，关闭 HTTP server |

**注意**：HTTP server 可以是进程级单例，但 MCP transport 不应是单例。每个 MCP client session 使用独立 transport，工具定义和调用仍通过同一个 `AcpWebMcpCallerService` 懒加载到浏览器侧。

## 渐进式实现路径

### P0 — MVP（验证链路）

1. 实现低阶 `Server + StreamableHTTPServerTransport` 的 `OpenSumiMcpHttpServer`
2. 只暴露一个工具（如 `file_read`），端到端跑通
3. 在 `AcpAgentService.getSessionMcpServers()` 中按 `mcpCapabilities.http` 注入 URL，并同步更新 create/load/loadOrNew 调用点

**验收标准：** 在 chat 中问 "请读取 README.md 的前 10 行"，LLM 调用 `mcp__opensumi-ide__file_read`，能看到正确返回。

### P1 — 全量接入

1. 全部 3 个组（file/terminal/editor）所有工具暴露
2. `tools/list` 原样返回 WebMCP JSON Schema，不做 JSON Schema → Zod 转换
3. 完善错误处理（HTTP 错误、工具异常、RPC 未就绪、超时）
4. 完善日志（与现有 `[AcpWebMcpHandler]` 日志风格一致）
5. 单元测试覆盖 `OpenSumiMcpHttpServer`

### P2 — 健壮性

1. 添加 Host header 校验和 token 校验测试
2. MCP session/transport 并发测试
3. create/load/loadOrNew 三条 ACP session 路径测试
4. 优雅关闭（in-flight 请求处理）
5. 性能基准测试（HTTP 调用延迟 < 5ms）

### P3 — 清理废弃路径

1. 在至少 claude-agent-acp 和一个其他 HTTP MCP agent 验证通过后，再移除 `extMethod` fallback
2. 移除 `_meta.opensumi.webmcp` 能力声明
3. 移除 `AcpWebMcpHandler` 类
4. 浏览器侧 `WebMcpGroupRegistry` 保留不动（仍在使用）

## 方案优势

- ✅ **零修改 agent**：完全走 ACP 标准 `mcpServers` 通道
- ✅ **零新进程**：在 OpenSumi Node 内嵌 HTTP server
- ✅ **复用 WebMCP**：`WebMcpGroupRegistry` 完全不动
- ✅ **跨 agent 通用**：任何支持 HTTP MCP 的 ACP agent 都能用
- ✅ **跨平台**：HTTP 天然跨平台，无 Unix socket / Named Pipe 兼容性问题
- ✅ **代码量可控**：核心实现预计 ~180-250 行
- ✅ **可降级**：HTTP server 失败不影响标准 ACP 功能

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 端口被占用 | 启动失败 | `listen(0)` 让 OS 分配，几乎不会冲突 |
| 本地恶意进程访问 | 工具被滥用 | URL token + Host header 校验 |
| transport 共享导致并发串线 | MCP session 异常或响应错配 | 按 `Mcp-Session-Id` 管理 transport，不使用单 transport |
| Browser RPC 未就绪 | `tools/list` 失败 | HTTP server 懒启动，工具列表懒加载，失败时返回 MCP error |
| JSON Schema 与 MCP SDK 高阶 API 不匹配 | 工具注册失败或 schema 丢失 | 使用低阶 `Server` 直接返回 JSON Schema |
| HTTP 调用延迟 | LLM 工具调用 +1-2ms | 实测验证；远低于 LLM 推理时间 |
| MCP SDK 依赖 | 版本 API 差异 | 当前仓库已有 `@modelcontextprotocol/sdk@1.11.4`，实现按该版本验证 |

## WebMCP Tool 能力分层

Agent 需要的是完成开发任务的 IDE 闭环能力，而不是完整遥控 IDE。工具粒度应保持在“IDE 语义动作”层：比内部 service API 更粗，比“一键完成任务”更细。

### 默认暴露组

| 组            | 工具                                               | 目标                                     |
| ------------- | -------------------------------------------------- | ---------------------------------------- |
| `workspace`   | `getInfo`、`listOpenFiles`、`listRecentWorkspaces` | 理解工作区、打开文件和用户当前上下文     |
| `search`      | `files`、`text`、`symbols`                         | 在不打开终端的情况下查找文件、文本和符号 |
| `diagnostics` | `list`、`getStats`、`open`                         | 读取 IDE 问题面板，并跳转到错误位置      |
| `file`        | 现有文件工具                                       | 读取、创建和修改 workspace 文件          |
| `editor`      | 现有编辑器工具                                     | 打开、跳转、选择、格式化和保存           |
| `terminal`    | 现有终端工具                                       | 创建终端、展示终端、执行验证命令         |

### 后续扩展组

| 组 | 建议工具 | 默认策略 |
| --- | --- | --- |
| `scm` | `status`、`diff`、`openChangedFile`、`commit` | `status/diff/openChangedFile` 默认可暴露，`commit` 需要权限 |
| `debug` | `listSessions`、`start`、`stop`、`continue`、`stackTrace` | 默认不暴露或按用户配置暴露 |
| `commands` | `list`、`execute` | 只允许 allowlist command，不能暴露任意 command id |
| `ui` | `showMessage`、`showQuickPick`、`focusPanel` | 只暴露低风险交互动作 |

### 暴露策略

`WebMcpToolDef` 支持轻量元数据：

```typescript
type WebMcpToolRiskLevel = 'read' | 'write' | 'destructive' | 'shell' | 'ui';

interface WebMcpToolDef {
  method: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskLevel?: WebMcpToolRiskLevel;
  exposedByDefault?: boolean;
}
```

HTTP MCP 入口只暴露 `defaultLoaded` group 中 `exposedByDefault !== false` 的工具。这样新增高风险工具时，可以先注册在 WebMCP registry 中，但不进入 agent 默认 `tools/list`。

### 上下文预算观测

`tools/list` 日志需要持续观察三类大小：

- `schemaBytes`：JSON Schema 体积
- `descriptionBytes`：工具描述体积
- `totalToolBytes`：实际 MCP tool definition 体积

同时输出每个 group 的工具数和字节数，以及 top 5 最大工具。这样可以判断上下文增长来自 schema、description，还是工具数量本身。

## 与现有代码的关系

### 保留不动

- `WebMcpGroupRegistry` (Browser)
- `AcpWebMcpRpcService` (Browser → Node RPC)
- `AcpWebMcpCallerService` (Node)
- 所有 webmcp-groups 实现

### 修改

- `AcpAgentService.getSessionMcpServers()`：在 `mcpServers` 数组中追加 `opensumi-ide` 配置，并更新 create/load/loadOrNew 调用点（约 40 行）
- DI 模块：注册 `OpenSumiMcpHttpServer` 并在合适时机启动

### 新增

- `OpenSumiMcpHttpServer` 类（~180 行）
- 单元测试

### 移除（P3 阶段）

- `AcpThread.createClientImpl()` 中的 `extMethod` 处理逻辑
- `_meta.opensumi.webmcp` 能力声明
- `AcpWebMcpHandler` 类

## 参考

- ACP 协议：https://agentclientprotocol.com/
- MCP 协议：https://modelcontextprotocol.io/
- MCP TypeScript SDK：https://github.com/modelcontextprotocol/typescript-sdk
- MCP HTTP transport：https://modelcontextprotocol.io/docs/concepts/transports#streamable-http
- 现有 WebMCP 实现：`packages/ai-native/src/browser/acp/webmcp-group-registry.ts`
- Agent 端 MCP server 处理：claude-agent-acp `src/acp-agent.ts:1923-1947`（已验证支持 HTTP MCP server）

## 附录：兼容性验证

### claude-agent-acp 对 HTTP MCP server 的处理

源码 `src/acp-agent.ts:1923-1947`：

```typescript
const mcpServers: Record<string, McpServerConfig> = {};
if (Array.isArray(params.mcpServers)) {
  for (const server of params.mcpServers) {
    if ('type' in server && (server.type === 'http' || server.type === 'sse')) {
      // HTTP or SSE type MCP server
      mcpServers[server.name] = {
        type: server.type,
        url: server.url,
        headers: server.headers ? Object.fromEntries(server.headers.map((e) => [e.name, e.value])) : undefined,
      };
    }
    // ...
  }
}
```

✅ 确认 HTTP MCP server 配置（`type: "http"`、`url`）会被正确转换为 Claude Agent SDK 的 `McpHttpServerConfig`，无需任何 agent 改动。

### Agent 能力声明确认

日志中已确认 agent 通过 `InitializeResponse.agentCapabilities` 声明：

```json
{
  "mcpCapabilities": {
    "http": true,
    "sse": true
  }
}
```

✅ Agent 原生支持 HTTP MCP server。
