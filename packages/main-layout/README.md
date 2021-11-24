---
id: main-layout
title: 布局模块
---

main-layout 模块负责 IDE 的基础布局划分，将整个窗口划分为形如left、main、bottom的若干块区域，我们定义这种区域为插槽。在布局划分之后，又通过提供的插槽渲染器组件来消费注册到插槽的若干个大视图。在如左侧边栏这类特殊的插槽中，一个大的视图（称为视图容器）还可以支持注册多个小的子视图。所以最终整个布局和 React 视图组件的一个组织关系为

![布局与视图的组织关系](https://img.alicdn.com/tfs/TB1gXOU3UH1gK0jSZSyXXXtlpXa-1850-990.png)

我们注册的视图最终会落到视图容器或子视图内。每个视图会通过 ContextProvider 注入全局的 DI 实例，视图内通过 `useInjectable` 方法就可以拿到各个类的实例。

<!-- TODO: 是否有必要根据内容快速生成导航链接overview？文档本身有右侧菜单了 -->

# 贡献点

## Contribution Providers

模块定义的用于其他模块贡献的贡献点。

### ComponentContribution

用于向 `ComponentRegistry` 注册视图信息的贡献点，注册的视图信息会被关联到对应的Token（一般约定为包名）内，通过配置  `LayoutConfig` 进行消费。

##### Example

```js
// 关联视图信息到token
registerComponent(registry: ComponentRegistry) {
  registry.register('@opensumi/ide-debug-console', {
    id: DEBUG_CONSOLE_VIEW_ID,
    component: DebugConsoleView,
  }, {
    title: localize('debug.console.panel.title'),
    priority: 8,
    containerId: DEBUG_CONSOLE_CONTAINER_ID,
    iconClass: getIcon('debug'),
  });
}
// 映射token到视图Slot
const LayoutConfig = {
  [SlotLocation.left]: {modules: ['@opensumi/ide-debug-console']}
}
```

### SlotRendererContribution

> TODO

### TabBarToolbarContribution

> TODO

## Contributions

模块注册的贡献点。

### Command

* `main-layout.left-panel.toggle`: 切换左侧面板
* `main-layout.right-panel.toggle`: 切换右侧面板
* `main-layout.bottom-panel.toggle`: 切换底部面板
* `main-layout.bottom-panel.expand`: 最大化底部面板
* `main-layout.bottom-panel.shrink`: 最小化底部面板


### Preference

无

### KeyBinding

* `ctrlcmd+b`: 切换左面板
* `ctrlcmd+j`: 切换底部面板

### Menu

> TODO: 不被依赖，是否有必要列出来？

* `view.outward.right-panel.hide`: 隐藏右侧面板

### ClientAppConfig

> 这个不能算贡献点，但是很重要，放哪里比较好？

* `defaultPanels`: 侧边栏、底部栏默认展开的面板

# 类

## LayoutService

`DI token: IMainLayoutService`

布局模块最上层的控制服务。

### Static Methods

#### `test()`

```js
static test(
  text: string,
  delimiter?: string
): ContentState
```

这是一个测试的静态方法（LayoutService没有静态方法，先做个示例）.

### Methods

#### `isVisible()`

```js
isVisible(location: string): Boolean
```

仅在支持多视图注册、可折叠展开的Slot可用。传入Slot位置，返回视图是否可见（非折叠状态）的状态。

#### `toggleSlot()`

```js
toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void
```

仅在支持多视图注册、可折叠展开的Slot可用。切换Slot的折叠展开状态，支持显示的传入`show`参数指定是否展开，未传入则取当前状态相反值进行切换；支持显示传入`size`参数指定最终的展开尺寸。

传入的`size`若为0会被忽略。

#### `getTabbarService()`

```js
getTabbarService(location: string): TabbarService
```

仅在支持多视图注册、可折叠展开的Slot可用。传入Slot位置，返回指定位置的`TabbarService`实例。

#### `getAccordionService()`

```js
getAccordionService(containerId: string): AccordionService
```

仅在支持多子视图渲染的Slot可用。传入Slot位置，返回指定位置的`AccordionService`实例。

#### `getTabbarHandler()`

```js
getTabbarHandler(viewOrContainerId: string): TabBarHandler | undefined
```

仅在支持多视图注册、可折叠展开的Slot可用。获取视图或子视图对应的视图控制器，控制器支持进行视图事件监听、主动切换展开状态等能力。

一般情况下推荐使用`TabBarHandler`对视图状态进行主动控制，而不是使用`toggleSlot` api。

##### Example

```js
const handler = layoutService.getTabbarHandler('explorer');
handler.onActivate(() => {console.log('explorer tab activated!')});
handler.activate();
```
#### `collectTabbarComponent()`

```js
collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string
```

仅在支持多视图注册、可折叠展开的Slot可用。往指定Slot注册一个或多个视图（若指定Slot不支持多个子视图，则只会渲染第一个）。支持自定义视图的标题组件`titleComponent`，标题组件为侧边栏顶部区域或底部栏的左上角区域。


#### `disposeContainer()`

```js
disposeContainer(containerId: string): void
```

仅在支持多视图注册、可折叠展开的Slot可用。销毁一个已注册的视图面板。

#### `collectViewComponent()`

```js
collectViewComponent(view: View, containerId: string, props: any = {}): string
```

仅在支持多子视图渲染的Slot可用。往一个视图面板内加入新的子视图面板，支持传入自定义的默认props。

#### `replaceViewComponent()`

```js
replaceViewComponent(view: View, props?: any): void
```

仅在支持多子视图渲染的Slot可用。替换一个已存在的子视图，一般用于预加载场景下，替换加载中的占位视图。

#### `disposeViewComponent()`

```js
disposeViewComponent(viewId: string): void
```

仅在支持多子视图渲染的Slot可用。销毁一个已经注册的子视图。

#### `revealView()`

```js
revealView(viewId: string): void
```

仅在支持多子视图渲染的Slot可用。强制展开一个子视图，注意该方法并不会保证子视图所在的视图容器可见。

---

## TabbarService

`DI Token: TabbarServiceFactory`

面向多视图注册、可折叠展开的Slot使用的视图激活控制服务。

### Properties

#### `onCurrentChange`

```js
readonly onCurrentChange: Event<{previousId: string; currentId: string}>
```

当前激活视图变化的事件


##### Example

```js
tabbarService.onCurrentChange((e) => {
  console.log(e.currentId, e.previousId);
});
```

### Methods

#### `registerContainer()`

```js
registerContainer(containerId: string, componentInfo: ComponentRegistryInfo): IDisposable
```

注册一个新的视图容器。返回一个销毁该容器及其所有副作用的句柄。

---

# React 组件

## `<TabRendererBase />`

### props

#### `side`

```js
side: string;
```

#### `className`

```js
className?: string;
```

#### `components`

```js
components: ComponentRegistryInfo[];
```

#### `direction`

```js
direction?: Layout.direction;
```

#### `TabbarView`

```js
TabbarView: React.FC;
```

#### `TabpanelView`

```js
TabpanelView: React.FC;
```

#### `noAccordion`

```js
noAccordion?: boolean;
```

