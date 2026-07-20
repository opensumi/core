# Contributing UI to OpenSumi

本流程用于新增或修改 OpenSumi UI、主题 token 和共享组件。

## 1. 先判断变更归属

### 新增页面或功能 UI

1. 确认它属于哪个现有工作台区域。
2. 查找是否已有 View、Slot、Toolbar、Menu、Quick Input、Dialog 或组件可复用。
3. 功能私有样式留在所属 package，并使用 Less module 与主题 variables。

### 新增共享组件

只有同时满足以下条件时进入 `packages/components`：

- 至少有明确的跨功能复用价值。
- 组件不依赖 OpenSumi runtime、服务或业务状态。
- API 可以用通用 UI 语义描述。
- 状态、键盘、无障碍和主题行为可以独立测试。

否则保留在功能包中，待真实复用出现后再提取。

### 新增主题 token

先按 [TOKENS.md](./TOKENS.md) 的决策顺序检查已有 semantic 和 component token。新增 token 是公共主题能力变更，需要检查全仓引用与主题兼容性。

## 2. UI 实施顺序

1. 定义用户任务、主要动作和退出/恢复路径。
2. 确定工作台区域与信息层级。
3. 选择现有组件和主题 token。
4. 写出 default、hover、active、focus-visible、disabled，以及适用的 loading/error/selected 状态。
5. 补齐键盘模型、ARIA 和焦点进入/返回。
6. 处理长文本、窄宽度、空状态和大量数据。
7. 实现并运行最小充分验证。

## 3. 主题 token 变更步骤

1. 在 `packages/theme/src/common/color-tokens/` 的正确领域文件中注册。
2. 使用稳定、用途导向的 ID，并写清 description。
3. 提供或引用 dark、light、hcDark、hcLight 值。
4. 从相应 `index.ts` 导出或确保模块被加载。
5. 在样式中使用自动生成的 CSS variable，禁止重复写 raw color。
6. 检查扩展、Webview 或主题作者是否会感知该 ID。
7. 为解析、主题切换或公共契约补充相应测试。

不要为了单一页面的一次性颜色差异新增公共 token。

## 4. 样式规则

- 使用 Less module 或当前组件既有样式组织方式。
- 主题颜色只使用 `var(--...)`。
- 尺寸优先使用 2、4、6、8、12、16、24、32px 和现有控件高度。
- 使用现有 stacking level，不添加随机 z-index。
- transition 限定到具体属性，避免 `transition: all`。
- 动画优先 transform/opacity，并提供 reduced-motion 降级。
- 不用 `!important` 掩盖不清晰的层级或状态模型；与既有第三方样式兼容时除外，并说明原因。

## 5. React 与交互规则

- 使用语义 HTML 元素；button 不用 clickable div 替代。
- 异步按钮在执行期间禁用重复提交，并暴露 busy 状态。
- 列表项使用稳定 key，大列表评估虚拟化。
- 避免在 render 中测量布局；读写 DOM 时批处理，防止 layout thrashing。
- ResizeObserver、全局事件和定时器必须正确释放。
- Modal、Popover 和 Menu 使用现有 overlay/focus 管理，不另建全局 portal 体系。
- 不从显示文案、CSS class 或时间推断协议状态；渲染所属服务的权威状态。

## 6. 无障碍检查

- 所有图标按钮有 accessible name。
- Tab 顺序符合视觉顺序，核心流程无需鼠标即可完成。
- focus-visible 在 dark/light/high contrast 中清晰可见。
- Modal/Popover 关闭后焦点返回触发元素。
- 错误、忙碌、选中、展开、禁用状态具有正确语义属性。
- 颜色不是唯一的信息载体。
- reduced motion 下界面仍可理解和操作。
- 文本放大、长文案或本地化后不遮挡主要操作。

## 7. 验证矩阵

根据风险选择最窄但充分的验证：

| 变更                              | 最低验证                           |
| --------------------------------- | ---------------------------------- |
| 纯文案或局部无布局样式            | 相关单测/快照（如存在）+ 手动检查  |
| 组件状态或键盘行为                | focused Jest/jsdom tests           |
| 公共组件 API                      | package typecheck/build + 组件测试 |
| 主题 token                        | theme tests + dark/light 实际检查  |
| Layout、Tab、拖拽、焦点、真实 DOM | Playwright 或运行 IDE              |
| 公共协议、扩展可见主题能力        | 下游引用检查 + contract tests      |

运行时检查至少覆盖：

- 默认 dark theme。
- light theme。
- 相关 high contrast theme 或等效可辨识检查。
- 键盘主流程。
- 窄宽度或面板收缩。
- loading、empty、error、disabled 等适用状态。

## 8. PR/交付清单

- [ ] 复用了现有工作台区域和组件。
- [ ] 未新增主题相关硬编码颜色。
- [ ] 新 token 有清晰 description 和多主题策略。
- [ ] 交互状态完整且不会引发布局跳动。
- [ ] 核心流程可通过键盘完成。
- [ ] icon-only 控件有 accessible name 和 tooltip。
- [ ] 异步操作有反馈，失败有恢复路径。
- [ ] 长文本、空状态、窄宽度和滚动行为已处理。
- [ ] dark/light/high contrast 已检查。
- [ ] 已运行与风险匹配的测试、typecheck 或实际 IDE 验证。
- [ ] `git diff --check` 通过。

## 9. 评审优先级

UI 评审按以下顺序进行：

1. 任务是否可完成，状态是否正确。
2. 键盘、焦点、无障碍和错误恢复。
3. 工作台、主题和公共 API 兼容性。
4. 布局稳定性、性能和数据量表现。
5. 视觉一致性和细节精度。

视觉精修不能掩盖交互、契约或可访问性问题。
