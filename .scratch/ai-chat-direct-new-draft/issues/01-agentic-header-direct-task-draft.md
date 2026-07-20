# 交付 Agentic Header 一键 Task Draft

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

1–6、10–15、28–37、46–51、54–55

## What to build

将 Agentic Chat Header 当前只能打开 Agent 菜单的 `+` 改为完整的分裂操作：主 `+` 使用当前 Workspace Target 和已解析的 Project Agent Recall 直接进入 Task Draft，始终可见的相邻下拉操作继续提供显式 Agent 覆盖与 Agent Configuration。

直接启动按照 Project Agent Recall、当前 Task Conversation 的 Agent、用户级默认 Agent、首个可用 ACP Agent 的顺序解析 Agent。显式选择某个 Agent 后立即进入 Task Draft，并更新已注册 Project 的 Agent Recall，但不得修改用户级默认 Agent。

这一切必须继续使用现有的延迟创建语义：Header 操作本身不创建 ACP session 或 Durable Agent Task；首次接受 Prompt 后才创建 Task Conversation 并使 Agent Task 持久化。进入 Task Draft 时保留用户尚未发送的文本和附件，聚焦主输入框并将光标放到草稿末尾。Classic/IDE Layout 的单一 New Chat `+`、Agent Task List、Project-group New Task 和最大化操作保持不变。

指针入口和后续命令入口应共享同一套浏览器侧 Task Launch 编排与上下文解析，避免 React 控件、命令处理器和服务层分别实现 Agent、Workspace Target、Draft、焦点及错误语义。

## Acceptance criteria

- [ ] Agentic Header 渲染相邻的主 `+` 与始终可见的 Agent 下拉操作；主 `+` 不先打开菜单，而是直接进入 Task Draft。
- [ ] 主操作使用 Project Agent Recall → 当前 Task Conversation Agent → 用户级默认 Agent → 首个可用 ACP Agent 的解析顺序，并在 Tooltip 中显示最终 Agent。
- [ ] 下拉菜单保留 ACP Agent 列表与 Agent Configuration；点击 Agent 会立即启动，并更新 Project Agent Recall，但不会写入用户级默认 Agent。
- [ ] Header Task Launch 使用选中 Task 的 Workspace Target；没有选中 Task 时使用当前 IDE Workspace Target，且不导航或切换 IDE Workspace。
- [ ] 进入 Task Draft 后，未发送文本与附件仍然存在，主输入框获得焦点，光标位于草稿末尾。
- [ ] 点击 Header 操作不会立即创建 ACP session 或 Durable Agent Task；首次接受 Prompt 后才创建一对一的 Task Conversation。
- [ ] 主操作、显式 Agent 覆盖和后续命令可复用同一个 Task Launch 编排入口，而不是形成多套上下文解析逻辑。
- [ ] Classic ACP Chat、Project-group New Task、Agent Task List 和最大化/恢复行为没有回归。
- [ ] 组件、Task Launch 服务和运行时指针流程测试覆盖直接启动、显式覆盖、Recall、偏好隔离、草稿保留、焦点与延迟创建。

## Blocked by

None - can start immediately
