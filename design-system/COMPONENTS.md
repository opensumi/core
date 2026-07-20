# OpenSumi Component Specifications

本规范描述 OpenSumi 工作台 UI 的共享组件约定。实现来源以 `@opensumi/ide-components` 和各工作台服务为准。

## 1. 组件归属

| 需求                         | 首选实现                                              |
| ---------------------------- | ----------------------------------------------------- |
| 通用纯 UI 组件               | `packages/components`                                 |
| 工作台菜单、命令、上下文行为 | 现有 Menu/Command/ContextKey contribution             |
| 编辑器、Tab、布局区域        | main-layout、editor、layout services                  |
| 快速选择、命令选择           | Quick Input / Quick Pick                              |
| 功能私有展示                 | 所属 feature package                                  |
| 跨包业务组件                 | 明确公共契约后放入合适的共享包，不默认放入 components |

`packages/components` 中的组件必须保持纯组件：不依赖 OpenSumi runtime，不直接读取工作台服务，不承担业务状态编排。

## 2. 通用状态模型

所有交互组件按适用范围实现以下状态：

| 状态          | 行为要求                                                        |
| ------------- | --------------------------------------------------------------- |
| default       | 清晰表达可交互性和当前值                                        |
| hover         | 提供轻量视觉反馈，但不改变布局尺寸                              |
| active        | 表达按压或正在执行的瞬间状态                                    |
| focus-visible | 键盘焦点清晰可见，通常使用 `focusBorder` 或 `list.focusOutline` |
| disabled      | 语义禁用、不可触发，视觉弱化但仍可读                            |
| loading       | 阻止重复触发，显示 spinner/进度并暴露 busy 状态                 |
| error         | 错误靠近来源，包含恢复说明，不只显示红色                        |
| selected      | 与 hover 区分，跨失焦状态仍可识别                               |

状态优先级：disabled → loading → active → focus-visible → hover → default。

## 3. Button

### 现有尺寸

| Size    | Height | Horizontal padding | Font size | 使用场景                     |
| ------- | -----: | -----------------: | --------: | ---------------------------- |
| small   |   22px |                8px |      12px | 紧凑次要工具区               |
| default |   28px |               12px |      12px | 默认表单和操作区             |
| large   |   32px |               16px |      14px | Modal 主操作或需要更高强调时 |

### Variants

| Variant           | 使用场景                         |
| ----------------- | -------------------------------- |
| primary           | 当前区域唯一主要动作             |
| secondary/default | 普通操作和次要动作               |
| ghost             | 工具栏、弱背景和低强调操作       |
| link              | 文本内导航或低视觉重量动作       |
| danger            | 立即产生破坏性结果的动作         |
| ghost danger      | 破坏性入口，但执行前仍有确认流程 |

规则：

- 一个 Dialog 或紧凑操作区通常只有一个 primary。
- 文案使用动词，避免“确定/取消”之外没有上下文。
- icon-only button 必须提供 accessible name、tooltip 和足够命中区域。
- loading 时保留按钮宽度，避免文本和布局跳动。
- danger 与普通 primary 不能视觉等价；不可逆操作需要确认或撤销。
- 不使用缩放造成相邻布局抖动；图标轻微 transform 只用于不影响盒模型的反馈。

## 4. Input and Textarea

### 现有尺寸

| Size    | Height | Font size |
| ------- | -----: | --------: |
| small   |   22px |      12px |
| default |   28px |      12px |
| large   |   32px |      14px |

规则：

- 有业务含义的输入必须有可见 label；placeholder 只提供示例或格式提示。
- focus 使用主题焦点边界，hover 与 focus 不应完全无法区分。
- 错误信息放在对应字段附近，并通过 `aria-describedby` 关联。
- 校验通常在 blur 或提交后显示，避免用户输入每个字符时立即报错。
- clear、show password、browse 等尾部动作需要独立 accessible name。
- read-only 允许聚焦和复制；disabled 不接收交互。
- 多行输入应限制最小/最大高度，并在内容增长时保持周围布局稳定。

## 5. Select and Combobox

- 使用原生 select 能满足需求时优先原生语义；复杂搜索、图标或多选使用现有 Select/Quick Pick。
- 打开后焦点和 active option 必须可预测。
- 支持 Up/Down 导航、Enter 选择、Esc 关闭；可搜索时保持输入焦点。
- 选项需要稳定 key，不用颜色作为唯一状态。
- 长选项可截断，但应提供完整文本访问方式。
- loading、empty 和 error 必须有明确内容，不能显示空下拉框。
- disabled option 保持可读，并解释不可用原因（如用户需要知道）。

## 6. Checkbox and selection controls

- Checkbox 用于可独立开关的多选项；单一布尔设置也可使用 Checkbox。
- Radio 用于少量互斥选项；选项较多或空间有限时使用 Select。
- 控件与 label 共同形成点击区域。
- checked、indeterminate、disabled 必须同时具有视觉和语义状态。
- 不使用 Checkbox 触发立即危险操作。

## 7. Tabs

- Tab 表示同一上下文中的同级内容，不用于替代一级导航。
- active、inactive、hover 和 unfocused active 状态必须可区分。
- 支持 Left/Right 或符合现有工作台约定的键盘导航。
- 关闭 Tab 后，焦点移动到合理的相邻 Tab 或内容区域。
- 修改未保存、固定、预览等状态使用现有工作台语义，不创建平行标记。
- Tab 数量超出空间时使用滚动、收缩或 overflow，而不是无限压缩文字。

## 8. Tree and List

- 使用现有 recycle tree/list 或工作台树服务处理大数据量。
- hover、focus、active selection、inactive selection 必须分别映射到 `list.*` token。
- 行高与缩进保持一致，不用任意 margin 破坏树形关系。
- 支持方向键、Home/End、Enter/Space，以及适用的 type-ahead。
- 展开状态通过 `aria-expanded` 表达；当前项和选中项不要混为一谈。
- 拖拽必须提供明确 drop target 和非拖拽替代操作。
- 50 项以上或节点渲染昂贵时评估虚拟化，避免滚动卡顿。

## 9. Menu and context menu

- 菜单用于操作，不用于承载复杂表单或长篇说明。
- 命令名称简短明确，可在右侧显示快捷键。
- 相关命令分组；危险命令与普通命令分隔。
- 不可用命令应 disabled；当原因重要时提供说明，不要无规则地隐藏。
- 支持方向键、Enter、Esc 和首字母导航。
- Context menu 的目标语义必须与右键位置一致，不能作用于隐藏的旧选择。

## 10. Toolbar

- 主要工具按使用频率从左到右排列，次要操作进入 overflow。
- 同一工具栏只保留一个视觉 primary；大多数工具栏动作使用 ghost/icon variant。
- icon-only 控件需要 tooltip，建议同时展示快捷键。
- Toolbar 不因异步状态改变整体高度或排列。
- 需要持续状态的动作使用 selected/pressed 语义，而不是只改变图标颜色。

## 11. Popover, Tooltip and Dropdown

### Tooltip

- 解释图标、缩写或快捷键。
- 不放置需要点击的主要内容。
- 不作为错误信息、label 或完成任务所必需的信息载体。
- 键盘聚焦时同样可显示，Esc 可关闭。

### Popover

- 用于短内容和轻量交互；复杂流程升级为 Dialog 或独立 View。
- 关闭后焦点返回触发元素。
- 保持在 viewport 内，避免覆盖触发目标和关键上下文。
- 使用 `--stacking-level-popover-component` 等既有层级变量。

### Dropdown

- 选择型内容遵守 Select 规范，命令型内容遵守 Menu 规范。
- loading、empty 和 error 状态必须明确。

## 12. Modal and Dialog

- 用于需要用户集中处理、确认或完成短流程的任务。
- 不用 Modal 承载一级导航或长期工作区。
- 打开时聚焦标题、首个字段或最安全的主要起点；关闭时返回触发元素。
- Esc 可关闭非强制流程；有未保存输入时关闭需要确认。
- Footer 操作顺序与平台现有约定一致，primary 不超过一个。
- 内容过长时 body 滚动，header/footer 保持清晰；避免整个页面和 Modal 双重滚动冲突。
- 破坏性确认必须写明对象和后果，默认焦点优先放在安全操作。

## 13. Notification, Message and Toast

- Message/Toast：短暂、非阻塞、无需复杂处理的结果反馈。
- Notification：需要保留、查看详情或执行后续动作的信息。
- Dialog：必须立即决定或会产生高风险结果的情况。
- Toast 使用 `aria-live="polite"`，不抢夺焦点。
- 错误通知包含恢复动作或查看日志入口。
- 自动消失内容应保留足够阅读时间；重要错误不自动消失。
- 多条相同通知应合并或节流，避免通知风暴。

## 14. Empty, Loading and Error states

### Empty

包含：当前状态说明、形成原因（必要时）、一个明确下一步。避免只放插图或“暂无数据”。

### Loading

- 保留最终布局空间，减少跳动。
- 超过 300ms 显示局部反馈。
- 长任务显示阶段、已完成数量或可取消操作。
- 不用多个不同 spinner 同时竞争注意力。

### Error

- 说明发生了什么。
- 说明用户可以怎么做。
- 技术详情可折叠或进入日志，不直接覆盖主要操作。
- 重试必须避免重复副作用。

## 15. 新组件验收模板

新增共享组件时，PR 或设计说明至少回答：

- 为什么现有组件不能满足？
- 组件属于纯 UI 还是工作台 runtime？
- anatomy、variants、sizes 和 states 是什么？
- 使用哪些主题 token？
- dark/light/high contrast 表现如何？
- 键盘模型、ARIA role 和焦点返回是什么？
- loading、empty、error、disabled 如何处理？
- 窄宽度、长文本和大量数据如何表现？
- 需要哪些单测、Playwright 或实际 IDE 验证？
