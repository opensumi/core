# Phase 2 Plan: HTTP MCP Bridge 成为主扩展路径

## 目标

把 OpenSumi ACP 的 IDE 能力扩展主路径从 `_meta.opensumi.webmcp + extMethod` 切换为标准 `mcpServers + HTTP MCP`。

完成本阶段后：

- 标准 ACP agent 不需要实现 OpenSumi 私有 `extMethod`，也能通过 `opensumi-ide` MCP server 使用 OpenSumi IDE 能力。
- `OpenSumiMcpHttpServer` 是 IDE 能力扩展的默认入口。
- `extMethod` 相关代码从 ACP client 实现中删除，不保留旧 agent fallback。
- 阶段 2 验收前，先不推进 ACP Core correctness、权限统一、更多 IDE 能力产品化等后续工作。

## 非目标

- 不在本阶段重构整个 ACP Core 状态模型。
- 不新增大批 IDE 工具能力，只保证现有 WebMCP 工具能通过 HTTP MCP 主路径稳定可用。
- 不继续维护 `AcpWebMcpHandler`/`extMethod` 兼容入口。
- 不改变标准 ACP 文件、终端、permission 基础能力。

## 当前代码状态

- `OpenSumiMcpHttpServer` 已存在，使用 loopback HTTP MCP server 暴露 OpenSumi IDE 能力。
- `OpenSumiMcpHttpServer` 已具备：
  - capability catalog tools：`opensumi_discoverCapabilities`、`opensumi_describeCapabilityGroup`、`opensumi_describeTool`、`opensumi_enableCapabilityGroup`、`opensumi_invokeCapabilityTool`。
  - 按 group 启用工具。
  - 默认工具暴露、profile/risk 过滤。
  - `opensumi_invokeCapabilityTool` fallback broker。
  - path/token/host 基础校验，校验失败返回 404。
  - tools/list 工具数量、schema bytes、description bytes 日志。
- `OpenSumiMcpHttpServer.start()` 当前仍通过 `getUrl()` 打印完整 MCP URL，日志中会包含 token，需改为脱敏输出。
- `AcpAgentService.getSessionMcpServers()` 已按 agent capability 过滤用户配置的 HTTP/SSE MCP server。
- `AcpAgentService.getSessionMcpServers()` 已在 `agentCapabilities.mcpCapabilities.http === true` 时追加内置 `opensumi-ide` server。
- `AcpAgentService.getSessionMcpServers()` 已处理同名 server 去重和内置 HTTP MCP server 启动失败降级。
- `createSession`、`loadSession`、`loadSessionOrNew` 已通过 `getSessionMcpServers()` 注入 `mcpServers`。
- `forkSession` 仍直接透传 `params.mcpServers`，没有统一追加内置 `opensumi-ide`。
- `resumeSession` 当前未传 `mcpServers`，需要确认 ACP SDK/agent 是否支持在 resume 时更新 MCP server。
- `AcpThread.initialize()` 已不再通过 `clientCapabilities._meta` 暴露 WebMCP 私有能力元信息。
- `AcpThread.initialize()` 已移除为 `_meta` 准备的 eager WebMCP 初始化和空 `_meta` 日志。
- `AcpThread.createClientImpl()` 已删除 `extMethod`/`extNotification` client methods。
- `AcpWebMcpHandler` 及其 node 单测已删除。
- `packages/ai-native/src/node/acp/index.ts` 已不再导出 `AcpWebMcpHandler`。
- `sendPrompt()` 仍会在首轮追加 MCP capability hint，且 capability/terminal 问题会继续追加提示；当前未检查本 session 是否确实成功注入 `opensumi-ide`。
- `withWebMcpCapabilityHint()`、`getWebMcpCapabilitySummary()` 等命名仍保留 WebMCP 语义，后续应改成 MCP-oriented 命名。
- HTTP MCP server 当前的 URL/token 是进程级别；MCP transport state 只记录 MCP session id 和 `enabledGroups`，尚未绑定 ACP session id。
- `AcpWebMcpCallerService.executeTool()` 当前没有接收 ACP session 上下文，多 ACP session 并发时仍有串 session 风险。
- 当前 node 单测已覆盖 `getSessionMcpServers()` 的 HTTP MCP supported/unsupported 基础分支，以及 `OpenSumiMcpHttpServer` 的 tools/list、tools/call、enable group、fallback broker happy path。
- 当前 node 单测尚未覆盖内置 server 启动失败降级、同名 server 去重、用户配置 HTTP/SSE server 过滤、create/load/loadOrNew 请求参数断言、HTTP MCP 404 校验和 URL/token 脱敏。

## 阶段 2 验收标准

- [ ] 使用 `claude-agent-acp` 创建新 session 后，agent 通过标准 `mcpServers` 发现 `opensumi-ide`。
- [ ] agent 能调用 `opensumi_discoverCapabilities` 读取 live catalog。
- [ ] agent 能启用一个非默认 group，并通过刷新后的 tools/list 或 `opensumi_invokeCapabilityTool` 调用工具。
- [x] `createSession`、`loadSession`、`loadSessionOrNew` 已走内置 HTTP MCP server 注入路径。
- [ ] `forkSession`、`resumeSession` 不遗漏内置 MCP server 注入，或明确记录 SDK/agent 不支持原因。
- [x] agent 不支持 HTTP MCP 时，ACP session 仍可正常创建，只降级为标准 ACP 能力。
- [x] `extMethod` 相关代码已从 node 侧 ACP client 实现中删除；新路径测试不依赖 `extMethod`。
- [x] prompt hint 不再推荐 `_opensumi/*` 或 `extMethod`，只推荐标准 MCP 工具发现入口。
- [ ] HTTP MCP server 的 URL/token 不泄漏到用户可见输出；日志中避免打印完整 token。
- [ ] 多 ACP session 并发时，MCP 工具调用能正确路由到对应 ACP session，或阶段 2 明确限制为单 ACP session 并有保护。

## 执行计划

### 1. 固化 HTTP MCP 主路径

- [x] 梳理所有创建/恢复 ACP session 的入口：
  - `createSession`
  - `loadSession`
  - `loadSessionOrNew`
  - `resumeSession`
  - `forkSession`
- [x] `createSession`、`loadSession`、`loadSessionOrNew` 统一通过 service 层 `getSessionMcpServers()` 构造 session `mcpServers`。
- [x] `getSessionMcpServers()` 按 agent capability 过滤不支持的 HTTP/SSE MCP server。
- [x] 对内置 `opensumi-ide` server 做同名去重，避免用户配置同名 MCP server 时重复注入。
- [x] 当 agent `mcpCapabilities.http !== true` 时跳过内置 HTTP MCP 注入，并记录降级日志。
- [x] 当 `OpenSumiMcpHttpServer.start()` 失败时跳过内置 server，不影响 ACP session 创建。
- [ ] `forkSession` 改为通过 service 层方法构造 `mcpServers`，避免只透传 `params.mcpServers`。
- [ ] `resumeSession` 评估 SDK 请求结构是否支持 `mcpServers`：
  - 如果支持，统一注入 `getSessionMcpServers()`。
  - 如果不支持，在代码和文档中说明 resume 不更新 MCP server，依赖原 session 创建时的 MCP 配置。
- [ ] 为 `createSession`、`loadSession`、`loadSessionOrNew` 增加断言，确认请求中包含内置 `opensumi-ide`。
- [ ] 为 `forkSession`、`resumeSession` 补注入/不支持原因测试。

### 2. 绑定 MCP 调用与 ACP session

当前 HTTP MCP server 使用进程级 URL/token，MCP session id 不等同于 ACP session id。成为主路径前必须明确 session 绑定策略，否则 `permission`、`acp_chat`、terminal 交互等能力容易误用全局 active session。

- [ ] 评估并选择一种绑定方式：
  - 每个 ACP session 分配独立 token/URL。
  - 或 URL token 映射到 ACP session id。
  - 或在 MCP transport 初始化时记录创建来源并绑定 ACP session id。
- [ ] `OpenSumiMcpHttpServer` 增加 ACP session scoped state，而不仅是 MCP transport scoped `enabledGroups`。
- [ ] `AcpAgentService.getSessionMcpServers()` 返回的内置 server URL 能携带或映射 ACP session 身份。
- [ ] `tools/call` 进入 `AcpWebMcpCallerService.executeTool()` 时携带 ACP session 上下文。
- [ ] permission、acp_chat、terminal 等 session-sensitive 工具不能依赖全局 active session。
- [ ] 多 session 并发调用同一个工具时增加测试。

### 3. 调整 capability hint

- [x] 修改 capability hint，只引导使用 MCP tools：
  - `opensumi_discoverCapabilities`
  - `opensumi_enableCapabilityGroup`
  - `opensumi_invokeCapabilityTool`
- [x] 删除或弱化对 `_opensumi/*`、`extMethod`、私有 `_meta` 的推荐描述。
- [x] 保留“当用户询问 IDE/OpenSumi 能力时，从 live MCP metadata 回答”的提示。
- [ ] 记录 session 是否成功注入内置 `opensumi-ide`，例如在 service 层保存 session MCP injection result。
- [ ] 只有确认当前 session 成功注入 `opensumi-ide` 后，才追加 MCP capability hint。
- [ ] 当 HTTP MCP 未注入成功时，不追加 terminal/capability MCP hint，避免 agent 被引导到不可用能力。
- [ ] 将 `withWebMcpCapabilityHint()` 改名为 MCP-oriented 命名，例如 `withOpenSumiMcpCapabilityHint()`。
- [ ] 将 `getWebMcpCapabilitySummary()`、`needsWebMcpCapabilityQuestionHint()`、`needsWebMcpTerminalHint()` 等命名同步收敛，避免新主路径继续叫 WebMCP。

### 4. 删除 extMethod 旧路径

- [x] `AcpThread.initialize()` 不再把 `_meta.opensumi.webmcp` 作为主能力声明。
- [x] 移除为 `_meta` 准备的 eager WebMCP 初始化和空 `_meta` 日志。
- [x] `AcpThread.createClientImpl()` 删除 `extMethod`/`extNotification` 处理器。
- [x] 删除 `AcpWebMcpHandler`。
- [x] 删除 `AcpWebMcpHandler` 单测。
- [x] 删除 node 侧 `AcpWebMcpHandler` 导出。
- [ ] 禁止新增 `_opensumi/*` extMethod-only 能力；新增 IDE 能力必须先走 HTTP MCP catalog。
- [ ] 清理其他设计文档中把 `extMethod` 描述为可用路径的旧内容。

### 5. 收敛工具暴露策略

- [x] `tools/list` 默认返回 capability catalog 和按 profile/risk 过滤后的默认工具。
- [x] `opensumi_enableCapabilityGroup` 改变当前 MCP session 的工具可见性；当前作用域是 MCP transport session 内的 `enabledGroups`。
- [x] `opensumi_invokeCapabilityTool` 作为工具列表未刷新时的 fallback broker。
- [x] 对 `write`、`shell`、`destructive` 工具保持默认不暴露或按 profile 限制。
- [x] 记录每次 tools/list 的 group 数、tool 数、schema bytes 和 description bytes。
- [ ] 把 `enabledGroups` 从纯 MCP session state 升级为 ACP session scoped state，或明确它只影响 MCP session。
- [ ] 明确 `write`、`shell`、`destructive` 工具被启用后是否还必须走 ACP permission routing。

### 6. 测试补齐

- [ ] `OpenSumiMcpHttpServer`:
  - [x] tools/list 返回默认 catalog。
  - [x] tools/call 能执行默认暴露工具。
  - [x] enable group 后工具可见性变化。
  - [x] invoke fallback 能调用已启用 group 的工具。
  - [x] 未暴露工具拒绝直接调用。
  - [ ] token/path/host 校验失败返回 404。
  - [ ] URL/token 日志脱敏；当前 `start()` 日志仍会输出完整 `getUrl()`。
  - [ ] ACP session scoped URL/state。
- [ ] `AcpAgentService`:
  - [x] HTTP MCP supported 时注入 `opensumi-ide`。
  - [x] HTTP MCP unsupported 时不注入。
  - [ ] 不支持 HTTP/SSE 时过滤用户配置的对应 MCP server。
  - [ ] server 启动失败时降级。
  - [ ] 同名 server 去重。
  - [ ] create/load/loadOrNew 路径都把内置 `opensumi-ide` 传给 agent。
  - [ ] resume/fork 路径覆盖。
- [ ] Prompt hint:
  - [ ] HTTP MCP 注入成功才追加 MCP capability hint。
  - [x] hint 不再包含 `_opensumi/*` 主路径描述。
- [x] Legacy extMethod:
  - [x] node 侧 `extMethod`/`extNotification` 处理器已删除。
  - [x] `AcpWebMcpHandler` 及其单测已删除。
  - [x] 新路径测试不依赖 `extMethod`。
- [x] 回归执行：
  - `yarn test packages/ai-native/__test__/node/acp/acp-thread.test.ts packages/ai-native/__test__/node/acp-agent.service.test.ts packages/ai-native/__test__/node/opensumi-mcp-http-server.test.ts --runInBand`

### 7. 手工验收

- [ ] 使用 `claude-agent-acp` 新建 session。
- [ ] 询问 agent “OpenSumi 有哪些 IDE 能力可用”，确认它调用 MCP catalog。
- [ ] 让 agent 启用 `editor`、`diagnostics`、`search` 或 `terminal` group。
- [ ] 调用一个只来自 OpenSumi IDE 的工具，例如 active editor、diagnostics summary、search 或 IDE terminal。
- [ ] 关闭并重新打开 session，确认 load/loadOrNew 仍注入 MCP server。
- [ ] 使用不支持 HTTP MCP 的 agent 验证标准 ACP 能力仍可用，且 prompt 不引导到不可用 MCP 工具。
- [ ] 多开两个 ACP session，验证 MCP 工具调用不会串到另一个 session。

## 风险与处理

| 风险                            | 处理                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| agent 不刷新 tools/list         | 保留 `opensumi_invokeCapabilityTool` fallback broker                 |
| 多 ACP session 调用串 session   | 在本阶段完成 ACP session scoped MCP URL/state，或明确单 session 限制 |
| HTTP MCP server 启动失败        | 降级为标准 ACP，不阻塞 session 创建                                  |
| 工具列表过大                    | 默认只暴露 catalog 和低风险工具，按 group 启用                       |
| 旧 agent 依赖 `extMethod`       | 不兼容旧私有路径；要求 agent 使用标准 `mcpServers + HTTP MCP`        |
| prompt hint 指向不可用 MCP 工具 | 只有确认当前 session 内置 MCP server 注入成功后再追加 hint           |
| URL/token 泄漏                  | 日志脱敏；用户可见输出不打印完整 URL/token                           |

## 完成后再推进

本阶段验收通过后，再继续 `acp-zed-compat-plan-todo.md` 中的其他工作：

1. 标准 ACP Core correctness。
2. OpenSumi IDE 能力产品化扩展。
3. 权限模型统一。
4. Transcript/e2e 兼容性测试矩阵。
