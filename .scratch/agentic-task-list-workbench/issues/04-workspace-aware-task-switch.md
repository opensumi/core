# 交付跨项目 Task Catalog、切换与会话恢复

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

13–16、25–27

## What to build

扩展 Workspace Catalog，使经过验证的已知项目可以作为其他 Project Group 出现在 Task List 中；选择当前 Project 的 Task 直接恢复，选择其他 Project 的 Task 执行 Workspace-aware Task Switch。该切换复用当前浏览器页，在加载目标 Workspace 后恢复同一个 ACP session，而不是新建会话。

Agentic 专用适配层负责脏编辑器守卫和 reload 后的待激活恢复，不修改 IDE Layout、WorkspaceService、编辑器或文件树的已有行为。

## Acceptance criteria

- [ ] 当前 Workspace 与经可用性/授权验证的最近 Workspace 可进入 Project Catalog；任意自由路径文本不会成为可选 Project。
- [ ] 选择当前 Project 的 Task 不打开 Workspace，直接激活原 session；选择其他可用 Project 的 Task 在当前页打开目标 Workspace 并在 reload 后恢复同一 session。
- [ ] 存在脏编辑器时仅提供 Save All and Switch、Discard Changes and Switch、Cancel；保存后仍有脏文档则不切换，放弃更改仅在明确选择后执行。
- [ ] reload 待恢复状态只保存所需的 Task 身份，优先于待启动状态恢复，且不保存提示或会话内容。
- [ ] 自动化测试覆盖当前/跨项目选择、三种脏编辑器结果、目标验证、同 session 恢复和无共享布局改动。

## Blocked by

- [01 — 扩展 ACP 会话以支持显式 Task Target](01-acp-task-target.md)
- [02 — 交付当前项目的常驻 Agent Task List](02-current-project-agent-task-list.md)
