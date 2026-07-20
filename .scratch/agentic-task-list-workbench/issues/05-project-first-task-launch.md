# 交付跨项目的 Project-first 新建 Task

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

17–22、26–27、29、32

## What to build

从 Task List 标题栏或 Project Group 交付 New Task：开发者先选择已验证 Project，再选择 ACP Agent。若目标不是当前 Workspace，流程使用同一套 Workspace-aware Task Switch，并在 reload 后只恢复 Project 与 Agent 这两个待启动标识，再进入新的 Agentic draft。

一时的 Agent 选择不得修改用户默认 Agent 偏好。该流程成为 Agentic 模式的唯一新建入口，因此移除原 Agentic 默认-Agent New Session 菜单，同时保留最大化操作。

## Acceptance criteria

- [ ] Task List 全局和 Project Group 的 New Task 都要求先选 Known Workspace Target、再选 ACP Agent；Project Group 入口预选其 Project。
- [ ] 当前 Project 立即进入目标化的 Agentic draft；其他 Project 经过脏编辑器守卫、当前页切换和 reload 后进入同一目标的 draft。
- [ ] 待启动数据只保存 Project 与 Agent 身份，不保存初始提示；首次接受提示后才由已有 Registry 生成 Task 标题。
- [ ] 一次性 Agent 选择不修改默认 Agent 偏好；原 Agentic New Session 菜单不再显示，Agentic 最大化与 Classic 行为不回归。
- [ ] 自动化测试覆盖当前/跨项目启动、Project-first 顺序、偏好隔离和 reload 恢复。

## Blocked by

- [01 — 扩展 ACP 会话以支持显式 Task Target](01-acp-task-target.md)
- [02 — 交付当前项目的常驻 Agent Task List](02-current-project-agent-task-list.md)
- [04 — 交付跨项目 Task Catalog、切换与会话恢复](04-workspace-aware-task-switch.md)
