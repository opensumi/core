# OpenSumi ACP 标准兼容基线改造 Plan TODO

## 背景

OpenSumi 后续 ACP 实现建议以 Zed 的标准兼容实现作为稳定性基线，同时保留 OpenSumi 的 IDE 能力优势。

本文只记录除“废弃 `extMethod` 主路径，HTTP MCP bridge 成为主扩展路径”之外的剩余改造事项。HTTP MCP bridge 主路径拆分到 `webmcp-mcp-bridge-design.md` 继续演进。

## 总体目标

- 标准 ACP Core 稳定可靠，优先保证协议兼容、session lifecycle、权限、终端和工具调用状态正确。
- OpenSumi IDE 能力以可发现、可审计、可权限控制的工具集方式提供给 agent。
- legacy `AgentUpdate` 只作为 UI 适配层，核心状态尽量保留 ACP 原生语义。
- 补齐 transcript/e2e 级测试，覆盖真实 JSON-RPC 时序和失败路径。

## 非目标

- 本文不设计 HTTP MCP bridge 的默认主路径切换。
- 本文不保留、不新增 `_opensumi/*` `extMethod` 能力。
- 本文不要求照搬 Zed UI，只借鉴 Zed 的协议边界和状态处理方式。

## Phase 1: 标准 ACP Core 收敛到 Zed 兼容模型

### 状态模型

- [ ] 重构 `AcpThread` 状态模型，直接保留 ACP 原生概念：
  - `SessionUpdate`
  - `ToolCall`
  - `Plan`
  - `SessionInfo`
  - `Mode`
  - `Model`
  - `ConfigOption`
  - `Usage`
- [ ] 减少 `SessionNotification -> AgentUpdate -> ChatProgress` 的多次转换。
- [ ] 将 legacy `AgentUpdate` 下沉为 UI 适配层，不再作为核心状态来源。
- [ ] 补齐 `current_mode_update`、`config_option_update`、`session_info_update`、`usage_update` 的状态保存和事件通知。
- [ ] 实现 `getAvailableModes()`，并评估是否同时暴露 model/config option 状态读取 API。

### Session lifecycle

- [ ] `createSession` 不再依赖 `available_commands_update` 才返回。
- [ ] `available_commands_update` 改为异步增量更新，超时不影响 session 创建成功。
- [ ] `loadSession` 期间先注册 session，避免 history replay notification 丢失。
- [ ] 增加 pending session 管理，处理并发 load 同一个 session。
- [ ] 增加 session ref-count，处理多个 UI/调用方持有同一 ACP session。
- [ ] 处理 load 中 close session，避免返回 orphan thread。
- [ ] `closeSession` 成功后同步清理 permission routing、thread status listener 和 session mapping。

### Thread pool

- [ ] 修正线程池复用条件，至少按以下字段分组或校验：
  - `agentId`
  - `command`
  - `args`
  - `env`
  - `nodePath`
  - workspace/cwd 兼容性
- [ ] 不允许不同 agent 配置复用同一个已初始化进程。
- [ ] 复用失败时明确重建进程或返回可诊断错误。
- [ ] 为线程池满、idle thread 复用、agent 配置变化补测试。

### 标准 ACP 能力

- [ ] 对齐并验证标准文件能力：
  - `readTextFile`
  - `writeTextFile`
- [ ] 对齐并验证标准终端能力：
  - `createTerminal`
  - `terminalOutput`
  - `waitForTerminalExit`
  - `killTerminal`
  - `releaseTerminal`
- [ ] 对齐并验证标准权限能力：
  - `requestPermission`
  - allow/reject/cancel/timeout
- [ ] 统一 JSON-RPC error 到 OpenSumi UI 错误展示，保留 agent stderr 和 request method 信息。

## Phase 3: OpenSumi IDE 能力产品化为工具集

### 默认低风险工具

- [ ] 默认暴露能力发现工具：
  - `opensumi_discoverCapabilities`
  - `opensumi_describeCapabilityGroup`
  - `opensumi_enableCapabilityGroup`
- [ ] 默认暴露低风险 IDE 上下文工具：
  - `workspace_getRoots`
  - `editor_getActiveEditor`
  - `diagnostics_getSummary`
- [ ] 明确默认工具的 schema、description、riskLevel 和 profile。

### 能力组

- [ ] `search`: 文本搜索、符号搜索、引用查找。
- [ ] `file`: 文件读取、stat、目录枚举。
- [ ] `editor`: 当前文件、选区、dirty diff、打开文件。
- [ ] `terminal`: 观察终端、读取输出、交互输入。
- [ ] `diagnostics`: LSP problems、跳转诊断。
- [ ] `scm`: git 状态、diff、变更文件。
- [ ] `acp_chat`: 当前 ACP 会话状态、权限等待状态、chat panel 展示。

### 高风险工具策略

- [ ] 写文件必须经过 permission 或明确 profile 开关。
- [ ] 运行 shell 必须经过 permission 或明确 profile 开关。
- [ ] 修改编辑器内容必须经过 permission。
- [ ] SCM 写操作必须经过 permission。
- [ ] 跨会话读取或投递内容必须经过 permission，并限制摘要/脱敏策略。

## Phase 4: 权限模型统一

### 权限上下文

- [ ] 所有工具调用统一携带：
  - `sessionId`
  - `toolName`
  - `riskLevel`
  - `locations`
  - 可选 `command`
  - 可选 `resource`
- [ ] Node 层只做权限路由和超时兜底。
- [ ] Browser 层负责展示、用户决策、always rule 存储和审计。

### 已知问题修复

- [ ] 修正 `requestId` 与 `toolCallId` 混用问题。
- [ ] 内部 request id 可以使用 `${sessionId}:${toolCallId}`。
- [ ] 更新 tool call 状态必须使用原始 `toolCallId`。
- [ ] permission request 结束后清理 pending map，避免泄漏。

### Always rule

- [ ] 支持 allow once/reject once/allow always/reject always。
- [ ] always rule 至少限制到 tool 维度。
- [ ] 对文件、终端、SCM 等高风险工具增加 path/workspace/session 作用域。
- [ ] 增加审计日志，记录 tool、risk、decision、scope、session。

## Phase 5: 兼容性测试补齐

### Transcript/e2e 测试

- [ ] initialize 协商失败。
- [ ] agent 早退和 stderr 上报。
- [ ] newSession 成功但没有 `available_commands_update`。
- [ ] loadSession 期间收到历史消息 replay。
- [ ] 并发 load 同一个 session。
- [ ] load 中 close session。
- [ ] permission allow/reject/cancel/timeout。
- [ ] `tool_call` 先来，`tool_call_update` 后补 `rawInput`。
- [ ] terminal create/output/wait/kill/release。
- [ ] agent 不支持增强能力时自动降级到标准 ACP 能力。

### 回归测试

- [ ] 线程池跨 agent 配置复用禁止。
- [ ] session notification 不串 session。
- [ ] tool call status 与 permission dialog 状态一致。
- [ ] mode/model/config option 更新能到达 UI。
- [ ] usage/title/session info 更新不被 legacy 转换层丢弃。

## 推荐落地顺序

1. 修 ACP Core correctness：线程池、createSession、permission requestId、session lifecycle。
2. 重构核心状态，减少 legacy `AgentUpdate` 对核心逻辑的影响。
3. 产品化 OpenSumi IDE 能力组，优先 `search/file/editor/diagnostics`。
4. 统一权限模型和 always rule。
5. 补齐 transcript/e2e 测试，作为后续 ACP 改造的兼容性基线。
