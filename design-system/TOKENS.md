# OpenSumi Design Tokens

本规范在不破坏现有主题兼容性的前提下，为 OpenSumi 建立 Primitive → Semantic → Component 三层 token 认知模型。

## 1. 现有实现

OpenSumi 颜色通过 `registerColor(id, defaults, description, ...)` 注册。主题应用时，颜色 ID 中的 `.` 会转换为 `-` 并挂载为 CSS variable：

```text
focusBorder                 -> --focusBorder
editor.background           -> --editor-background
kt.primaryButton.background -> --kt-primaryButton-background
```

现有实现位置：

- 颜色注册：`packages/theme/src/common/color-tokens/`
- CSS variable 注入：`packages/theme/src/browser/workbench.theme.service.ts`
- 通用组件变量：`packages/components/src/style/variable.less`
- IDE 基础字号和间距：`packages/core-browser/src/style/variable.less`
- z-index CSS variables：`packages/theme/src/common/rule.ts`

## 2. 三层模型

### Primitive tokens

Primitive 是原始值，例如色值、字号、间距、圆角、时长和阴影。现阶段它们主要存在于：

- 主题 token 的 dark/light 默认值。
- `packages/components/src/style/variable.less` 的 Less 变量。
- `@base-font-size: 13px` 与 `@base-ui-spacing: 6px`。

Primitive 不是 feature UI 的消费 API。功能样式不应直接复制 raw hex 或随意增加新的数值尺度。

推荐基础尺度：

| 类别           | 基线                         |
| -------------- | ---------------------------- |
| spacing        | 2、4、6、8、12、16、24、32px |
| font size      | 11、12、13、14、16、20、24px |
| radius         | 0、2、4、6、8px、full        |
| duration       | 100、150、200、300ms         |
| control height | 22、28、32px                 |

这些尺度用于设计与评审，不要求立即新增一套平行 CSS variables。

### Semantic tokens

Semantic token 表达用途，而不是组件名称。优先使用 VS Code 兼容和 OpenSumi 通用语义色。

| 意图       | Theme ID                         | CSS variable                       |
| ---------- | -------------------------------- | ---------------------------------- |
| 主要文本   | `foreground`                     | `--foreground`                     |
| 次要文本   | `descriptionForeground`          | `--descriptionForeground`          |
| 禁用文本   | `disabledForeground`             | `--disabledForeground`             |
| 通用图标   | `icon.foreground`                | `--icon-foreground`                |
| 焦点边界   | `focusBorder`                    | `--focusBorder`                    |
| 编辑器表面 | `editor.background`              | `--editor-background`              |
| 编辑器文本 | `editor.foreground`              | `--editor-foreground`              |
| 侧边栏表面 | `sideBar.background`             | `--sideBar-background`             |
| 面板表面   | `panel.background`               | `--panel-background`               |
| 列表 hover | `list.hoverBackground`           | `--list-hoverBackground`           |
| 列表选中   | `list.activeSelectionBackground` | `--list-activeSelectionBackground` |
| 列表焦点   | `list.focusOutline`              | `--list-focusOutline`              |
| 输入框表面 | `input.background`               | `--input-background`               |
| 输入框文本 | `input.foreground`               | `--input-foreground`               |
| 输入框占位 | `input.placeholderForeground`    | `--input-placeholderForeground`    |
| 菜单表面   | `menu.background`                | `--menu-background`                |
| 菜单文本   | `menu.foreground`                | `--menu-foreground`                |
| 通知表面   | `notifications.background`       | `--notifications-background`       |

当存在合适的语义 token 时，不为颜色细微差异新增组件 token。

### Component tokens

Component token 用于一个稳定组件及其状态。OpenSumi 已有的 `kt.*` token 属于这一层。

| 组件 | 推荐 token 族 |
| --- | --- |
| Button | `kt.primaryButton.*`、`kt.secondaryButton.*`、`kt.defaultButton.*`、`kt.dangerButton.*`、`kt.button.disable*` |
| Input | `input.*`、`kt.input.*`、`inputValidation.*` |
| Checkbox | `checkbox.*`、`kt.checkbox.*` |
| Select | `kt.select.*`、`kt.selectOption.*`、`kt.selectDropdown.*` |
| Tab | `tab.*`、`kt.tab.*` |
| Panel | `panel.*`、`kt.panel*` |
| Menu | `menu.*`、`kt.menu.*`、`kt.menubar.*` |
| Popover | `kt.popover.*` |
| Modal | `kt.modal.*`、`notifications.*` |
| Notification | `notifications.*`、`notification*`、`kt.notifications*` |
| Toolbar | `toolbar.*` |

`design.*` token 是历史上形成的设计场景 token。新增通用 UI 时，先检查 Semantic 和 `kt.*` 层，不默认扩展 `design.*`。

## 3. 消费规则

### 正确

```less
.node {
  color: var(--foreground);
  background: var(--sideBar-background);
  border-color: var(--sideBar-border);

  &:hover {
    background: var(--list-hoverBackground);
  }

  &:focus-visible {
    outline: 1px solid var(--focusBorder);
  }
}
```

### 错误

```less
.node {
  color: #d8dee9;
  background: #1e222a;
  border-color: rgba(255, 255, 255, 0.08);
}
```

允许的固定值包括布局尺寸、非主题几何值和确实不随主题变化的媒体资产，但应优先从既有尺寸尺度中选择。

## 4. 新增颜色 token

新增前依次判断：

1. 能否复用现有工作台语义 token？
2. 能否复用已有 `kt.*` 组件 token？
3. 该差异是否确实具有稳定语义，而非单页视觉偏好？
4. 是否会暴露给主题作者或扩展？

只有前三项无法满足时才新增 token。

### 命名

```text
通用语义：category.propertyState
组件语义：kt.component.propertyState
功能私有：feature.component.propertyState
```

示例：

```text
toolbar.hoverBackground
kt.primaryButton.hoverBackground
aiNative.inlineDiffAddedRange
```

要求：

- 使用名词表达对象，使用 property/state 表达用途。
- 状态词统一使用 `hover`、`active`、`focus`、`disabled`、`selected`、`error` 等。
- 不在名称中放入具体色名，如 `blueBackground`。
- 不用 `new`、`v2`、`temp` 等迁移性名称。
- description 必须说明使用场景，不能留空。

### 主题默认值

每个新 token 必须评估：

| Theme   | 要求                                 |
| ------- | ------------------------------------ |
| dark    | 提供值或明确引用已有 token           |
| light   | 提供值或明确引用已有 token           |
| hcDark  | 提供高对比度值，或确认继承语义可辨识 |
| hcLight | 提供高对比度值，或确认继承语义可辨识 |

不要简单反转亮暗色。暗色模式通常需要更低饱和的表面和更亮的前景；边框、焦点和状态对比度需要独立验证。

## 5. 非颜色 token

### Typography

当前字体、字号和行高主要由 Less 变量及局部样式控制。新增 UI 应优先复用：

- `@font-family`
- `@code-family`
- `@font-size-base`
- `@font-size-sm`
- `@font-size-lg`
- `@line-height-base`
- `@base-font-size`

不要为单个视图引入新的字体族。

### Spacing and sizing

- 常规间距使用 2、4、6、8、12、16、24、32px。
- 默认紧凑控件使用 28px，高一级使用 32px。
- 22px 仅用于明确的紧凑变体。
- 避免相邻位置混用 5、7、9、11px 等无系统数值；历史组件已有值除外。

### Radius and elevation

- 常规控件 2px，Modal 和大表面可使用 4px。
- 使用现有 shadow token、Less shadow mixin 或主题中的 `widget.shadow`、`kt.menu.shadow`、`design.boxShadow.*`。
- 不通过不断增大 shadow 表达层级；优先使用表面、边框和 z-index 关系。

### Z-index

- 使用 `StackingLevelStr` 注册出的 `--stacking-level-*` variables。
- 使用现有组件 z-index 变量时，保持其层级语义。
- 禁止通过随机的 `9999`、`99999` 修复遮挡；应确认 overlay container 和 stacking context。

### Motion

- 复用现有 `@animation-duration-fast/base/slow` 和 easing 变量。
- 新动效默认使用 100–300ms。
- 为 `prefers-reduced-motion` 提供降级。

## 6. 迁移策略

本规范不要求一次性重命名现有 600+ 颜色 token。迁移采用增量策略：

1. 新 UI 只消费现有语义 token，不新增硬编码主题色。
2. 修改旧 UI 时，顺手将触达范围内的硬编码色替换为已有 token。
3. 只有多个组件稳定共享同一用途时，才提升为新的 semantic token。
4. 废弃 token 需要兼容期、迁移说明和下游引用检查。
5. 公共主题 ID 视为兼容性边界，不为命名美观进行批量重命名。
