# 建立紧凑单行 Task Row 与完整 Tooltip

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

1–10、12–13、20–21、29–35、40–42、44

## What to build

为 Agent Task List 建立稳定的单行 Task Row 信息层级，并交付第一条可运行的端到端路径：Task Title 是唯一自由伸缩的主信息；originating ACP Agent 使用有最大宽度的紧凑用户可见标签；常规 live ACP Task Status 使用紧凑图标与短标签；完整标题、Agent 标签与身份、完整状态和可访问描述通过同一个 presentation model 生成。

Task Row 保持现有 22px 高度，在 Task List 的最小、默认和最大宽度下均不换行、不产生横向溢出。`ready` 保持静默，`running`、`stopped` 和 `error` 使用可扫描的短标签。非交互式 Tooltip 在 hover 和键盘 focus 时展示完整信息，并且不得包含 Prompt、消息、凭据、命令、thought、tool result 或 Task Artifact 内容。

这个切片同时建立后续 Attention、availability、Last-known 和 row action 可以复用的 compact/full presentation 契约，但不提前改变这些状态的产品语义。

## Acceptance criteria

- [ ] Task Row 在 208px、244px 和 280px Task List 宽度下始终保持 22px 单行高度，无文字换行、行内横向滚动或控件溢出。
- [ ] Task Title 占据主要弹性空间并使用 ellipsis；Agent 标签使用最短可用的用户可见名称、固定最大宽度和 ellipsis，在缺少目录标签时回退到稳定 Agent identity。
- [ ] `ready` 不显示冗余状态，`running`、`stopped` 和 `error` 使用现有 Codicon、主题 token 和紧凑可读的状态标签，且不推断 `completed` 或其他前端生命周期。
- [ ] 同一 presentation model 提供 compact label、full label、Tooltip 内容和 accessibility 内容，避免不同展示渠道产生语义漂移。
- [ ] Tooltip 可通过 hover 和键盘 focus 打开，经过适合密集 IDE 列表的短延迟出现，可通过 pointer exit、focus exit 和 Escape 关闭，并保持在可视区域内。
- [ ] Tooltip 仅包含 Task discovery/presentation metadata，不包含敏感会话内容或可点击操作。
- [ ] Task Row 的可访问描述包含完整 Task Title、originating ACP Agent 和适用的 live ACP Task Status；等价文本存在时状态图标从辅助技术中隐藏。
- [ ] focused component coverage 验证 compact/full presentation、ready 静默、live 状态、Agent label fallback、Tooltip 和 accessible wording；运行中 IDE 的 Playwright coverage 验证真实宽度、单行几何、hover/focus 和主题样式。
- [ ] Classic ACP Chat、Task Registry schema、ACP protocol、Agent startup、Workspace、editor 和 file tree 行为保持不变。

## Blocked by

None - can start immediately
