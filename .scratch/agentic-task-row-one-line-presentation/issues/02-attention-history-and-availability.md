# 适配 Attention、Last-known 与不可用状态

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

11、14–20、32–33、38–41、43–44

## What to build

在紧凑 Task Row presentation 契约上交付所有异常和历史状态的完整纵向路径。Permission Request 和结构化输入请求继续作为 ACP Attention Signal 覆盖普通 ACP Task Status；Unavailable ACP Agent、Unavailable Task Conversation、live ACP Task Status 与 Last-known ACP Task Status 保持相互独立，并在单行中使用短而明确的可见标签。

行内推荐使用 `Permission`、`Input`、`No agent`、`No history` 和 `Last: <status>` 等紧凑文案，Tooltip 与 accessibility 内容使用完整术语并说明 live/Last-known 区别及既有恢复行为。表现优化不得启动 Agent 进行列表级预验证，不得把 unavailable 条件持久化成新的 Task 状态，也不得增加前端合成的 Retry、Stop 或完成状态。

## Acceptance criteria

- [ ] pending Permission Request 或结构化输入请求在 primary state 区域覆盖普通 ACP Task Status，并通过警告图标与短标签共同表达，而不是只依赖颜色。
- [ ] Unavailable ACP Agent 使用紧凑的 `No agent` 语义，仍显示原始 originating ACP Agent，且绝不回退或改绑到当前 Agent。
- [ ] Unavailable Task Conversation 使用独立的 `No history` 语义，与 Unavailable ACP Agent 和 ACP `error` 状态保持可见及可访问的区分。
- [ ] 未在当前页面生命周期观察过的持久化状态使用 `Last: <status>` 等历史表达，Tooltip 和 accessibility 内容明确说明其为 Last-known ACP Task Status，而非 live 状态。
- [ ] Tooltip 为 Attention、availability 和 Last-known 状态提供完整文案与通用恢复说明，但不包含交互操作或敏感会话数据。
- [ ] selecting an Unavailable Task Conversation 继续通过选择同一 Task Row 重试既有 Session-first Task Selection，不新增独立 Retry action。
- [ ] Unavailable ACP Agent、Unavailable Task Conversation、Last-known status、Attention、activation 和 archive eligibility 的现有行为及持久化边界保持不变。
- [ ] focused component coverage 覆盖 Attention 优先级、Permission、Input、No agent、No history、Last-known live 区分、图标和完整 accessibility wording；运行中 IDE coverage 验证这些组合在最小宽度下仍可理解。
- [ ] 实现不引入 eager Agent startup、列表级 session reconciliation、新 ACP 状态、新持久化字段或公开契约变化。

## Blocked by

- [01 — 建立紧凑单行 Task Row 与完整 Tooltip](01-compact-task-row-and-tooltip.md)
