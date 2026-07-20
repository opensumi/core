# 完成端到端验收、Classic 回归与范围审计

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

1–33

## What to build

通过现有 Agentic ACP BDD/Playwright 验收切面验证完整的 Agent Task List Workbench：四区域桌面布局、Project/Task 行为、跨 Workspace 选取和恢复、Project-first 启动、ACP Attention、归档以及脱敏持久化。补齐 Classic ACP 与 Agentic 面板行为回归，并审计改动范围是否保持在 Agentic/ACP 边界内。

此 Issue 只补齐可观察的验收与回归保护，不引入新的产品行为。

## Acceptance criteria

- [ ] 运行中的 IDE 验收覆盖四区域同时可见、Project/Task 排序、标题搜索、当前 Project 切换和跨 Project 的 Save/Discard/Cancel 结果。
- [ ] 端到端验收覆盖 Attention、未读、归档/取消归档、不可用 Project、Project-first 启动和同一 ACP session 的 reload 恢复。
- [ ] 存储检查使用唯一的提示、消息、权限、thought 和 tool-result 哨兵，证明 Task Registry 与 pending 状态不包含它们。
- [ ] Classic ACP 会话历史、Agentic 最大化以及现有编辑器/文件树行为保有回归保护。
- [ ] 最终范围审计与格式检查确认没有修改 IDE Layout、共享工作台、Agentic Shell 或 WorkspaceService 的实现边界。

## Blocked by

- [01 — 扩展 ACP 会话以支持显式 Task Target](01-acp-task-target.md)
- [02 — 交付当前项目的常驻 Agent Task List](02-current-project-agent-task-list.md)
- [03 — 交付 Task List 的 Attention、未读与归档](03-agent-task-attention-unread-archive.md)
- [04 — 交付跨项目 Task Catalog、切换与会话恢复](04-workspace-aware-task-switch.md)
- [05 — 交付跨项目的 Project-first 新建 Task](05-project-first-task-launch.md)
