# 交付 Task List 的 Attention、未读与归档

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

9–11、23–25、27、29

## What to build

让 Agent Task List 消费 ACP 的状态、Permission Request 和结构化输入请求。非当前 Task 收到 Agent 内容或 ACP Attention Signal 时显示独立未读状态；Attention Signal 覆盖普通状态图标。实现符合 ACP 状态限制的归档/取消归档、折叠的 Archived Area 以及可读但不可激活的 Unavailable Project 状态。

所有状态、Attention 和可执行动作仍由 ACP 决定；前端不推断完成、不添加 Stop/Retry/Pin，也不产生浏览器或宿主通知。

## Acceptance criteria

- [ ] Task Row 在有 pending Permission 或输入请求时显示 Attention 而非普通状态，未读标记独立存在且选择 Task 后清除。
- [ ] 仅 `ready`、`stopped` 和 `error` 状态的 Task 可以归档；归档 Task 在列表底部按 Project 分组的折叠区域中可恢复，且没有永久删除入口。
- [ ] 已不可用的 Workspace Target 及其 Task 仍可阅读但不可触发激活或启动。
- [ ] 任务状态、Attention 和存储内容均来自允许的 ACP/Task 元数据，不包含敏感会话内容或前端合成的完成状态。
- [ ] 自动化测试覆盖 Attention 优先级、未读、归档资格、取消归档和不可用 Project 的禁用态。

## Blocked by

- [02 — 交付当前项目的常驻 Agent Task List](02-current-project-agent-task-list.md)
