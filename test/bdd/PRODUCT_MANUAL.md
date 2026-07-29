# AI Native IDE Product Manual From ACP / WebMCP BDD

本文档把 `test/bdd/` 目录中的 BDD 验收场景整理成一份产品手册，用于判断 OpenSumi AI Native IDE 的 ACP Chat、Agentic 布局、WebMCP 能力和 IDE 工具调用是否达到了可发布、可信、可集成的产品状态。

它不替代具体 BDD 用例。某个行为是否必须满足，仍以对应 `.scenario.md` 的 `Given / When / Then / Pass / Fail Judgment` 为准。本文档负责回答产品问题：这些用例共同证明了什么用户价值，哪些能力还不能发布，新增用例应该放在哪一层。

## 产品定位

AI Native IDE 不是在 IDE 旁边放一个聊天窗口，而是让 Agent 成为 IDE 工作流的一部分。用户可以把有限范围内的任务交给 Agent，同时保留上下文选择权、权限决策权、过程可见性和失败恢复能力。

核心承诺：

- 开发者可以在 IDE 内发起任务、附加上下文、观察 Agent 的计划和工具执行，并随时停止或恢复。
- Agent 可以通过稳定的 WebMCP / MCP 能力发现和调用 IDE 功能，但不能越过当前 Profile、工作区边界和权限门禁。
- IDE 始终保持可用。Chat、Explorer、Editor、Terminal、状态栏和布局切换不能互相破坏。
- 敏感内容默认不外泄。状态、历史、权限、调试、relay 和工具目录都必须有明确的内容边界。

## 读者速览

| 读者               | 该关心什么                                       | 推荐章节                                |
| ------------------ | ------------------------------------------------ | --------------------------------------- |
| 产品经理           | AI Native IDE 是否形成可信闭环，哪些能力可发布。 | 产品定位、核心体验原则、发布准入        |
| 测试/质量          | BDD 场景是否覆盖用户路径、权限边界和失败恢复。   | BDD 覆盖矩阵、BDD 评审规则              |
| 研发               | ACP、WebMCP、Node 合约和 UI 行为应如何落地。     | 能力模型、Profile 模型、Node 运行时契约 |
| Agent / MCP 集成方 | 如何发现工具、连接 MCP、理解权限和错误。         | WebMCP 与 MCP 集成                      |
| 安全/平台          | 哪些信息可以暴露，哪些操作必须受控。             | 安全与信任模型、发布准入                |

## 核心体验原则

| 原则 | 产品含义 | 不可接受情况 |
| --- | --- | --- |
| 上下文可控 | 用户能看到自己附加了哪些文件、片段、规则或编辑器上下文，也能在发送前删除。 | 删除的 chip 仍被发送，或 UI 暴露隐藏 payload wrapper。 |
| 行动可见 | Agent 的 streaming、计划、推理、工具调用和失败状态都要能被用户理解。 | 长时间只有 spinner，工具卡片重复，失败后输入框不可用。 |
| 权限可审计 | 写入、relay、终端、文件、调试等高风险动作必须受 Profile 和可见 UI 权限控制。 | 通过 MCP 自动 approve/reject，或权限状态泄露请求正文。 |
| 会话可恢复 | 历史、新建会话、切换、刷新、取消和失败重试都不能破坏会话归属。 | A 会话的流式更新污染 B，会话刷新后重复消息或丢工具结果。 |
| IDE 不退化 | Agentic 布局不能让 Explorer、Editor、Terminal 和状态栏失效。 | 切换布局刷新页面、Workbench 过窄、Explorer 无法打开文件。 |
| 集成稳定 | 外部能力使用 lower-snake canonical 名称，并由 Profile 控制可见范围。 | `_opensumi/...`、camelCase 或旧 ACP direct tools 作为正向路径出现。 |
| 默认最小暴露 | default Profile 只提供安全状态和打开 Chat 能力。 | 默认 Profile 可发送消息、读历史正文、修改文件或运行终端命令。 |

## 用户与关键任务

| 用户 | 关键任务 | 产品验收信号 |
| --- | --- | --- |
| 普通开发者 | 打开 IDE，向 Agent 提问，附加代码上下文，观察回答，必要时停止。 | Chat 可聚焦、发送不重复、Stop 后可继续、上下文 chip 可删除。 |
| 高阶开发者 | 在多个任务之间切换，保留历史，恢复复杂工具结果。 | 多会话隔离，刷新后历史一致，复杂响应不丢不重。 |
| Agent 使用者 | 让 Agent 调用文件、搜索、诊断、编辑器和终端能力。 | 工具可发现，结果有界，写操作仅在 full Profile 且可清理。 |
| MCP 集成方 | 通过 loopback MCP 连接 IDE，调用 canonical tools。 | bridge token 不泄露，`tools/list` 与 browser surface 对齐。 |
| 企业平台/安全 | 控制不同环境下的能力暴露和敏感信息输出。 | Profile 边界不可绕过，state/list/permission/debug/relay 不泄露内容。 |
| 研发/测试 | 用 BDD 判断实现是否满足产品契约。 | 用例声明 Layer/Profile/Fixtures/Mutation/Automation status，失败原因可定位。 |

## 核心用户旅程

### 1. 打开 AI Native IDE

用户启动 OpenSumi IDE，进入带工作区的 URL。页面完成加载后，Agentic Chat 应在左侧主要列可见，Workbench、Explorer、Editor 和状态栏仍可用。

验收重点：

- Agentic Chat 默认可打开，输入框可聚焦。
- Agentic 下 Chat 宽度在 `640px` 到 `1440px` 之间，Workbench 宽度至少 `480px`。
- Classic 和 Agentic 可双向切换，切换不刷新页面、不离开当前 workspace URL。
- 主题、布局偏好和尺寸刷新后恢复到可用状态。

### 2. 发送第一条消息

用户聚焦输入框，输入内容，选择 slash command 或 mention 上下文，点击发送。第一条有效消息创建或激活 ACP Session。

验收重点：

- 空白输入不会创建消息或会话。
- 用户消息只出现一次，并位于助手响应之前。
- 助手响应从 streaming 收敛为稳定消息，不重复行。
- 发送失败后输入框恢复可编辑，用户可以重试。
- `acp_chat_get_session_state` 只返回 metadata，不返回 prompt、assistant 正文、工具结果或权限正文。

### 3. 让 Agent 解释过程

用户发送确定性任务后，界面逐步展示工作状态、推理内容、计划内容、助手正文和工具调用卡片。

验收重点：

- 推理和计划归属于同一条助手响应。
- 同一个 tool call id 的更新会更新现有卡片，不新增重复卡片。
- 工具卡片可展开查看工具名、参数区和结果区。
- BDD 只能验证 UI 转换和 fixture 输出，不断言真实 LLM 文本。

### 4. 控制长任务

用户在长流式响应期间点击 Stop/Cancel，然后继续在同一会话发送后续消息。

验收重点：

- Stop/Cancel 只在 active request 期间可用。
- 取消后用户消息保留，助手行不再卡在纯 spinner 状态。
- 输入框恢复可编辑，同一 session 可继续发送。
- 旧 ACP direct tools 不能作为取消路径出现。

### 5. 管理历史和多会话

用户点击 New Chat 进入草稿态，发送后历史出现稳定标题。用户可以在多个会话之间切换，并在流式响应期间切到另一个会话。

验收重点：

- 未发送的空草稿不能落成 `(untitled)` 或 `New Session` 垃圾历史。
- 历史按 ACP 期望顺序展示，通常为 newest first。
- 当前选中项和 `acp_chat_get_session_state` 一致。
- 非当前 session 的流式更新不能污染当前聊天窗口。
- 历史/list 工具不能返回消息正文或工具结果。

### 6. 恢复复杂会话

用户打开包含正文、推理、计划和工具结果的复杂会话，切换到其他会话，再切回或刷新页面。

验收重点：

- 切换/刷新不能产生重复消息、重复工具卡片或空会话。
- 复杂响应结构仍与同一条助手响应关联。
- 工具卡片展开状态可以重置，但底层工具卡片和结果必须可恢复。

### 7. 处理权限

full Profile 下，用户触发需要权限的动作。IDE 弹出可见权限弹窗，用户通过 UI reject 或关闭。

验收重点：

- 权限决策必须通过可见浏览器 UI 完成。
- ACP/WebMCP 不暴露自动 approve/reject 工具。
- Permission state 只能暴露 `activeDialogCount`、`activeSessionId`、`pendingCountExcludingActive` 等计数/作用域。
- 弹窗没有稳定 Reject/close selector 时，场景应为 `BLOCKED`，不是假装通过。

### 8. 通过 MCP 调用 IDE 能力

Agent 或外部 MCP 客户端通过 browser WebMCP surface 获取 loopback MCP bridge URL，再连接 IDE 内置 `opensumi-ide` server。

验收重点：

- bridge 只监听 `127.0.0.1`。
- URL 带不可猜测的 `/mcp/<token>` 路径，日志只能显示 `/mcp/<redacted>`。
- Browser `navigator.modelContext.getTools()` 和 Node MCP `tools/list` 暴露同一批 canonical tools，受 Profile 差异影响。
- 非 loopback host、错误路径、未知或已删除 `mcp-session-id` 必须被拒绝。

## 能力模型

| 能力域 | 用户价值 | BDD 证明什么 |
| --- | --- | --- |
| Agentic Chat | 用户能在 IDE 左侧完成 AI 对话和任务控制。 | 启动、输入、发送、stream、停止、历史、恢复和错误可见。 |
| Agentic Layout | AI 工作区成为主视图，但不破坏传统 IDE 工作流。 | Classic/Agentic 切换、Explorer/editor interop、resize bounds、主题恢复。 |
| Context & Commands | 用户可以显式控制 Agent 的上下文和命令意图。 | Slash command、mention、附件、删除 chip、metadata safety。 |
| Permission & Trust | 高风险能力必须可见、可拒绝、可恢复。 | 权限弹窗、badge、permission state、无自动决策工具。 |
| WebMCP / MCP | Agent 和外部客户端能稳定调用 IDE 能力。 | canonical naming、Profile gating、bridge transport、fallback broker。 |
| IDE Capability Groups | Agent 可以安全使用 Workspace/Search/Diagnostics/File/Editor/Terminal。 | 工作区边界、有界响应、full-only mutation、清理。 |
| ACP Node Runtime | 后端会话、线程、协议、配置和错误恢复稳定。 | raw session id、thread pool、permission routing、process config、RPC sync。 |

## Profile 模型

WebMCP 暴露能力由 Profile 控制。Profile 是权限边界，不是展示偏好。

| Profile | 应暴露能力 | 不应暴露能力 | 典型用例 |
| --- | --- | --- | --- |
| `default` | IDE 启动、默认 ACP Chat 打开、安全状态读取、Agentic 默认布局、只读布局检查。 | 发送消息、读取历史正文、修改文件、终端命令、调试读写。 | 启动 smoke、安全默认面、fallback。 |
| `interactive` | default 能力，加上会话列表、可用命令、输入发送、历史切换、上下文附件、只读 IDE 工具。 | Full-only 写操作、调试读写、跨会话 relay 发布。 | 真实 Chat 交互和只读集成。 |
| `full` | interactive 能力，加上写入、调试、权限、终端、文件和编辑器可逆变更能力。 | 不带清理逻辑的真实工作区破坏性操作。 | 端到端权限、终端、文件、relay、debug。 |

本地验证非默认 Profile 时使用 loopback 查询参数：

```text
http://localhost:8080/?workspaceDir=<absolute workspace path>&webMcpProfile=interactive
http://localhost:8080/?workspaceDir=<absolute workspace path>&webMcpProfile=full
```

`opensumi_enable_capability_group` 只能作为目录/发现辅助，不能让 Profile 禁止的工具变得可调用。

## 安全与信任模型

### Canonical Tool Names

外部能力工具必须使用 lower-snake canonical 名称：

| 能力              | 工具名                               |
| ----------------- | ------------------------------------ |
| MCP 连接发现      | `opensumi_get_mcp_server_connection` |
| ACP Chat 状态     | `acp_chat_get_session_state`         |
| ACP Chat 权限状态 | `acp_chat_get_permission_state`      |
| 打开 ACP Chat     | `acp_chat_show_chat_view`            |
| 会话列表          | `acp_chat_list_sessions`             |
| 可用命令          | `acp_chat_get_available_commands`    |
| 准备 relay digest | `acp_chat_prepare_session_digest`    |
| 发布 relay digest | `acp_chat_post_prepared_relay`       |
| 读取有界消息      | `acp_chat_read_session_messages`     |
| 切换模式          | `acp_chat_set_session_mode`          |
| 文件读取          | `file_read`                          |
| 文本搜索          | `search_text`                        |

不允许作为外部能力出现：

- `_opensumi/{group}/{action}` 旧标识。
- `acp_chat_getSessionState` 这类 camelCase 旧名称。
- `acp_sendMessage`、`acp_createSession`、`acp_switchSession`、`acp_clearSession`、`acp_cancelRequest`、`acp_handlePermissionDialog` 等旧 direct tools。

### 内容边界

以下工具和状态面必须保持 metadata-only 或有界返回：

| 表面 | 允许返回 | 不允许返回 |
| --- | --- | --- |
| session state | active session id、状态、loading、permission count、有限 metadata。 | prompt、assistant 正文、工具结果、权限正文。 |
| session list | session id、标题、时间、状态摘要。 | 消息正文、附件原文、工具结果。 |
| permission state | active session id、dialog count、pending count。 | 请求正文、文件内容、选项详情、决策按钮。 |
| relay prepare | metadata、最长 300 字符 preview、长度统计、过期时间。 | 完整 digest、完整源会话内容。 |
| debug read | 显式 `maxMessages`、`maxChars` 边界内的 user/assistant。 | 工具结果、无界历史、secret。 |
| capability describe | group/tool metadata、参数说明。 | workspace 文件正文或 editor buffer 内容。 |

### Permission

权限体验必须满足三条底线：

- full Profile 才能触发写入、relay、debug read、终端命令等高风险能力。
- 权限决策只能通过可见 UI 完成，不能通过 ACP/WebMCP 后门完成。
- 取消或拒绝权限后，Chat 必须恢复可用，同一会话能继续发送普通消息。

## WebMCP 与 MCP 集成

推荐集成流程：

1. 在浏览器 WebMCP 表面调用 `opensumi_get_mcp_server_connection({})`。
2. 使用返回的 Streamable HTTP URL 建立 MCP client。
3. 调用 `tools/list` 检查当前 Profile 工具面。
4. 直接调用 Profile 已暴露工具。
5. 如客户端不能直接调用能力工具，可用 `opensumi_invoke_capability_tool({ tool, arguments })` 作为 fallback broker。

Fallback broker 应接受：

```json
{
  "tool": "acp_chat_list_sessions",
  "arguments": {}
}
```

也应兼容常见嵌套误用，并在缺少 string `tool` 时返回 `INVALID_ARGUMENTS`。

## IDE 能力组

full Profile 期望覆盖以下 IDE capability groups：

| Group | 用户/集成方能力 | 关键边界 |
| --- | --- | --- |
| `workspace` | 读取根目录、打开文件、最近工作区 metadata。 | 返回 metadata，不返回文件正文。 |
| `search` | 文件名、文本、符号搜索。 | 结果有数量和片段边界。 |
| `diagnostics` | 读取诊断列表、统计、打开诊断。 | 返回 severity、path、range、message 等 metadata。 |
| `file` | 读取、列出、判断、可逆创建/写入/移动/删除。 | 限制在 workspace 内，拒绝 path traversal。 |
| `editor` | 打开、读取 active editor、读取范围、选择、格式化、保存。 | 读写能力受 Profile 控制。 |
| `terminal` | 读取终端状态，创建终端，运行命令，读取输出。 | 输出有界，写/命令能力只在 full Profile。 |

终端创建文件后 Explorer 自动刷新是 AI Native IDE 的关键体验：Agent 通过 Terminal 造成的真实工作区变化，必须被 IDE 文件树自动感知。BDD 不能用 `file_create`、`file_write` 或 file-tree service shortcut 代替终端路径。

## Node 运行时契约

这些场景不直接面向终端用户，但决定产品能否稳定运行。

| 契约 | 产品要求 |
| --- | --- |
| ACP Agent Session Lifecycle | raw ACP session id 贯穿 new/load/send/dispose；permission routing、terminal、pool 在 dispose 后清理。 |
| ACP Agent Protocol Client | 协议版本、状态机、notification filtering、entry conversion 和 entry update 稳定。 |
| Thread Pool LRU | pool 大小保持 3；只复用可复用 thread；无可复用 thread 时 fail fast 并输出诊断。 |
| Session Advanced Operations | config、fork、resume、close、model、modes 使用 raw session id，缺失参数在调用连接前失败。 |
| Permission Routing | 只路由已注册 raw session；选项排序稳定；计数/作用域 metadata-only；重复 request 不替换 resolver。 |
| Process Config | command/args/env/node path 按优先级合并；相对 node path fail fast；不突变注册对象。 |
| Client Handlers | file handler 限制在 workspace 内；terminal 由 raw session owner 管理；输出有界且清理幂等。 |
| Chat Session Storage | session list 最多 20；raw id 与 `acp:<id>` 归一；active in-memory session 不被列表加载覆盖。 |
| RPC Bridge and Thread Status | Node 侧复用 browser registry catalog；RPC 成功/失败 class 与 browser 直接执行一致；缺失 client fail fast。 |
| Error and Recovery | 错误归一成可读 Error，保留 SDK code/data；details 有界并 redacts token/key/secret/password。 |

## 发布准入

### P0 不可发布

出现任一情况，不应发布 AI Native IDE 能力：

- default Profile 可执行发送消息、读取历史正文、修改文件、运行终端命令或调试读写。
- Profile 禁止的工具通过 `opensumi_enable_capability_group`、fallback broker 或旧工具名绕过。
- state/list/permission/debug/relay/capability describe 泄露 prompt、assistant 正文、工具结果、权限正文或 secret。
- 权限决策可以被 ACP/WebMCP 自动 approve/reject。
- Chat 发送、停止、失败、刷新后进入不可恢复 loading 或输入框永久不可用。
- 会话隔离失效，A session 的流式更新污染 B session。
- MCP bridge token 出现在日志或 evidence 中。
- File/editor/terminal 写操作越过 workspace 边界或没有清理路径。

### P1 发布风险

以下问题可以按版本策略评估，但必须记录风险和补救计划：

- Debug Log redacted render/copy 合约尚未实现，真实 redaction 审计应标为 `BLOCKED`。
- 权限弹窗缺少稳定 Reject/close selector，导致 full Profile 权限 UI 无法自动证明。
- `acp_chat_set_session_mode` 返回了请求的 `modeId`，但 session state 暂不强制暴露 active mode。
- 部分 interactive/full 场景缺少确定性 fixture，只能标为 `BLOCKED`。
- 布局压力下存在轻微视觉瑕疵，但不影响 Chat、Explorer、Editor 和 Terminal 可用性。

### Readiness Matrix

| 维度 | 发布目标 | 失败判定 |
| --- | --- | --- |
| 启动可用 | default Profile 下 IDE readiness、Agentic Chat、safe tools 可用。 | shell 未 ready、Chat 不可打开、旧工具出现在默认面。 |
| 核心对话 | interactive 下输入、发送、stream、stop、重试稳定。 | 重复消息、卡 loading、输入框不恢复。 |
| 上下文 | slash command、mention、附件和删除行为可控。 | 删除后仍发送，metadata 泄露内容。 |
| 历史恢复 | 多会话、切换、刷新、复杂响应恢复一致。 | 消息/工具卡重复，跨 session 污染。 |
| 权限 | full 下权限弹窗可见、可拒绝、可恢复。 | 自动决策、计数泄露正文、拒绝后不可继续。 |
| MCP 集成 | bridge 可发现，canonical tools 与 browser/MCP 对齐。 | token 泄露、旧名称可调用、surface 不一致。 |
| IDE 能力 | workspace/search/diagnostics/file/editor/terminal 安全可用。 | path traversal、无界输出、写操作越权。 |
| Node runtime | session、thread、protocol、process、RPC、error recovery 稳定。 | phantom session、pool hang、错误不可恢复。 |

## BDD 覆盖矩阵

| 场景 | Layer | Profile | 产品意义 |
| --- | --- | --- | --- |
| `bdd-runtime-preflight.scenario.md` | `runtime-ui` | `default` | BDD 执行前确认 IDE readiness、browser/MCP 执行面和诊断脱敏。 |
| `acp-chat.scenario.md` | `runtime-ui` | `default` | 默认 ACP Chat smoke 和安全状态读取。 |
| `acp-chat-agentic-startup.scenario.md` | `runtime-ui` | `default` | Agentic 默认布局、左侧 Chat、默认安全工具面。 |
| `acp-chat-agentic-fallback.scenario.md` | `runtime-ui` | `default` | ACP 后端不可用时仍有可用 Chat surface。 |
| `acp-layout-switch.scenario.md` | `runtime-ui` | `default` | Classic/Agentic 切换、Explorer interop、resize bounds。 |
| `acp-chat-agentic-theme-persistence.scenario.md` | `runtime-ui` | `default` | 主题、布局偏好、尺寸刷新后恢复。 |
| `acp-chat-agentic-input-send.scenario.md` | `runtime-ui` | `interactive` | 草稿、首发、命令、mention、附件、滚动和失败恢复。 |
| `acp-chat-agentic-stream-rendering.scenario.md` | `runtime-ui` | `interactive` | 确定性 stream 中的正文、推理、计划、工具卡片和恢复。 |
| `acp-chat-agentic-cancel-stop.scenario.md` | `runtime-ui` | `interactive` | 长响应停止/取消、输入恢复和后续发送。 |
| `acp-chat-agentic-reload-during-stream.scenario.md` | `runtime-ui` | `interactive` | 流式过程中刷新页面后的可用恢复。 |
| `acp-chat-agentic-task-list-presentation-and-resize.scenario.md` | `runtime-ui` | `interactive` | Agent Tasks 列表样式、可访问性、resize 边界和宽度持久化。 |
| `acp-chat-agentic-project-management-and-disclosure.scenario.md` | `runtime-ui` | `interactive` | Project 标签、搜索、折叠、重命名、添加/移除和不可用过滤。 |
| `acp-chat-agentic-task-launch-and-activation.scenario.md` | `runtime-ui` | `interactive` | Task 创建、Agent recall、当前 Project 激活、失败与竞态安全。 |
| `acp-chat-agentic-cross-project-session-activation.scenario.md` | `runtime-ui` | `interactive` | 跨 Project 会话原地激活，不切换工作区或干扰脏编辑器。 |
| `acp-chat-agentic-task-archive-status-and-restore.scenario.md` | `runtime-ui` | `interactive` | Task 状态/注意力、归档、刷新恢复和 Classic 边界。 |
| `acp-chat-agentic-session-isolation.scenario.md` | `runtime-ui` | `interactive` | 多会话并发状态和 stream 更新隔离。 |
| `acp-chat-agentic-rich-history-restore.scenario.md` | `runtime-ui` | `interactive` | 复杂响应在切换/刷新后不丢不重。 |
| `acp-chat-agentic-context-attachments.scenario.md` | `runtime-ui` | `interactive` | 文件、文件夹、代码、规则上下文 chip 和附件清理。 |
| `acp-chat-agentic-command-surface.scenario.md` | `runtime-ui` | `interactive` | Slash command 发现、选择、取消、发送和 metadata parity。 |
| `acp-chat-agentic-layout-interop.scenario.md` | `runtime-ui` | `interactive` | Agentic Chat 与 Explorer/editor 的常规互操作。 |
| `acp-chat-agentic-layout-stress.scenario.md` | `runtime-ui` | `interactive` | 长内容、工具结果、scroll、resize 和布局往返稳定。 |
| `acp-chat-agentic-keyboard-a11y.scenario.md` | `runtime-ui` | `interactive` | 键盘无鼠标路径、focus、Escape 和工具卡片操作。 |
| `acp-chat-agentic-error-taxonomy.scenario.md` | `runtime-ui` | `interactive` | create/load/send/OpenCode service/模型不可用/auth/disconnected/config 失败分类与重试。 |
| `acp-chat-agentic-config-controls.scenario.md` | `runtime-ui` | `full` | Mode、Model、Config 控件和 stream 中安全 gating。 |
| `acp-chat-agentic-permission-during-send.scenario.md` | `runtime-ui` | `full` | 发送中权限弹窗、badge、dismiss 和恢复。 |
| `acp-chat-agentic-debug-log-from-chat.scenario.md` | `runtime-ui` | `full` | Chat stream 后打开 Debug Log 并关联日志。 |
| `permission-dialog.scenario.md` | `runtime-ui` | `full` | 权限状态和弹窗可观察，不通过工具自动决策。 |
| `terminal-file-tree-refresh.scenario.md` | `runtime-ui` | `full` | Terminal 创建/删除文件后 Explorer 自动刷新。 |
| `acp-debug-log.scenario.md` | `runtime-ui` | `full` | Debug Log store、viewer、条数上限、copy/clear 和 blocked redaction audit。 |
| `available-commands.scenario.md` | `mcp-contract` | `interactive/full` | Command metadata 通过 profile-granted `acp_chat` 暴露。 |
| `webmcp-capability-surface.scenario.md` | `mcp-contract` | `interactive/full` | Browser 和 MCP surfaces 暴露同一批 canonical tools。 |
| `acp-mcp-bridge.scenario.md` | `mcp-contract` | `default/interactive/full` | MCP bridge startup、injection、catalog、profiles 和 transport。 |
| `session-mode.scenario.md` | `mcp-contract` | `full` | Session mode 切换返回合约和 metadata-only state。 |
| `session-relay.scenario.md` | `mcp-contract` | `full` | 跨会话 digest relay、权限门禁和有界 debug read。 |
| `error-handling.scenario.md` | `mcp-contract` | `full` | Capability boundaries、invalid inputs 和 redacted structured errors。 |
| `webmcp-ide-capability-groups.scenario.md` | `mcp-contract` | `full` | Workspace/Search/Diagnostics/File/Terminal/Editor groups。 |
| `acp-agent-session-lifecycle.scenario.md` | `node-contract` | `default` | Node session lifecycle、stream、cancel、dispose 和 pool cleanup。 |
| `acp-agent-protocol-client.scenario.md` | `node-contract` | `default` | ACP protocol handshake、状态机、entry conversion 和 isolation。 |
| `acp-thread-pool-lru.scenario.md` | `node-contract` | `default` | Thread pool LRU recycling、evicted reload、race handling。 |
| `acp-session-advanced-operations.scenario.md` | `node-contract` | `default` | Config、fork、resume、close、model、modes 合约。 |
| `acp-process-config.scenario.md` | `node-contract` | `default` | Browser config merge 和 Node spawn config resolution。 |
| `acp-client-handlers.scenario.md` | `node-contract` | `default` | ACP client file/terminal handlers 的 workspace/session scope。 |
| `acp-chat-session-storage.scenario.md` | `node-contract` | `default` | Session provider、activation、fallback、command propagation、cleanup。 |
| `acp-rpc-bridge-and-status.scenario.md` | `node-contract` | `default` | Browser/Node WebMCP RPC definitions 和 thread status 同步。 |
| `acp-permission-routing.scenario.md` | `node-contract` | `full` | Node permission routing 和 browser permission bridge 生命周期。 |
| `acp-error-and-recovery.scenario.md` | `node-contract` | `full` | Node/MCP/UI 错误归一、脱敏和恢复。 |

## BDD 评审规则

一个合适的 BDD 用例应满足：

- 明确声明 `Layer`、`Required profile`、`Fixtures`、`Workspace mutation`、`Automation status`。
- 用例层级和验证对象一致：UI 用 `runtime-ui`，工具目录/Profile/错误/transport 用 `mcp-contract`，服务/线程/协议/配置/handler 用 `node-contract`。
- 用户可见行为或外部合约清晰，不只是实现细节。
- 依赖 deterministic fixture，不依赖真实 LLM 生成文本。
- 对 workspace mutation 有明确范围和清理步骤。
- Pass、Blocked、Fail 边界明确。
- 不使用已废弃 ACP direct tools 作为正常操作路径。
- 对敏感数据有不泄露断言。

不合适或需要修正的信号：

- 在 default Profile 中要求 full-only 工具。
- 把没有 fixture 的真实 agent 长流程当成稳定断言。
- 断言 prompt、assistant 正文或 tool result 出现在 state/list/permission 工具返回里。
- 用旧工具名作为正向路径，例如 `acp_sendMessage` 或 `_opensumi/file/read`。
- UI 场景没有稳定 selector，却把执行失败记为 `FAIL`，而不是 `BLOCKED`。
- 把多个无关功能塞进一个场景，导致失败原因无法定位。
- 有 workspace mutation 但没有清理。
- 只验证工具返回 `success: true`，没有验证 Profile 边界、内容边界或用户可见结果。

## Pass / Blocked / Fail

| 结果 | 使用条件 |
| --- | --- |
| `PASS` | 声明的 Profile、fixture、执行面都存在，并且所有关键行为满足契约。 |
| `BLOCKED` | 缺少 Profile、fixture、MCP bridge、browser ModelContext、稳定 selector 或运行环境，导致场景无法开始或无法证明。 |
| `FAIL` | 前置条件存在，但产品行为违反契约，例如泄露内容、工具名漂移、UI 卡死、Profile 越权、无法恢复。 |

不要把缺少 interactive/full Profile 的场景标成部分通过。当前规范要求跳过或标为 `BLOCKED`，并说明缺少的前置条件。

## 新增场景建议

新增或变更 BDD 用例时，按这个顺序评审：

1. 它证明的是用户可见行为、外部集成合约，还是内部服务合约。
2. 它应该属于 `runtime-ui`、`mcp-contract` 还是 `node-contract`。
3. 它是否使用最小 Profile，能 default 就不要 full。
4. 它是否有确定性 fixture，尤其不要断言真实 LLM 文本。
5. 它是否包含内容泄露断言，尤其是 state/list/permission/debug/relay。
6. 它是否只使用 canonical tool names，并验证旧别名被拒绝。
7. 它是否有可逆 mutation、受控路径和结束清理。
8. 它的 PASS/BLOCKED/FAIL 是否能让失败原因被定位。

如果一个用例能被这 8 条清楚解释，它通常就是合适的。如果解释不清，优先拆分用例或补 fixture，而不是把更多步骤塞进同一个场景。
