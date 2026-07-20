# 稳定 hover/focus 操作、未读与选中状态

Status: ready-for-agent

## Parent

../PRD.md

## User stories covered

22–28、30–39、42–44

## What to build

完成 Task Row 的 progressive disclosure 与运行时验收。Archive 或 Unarchive 在 hover 和键盘 focus 时出现在预留的 trailing action 区域，只替换 primary state 的可见区域，不改变 Task Title 或 Agent 的位置，不遮挡独立 unread marker，也不改变 Task Row 的宽高。

同时验证 selected、hover、focus-visible、disabled、Unavailable ACP Agent、Unavailable Task Conversation 和 archived Task Row 在紧凑布局中的组合表现。运行中 IDE 验收覆盖最小、默认和最大 Task List 宽度，以及 dark、light 和适用的 high-contrast 主题，确保真实 Tooltip、主题 token、焦点、选中和 action disclosure 均可用。

## Acceptance criteria

- [ ] Archive 和 Unarchive 控件在 pointer hover 与 keyboard focus-within 时可见并可操作，离开对应状态后恢复隐藏，不依赖 hover 作为唯一入口。
- [ ] row action 使用预留 trailing 区域，出现和消失时 Task Title、Agent label、row width、row height 和相邻 Task Row 均不发生布局位移。
- [ ] action disclosure 只隐藏或替换 compact primary state presentation；unread marker 在 action 可见期间仍然清晰可见且保持独立语义。
- [ ] selected Task Row 保持 active background、leading indicator 和 `aria-current`；hover、focus-visible、selected 与 disabled 状态之间能够明确区分。
- [ ] Tooltip 与 row action 不互相遮挡关键上下文；Tooltip 保持非交互，Archive/Unarchive 保持独立、具名、可聚焦的真实按钮。
- [ ] Unavailable ACP Agent、Unavailable Task Conversation、Last-known、Attention、unread、selected、archive-eligible 和 archived Task 的代表性组合均保持 22px 单行布局。
- [ ] 运行中 IDE coverage 在 208px、244px 和 280px 宽度验证无换行、无横向溢出、ellipsis、稳定几何、Tooltip hover/focus、action disclosure 和 unread persistence。
- [ ] dark、light、high-contrast dark 和 high-contrast light 的适用验收确认文本、图标、Tooltip、focus indicator、selected row、disabled row 和 warning/error 状态具有足够可辨识度并只使用主题 token。
- [ ] focused tests 与 Agentic Task Workbench Playwright scenario 共同覆盖真实外部行为；测试不依赖私有 React state 或仅由构建工具生成的 class 名称。
- [ ] 最终验证包含窄范围 TypeScript build、Agent Task List focused tests、Agentic Task Workbench runtime scenario 和 whitespace check，且不要求修改 Classic ACP 或共享 IDE Layout。

## Blocked by

- [01 — 建立紧凑单行 Task Row 与完整 Tooltip](01-compact-task-row-and-tooltip.md)
- [02 — 适配 Attention、Last-known 与不可用状态](02-attention-history-and-availability.md)
