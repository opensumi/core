# 扩展 ACP 会话以支持显式 Task Target

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

13、18–22、29

## What to build

以可选的显式 ACP Agent 和 Workspace Target 扩展 ACP 会话的创建与加载契约。后续 Agent Task 可以用该契约在指定工作目录创建会话，并在恢复时根据保存的 Agent 与目标重新解析配置；现有 Classic 与非 Task 流程继续使用原默认配置。

这是共享会话契约的 expand 阶段：新能力与默认路径并存，不迁移或改变任何现有调用者的默认行为。

## Acceptance criteria

- [ ] ACP 会话创建可接收一个可选的显式 Agent 和工作目录目标。
- [ ] 显式目标会使用指定的 Agent 与工作目录解析 ACP 配置；默认会话仍沿用原有默认配置。
- [ ] 已注册 Task 的 ACP 会话恢复可根据其保存的 Agent 与 Project Target 解析配置。
- [ ] 覆盖显式目标创建/恢复和 Classic 默认路径不变的自动化测试通过。

## Blocked by

None - can start immediately
