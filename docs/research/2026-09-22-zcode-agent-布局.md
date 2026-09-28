# ZCode Agent 架构与布局 — 研究笔记

**研究对象：** ZCode（`/Users/ljs/ant/github/agent/zcode`，AI 编程工作台：Electron 桌面应用 + Web 工作台 + 终端 Agent CLI），重点是其中 "agent" 的**代码模块布局**与 **Agent 面板 UI 布局**。 **资料范围：** 直接阅读 zcode 仓库源码（以源码为一手证据，本文所有 `路径` 引用均相对 `/Users/ljs/ant/github/agent/zcode/`）。OpenSumi 侧仅浏览 `packages/ai-native`（`/Users/ljs/ant/ide/core/packages/ai-native`）用于对比，未做全量调研。 **写作用途：** 供 OpenSumi 核心开发者评估可借鉴点。除特别标注「推测」外均为源码可见事实。

---

## 1. ZCode 整体架构一览

### 1.1 三个运行入口、一套 Agent 运行时

zcode 的核心决策：**Agent 运行时只有一份，位于 `apps/zcode-cli/`，三个入口（Desktop / Web / TUI）都是它的宿主**。

| 入口 | 与 Agent 的关系 | 源码证据 |
| --- | --- | --- |
| Desktop | Electron Main 按 workspace 拉起 Local Host（Electron utilityProcess），Host 内 services 层以子进程 spawn CLI 并走 stdio 协议 | `packages/desktop/src/main/desktopHostProcess.ts:8-12`（`utilityProcess as electronUtilityProcess`）；`packages/services/src/zcode-agent/zcodeAgentProcessManager.ts:369`（`args: [entrypoint, "app-server", "--stdio"]`） |
| Web | 同一后端（`packages/server`，Hono HTTP + WebSocket）同时托管 Web 页面与 Agent 子进程 | `packages/server/src/http.ts:1-40`；`README.md:86-103`（`zcode --web`） |
| TUI | CLI 自带的终端界面，OpenTUI（React 渲染到终端），**业务状态零留存**，session 事件经 relay 下发 | `apps/zcode-cli/packages/tui/package.json`（`@mbears/opentui-react`）；`apps/zcode-cli/AGENTS.md:71` |

根 `AGENTS.md:59` 明确："Desktop app 通过 stdio 与 Agent 通信。协议改动同步更新 `packages/shared/src/zcode-protocol/index.ts`"——进程边界即协议边界。

### 1.2 仓库 / 包结构

```
zcode/  (pnpm monorepo，双 层 workspace)
├─ apps/zcode-cli/            ★ Agent CLI 与运行时（自带子 workspace，16 个包）
│  ├─ packages/cli/           # bin 入口：zcode <args>、TUI 命令、app-server 分流
│  ├─ packages/core/          # ★ Agent 运行时核心：runtime / agent(turn) / tool / permission /
│  │                          #   subagent / mcp / memory / context / hooks / compact / workflow
│  ├─ packages/contracts/     # ★ 纯类型+事件+端口契约（interfaces/*.port.ts、events、model、tools…）
│  ├─ packages/adapters/      # ★ 全部 I/O 落地：model(Vercel AI SDK)、fs、exec、http、mcp、skills、config…
│  ├─ packages/bootstrap/     # 组装层：create-app、会话池、协议 V4 网关、工作流运行时、skills/plugins
│  ├─ packages/dynamic-workflow(-runtime)/  # 模型编写 TS 脚本→编译→多 actor 编排
│  └─ packages/tui/, i18n/, telemetry/, node-repl-host/, debug/, shared-types/ …
├─ packages/                  # 工作台侧（Electron/Web/后端服务）
│  ├─ desktop/                # Electron main / host(utilityProcess) / renderer / scheduler
│  ├─ web/                    # Web 客户端（薄壳，复用 ui）
│  ├─ server/                 # HTTP/WS 服务 + 远程连接（SSH/WSL）；entry-stdio 独立远程入口
│  ├─ zcode-server-cli/       # 独立 Server 启动与进程监管
│  ├─ ui/                     # ★ 共享 React 组件、hooks、Zustand（Agent 面板主体在此 + ui/src/v4）
│  ├─ services/               # 业务服务与持久化（zcode-agent spawn 管理、git、fs、credential、cua…）
│  ├─ shared/                 # 跨端共享协议与类型（zcode-protocol、消息投影、模型选择 schema）
│  ├─ rpc/                    # ★ VS Code 风格 RPC 框架（IMessagePassingProtocol / Channel）
│  ├─ client/                 # Agent 客户端 SDK（websocket / messageport / remoteServiceAccess）
│  ├─ provider / provider-node # Provider&模型配置注册表（zod），provider-node 为 Node 落地
│  └─ zcode-cua/              # 计算机使用（CUA）常驻进程 broker（占位实现，fail-closed）
└─ architecture-policy.yaml   # 模块依赖策略：模块清单+publicEntrypoints+分层+禁环+禁深导入
```

- `architecture-policy.yaml:4-57`：15 个注册模块（rpc/shared/provider/services/session/storage/client/server/ui/web/desktop/zcode-cli…），其中 `storage` 已 `managed: true`（domain/app/adapters 三层、`forbidCycles`、400 行单文件上限）。
- `pnpm-workspace.yaml:1-6`：CLI 子 workspace（`apps/zcode-cli/packages/*`）独立于根 workspace。
- README「仓库结构」表（`README.md:206-219`）与上表对应。

**模块分层纪律（CLI 内部，`apps/zcode-cli/AGENTS.md`）**：`contracts`（契约与端口）← `adapters`（唯一 I/O 出口）← `core`（运行时）← `bootstrap`（组装 + 协议 UI 网关）← `cli/tui`（入口表现层）。核心约束："业务模块不得直接调用 fetch/fs/child_process/process.env"（`apps/zcode-cli/AGENTS.md:53`）、"每个 tool 声明 inputSchema、只读性、破坏性、并发安全、权限需求"（`apps/zcode-cli/AGENTS.md:62-65`）、"session/message/tool/permission/todo 是一等状态对象，TUI 只留交互态"（`apps/zcode-cli/AGENTS.md:70-73`）。

---

## 2. Agent 运行时

### 2.1 会话与事件模型：事件溯源（Event Sourcing）

zcode 的会话不是"消息数组"，而是**事件流 + 投影（projection）**：

- `SessionEvent`：`{ id, sessionId, turnId?, type, timestamp, traceId, sequenceNumber, payload }`（`apps/zcode-cli/packages/contracts/src/events/session.events.ts:72-81`）。
- `SessionEventType` 共 60+ 种，覆盖 turn 生命周期、模型流（`model_request / model_streaming / stream_recovery_*`）、工具（`tool_call_scheduled/started/progress/result/error`、`tool_batch_complete`）、后台任务、权限、compact 边界、rewind/checkpoint、subagent（`subagent_spawned/message/stopped`）、workflow 进度、队列控制（`queue_auto_drain_changed`、`followup_mode_changed`）等（`session.events.ts:83-174`）。
- `EventReducer` 把事件折叠为 `SessionProjection`（`contracts/src/events/event-reducer.ts`）；`SessionEventStorePort` 是持久化端口，`AgentRuntime.resumeFromStore` / `getProjection` 为恢复与查询入口（`apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts:522,586`）。
- 每个运行时持有 `rootTraceContext`（traceId/span 贯穿），`sequenceNumber` 保证事件全序。

**后果（事实）：** 恢复、分叉（`forkWorkspaceFromCheckpoint` / `forkStableConversationAtMessage`）、回滚（`rewindConversationToMessage` / `applyWorkspaceFileRewind`）全部是对事件流的操作（`agent-runtime.ts:605-650`）；UI 侧不自己推导状态，只消费投影。

### 2.2 AgentRuntime：门面 + mixin 分文件 + 端口注入

- `AgentRuntime` 类本身就是会话级对象（一个 session 一个 runtime 实例），`runtime/agent-runtime.ts:132-335`（构造函数注入 30+ deps，全部是 `*Port` / 服务接口）；巨大方法面（admitPrompt、steerTurn、executeTurn、scheduleTools、permission、fork、rewind……）**通过 `installAgentRuntimeMethods(AgentRuntime)` 混入**（`agent-runtime.ts:664`），实现拆在 `runtime/methods/`（100+ 个文件：turn-loop、turn-model-step、compact、microcompact、streaming-recovery、subagent、queue…），绕过 400 行单文件限制。
- 依赖注入的关键端口：`modelFactory`、`contextBuilder`、`skillPort`、`mcpPort`、`subagentPort`、`dynamicWorkflowRunPort`、`modelCatalogPort`、`eventStore`、`sessionStore`、`artifactStore`、`executionPort`、`fileSystemPort`、`permissionService/broker`（`agent-runtime.ts:133-226` 字段清单）。缺省时给 deny-by-default 权限 broker 等安全兜底（`agent-runtime.ts:247-249`）。
- 长程任务原则（`apps/zcode-cli/AGENTS.md:11`）："核心 agent loop 默认面向可持续运行的复杂任务设计，不用 tool call 次数做硬停止"，停止条件由 compact、用户取消、权限拒绝、超时等承担。

### 2.3 Turn：显式状态机 + 双层循环

- **Turn 状态机**：`TurnMachineImpl`（`apps/zcode-cli/packages/core/src/agent/turn-machine.ts:68`）；phase 集合 `idle → processing_input → awaiting_model_response → streaming → scheduling_tools → (awaiting_permission |) executing_tools → aggregating_results → completing / error`（`agent/turn-state.ts:25-36`）。非法迁移抛 `CoreError(InvalidTurnPhase)`（`turn-machine.ts:92-104`）；`getNextPhase()` 给出"流结束有工具 → 调度；工具全完 → 聚合；聚合无失败 → 再请求模型"的循环决策（`turn-machine.ts:308-339`）。
- **主循环**：`runRegularTurnLoop`（`runtime/methods/turn-loop.ts:43`）`while(true)` 内依次：abort 检查 → 排队 runtime command drain → **microcompact/autoCompact**（PreRequest/MidTurn 两阶段上下文预算 + rapid-refill 防抖，`turn-loop.ts:67-102`）→ MCP 初始化 → 每轮过滤 disallowed tools、拼 system reminder（plan-mode 退出提醒、runtime mode、todo 提醒）→ 模型步 → 工具批（`turn-loop.ts:105-155` 及后续）。
- **输入队列与转向（steering）**：会话内 running 时新输入进入 `pendingInputs`，支持 `queuePendingInput / drainPendingInputs`（`turn-machine.ts:221-236`）、单项删除/编辑/重排/reservation（`agent-runtime.ts:425-466`），对应协议 V4 的 queue 语义（hold/提升/自动 drain 开关）。
- **崩溃与断流恢复**：`streaming-recovery`（`runtime/methods/streaming-recovery.ts`）+ 事件 `stream_recovery_*`（`session.events.ts:119-124`）按锚点重放恢复中断的模型流；output-token 截断续写（`runtime/methods/turn-output-token-continuation.ts`）。

### 2.4 子 Agent 与任务编排：存在且分层

zcode 的编排分**三层**，强度递增（这是它与 OpenCode 子代理最大的差异处之一，OpenCode 侧调研见 `docs/research/2026-09-01-opencode-子代理.md`）：

1. **内建子代理（Agent/Task 工具）**：`core/src/subagent/`。`AgentProfile` 用 Markdown frontmatter 定义（name/description/tools/disallowedTools/model/color/maxTurns/permissionMode/memory/mcpServers/background），来源 `built-in | project | user`（`subagent/profile.ts:21-38`）；内置 `general-purpose`（全工具 + injectAgentsMd）与只读 `Explore`（`profile.ts:66-130`）。项目级放在 `.zcode/agents/*.md`，用户级在 storage `agents/` 目录，插件也能贡献 agent（`apps/zcode-cli/packages/bootstrap/src/subagents.ts:52-56,138-140`）。运行器 `subagent/runner.ts:131` 起 `createExploreSubagentPort`：`SubagentPort` 提供 launch/run/start/wait/stop/**sendMessage**（向运行中子代理注入消息）、前台/后台（`runInBackground` / profile `background`）、不活动超时与 **auto-background**、完成通知回父队列。子会话共享父 `eventStore` 并把原事件扇出给外部 sink（`agent-runtime.ts:499-518` 的三个"外部子 runtime 接缝"），子代理经 `createChildClientPorts` 取权限 broker 等端口（`agent-runtime.ts:514-519`）。
2. **后台任务注册表**：`RuntimeTaskRegistry`（`core/src/runtime-task/registry.ts`，`InMemoryRuntimeTaskRegistry` 被 runtime 持有，`agent-runtime.ts:178,284`）统一登记前台/后台 Bash/子代理/工作流，供 UI "Task List" 面板与 `hasResidencyBlockingWork` 常驻判定。
3. **动态工作流（多 actor 图编排）**：模型通过 `CreateWorkflow` 工具写 TypeScript 脚本（`facade`），编译层做**虚拟宿主类型检查 + schema 合成 + 依赖推断 + site 提取**（`apps/zcode-cli/packages/dynamic-workflow/README.md` "Boundaries"：纯库、无 session/IO、从不 import core/bootstrap）；`dynamic-workflow-runtime` 提供沙箱（子进程 + vm + NDJSON 桥），生产 driver（actor 子会话、SQLite journal、工件）在 bootstrap（`bootstrap/src/app/dynamic-workflow-run-*.ts` 十余个文件）。运行中支持 `escalate`（actor 向主代理升级提问）与 `ResolveWorkflowQuestion`、`GetWorkflowRun` 观察工具。

另有一层**闲时/定时任务**（off-peak / cron 工具与 automation 端口，`contracts/src/interfaces/automation.port.ts`、`off-peak.port.ts`；工具处理 `tool/handlers/cron.ts`、`off-peak.ts`），详见 §2.6。

### 2.6 自动化（定时任务）链路深挖

> 2026-09-22 二次深挖产出，均经源码核实，路径相对 `/Users/ljs/ant/github/agent/zcode/`。

**完整链路**：

```
模型调 CronCreate 工具 (CLI 运行时, 经 AutomationPort 协议转发)
  → 宿主 automationService 入库 (SQLite tasks-index: automation 表 + automation_runs 台账)
  → main 拉起的常驻 scheduler 进程 (Electron utilityProcess, 20s 轮询)
  → claimDue 事务认领 (BEGIN IMMEDIATE + running 0→1, single-flight)
  → 认领后把派发请求发回 main → 路由到目标 workspace host
  → host dispatchCronRun: 绑定会话则 resumeTask, 否则 createTask(带 automationId)
    → sendPrompt(traceId=runId) → 跟踪任务终态
  → 回 scheduler 结算 (推进 nextRunAt/runCount; 失败退避重试)
```

**工具面**：恰好 4 个模型工具 `CronCreate / CronList / CronUpdate / CronDelete`（注册于 `core/src/tool/handlers/index.ts:88-91`，`includeAutomation !== true` 时过滤）；契约 `contracts/src/tools/automation.ts:34-127`：

- `cron` 5 字段**本地时区**字符串；`delayMinutes`（1–525600，一次性相对延迟，host 真实时钟锚定，禁止模型自算绝对时刻）；二者互斥。
- "每 N 单位"走 `intervalUnit`(minute/hourly/daily/weekly/monthly/yearly) + `interval`(1–200) 独立字段，cron 只表达时刻槽位。
- `prompt` 必填且要求"完整、不依赖未写出的会话上下文、不得指示再建自动化"；`title` 必填（保留用户口语化的排期短语原文，CronUpdate 每次也必传）。
- `recurring`(默认 true) / `maxRuns`（仅一次性）；一次性判定 `!recurring && (maxRuns ?? 1) <= 1`（`packages/services/src/session/automationCron.ts:44-48`）。
- 权限：create/update/delete 均 `needsApproval: true`；CronList 免批（`cron.ts:153-168,269-278`）。

**台账状态机**（`packages/shared/src/automation-types.ts` + `packages/services/src/session/automationRepo.ts`）：

- automation 生命周期 `active|completed|failed|paused`；派发态 `idle|claimed|dispatched|failed_to_dispatch`；run 派发态 `claimed|dispatched|failed_to_dispatch|skipped`；run 终态 `running|succeeded|failed|stopped`。
- 常量：`DISPATCH_RETRY_BASE_MS=30s`、`CAP=15min`、`MAX_ATTEMPTS=5`、`CLAIM_STALE_MS=10min`（僵尸认领回收）、`MISFIRE_GRACE_MS=5min`（错过即记 `skipped` 不补跑；一次性错过即终态）。
- 重试 runId 稳定 = `automationId:scheduledAt`；manual run = `automationId:manual:<uuid>`（trigger kind `"schedule"|"manual"`）；manual run 不改动 cron 计划（仅 `run_count`/`last_run_at` 展示）；已删除的 automation 回写被丢弃防"复活"；重试退避 `min(30s·2^(n-1), 15min)`，recurring 5 次失败后跳到下个 `next_run_at`，finite 终态 failed。

**防递归派生三重门**：host 准入（sendPrompt 带 automationId → turn denylist 添加三个 cron 变更工具，`bootstrap/src/zcode-protocol/server-operations.ts:2472-2503`）；核心循环（`turn-loop-state.ts:130-138` 状态位 + queryId 前缀 + denylist 三重信号）；handler 层 `assertNotAutomationTurn` 终拒（`cron.ts:39-58`）。CronList 在自动化轮**放行**。

**无人值守与权限**：无 "unattended 模式"开关——权限 ASK 就是**排队等待**（无默认超时，broker 每 1s 向 UI 重播，恢复的 UI 也能应答；AskUserQuestion 是唯一自动解决的交互：60s 宽限/300s 截止）。UI 文案明说"需要确认的操作会暂停任务直到你响应"。manual claim 心跳 60s（`cronRunLifecycle.ts:31,115-127`）正是因为等待无界。

**manual "立即运行"**：service/repo `runNow`（`automationService.ts:452-461`）：BEGIN IMMEDIATE + stale 清扫 + single-flight，插入 manual run（`automationRepo.ts:590-681`）；RPC `runAutomationNow` 重复点击返回 `{status:"duplicate"}`；**无生命周期限制**（paused/completed 亦可 runNow）；`restart`（失败任务重跑）则要求 `lifecycleStatus === "failed"`。

**UI 管理面**（`packages/ui/src/store/automationManagementStore.ts`，全部走 RPC）：list（跨项目）/create（上限 20）/edit/delete/toggle 暂停恢复/restart/runNow/运行历史（无分页、按 automationId 缓存）/删除历史记录；chat 工具卡（`renderers/cron-create.tsx:177-192`）携带 automationId 跳转管理页（`App.tsx:841-845`）。会话列表按 `cronAutomationIdByTaskId` 分组（`lib/taskListMembershipSets.ts:377-378`）。

**绑定会话被删除**：cron 无 pre-dispatch 检查（off-peak 有 `assertBoundSessionDispatchable`）——`resumeTask` 抛 "Session not found"，被当 transient 退避重试 5 次（~8 分钟）后 recurring 跳到下一槽位 / finite 终态 failed。**事件性最终失败，非检测即失败**，且无解绑/级联删除钩子。

**关键文件**：工具 `contracts/src/tools/automation.ts`、`core/src/tool/handlers/cron.ts`；端口 `contracts/src/interfaces/automation.port.ts`，协议落地 `bootstrap/src/zcode-protocol/automation-port.ts`（模型/模式取自 runtime 而非模型入参；`targetTaskId = createContext.sessionId`）；持久化 `packages/services/src/session/automationRepo.ts`、`automationService.ts`、`automationCron.ts`、`automationIntervalCarrier.ts`；调度进程 `packages/desktop/src/scheduler/index.ts`，main 路由 `desktopCronScheduler.ts`；派发执行 `packages/desktop/src/host/index.ts:849-962`（dispatchCronRun）、`host/cronRunLifecycle.ts`。

**不要抄的部分**：Off-Peak（服务端 ticket 排队 + 模型 IO 代理，绑定 zcode 自家账号/服务器体系）。

### 2.5 记忆系统（与编排正交）

项目级自动记忆：`MEMORY.md` + 索引（`core/src/memory/`），后台 `ProjectMemoryExtractionScheduler` 异步提取（`agent-runtime.ts:167,333`），注入到用户上下文段（见 §5）。子代理侧还有 `persistent-memory`（`subagent/persistent-memory.ts`）。

---

## 3. 工具系统

### 3.1 工具契约：声明式安全元数据 + zod schema

`ToolMetadata`（`apps/zcode-cli/packages/core/src/tool/types.ts:65-94`）是整个工具/权限/调度体系的单一事实源：

```ts
{ name, description, modelInstructions?, allowedInPlanMode?, readOnly, destructive,
  concurrentSafe, requiresUserInteraction?, timeoutMs?, maxOutputBytes?,
  sideEffectScope: "none"|"workspace"|"git"|"network"|"system",
  riskLevel, needsApproval, providerVisible?, stopTurnOnSuccess?, mcpPresentation? }
```

- `AGENTS.md`（CLI 层）要求："每个 tool 都应声明 `inputSchema`、`outputSchema`、是否只读…权限需求…副作用范围应显式声明"（`apps/zcode-cli/AGENTS.md:62-65`），并有 "大体积 tool 结果不回灌上下文、落 artifact 只返回摘要"（`AGENTS.md:66`）。
- 注册：`ToolRegistry`（`tool/registry.ts:12-20`）register/unregister/别名（canonical 优先、冲突别名拒绝，`registry.ts:34-71`）；`toContracts()` 输出 `ModelToolContract`（过滤 `providerVisible:false`、拼 modelInstructions 到 description），这是发给模型的工具声明（`registry.ts:104-139`）。MCP 工具也走同一注册表，只带 `mcpPresentation` 显示来源（UI 用，不参与权限，`types.ts:86-93`）。
- **调度**：`ToolScheduler`（`tool/scheduler.ts:50`）对一批 tool call 做拓扑排序 + 并行分组：`destructive→串行`、`concurrentSafe/只读→并行`、`maxConcurrency` 默认 10（`scheduler.ts:48,85-103`）。
- **执行**：`tool/executor/`（impl + call-runner + batch-runner + approval-gate + permission-flow + permission-rules(+persistence) + hook-flow + timeout + turn-control + result-display + result-serialization + validation …）。每个工具的 handler 实现在 `tool/handlers/`（114 个文件：read/edit/write、bash（含整套 `bash-readonly-policy-*` 只读命令静态分析）、glob/grep（可选原生嵌入式搜索）、webfetch（egress guard + 预批 URL + 缓存）、todo、skill、agent、send-message、task-output/stop、node-repl、workflow 系列、read-image/pdf/video、ask-user-question、exit-plan-mode 等）。

### 3.2 权限 / 审批（Permission）

- 判定核心 `PermissionService.checkPermission`（`core/src/permission/service.ts:82-102`）：顺序为 plan-mode 迁移规则 → requiresUserInteraction 工具直接 ask → **alwaysAsk 硬门禁**（不可被模式放行，`service.ts:130-133`）→ yolo 放行 → 显式禁用表 → 项目 deny → 项目 ask → plan 模式 → 项目 allow → webfetch 预批 → workflow 草稿免确认（按位次排布，`service.ts:103-200`）；输出**结构化决定** `{decision: allow|ask|deny, reason, ruleId, escalated, alwaysAsk…}`（`service.ts:61-76`）。规则号（如 `mode.yolo`、`rule.project.deny`、`tool.webfetch.preapproved`）让下游用结构化字段而非字符串匹配分流。
- 会话级 allow 规则随实例消亡（`service.ts:84-88`）；项目级规则与持久化在 `executor/permission-rules.ts` + `permission-rules-persistence.ts`。
- **Broker 端口**：`PermissionBrokerPort` 承载交互请求（emit/resolve），runtime 提供 `emitPermissionRequest / resolvePermission / getPendingPermissionRequests`（`agent-runtime.ts:583-585`）；GUI/TUI 只是不同前端。权限的"带预览审批"：工具可声明 `prepareApproval` 生成 diff 预览，但**预览失败不能取消询问**（fail-open 只作用于预览，`tool/executor/approval-gate.ts:36-75`，见 `gate.ts:61-73` 注释）。
- 模式体系：`CollaborationMode`（yolo/auto/默认 ask）+ plan mode（`permission/plan-mode-policy.ts`；工具 `allowedInPlanMode` 控制，`ExitPlanMode` 工具收口）。

### 3.3 文件编辑（Edit）策略

`tool/handlers/edit.ts`（Claude Code 风格，非 diff/patch）：**必须先 Read**（`ReadFileStateMap` 记录 path→{content,mtimeMs,revisionId}，`types.ts:203-216`）→ `old_string` 精确唯一匹配（否则报错要求更多上下文或 `replace_all`）→ mtime 检测外部修改（`EDIT_STALE_MESSAGE`，拒绝编辑并要求重读，`edit.ts:62-65`）→ 写回后产出结构化 patch（`tool/diff.ts createStructuredPatch`）并在模型回报里附"文件已最新、无需重读"提示以省 token（`edit.ts:75-82`）。Edit 拒绝空路径时保留 code+message 失败契约（`edit.ts:111-115`）。

---

## 4. Provider 抽象与模型访问

两层分工（与名字直观感受不同，`packages/provider` **不是** LLM 调用层）：

1. **配置层（根 `packages/provider` / `provider-node`）**：provider/model 的**注册表与解析**——account-provider 绑定、config overlay、effective model selection、内置 provider 配置物化与 CDN 同步，全部 zod 校验（`packages/provider/src/` 目录：`registry.ts`、`config-service.ts`、`resolver.ts`、`effective-model-selection.ts` 等；`packages/provider-node/src/` 为文件读写与内置源）。
2. **调用层（CLI `packages/adapters/src/model/`）**：基于 **Vercel AI SDK**（`adapters/package.json:102-104`：`@ai-sdk/anthropic` / `openai` / `openai-compatible`，均有 patch）。`AiSdkModelAdapter` 为统一入口（`adapters/src/model/runner.ts:80`），围绕它拆出 retry-policy / retry-budget、`stream-idle-timeout`、failure-classifier（业务错误/TLS/provider 错误分类）、request-admission、**runner-record（模型 IO 轨迹落盘，供 trajectory 调试面板）**、streaming-tool-call-assembler、tool schema strict 化、anthropic/openai 兼容垫片（目录清单即证据）。
3. **端口契约（`contracts/src/model/`）**：`Model` 接口极小：`providerId/modelId/properties/optionSpecs + bind(options) + generateText + streamText`（`model.ts:44-55`）；流事件为判别联合 `ModelStreamEvent`：`start / text_start|delta|end / reasoning_start|delta|end / tool_* / … / compact_stream_boundary`（**流边界只带 provenance 不带正文**，`model/index.ts:715-769`；usage 统计见 `index.ts:522-556`）。会话内换模型、per-request headers、provider runtime headers 注入都有端口（`agent-runtime.ts:151-156`；`runtime/methods/model-runtime-headers.ts`）。

**流式输出传递路径（推测性总结，基于以上事实）**：adapter async-iterator → runtime 归一化（`runtime/methods/model-streaming-event*.ts`、`reasoning-stream.ts`）→ 事件进 `eventStore` + 扇出 `eventSinks` → V4 网关按 topic + flush 窗口批推给 GUI/TUI（`bootstrap/src/zcode-protocol-v4/v4-gateway.ts:1-16` 注释：per-session publisher、不做网关内 IO、物理帧交给宿主 stdio notification）。

---

## 5. 配置与扩展机制

- **AGENTS.md / 用户指令**：解析成 `ResolvedUserInstructions` 后进入上下文段 `Request User Context`（注入目标 `meta_user`、>`# agentsMd` 段头 + "instructions OVERRIDE default behavior" 强调语，`core/src/context/sections/request-user-context.ts:63-70`）；同段还可并入项目记忆 `MEMORY.md` 索引（`request-user-context.ts:73-86`）。CLI 层规范要求"默认兼容 .agents Protocol"（`apps/zcode-cli/AGENTS.md:80`）。
- **System prompt 组装**：`core/src/context/builder.ts` + `sections/`（identity / env-info / cli-prefix / current-date / desktop / skills / memory / workflow-actor，目录清单即证据）——分段、每段带 chars/est-tokens/cacheHint，**microcompact 按段裁剪**。
- **Skills**：Markdown 技能发现与加载（`SkillPort`），bootstrap 侧入口 `bootstrap/src/skills.ts:26-41`（`discoverSkills`/`loadSkill`），受 config feature 开关控制、插件可贡献（`skills.ts:98-101`）。技能同时注册为 slash command（`bootstrap/src/slash-command-surface.ts`、`skill-command-overrides.ts`）。
- **Plugins 插件系统**：manifest `plugin.json`（`commands / agents / skills / hooks / mcpServers / userConfig`，根 `CONTEXT.md:60-63`）；官方市场（内置 + CDN zip sha256 校验）与个人来源（git/URL/本地目录）；CLI 内 `plugin-host-command.ts`（宿主 Node REPL 经 MCP 注册，见 §8 UI 的 node-repl 卡）。插件目录 `apps/zcode-cli/packages/browser-use-plugin`、`superpowers-plugin` 为示例插件。
- **MCP**：`McpPort` + `bootstrap/src/mcp-config.ts` 分层合并；连接快照、启动延迟到首个 turn（`agent-runtime.ts:171-174,307`）。
- **Workspace Hooks**：`core/src/hooks/` 有完整的 hook 信任/审查流（`workspace-hook-trust-*`（按仓库信任）、`workspace-hook-review-*`（人工审查软门禁 + admission 事件））。
- **配置层级**：CLI `adapters/src/config`（`createConfig`：env / user / project 覆盖合并，`bootstrap/src/skills.ts:84-90` 的用法即证据）。

---

## 6. 进程与通信架构

### 6.1 RPC 框架（`packages/rpc`）

VS Code 同构的分层：`IMessagePassingProtocol`（只需 `send` + `onMessage` 即可接入，`rpc/src/protocol.ts:24-28`）→ `ChannelClient/ChannelServer` + proxy-channel（传输无关的 RPC）→ 传输实现（`ipc.ts`、`remote.ts`、serialization、流控 `ConnectionFlowControl`，`protocol.ts:35-58`）。`packages/client` 是消费侧 SDK：`connectViaProtocol / connectViaWebSocket / connectViaMessagePort`（`client/src/index.ts:1-5`）。

### 6.2 桌面拓扑（事实链）

Renderer（负载全部工作台 UI，`packages/ui`）↔ Electron Main（窗口/原生/生命周期，`packages/desktop/src/main/`）→ **每窗口一个 Local Host**（Electron utilityProcess，跑 `packages/services`；根 `AGENTS.md:61-62`）→ Host 内 `zcodeAgentProcessManager` spawn Agent CLI（`app-server --stdio`）。协议与权限路由：`services/src/zcode-agent/`（zcodeProtocolTransport stdio/websocket/memory 三种、zcodeProtocolClient、事件 coalescer、task index 同步）。**Main 不承载业务状态**，relay 只做鉴权转发（`AGENTS.md:63-64`）。远程（SSH/WSL）由 server（`zcode-server-cli` supervisor）在远端拉起 Host + Agent，走 `entry-stdio.ts` 的 stdio RPC（`server/src/entry-stdio.ts:39-60`：hello/hello-ack 握手 + 帧纪律——**`printf/console.log 一旦写进 stdout 就污染协议流`，所以 entry 层把全部 console 输出重定向 stderr**，`entry-stdio.ts:19-31`）。

### 6.3 应用协议 "ZCode Protocol V4"（CLI ↔ 宿主）

- CLI 侧网关 `bootstrap/src/zcode-protocol-v4/v4-gateway.ts`（3436 行；头注释明确分层：per-session `ConversationTopicPublisher` + flushWindowMs 调度；命令经 **CommandInbox** 串行 admission 后交宿主 executor；本类不做网络 IO）。配套：commands/（命令集）、product-projection.ts / projection-rows.ts（事件 → 产品投影）、cold-session-resume / replay（冷恢复）、command-inbox（根 `AGENTS.md:65`："已接受的 busy/running 输入由 CLI/runtime CommandInbox 串行 admission；Renderer 只保留草稿与 optimistic overlay"）、sessions-index-publisher（会话列表 topic）、attachment-upload-registry（附件分块上传事务）。
- 传输语义显式区分两种链路：`desktop-continuous`（桌面实时）与 `web-remote-replayable`（手机/远控恢复式），见根 `AGENTS.md:63` 与 `types.ts` 的 `clientMode/deliveryKind`（`tool/types.ts:188-189`）。
- 全部命令/结果有 zod schema（`@zcode/shared/zcode-protocol-v4`，`v4-gateway.ts:75-120` 的 import 列表即证据）。

### 6.4 TUI 选型

`@mbears/opentui-react`（React 渲染到终端）+ shiki + web-tree-sitter（`tui/package.json` 依赖块）；TUI 文件全部 `app-*.tsx/ts`（输入面板、审批面板、markdown 主题、流式渲染…），**无业务状态**：状态经 `cli/src/tui-session-event-relay.ts` 从 session 事件流入。stdout/stderr 有专门拦截策略（`cli/src/main.ts:30-38`、`tui-stderr.ts`）。

---

## 7. Agent 面板 UI 布局（`packages/ui`）

### 7.1 桌面布局骨架

- **WorkspaceShellLayout**（`ui/src/app-shell/WorkspaceShellLayout.tsx`，1974 行，文件头注明“集中编排 sidebar、chat、terminal 和 browser pane 的布局联动”）：`WorkspaceSidebar`（文件树 + 任务列表，默认 264px，键盘可调）｜ 会话列（Conversation）｜ 浏览器区；会话列下方可挂 **Terminal frame**；右侧 **Side Pane**（自带 tab bar：终端、后台 Bash 输出、Plan、子代理会话、工作流 run/工件/目录…，`app-shell/` 下 `SubagentSessionSidePane.tsx`、`WorkflowRunSidePane.tsx`、`BackgroundBashOutputSidePane.tsx`、`PlanDetailSidePane.tsx` 等文件清单即证据）；`react-resizable-panels` 分割 + 4px 可见把手（设计规范 `DESIGN.md:485-487` "独立 conversation、bottom terminal、Side Pane frames"）。布局常量见 `WorkspaceShellLayout.tsx:99-122`。
- **多会话并排 = 分屏树**：`v4/paneLayoutTree.ts:20-28` —— **二叉分割树（VS Code editor groups 模型）**，pane 绑定 `{workspaceScope, sessionId}`，可 left/right/up/down 拆分，`MAX_WORKBENCH_PANES = 4`（性能基线“4 pane 同时流式不掉帧”，还是 CLI 子进程数软上限）；纯函数 + 引用稳定（zustand 免重渲染）。
- 左侧任务列表 = 会话索引投影（`TaskList.tsx`、`sessions-index-*`），支持分组/置顶/归档（`workspace-grouped-tasks/`）。

### 7.2 会话时间线渲染

- **ConversationTimeline**（`ui/src/v4/ConversationTimeline.tsx`，1963 行）：`@tanstack/react-virtual` 虚拟滚动 + **行高缓存**（`timelineRowHeightCache.ts`）+ 底部 live-tail 分离（流式时新行进 tail，历史区不重排，`conversationTimelineLiveTail.ts`）+ 回放加载 + 页内 find 高亮 + Turn Navigator（跳转工具轮）。行结构 `ConversationRowView / ConversationTurnRow / ConversationTurnGroup`。
- **消息块渲染**：assistant 文本走共享 Markdown 组件（`components/ai-elements/` 改自 vercel/ai-elements，Apache-2.0 声明保留，`ai-elements/reasoning.tsx:1-6`）；**thinking/reasoning = 可折叠 `Reasoning`**（Collapsible + auto-collapse + 流式期贴底，`reasoning.tsx:53-80`）。
- **工具调用卡 = renderer 注册表**：`ToolCallBlocks/resolveRenderer.ts:57` `resolveToolCallRenderer` 按结构化 tool identity（`lib/toolIdentity.ts`）+ family 分发到 **每工具一个 React 组件**（`renderers/` 61 个：edit（内联 diff，`EditInlineDiffContent.tsx`）、read、execute/bash 输出、agent/explore、todo、skill、mcp、cua、workflow 系列、ask-question、node-repl、fallback 兜底卡）；另有 `changes-group`（**文件变更归组卡**，`renderers/changes-group.tsx`）与 `cua-group` / `execute-group` 折叠流。工具卡原料是**事件投影里的 `toolResultDisplay`**（`contracts tools/tool-result-metadata.ts` → `ui/src/ToolCallBlocks/toolResultDisplay.ts`），即后端负责"显示什么"，前端只负责"怎么显示"。
- **Composer 输入区**：Lexical 富文本（`LexicalChatInput.tsx`）+ mention（@文件/@代理...）+ slash 命令 + 附件；running 时输入进 **Queue 面板**（`ConversationQueuePanel.tsx`、`ConversationPendingGuideList.tsx`，对应 §2.3 的 queue 语义）。
- **交互请求**：权限/askUserQuestion 是协议级 interaction request（`PermissionDialog.tsx`、`ElicitationDialog.tsx`、`V4InteractionDialogs.tsx`、`TaskInteractionBadge.tsx`）。

---

## 8. 与 OpenSumi `ai-native` 现状对比

OpenSumi 侧（`/Users/ljs/ant/ide/core/packages/ai-native`，浏览级别）：

- Agent 组织：`IChatAgent` 注册表 + `DefaultChatAgent`（browser/chat/default-chat-agent.ts:42），另有 **ACP 外接 agent**（node/acp/acp-agent.service.ts spawn 外部 CLI，permission-routing、webmcp caller 等一整套）。
- 消息/渲染：ChatRenderRegistry 按"槽位"注册（chat.render.registry.ts:18-60）+ `ChatToolRender` 组件内按 MCP registry 取工具组件（components/ChatToolRender.tsx:54-57）+ `ChatThinking.tsx`。
- 模型：`BaseLanguageModel` 基于 Vercel AI SDK（node/base-language-model.ts:1 引入 `streamText/tool`），providers anthropic/deepseek/openai(-compatible)。
- 工具：`ToolInvocationRegistry`（common/tool-invocation-registry.ts:37-88，**按 clientId 分实例**）+ MCP server manager（node/mcp）。
- 面板：ai-layout（browser/layout/ai-layout.tsx）挂在 IDE 布局；编辑器内联能力（inline-chat / inline-diff / rewrite 等比 zcode 丰富——这是 OpenSumi 强项）。

| 维度 | zcode | OpenSumi ai-native（现状） | 差距/互补 |
| --- | --- | --- | --- |
| 会话状态 | 事件溯源：SessionEvent 流 + EventReducer 投影 + EventStore 持久化（§2.1） | 视图模型 + ACP 外接会话为主（推测：内部无统一事件流抽象） | zcode 更适合"多端投影、重放、fork/rewind" |
| Agent 循环 | 显式 Turn 状态机 + while 循环 + micro/auto compact + 断流恢复（§2.3） | 内部 loop 较薄，复杂 agent 交给 ACP 外接进程 | OpenSumi 若要内置 agent，可借鉴 turn 状态机与 compact 分层 |
| 工具契约 | 声明式安全元数据 + zod 双向 schema + 注册表 + 拓扑调度（§3.1） | ToolInvocationRegistry 有调用面板，但无 readOnly/destructive/sideEffectScope 声明（浏览范围内未见） | zcode 的单一契约源对权限/并发/UI 都能复用 |
| 权限 | 结构化 decision + ruleId + broker 端口 + 规则持久化 + 带预览审批（§3.2） | ACP permission-routing + permission-dialog-widget（有链路；规则体系较浅） | zcode 的规则位次与 fail-open 边界值得抄 |
| 子代理 | Markdown profile + 端口化 runner + 后台 + 提问注入 + 事件镜像（§2.4） | 无内置子代理（ACP agent 提供部分能力） | 结构差异最大处 |
| 模型访问 | 同为 Vercel AI SDK；zcode 多了轨迹落盘/失败分类/流空闲超时（§4） | 同为 Vercel AI SDK（base-language-model.ts:1） | 实践相近，细节可互鉴 |
| UI 工具卡 | 每工具一个 renderer 组件 + identity 分发 + 事件投影喂料（§7.2） | MCP registry 组件 + ChatToolRender 单组件集中渲染 | zcode 版本扩展性更好 |
| 多会话布局 | 分屏树 + Side Pane tab + 队列面板（§7.1） | 单 Chat 面板 + 编辑器内联入口 | 产品形态不同，按需取舍 |

---

## 9. 适合 OpenSumi 借鉴的点（按优先级）

> 每条含：借鉴什么 / 为什么 / OpenSumi 落点 / 迁移成本。

1. **工具契约的声明式安全元数据（readOnly/destructive/concurrentSafe/sideEffectScope/needsApproval/timeout/maxOutput）+ zod input/output schema** 为什么：一份契约同时喂给权限判定、并行调度、plan-mode 过滤、UI 卡片与模型工具声明，避免各处硬编码工具名单（zcode `toContracts()` 即模型面，`tool/types.ts:65-94`）。落点：`ai-native` 的 `ToolInvocationRegistry`（common 层扩展契约接口）+ 未来内置 agent loop 的调度器。成本：**低**（接口+元数据字段，逐步补齐）。
2. **结构化权限决定（allow/ask/deny + ruleId + 可持久化规则）与"预览不能取消询问"的 fail-open 边界** 为什么：规则位次表把 yolo/项目规则/alwaysAsk 的优先级写死（`permission/service.ts:103-200`），结构化 ruleId 让 UI/hook 免字符串匹配；审批带 diff 预览但预览失败不降级审批（`approval-gate.ts:61-73`）。落点：`ai-native` 的 `permission-routing.service.ts`（node/acp）与 `permission-dialog-widget.tsx` 之间的契约层。成本：**低-中**。
3. **Turn 显式状态机 + 事件投影（最小版事件溯源）** 为什么：phase 状态机让取消/插入输入/暂停恢复都有合法边界（`turn-machine.ts:92-104`）；SessionEvent 流使 UI/CLI/重放同源，OpenSumi 的多窗口（Electron/browser/远程）天然受益。落点：ai-native 内置 chat-agent 的会话模型（browser/chat/chat-model.ts 一侧引入事件 reducing）。成本：**中**（先事件类型 + reducer，持久化可后置）。
4. **CLI 即 agent 运行时 + 宿主壳（Desktop/Web 皆薄壳）的拓扑，以及 "stdout 只许协议帧" 的进程纪律** 为什么：zcode 用同一 runtime 服务 TUI/Web/Desktop，靠协议而非共享代码复用（`zcodeAgentProcessManager.ts:369`、`entry-stdio.ts:19-31`）；OpenSumi 的 ACP 外接已具雏形，可实现"内置 agent 也可作为独立进程被其他 IDE/CLI 复用"。落点：结合既有 ACP（node/acp）定义"内部 agent 的进程契约"；与 `2026-09-01-opencode-cli-web-编排接口.md` 的结论合并评估。成本：**中-高**（架构级，但可沿 ACP 既有缝隙推进）。
5. **子代理 Markdown profile（`.zcode/agents/*.md`）+ 端口化 runner（launch/sendMessage/wait/后台/auto-background）** 为什么：声明来源分层（built-in/project/user/plugin）、frontmatter 即配置，生态（社区分享 agent 定义）成本极低；sendMessage 支持向运行中子代理追加指令，配合事件镜像回父会话（§2.4）。OpenCode 侧调研（`2026-09-01-opencode-子代理.md`）同样指向该形态。落点：ai-native 新增 subagent 能力时的 profile 规范与 `IChatAgent` 扩展；agent 定义可直接复用 `.agents` 协议兼容思路（zcode `AGENTS.md:80`）。成本：**中**。
6. **UI：每工具 renderer 组件 + 结构化 tool identity 分发 + 工具结果"显示载荷"由后端产出** 为什么：后端 `toolResultDisplay`（事件 payload）决定展示内容，前端 registry 决定组件（`resolveRenderer.ts:57`；`ToolCallBlocks/renderers/` 61 个），新工具/MCP 工具都能有卡片而不是 JSON 兜底。落点：ai-native `ChatToolRender.tsx` 拆分为 registry + per-tool 组件；MCP registry 已有挂点。成本：**低-中**（UI 重构逐步迁移，fallback 组件先兜底）。
7. **会话时间线工程细节：虚拟化 + 行高缓存 + live-tail 分离 + reasoning 自动折叠** 为什么：高密度 agent 输出（流式 + 工具批 + 子代理通知）对滚动性能极其敏感；zcode 明确注释了这些为性能基线服务（`ConversationTimeline.tsx` 头注释；`MAX_WORKBENCH_PANES` 注释）。落点：ai-native `AgenticVirtualMessageList.tsx` 的滚动策略。成本：**低**。
8. **上下文组装的分段 + cacheHint + microcompact 分阶段预算 + AGENTS.md/MEMORY.md 注入约定** 为什么：段级 token 估算让自动 compact 有裁剪单位（`context/builder.ts` + sections；`turn-loop.ts:67-102`）；`# agentsMd` 段头 + `meta_user` 注入位是可直接复用的提示工程约定。落点：ai-native 的提示组装（common/prompts）与 context 管理。成本：**低-中**。
9. **模型访问的运行时韧性清单：流空闲超时、失败分类、重试预算、模型 IO 轨迹落盘** 为什么：这些全部是上线后高频问题域，zcode 的拆分文件即一张 checklist（`adapters/src/model/` 目录，§4）。落点：`ai-native` node 的 `base-language-model.ts` 周边。成本：**低-中**。

**不建议借鉴**：

- **动态工作流（TS 脚本 → 类型检查 → 多 actor 编译运行）**：解决的是 zcode 自身"长程后台工作流"的产品问题，编译器 + vm 沙箱 + SQLite journal 的复杂度对 OpenSumi 现阶段收益低（`dynamic-workflow/README.md` 自述边界也说明它是独立产品能力）。
- **TUI（OpenTUI）与其键盘优先规范**：OpenSumi 是 IDE，不具备终端 UI 产品面。
- **整套 CLI 子 workspace 的组织方式（400 行上限、mixin 分方法文件、十几包边界）**：有效但高摩擦，依赖成熟的架构检查工具链（`architecture-policy.yaml` + 自研 checker）与团队纪律；OpenSumi 包结构已稳定，全盘迁移不现实（可局部借鉴 mixin 拆大类的做法）。
- **插件商店/CDN 分发与 CUA broker**：产品与合规域，非通用工程价值（`zcode-cua/README.md` 本身就是占位实现）。
- **Vercel AI SDK provider 层重写**：OpenSumi 已是同栈（`base-language-model.ts:1`），无需引入 zcode 的 provider 注册表（其配置复杂性服务于桌面产品账号体系）。

---

## 10. 引用源文件清单（zcode 侧除注明外均相对 `/Users/ljs/ant/github/agent/zcode/`）

**根与规范**：`README.md`；`AGENTS.md`（根）；`apps/zcode-cli/AGENTS.md`；`DESIGN.md`；`CONTEXT.md`；`architecture-policy.yaml`；`pnpm-workspace.yaml`；`package.json`。

**Agent 运行时**：`apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts`；`.../runtime/methods/turn-loop.ts`；`.../runtime/methods/streaming-recovery.ts`；`.../runtime/methods/turn-output-token-continuation.ts`；`.../agent/turn-machine.ts`；`.../agent/turn-state.ts`；`.../runtime-task/registry.ts`。

**事件契约**：`apps/zcode-cli/packages/contracts/src/events/session.events.ts`；`.../contracts/src/events/event-reducer.ts`；`.../contracts/src/interfaces/`（session.port.ts、permission.port.ts、subagent.port.ts、mcp.port.ts 等）。

**工具/权限**：`apps/zcode-cli/packages/core/src/tool/types.ts`；`.../tool/registry.ts`；`.../tool/scheduler.ts`；`.../tool/handlers/edit.ts`；`.../tool/handlers/`（bash-readonly-policy-\* 等 114 文件）；`.../tool/executor/approval-gate.ts`；`.../permission/service.ts`；`.../permission/plan-mode-policy.ts`。

**子代理/记忆**：`apps/zcode-cli/packages/core/src/subagent/profile.ts`；`.../subagent/runner.ts`；`.../subagent/explore-tools.ts`；`.../memory/`；`apps/zcode-cli/packages/bootstrap/src/subagents.ts`。

**Provider/模型**：`packages/provider/src/`（registry.ts、config-service.ts、resolver.ts）；`packages/provider-node/src/`；`apps/zcode-cli/packages/adapters/src/model/`（runner.ts、retry-policy.ts、stream-idle-timeout.ts、model-execution.ts 等）；`apps/zcode-cli/packages/contracts/src/model/model.ts`；`.../contracts/src/model/index.ts`。

**配置/扩展**：`apps/zcode-cli/packages/core/src/context/builder.ts`；`.../context/sections/request-user-context.ts`；`.../context/sections/`（其余各段）；`apps/zcode-cli/packages/bootstrap/src/skills.ts`；`.../bootstrap/src/plugins.ts`；`.../core/src/hooks/`（workspace-hook-\* 等）。

**协议/进程**：`packages/rpc/src/protocol.ts`；`packages/client/src/index.ts`；`packages/desktop/src/main/desktopHostProcess.ts`；`packages/server/src/http.ts`；`packages/server/src/entry-stdio.ts`；`packages/services/src/zcode-agent/zcodeAgentProcessManager.ts`；`packages/services/src/zcode-agent/zcodeProtocolTransport.ts`；`apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/v4-gateway.ts`；`apps/zcode-cli/packages/cli/src/arguments.ts`；`apps/zcode-cli/packages/cli/src/main.ts`。

**UI**：`packages/ui/src/app-shell/WorkspaceShellLayout.tsx`；`packages/ui/src/v4/paneLayoutTree.ts`；`packages/ui/src/v4/ConversationTimeline.tsx`；`packages/ui/src/ToolCallBlocks/resolveRenderer.ts`；`packages/ui/src/ToolCallBlocks/renderers/`（edit.tsx、changes-group.tsx 等）；`packages/ui/src/components/ai-elements/reasoning.tsx`；`packages/ui/src/v4/ConversationQueuePanel.tsx`。

**工作流（上下文参考）**：`apps/zcode-cli/packages/dynamic-workflow/README.md`。

**OpenSumi 侧（对比用，`/Users/ljs/ant/ide/core/packages/ai-native/`）**：`src/browser/chat/chat.render.registry.ts`；`src/browser/chat/default-chat-agent.ts`；`src/browser/components/ChatToolRender.tsx`；`src/common/tool-invocation-registry.ts`；`src/node/base-language-model.ts`；`src/node/acp/acp-agent.service.ts`；既有研究 `docs/research/2026-09-01-opencode-子代理.md`、`docs/research/2026-09-01-opencode-cli-web-编排接口.md`。
