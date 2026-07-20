# 交付 Task Launch 安全边界与恢复行为

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

16–18、38–45、53、55–56

## What to build

完成指针和快捷键 Task Launch 的安全边界，使一键入口在缺少 ACP Agent、Workspace Target 不可用、重复触发、异步失败以及已有 Agent Task 正在运行时仍具有可预测、可恢复的端到端行为。

没有可用 ACP Agent 时，Agentic 主 `+` 禁用并解释原因，下拉操作仍可进入 Agent Configuration；快捷键显示一次非阻塞的 `No ACP Agent available` 提示并提供 `Configure Agents` 恢复操作，不得进入 Task Draft。选中 Task 的 Workspace Target 不可用时，指针与快捷键都不得回退到当前 IDE Workspace。

Task Launch 在用户操作边界保持 single-flight。一次启动尚未完成时，主 `+`、下拉操作和 New Task 命令不得再次创建 Draft，并通过紧凑忙碌状态说明正在处理。启动失败必须保持原 Active Task、Task Row 选择、Permission 上下文、未发送文本与附件，不显示空白或未绑定 Draft。

当前 Agent Task 正在运行时，新 Task 继续使用独立 ACP Thread 并行启动；旧 Task 不停止、不取消，仍保留在 Agent Task List 中，新 Task Draft 成为当前对话。使用现有运行中 IDE 的 Agentic 与 Classic ACP 场景验证整条路径，确保组件级测试没有掩盖快捷键、焦点、面板显示或延迟创建问题。

## Acceptance criteria

- [ ] 无 ACP Agent 时，Agentic 主 `+` 禁用并显示明确原因，下拉操作仍可打开 Agent Configuration。
- [ ] 无 ACP Agent 时触发 New Task 快捷键只显示一条非阻塞提示，并提供 `Configure Agents` 操作；不会进入 Task Draft 或修改当前对话。
- [ ] 选中 Task 的 Workspace Target 不可用时，Header 与快捷键均不可启动，也不会回退到当前 IDE Workspace Target。
- [ ] Task Launch single-flight：延迟一次启动后连续点击主操作、下拉选项或快捷键，只接受一次启动；成功或失败后所有操作恢复。
- [ ] 启动过程中两个分裂按钮段和 New Task 命令公开一致的忙碌/不可重复触发状态。
- [ ] 目标验证或 Task Launch 失败后，原 Active Task、Task Row 选择、Permission 上下文、未发送文本与附件保持不变，并显示非阻塞错误。
- [ ] 当前 Task 正在运行时执行 New Task 不会停止或取消它；旧 Task 继续运行，新 Task Draft 成为当前视图。
- [ ] Agentic 和 Classic 运行时验收覆盖真实快捷键、隐藏面板显示、输入焦点、实际 Tooltip 绑定、Draft 保留和首次 Prompt 创建 Session 的边界。
- [ ] 现有 Classic 历史、Agentic Task List、Project Agent Recall、共享 Workspace 并发、最大化/恢复和布局组合测试均无回归。

## Blocked by

- [01 — 交付 Agentic Header 一键 Task Draft](01-agentic-header-direct-task-draft.md)
- [02 — 交付双布局 New Chat / New Task 快捷命令](02-layout-aware-new-draft-commands.md)
