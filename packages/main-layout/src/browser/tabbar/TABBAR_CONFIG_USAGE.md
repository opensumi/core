# Tabbar 配置使用指南

## 概述

现在支持在注册插槽渲染器时传入 `tabbarConfig` 配置，用于控制 tabbar 的布局行为。这样不同的插槽渲染器可以根据自己的实现特点提供相应的配置。

## 配置接口

```typescript
export interface TabbarConfig {
  /** 是否为后置位置（bar 在 panel 右侧或底下） */
  isLatter: boolean;
  /** 支持的操作类型 */
  supportedActions?: {
    expand?: boolean;
    toggle?: boolean;
    accordion?: boolean;
  };
}
```

## 使用方式

### 1. 注册带配置的插槽渲染器

```typescript
import { SlotLocation } from '@opensumi/ide-core-browser';
import { slotRendererRegistry } from '@opensumi/ide-core-browser/lib/react-providers';

// 注册左侧面板渲染器（bar 在 panel 左侧）
slotRendererRegistry.registerSlotRenderer(SlotLocation.view, LeftTabRenderer, {
  isLatter: false, // bar 在 panel 左侧
  supportedActions: {
    accordion: true, // 支持手风琴
  },
});

// 注册右侧面板渲染器（bar 在 panel 右侧）
slotRendererRegistry.registerSlotRenderer(SlotLocation.extendView, RightTabRenderer, {
  isLatter: true, // bar 在 panel 右侧
  supportedActions: {
    accordion: true,
  },
});

// 注册底部面板渲染器（bar 在 panel 底下）
slotRendererRegistry.registerSlotRenderer(SlotLocation.panel, BottomTabRenderer, {
  isLatter: true, // bar 在 panel 底下
  supportedActions: {
    expand: true, // 支持展开/收缩
    toggle: true, // 支持 toggle 行为
  },
});
```

### 2. 自定义插槽渲染器的配置

如果你有自定义的插槽渲染器，可以根据具体的布局实现来设置配置：

```typescript
// 自定义的水平布局渲染器
class HorizontalTabRenderer extends React.Component {
  // 实现水平布局，bar 在左侧
}

// 注册时指定配置
slotRendererRegistry.registerSlotRenderer('customLocation', HorizontalTabRenderer, {
  isLatter: false, // bar 在左侧
  supportedActions: {
    accordion: false, // 不支持手风琴
    expand: false, // 不支持展开
  },
});
```

### 3. 配置的优先级

配置采用以下优先级：

1. **插槽渲染器配置**：通过 `registerSlotRenderer` 传入的 `tabbarConfig`
2. **默认配置**：基于 location 的默认配置

```typescript
// 在策略中获取配置的逻辑
protected getIsLatter(): boolean {
  if (this.tabbarConfig?.isLatter !== undefined) {
    return this.tabbarConfig.isLatter; // 优先使用渲染器配置
  }
  // 默认配置：扩展视图和底部面板为后置位置
  return this.location === 'extendView' || this.location === 'panel';
}
```

## 实际应用场景

### 场景 1：自定义右侧面板布局

如果你的右侧面板采用了特殊的布局，bar 实际在左侧：

```typescript
slotRendererRegistry.registerSlotRenderer(SlotLocation.extendView, CustomRightRenderer, {
  isLatter: false, // 虽然是右侧面板，但 bar 在左侧
});
```

### 场景 2：底部面板的变体

底部面板的不同实现可能有不同的布局：

```typescript
// 传统底部面板：bar 在上方
slotRendererRegistry.registerSlotRenderer(SlotLocation.panel, TraditionalBottomRenderer, {
  isLatter: false, // bar 在 panel 上方
  supportedActions: {
    expand: true,
    toggle: true,
  },
});

// 现代底部面板：bar 在下方
slotRendererRegistry.registerSlotRenderer(SlotLocation.panel, ModernBottomRenderer, {
  isLatter: true, // bar 在 panel 下方
  supportedActions: {
    expand: true,
    toggle: true,
  },
});
```

## 注意事项

1. **向后兼容**：如果不提供 `tabbarConfig`，会使用默认配置
2. **配置验证**：确保 `isLatter` 的值与实际的渲染器布局一致
3. **动态更新**：目前配置在注册时确定，不支持运行时动态修改

## 好处

- **灵活性**：不同的渲染器可以有不同的布局配置
- **解耦合**：策略不再硬编码位置相关的配置
- **可扩展**：新的渲染器可以轻松定义自己的配置
- **清晰性**：配置意图明确，便于理解和维护
