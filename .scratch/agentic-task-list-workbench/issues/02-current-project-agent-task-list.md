# 交付当前项目的常驻 Agent Task List

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

1–8、12、21–22、26–27、30–33

## What to build

在 Agentic Layout 中交付仅面向当前 Project 的持久 Agent Task List：它替代 Agentic 模式的内联会话历史，位于 ACP Chat Slot 左侧，主会话、既有编辑器和文件树同时保留。建立仅保存脱敏元数据的 Project Catalog 和 Task Registry；当前 Agentic 会话的第一条已接受提示会登记任务，并以首行作为不可变标题。

列表支持当前 Project 的 Task 恢复、按 Catalog Joined At/创建时间排序、按标题搜索和局部宽度调整。Classic ACP 历史不变，现有 Agentic New Session 菜单在 Project-first 启动流程落地前仍保留。

## Acceptance criteria

- [ ] Agentic Layout 同时显示 Agent Task List、Main Conversation Area、既有编辑器和文件树；Classic ACP 仍显示其既有历史体验。
- [ ] 当前 Workspace 会作为已验证 Project 登记；当前 Agentic 会话首次接受提示后，生成仅关联一个 Project 和一个 ACP session 的 Task，标题取首行并限制为 100 字符。
- [ ] Registry 仅序列化 Task/Project 身份、标题、时间和组织元数据，不包含提示正文、消息、权限、命令、环境、凭据或 Artifact 内容。
- [ ] 当前 Project 的 Task 可恢复其会话；Project Group 和 Task Row 的排序、标题搜索与 208–280px 宽度范围可用。
- [ ] 自动化测试覆盖四区域构图、首提示登记、脱敏持久化、排序/搜索、Classic 回归和尺寸边界。

## Blocked by

None - can start immediately
