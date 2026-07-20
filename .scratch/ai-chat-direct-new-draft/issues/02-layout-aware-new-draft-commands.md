# 交付双布局 New Chat / New Task 快捷命令

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

7–9、19–34、48–53、55–56

## What to build

通过现有命令与快捷键贡献机制交付两个布局语义明确的命令：Classic/IDE Layout 使用 `AI Chat: New Chat` 进入 Chat Draft，Agentic Layout 使用 `Agent: New Task` 进入 Task Draft。两个命令使用互斥的布局上下文，共享默认快捷键 `⌘⌥N / Ctrl+Alt+N`，并可在命令面板和快捷键设置中发现与重新绑定。

命令在对应布局内全局生效，包括编辑器获得焦点时。若 ACP Chat 当前隐藏，命令先显示现有 ACP Chat 面板，再进入相应 Draft 并聚焦主输入框。Classic 命令复用既有 New Chat Draft 行为，不增加 Agent 下拉；Agentic 命令复用 Issue 01 建立的直接 Task Launch 编排，不复制 Agent 或 Workspace Target 解析。

Header Tooltip 从快捷键注册表读取实际平台绑定。Agentic 主操作显示解析后的 Agent 与实际快捷键，Classic New Chat 显示实际快捷键；用户重绑定后提示同步更新，用户移除绑定后不显示虚假的默认键位。分裂按钮不增加 ArrowDown、Home/End、菜单漫游焦点等定制键盘模式，只保留原生按钮行为。

## Acceptance criteria

- [ ] 命令面板和快捷键设置分别公开 `AI Chat: New Chat` 与 `Agent: New Task`，且两者都允许用户重新绑定。
- [ ] 两个命令共享默认 `ctrlcmd+alt+n`，并通过 Classic/Agentic 布局上下文互斥生效，不影响 New File、Inline Chat 或其他已有命令。
- [ ] Classic 命令进入 Chat Draft；Agentic 命令通过既有直接 Task Launch 编排进入 Task Draft，不会混淆两种领域语义。
- [ ] 命令在编辑器或其他 Workbench 表面获得焦点时仍可触发。
- [ ] ACP Chat 隐藏时，命令会显示现有面板、进入 Draft 并聚焦主输入框，而不是在后台静默切换状态。
- [ ] Chat Draft 和 Task Draft 都保留未发送文本与附件，并继续延迟创建 ACP session；Task Draft 也继续延迟创建 Durable Agent Task。
- [ ] Agentic Tooltip 显示 `New Task with {Agent}` 与实际快捷键，Classic Tooltip 显示 New Chat 与实际快捷键；重绑定或移除快捷键后提示与注册表一致。
- [ ] Agentic 分裂按钮没有新增定制菜单键盘导航，所有图标操作仍保留清晰的本地化可访问名称。
- [ ] 命令贡献测试覆盖命令名称、默认绑定、互斥上下文和可重绑定注册；运行时测试覆盖两个布局、编辑器焦点、隐藏面板、Draft 焦点与延迟 Session 创建。

## Blocked by

- [01 — 交付 Agentic Header 一键 Task Draft](01-agentic-header-direct-task-draft.md)
