export const browserViews = {
  // browserViews
  "kaitianContributes.browserViews": "向编辑器提供前端视图",
  "kaitianContributes.browserViews.left": "在左侧活动栏容器提供视图",
  "kaitianContributes.browserViews.right": "在右侧活动栏容器提供视图",
  "kaitianContributes.browserViews.bottom": "在底部标签栏容器提供视图（不会渲染图标，所以需要提供标题）",
  "kaitianContributes.browserViews.location.custom": "向 \"{0}\" 容器提供视图",
  "kaitianContributes.browserViews.view.id": "视图 id, browser/index 中需要导出一个与此 id 相同名称的组件",
  "kaitianContributes.browserViews.view.icon": "图标名称，参考: [内置图标集](https://docs.antfin-inc.com/iconfont-demo/)",
  "kaitianContributes.browserViews.view.iconPath": "本地图标相对路径",
  "kaitianContributes.browserViews.view.title": "视图标题（当 type 为 bottom 时，将展示）",
  "kaitianContributes.browserViews.view.titleComponentId": "自定义视图标题组件 id, 特性与普通的 browserView 完全一致",
  "kaitianContributes.browserViews.view.expanded": "是否需要全屏展开，这会遮盖掉 editor 区域",

  // browserMain
  "kaitianContributes.browserMain": "声明插件 browser 入口（相对于插件目录的编译后的代码文件路径）",

  // nodeMain
  "kaitianContributes.nodeMain": "声明插件 node 入口（相对于插件目录的编译后的代码文件路径）",

  // workerMain
  "kaitianContributes.workerMain": "声明插件 worker 入口（相对于插件目录的编译后的代码文件路径）",

  // viewsProxies
  "kaitianContributes.viewsProxies": "声明需要绑定 componentProxy 调用的组件 id, 与导出名相同。例如声明 [\"component\"] 后, 即可在 node 层通过 **`context.componentProxy.component.xxxx`** 调用 browser 层 component 组件的 xxxx 函数",
}
