# OpenCode CLI、Web、Server 与 SDK：rootAgent 编排接口研究

**研究目标：**判断 Codex App 中的 rootAgent 应通过 `opencode run`、OpenCode Web，还是 `opencode serve` + SDK/API 调度工作项代理。

**资料范围：**OpenCode 官方中文文档及官方源码。源码结论固定在提交 [`ebece6e`](https://github.com/anomalyco/opencode/commit/ebece6efd7b11401cf1e7390b5a22991b6608cc4)；OpenCode 正在持续演进，实施时还应固定实际安装版本并以该版本 `/doc` 暴露的 OpenAPI 规范和生成类型为准。

## 结论

**Q27 应从原来的“CLI PoC，随后迁移”调整为：控制面 PoC 从第一版就使用由 rootAgent 托管生命周期的 `opencode serve` + `@opencode-ai/sdk`；`opencode run --format json` 只用于安装连通性和提示词/profile 的冒烟测试，不建设正式 CLI adapter；OpenCode Web 不进入自动化调用链。**

理由是：CLI `run` 的官方定位是一次性非交互运行；它能输出 JSON、选择/继续会话并连接已有服务器，但进程围绕一次提示词运行并在会话空闲时结束。Server/API 则直接暴露异步提示、SSE 事件、会话状态、取消、权限回复、消息/差异读取等编排原语，SDK 还支持 JSON Schema 结构化输出。Web 只是同一服务器之上的人类浏览器界面，不是另一套自动化 API。[CLI：`run`](https://opencode.ai/docs/zh-cn/cli/#run)、[Server API](https://opencode.ai/docs/zh-cn/server/#api)、[SDK：结构化输出](https://opencode.ai/docs/zh-cn/sdk/#%E7%BB%93%E6%9E%84%E5%8C%96%E8%BE%93%E5%87%BA)、[Web：使用界面](https://opencode.ai/docs/zh-cn/web/#%E4%BD%BF%E7%94%A8-web-%E7%95%8C%E9%9D%A2)、[官方 `run` 源码的生命周期说明](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L3-L15)。

## 四种入口的真实定位

| 入口 | 生命周期与界面 | 适合 rootAgent 的程度 |
| --- | --- | --- |
| `opencode run` | 默认建立进程内 server，发送一次提示词、输出结果/事件，在会话进入 `idle` 后退出；也可用 `--attach` 连接已有 server | 适合冒烟测试和简单脚本，不适合作为长期编排协议 |
| `opencode web` | 启动 server、打开浏览器并持续运行；页面用于人类查看、创建和管理会话 | 不应成为自动化依赖；调试时可作为可选观察器 |
| `opencode serve` | 启动无界面、持续运行的 HTTP server，发布 OpenAPI 3.1 与 SSE | 适合作为 OpenCode worker 的正式进程边界 |
| JS/TS SDK | 可连接已有 server；官方还提供同时启动 server 和 client 的 `createOpencode()` | 适合 rootAgent 控制面，以类型安全方式调用 server |

`run` 在未使用 `--attach` 时明确使用进程内 server，并在 `session.status=idle` 后结束事件循环；它支持 `--continue`、`--session`、`--fork`、`--agent`、`--format json` 和 `--attach`。官方也建议通过 attach 到长期 server 来避免 MCP 冷启动。[CLI：`run` 及 flags](https://opencode.ai/docs/zh-cn/cli/#run)、[官方源码：默认进程内 server](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L126-L134)、[官方源码：监听 idle](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L793-L799)。

`serve` 是官方定义的“无界面 OpenCode 服务器”，以 OpenAPI 提供编程接口；`web` 调用同一个 `Server.listen`，额外打开浏览器，然后同样保持进程运行。因此 Web UI 是人工客户端，不是 rootAgent 应抓取或自动点击的接口；如果需要人工排查，Web/TUI 可以作为连接同一 server、共享会话和状态的辅助客户端。[Server：工作原理](https://opencode.ai/docs/zh-cn/server/#%E5%B7%A5%E4%BD%9C%E5%8E%9F%E7%90%86)、[Web：连接终端](https://opencode.ai/docs/zh-cn/web/#%E8%BF%9E%E6%8E%A5%E7%BB%88%E7%AB%AF)、[官方 `serve` 源码](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/serve.ts#L6-L23)、[官方 `web` 源码](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/web.ts#L31-L83)。

## 控制面需要的能力对比

| 需求 | `run --format json` | `serve` + SDK/API |
| --- | --- | --- |
| 非交互执行 | 支持 | 支持同步或异步 prompt |
| 结构化过程事件 | stdout JSON 行，但由 CLI 转译/筛选 | 原生 `/event`、`/global/event` SSE |
| 机器可校验最终结果 | 需从事件/文本自行组装 | SDK 支持 JSON Schema 验证和失败重试 |
| 状态查询 | 主要依赖当前进程输出 | `/session/status` 可查询全部会话状态 |
| 取消 | 终止 CLI 进程是外围手段 | `/session/:id/abort` 是显式协议 |
| 会话恢复 | `--session` / `--continue` | 可列出、读取消息并继续指定 session |
| 权限审批 | 非交互模式默认自动拒绝 `ask`；`--auto` 会自动批准且被标为危险 | 事件中接收权限请求，再通过权限 API 精确回复 |
| 多任务编排 | 每个子进程自行管理一次运行 | 多个 session 可独立寻址、查询与订阅；并发上限仍由 rootAgent 控制 |
| 人类 UI | 无 | Web/TUI 可作为旁路观察器，不影响控制协议 |

Server 官方 API 包含 `POST /session/:id/prompt_async`、`GET /session/status`、`POST /session/:id/abort`、会话消息/子会话/差异读取、权限回复以及 SSE `/event`；这些正好覆盖启动、观测、取消、恢复和审批。它没有声明“持久任务队列、租约、自动重试或 server 崩溃后继续正在生成的响应”，因此这些能力必须属于 rootAgent 的确定性编排器，不能由 OpenCode 会话替代。[Server：会话与消息 API](https://opencode.ai/docs/zh-cn/server/#%E4%BC%9A%E8%AF%9D)、[Server：事件](https://opencode.ai/docs/zh-cn/server/#%E4%BA%8B%E4%BB%B6)。

官方 SDK 能启动 server + client，也能以 `createOpencodeClient` 连接已有实例；其 API 类型由 server 的 OpenAPI 生成。SDK 的结构化输出通过 JSON Schema 约束结果，并提供 `retryCount` 和 `StructuredOutputError`。这比让 rootAgent 从自由文本或 CLI 的事件片段猜测 `completed | needs_decision | failed | blocked` 更适合工作项交付契约。[SDK：创建客户端与仅客户端模式](https://opencode.ai/docs/zh-cn/sdk/#%E5%88%9B%E5%BB%BA%E5%AE%A2%E6%88%B7%E7%AB%AF)、[SDK：类型](https://opencode.ai/docs/zh-cn/sdk/#%E7%B1%BB%E5%9E%8B)、[SDK：结构化输出](https://opencode.ai/docs/zh-cn/sdk/#%E7%BB%93%E6%9E%84%E5%8C%96%E8%BE%93%E5%87%BA)。

## CLI 作为正式 adapter 的具体问题

1. `run --format json` 虽称 JSON 事件，但当前实现并非把 server SSE 原样透传，而是将工具完成、步骤、文本、推理和错误转成 CLI 自己的 JSON 行；rootAgent 若依赖这些行，会额外绑定 CLI 的呈现层。[官方源码：CLI JSON emit](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L678-L690)、[官方源码：事件转译](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L720-L790)。
2. 非交互 `run` 遇到 `permission.asked` 时默认拒绝；`--auto` 则批准未显式拒绝的请求，源码直接将它标记为 dangerous。这不符合 rootAgent“允许列表自动执行、其余精确暂停或拒绝”的审批模型。[官方源码：`--auto`](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L249-L264)、[官方源码：权限请求处理](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L801-L820)。
3. 每次默认运行都拥有自己的进程/进程内 server 生命周期，取消、超时、断线重连和多个 session 的协调只能由外层用进程信号和日志拼装；使用 `--attach` 虽可复用 server，却仍然不如直接调用同一个 server API 完整。[官方源码：`run` 三种模式](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L3-L15)、[CLI：attach](https://opencode.ai/docs/zh-cn/cli/#run)。

因此 CLI 可保留两项用途：安装健康检查，以及在开发 OpenCode profile 时人工验证一条提示词；正式运行记录应来自 SDK 请求/响应、SSE 原始事件和 rootAgent 自己的状态机。

## 推荐拓扑

首期建议采用“**每个活动 worktree 一个受 rootAgent 管理的 OpenCode worker server**”，而不是一个全局 Web 服务器：

```text
Codex App
  └─ rootAgent
      └─ deterministic orchestrator
          ├─ worktree A → opencode serve A → SDK client → Implement session
          ├─ worktree B → opencode serve B → SDK client → Implement session
          └─ worktree C → opencode serve C → SDK client → Verify/Review session
```

OpenCode server/SDK 当前支持用 directory 选择项目实例，因此单 server 技术上可以服务多个目录；但一 worktree 一进程更容易把文件访问范围、配置、日志、预算、崩溃影响和清理动作对齐到一个 worker 租约。它是控制面的隔离策略，不代表 OpenCode server 自身是 OS 沙箱。[官方源码：`serve` 按请求加载目录实例](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/serve.ts#L9-L12)、[官方 SDK client 的 directory 路由](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/sdk/js/src/client.ts#L17-L56)。

rootAgent 应保存 `workItemID ↔ repo/worktree ↔ server PID/port ↔ sessionID ↔ lastEventCursor/lastKnownStatus`。重启后先检查 server health、会话列表/消息/status 和 Git/worktree 实际状态，再决定继续、重试或标记失败。OpenCode 记录对话历史，但官方 API 未承诺持久化“正在运行的工作租约”；当前 session status 实现也是按 session 保存在实例内存 Map 中，`idle` 后删除，因此不能把它当作控制面的持久状态源。[Server：health、session status 与 messages](https://opencode.ai/docs/zh-cn/server/#api)、[官方源码：SessionStatus 内存状态](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/session/status.ts#L21-L48)。

协议支持多个独立 session 和异步 prompt，但官方文档没有提供资源调度或并发额度机制。rootAgent 仍应执行已确定的并发限制（首期两个写 worktree 加一个只读任务）、超时、最多修复轮次以及 server 进程回收。[Server：session create/status/prompt_async](https://opencode.ai/docs/zh-cn/server/#%E4%BC%9A%E8%AF%9D)。

## 本地安全基线

- server 固定绑定 `127.0.0.1`，不启用 `0.0.0.0`、mDNS 或额外 CORS；官方默认 host 本身就是 `127.0.0.1`。即便仅本机访问，也为每个 worker 生成独立随机 `OPENCODE_SERVER_PASSWORD`，通过 Basic Auth 连接，凭据只放进子进程环境和内存，不写运行报告。[Server：选项与认证](https://opencode.ai/docs/zh-cn/server/#%E7%94%A8%E6%B3%95)、[Web：未设密码的警告](https://opencode.ai/docs/zh-cn/web/#%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B)。
- CORS 只配置浏览器来源，不能代替认证；首期不需要自定义 Web 前端，因此无需配置 CORS。Web 文档将 CORS 和 Basic Auth 分为两个独立配置项。[Web：CORS](https://opencode.ai/docs/zh-cn/web/#cors)、[Web：身份验证](https://opencode.ai/docs/zh-cn/web/#%E8%BA%AB%E4%BB%BD%E9%AA%8C%E8%AF%81)。
- 不接受 OpenCode 的宽松默认权限。每个工作项 profile 都显式设置：允许当前 worktree 内必要读写和验证命令；拒绝 `git push`、发布、生产访问、密钥文件、工作区外路径；Verify/Review 额外拒绝 edit。官方权限支持 `allow | ask | deny`、按命令/路径匹配、agent 级覆盖和 `external_directory`，并明确说明大多数未配置权限默认 `allow`。[Permissions：操作、细粒度规则、默认值与代理覆盖](https://opencode.ai/docs/zh-cn/permissions/)。
- 自动运行中尽量把所有预期动作明确归为 allow 或 deny；只有 rootAgent 能处理的例外才使用 ask，并通过 SSE + 权限 API 回复。不要使用 CLI `--auto` 代替权限策略。[Server：权限回复 API](https://opencode.ai/docs/zh-cn/server/#%E4%BC%9A%E8%AF%9D)、[官方源码：CLI 自动批准语义](https://github.com/anomalyco/opencode/blob/ebece6efd7b11401cf1e7390b5a22991b6608cc4/packages/opencode/src/cli/cmd/run.ts#L801-L820)。

## PoC 实施切片

1. rootAgent 启动一个绑定 loopback、随机端口和随机密码的 `opencode serve`，等待 `/global/health` 成功；进程 PID 和地址写入该 run 的本地运行状态。[Server：health](https://opencode.ai/docs/zh-cn/server/#%E5%85%A8%E5%B1%80)。
2. 通过 SDK 创建一个指定 work-item primary profile 的 session，同时订阅 SSE；使用 `prompt_async` 发起任务，避免让一个 HTTP 请求占据整轮生命周期。[Server：异步消息与事件](https://opencode.ai/docs/zh-cn/server/#%E6%B6%88%E6%81%AF)。
3. 将 SSE 原始事件追加到 `runs/`，用 session status 判定 busy/idle，用显式 abort 处理控制面超时；rootAgent 的状态迁移必须由自己的确定性编排器校验。[Server：status、abort 与 event](https://opencode.ai/docs/zh-cn/server/#api)。
4. 最终提示要求按工作项 JSON Schema 返回 `status`、artifact、commands、assumptions、risks、commit/diff 等字段；校验失败按有限预算重试，仍失败则标为协议失败。[SDK：JSON Schema、retryCount 与 StructuredOutputError](https://opencode.ai/docs/zh-cn/sdk/#%E7%BB%93%E6%9E%84%E5%8C%96%E8%BE%93%E5%87%BA)。
5. PoC 只验证一个真实 AIStudio ticket 的 Implement → Verify → Review 串联；三个阶段用独立 session，写操作只发生在 Implement 的 worktree。OpenCode Web 仅在调试时人工连接观察，不作为验收条件。[Web：会话与共享状态](https://opencode.ai/docs/zh-cn/web/#%E4%BC%9A%E8%AF%9D)、[Web：连接终端](https://opencode.ai/docs/zh-cn/web/#%E8%BF%9E%E6%8E%A5%E7%BB%88%E7%AB%AF)。

## 最终决策建议

- **PoC 自动化接口：**`opencode serve` + 固定版本的 `@opencode-ai/sdk`。
- **CLI：**仅保留为冒烟和人工诊断入口，可用 `opencode run --format json` 验证 profile，不形成生产 adapter。
- **Web：**可选的人类观察/排障 UI，永远不是 rootAgent 控制协议。
- **目标架构：**rootAgent 的确定性编排器持有工作 DAG、预算、worktree 租约、恢复与阶段门；OpenCode server 持有执行 session，SDK/API 是两者边界。
- **升级纪律：**固定 OpenCode/SDK 版本；升级时用该版本 `/doc` OpenAPI 做契约测试，因为官方 SDK 类型由 OpenAPI 生成。[Server：OpenAPI 规范](https://opencode.ai/docs/zh-cn/server/#%E8%A7%84%E8%8C%83)、[SDK：类型来源](https://opencode.ai/docs/zh-cn/sdk/#%E7%B1%BB%E5%9E%8B)。
