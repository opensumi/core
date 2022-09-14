export const browserViews = {
  // kaitianContributes
  'sumiContributes.opensumiContributes': '由此包表示的 Opensumi 扩展的所有贡献',

  // 公用 properties，如 command
  'sumiContributes.common.command': '要执行的命令。该命令必须在 "contributes.command" 中声明（内置命令除外）',
  'sumiContributes.common.when': '此条件必须为 true 才能显示此项',
  'sumiContributes.common.group': '此项所属的组',

  // browserViews
  'sumiContributes.browserViews': '向编辑器提供前端视图',
  'sumiContributes.browserViews.left': '在左侧活动栏容器提供视图',
  'sumiContributes.browserViews.right': '在右侧活动栏容器提供视图',
  'sumiContributes.browserViews.bottom': '在底部标签栏容器提供视图（不会渲染图标，所以需要提供标题）',
  'sumiContributes.browserViews.location.custom': '向 "{0}" 容器提供视图',
  'sumiContributes.browserViews.view.id': '视图 id, browser/index 中需要导出一个与此 id 相同名称的组件',
  'sumiContributes.browserViews.view.icon': '图标名称，参考: [内置图标集](https://opensumi.github.io/core/)',
  'sumiContributes.browserViews.view.iconPath': '本地图标相对路径',
  'sumiContributes.browserViews.view.title': '视图标题（当 type 为 bottom 时，将展示）',
  'sumiContributes.browserViews.view.titleComponentId': '自定义视图标题组件 id, 特性与普通的 browserView 完全一致',
  'sumiContributes.browserViews.view.expanded': '是否需要全屏展开，这会遮盖掉 editor 区域',

  // browserMain
  'sumiContributes.browserMain': '声明插件 browser 入口（相对于插件目录的编译后的代码文件路径）',

  // nodeMain
  'sumiContributes.nodeMain': '声明插件 node 入口（相对于插件目录的编译后的代码文件路径）',

  // workerMain
  'sumiContributes.workerMain': '声明插件 worker 入口（相对于插件目录的编译后的代码文件路径）',

  // viewsProxies
  'sumiContributes.viewsProxies':
    '声明需要绑定 componentProxy 调用的组件 id, 与导出名相同。例如声明 ["component"] 后, 即可在 node 层通过 **`context.componentProxy.component.xxxx`** 调用 browser 层 component 组件的 xxxx 函数',

  // toolbar
  'sumiContributes.toolbar': 'Toolbar 默认位于 IDE 顶部菜单栏的右侧, 也可以展现为单独的一栏',
  'sumiContributes.toolbar.actions':
    '用于描述 Toolbar 上的元素, 目前仅支持 `button` 和 `select`, 我们称之为 action, 某些情况下需要搭配 Toolbar API 来使用',
  'sumiContributes.toolbar.actions.id': '唯一标识符',
  'sumiContributes.toolbar.actions.weight': '顺序权重, 数值越大，排在越前面',
  'sumiContributes.toolbar.actions.preferredPosition': `注册这个 action 的位置， 如果 strictPosition 存在，这个选项无效
规则：
注： 每个 location 默认存在 _head  _tail 两个group，代表了第一个和最后一个group
1. 如果提供 group 值, 且 group 不为 _head 和 _tail
    1. 如果 group 已注册, 将其注册在group内，跟随 group 出现
    2. 如果 group 未注册
        1. 如果 location 存在， 它会出现在指定 location 的 _tail
        2. 如果 location 不存在， 它会出现在默认 location 的 _tail
2. 如果提供 group 值, 且 group 为 _head 或 _tail
    1. 如果 location 已注册, 它会出现在指定 location 的 group 位置。
    2. 如果 location 未注册 它会出现在默认 location 的 group 位置。
3. 如果仅仅提供 location 值
    1. 如果 location 已注册, 它会出现在指定 location 的 _tail 位置。
    2. 如果 location 未注册 它会出现在默认 location 的 _tail 位置。
4. 如果什么 position 建议都没有，出现在 默认location 的 _tail
真实的位置不会反复计算，仅仅在Toolbar首次渲染时（onStart）计算，或者渲染后 action 注册时计算。
但是 order 会反复计算。`,
  'sumiContributes.toolbar.actions.preferredPosition.location': `location 是指一个工具条单元的位置，由于框架的集成不同，在不同的 IDE 集成产品中，
可能存在不同的 location 可选值。

一般来说，桌面版本版默认的位置会有
toolbar-left（工具条左侧）
toolbar-right（工具条右侧）
toolbar-center (工具条中央)

在 Web 版本的 IDE 上，会额外存在这两个
menu-left (顶部菜单右侧靠左）
menu-right (顶部菜单左侧靠右)

其他位置可能需要具体的集成产品提供

每个集成产品都会有一个默认的 location，如果找不到 preferredPosition 指定的位置
则会放到默认的 locaiton`,
  'sumiContributes.toolbar.actions.preferredPosition.group': `多个按钮可以成组，组与组之间会存在分割线表示分割
目前插件只能注册到集成 IDE 按钮已经存在的组中，而不能自定义组，这个特性可能未来添加
每个 location 都默认存在 _head 和 _tail 两个内置组，分别用来表示这个位置的最左侧和最右侧
没有指定 group 的按钮都会默认放到 _tail 中`,
  'sumiContributes.toolbar.actions.strictPosition': `如果存在这个值，会永远寻找指定的位置。
如果这位置无法被找到（比如 location 不存在，或者group不存在），则这个按钮不会被显示`,
  'sumiContributes.toolbar.actions.description': '当前 action 的介绍，为了让用户能明白这个组件是做什么的，理论上必填',
  'sumiContributes.toolbar.actions.command': '要执行的命令',
  'sumiContributes.toolbar.actions.defaultState': '默认样式状态的 key',
  'sumiContributes.toolbar.actions.type': 'action 的类型',
  'sumiContributes.toolbar.actions.type.button': '按钮类型',
  'sumiContributes.toolbar.actions.type.select': '下拉框类型',
  'sumiContributes.toolbar.actions.title': '按钮文案',
  'sumiContributes.toolbar.actions.iconPath': '按钮图标路径，相对于插件根目录',
  'sumiContributes.toolbar.actions.iconMaskMode': '图标渲染模式',
  'sumiContributes.toolbar.actions.button.states':
    '按钮状态，除了可以修改不同文案、图标路径和渲染模式外，还可以修改样式，类似声明一组 ClassName，可通过 API 改变按钮的状态',
  'sumiContributes.toolbar.actions.button.states.width': '指定按钮宽度，不指定则默认为 8px',
  'sumiContributes.toolbar.actions.button.states.height': '指定按钮高度，不指定则默认为 22px',
  'sumiContributes.toolbar.actions.button.states.showTitle': '是否显示 title, 默认为 true',
  'sumiContributes.toolbar.actions.button.states.iconForeground': '图标前景色',
  'sumiContributes.toolbar.actions.button.states.iconBackground': '图标背景色',
  'sumiContributes.toolbar.actions.button.states.titleForeground': 'title 前景色',
  'sumiContributes.toolbar.actions.button.states.titleBackground': 'title 背景色',
  'sumiContributes.toolbar.actions.button.states.titleSize': 'title 字体大小',
  'sumiContributes.toolbar.actions.button.states.iconSize': '图标大小',
  'sumiContributes.toolbar.actions.button.states.background': '整体背景色',
  'sumiContributes.toolbar.actions.button.states.btnStyle': `样式类型，
inline 则不会有外边框
button 则为按钮样式
不指定则默认为 button
inline 模式 showTitle 会失效, 只显示 icon`,
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle': 'button 的文本位置样式',
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle.vertical': '上 icon 下文本',
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle.horizontal': '左 icon 右文本',
  'sumiContributes.toolbar.actions.popoverComponent': '指定自定义的 Popover 组件 id',
  'sumiContributes.toolbar.actions.popoverStyle': '指定 Popover 的样式',
  'sumiContributes.toolbar.actions.popoverStyle.position': '指定位置，默认为 bottom',
  'sumiContributes.toolbar.actions.popoverStyle.position.top': '在 action 的上方',
  'sumiContributes.toolbar.actions.popoverStyle.position.bottom': '在 action 的下方',
  'sumiContributes.toolbar.actions.popoverStyle.horizontalOffset': '距离右边的偏移量(px), 默认 30px',
  'sumiContributes.toolbar.actions.popoverStyle.hideOnClickOutside': '点击组件外部时自动隐藏, 默认 true',
  'sumiContributes.toolbar.actions.popoverStyle.noContainerStyle': '不要带箭头，阴影，背景色等默认样式',
  'sumiContributes.toolbar.actions.popoverStyle.minWidth': '指定 popOver 的最小宽度',
  'sumiContributes.toolbar.actions.popoverStyle.minHeight': '指定 popOver 的最小高度',
  'sumiContributes.toolbar.actions.when': '当满足条件时',
  'sumiContributes.toolbar.actions.select.options': '定义 select 下拉列表项',
  'sumiContributes.toolbar.actions.select.options.iconPath': '按钮图标路径，相对于插件根目录',
  'sumiContributes.toolbar.actions.select.options.iconMaskMode': '图标渲染模式',
  'sumiContributes.toolbar.actions.select.options.label': '显示的文案',
  'sumiContributes.toolbar.actions.select.options.value': '选中的值',
  'sumiContributes.toolbar.actions.select.defaultValue': '默认值',
  'sumiContributes.toolbar.actions.select.optionEqualityKey': '用于对比值是否相等的 key',
  'sumiContributes.toolbar.actions.select.states': '样式状态',
  'sumiContributes.toolbar.actions.select.states.backgroundColor': '背景色',
  'sumiContributes.toolbar.actions.select.states.labelForegroundColor': '文案前景色',
  'sumiContributes.toolbar.actions.select.states.iconForegroundColor': '图标前景色',
  'sumiContributes.toolbar.actions.select.states.width': '宽度',
  'sumiContributes.toolbar.actions.select.states.minWidth': '最小宽度',

  // menubars
  'sumiContributes.menubars': '注册菜单栏',
  'sumiContributes.menubars.id': '作为 menubar item 的 menu id, 后续可通过 menus 往这里贡献菜单项',
  'sumiContributes.menubars.title': '展示的文案',
  'sumiContributes.menubars.order': '排序权重，越小越靠前',
  'sumiContributes.menubars.nativeRole': 'electron native 菜单使用（web 端可不填）',

  // menu
  'sumiContributes.menu': '提供菜单项',
  'sumiContributes.menu.api.CommandPalette': '命令面板菜单',
  'sumiContributes.menu.api.ActivityBarExtra': '左侧活动栏底部的菜单',
  'sumiContributes.menu.api.DebugBreakpointsContext': '调试断点的右键菜单',
  'sumiContributes.menu.api.DebugCallStackContext': '调试调用堆栈的右键菜单',
  'sumiContributes.menu.api.DebugConsoleContext': '底部调试控制台日志面板的右键菜单',
  'sumiContributes.menu.api.DebugVariablesContext': '调试变量面板的右键菜单',
  'sumiContributes.menu.api.DebugWatchContext': '调试监视面板的右键菜单',
  'sumiContributes.menu.api.DebugToolBar': '调试工具栏的菜单',
  'sumiContributes.menu.api.EditorContext': '编辑器内的右键菜单',
  'sumiContributes.menu.api.EditorTitle': '编辑器右上角的标题菜单',
  'sumiContributes.menu.api.EditorTitleContext': '编辑器上方的选项卡右键菜单',
  'sumiContributes.menu.api.ExplorerContext': '资源管理器的右键菜单',
  'sumiContributes.menu.api.MenubarAppMenu': '顶层主菜单的子菜单（仅限本地 Electron 端）',
  'sumiContributes.menu.api.MenubarEditMenu': '顶层 "编辑" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarFileMenu': '顶层 "文件" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarGoMenu': '顶层 "前往" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarHelpMenu': '顶层 "帮助" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarViewMenu': '顶层 "视图" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarSelectionMenu': '顶层 "选择" 菜单中的子菜单',
  'sumiContributes.menu.api.MenubarTerminalMenu': '顶层 "终端" 菜单中的子菜单',
  'sumiContributes.menu.api.TerminalInstanceContext': '终端面板的右键菜单',
  'sumiContributes.menu.api.TerminalNewDropdownContext': '终端选项卡右边的下拉框子菜单',
  'sumiContributes.menu.api.TerminalTabContext': '终端选项卡的右键菜单',
  'sumiContributes.menu.api.OpenEditorsContext': '资源管理器里 "打开的编辑器" 的右键菜单',
  'sumiContributes.menu.api.SCMResourceContext': 'SCM 源代码管理状态的右键菜单',
  'sumiContributes.menu.api.SCMResourceGroupContext': 'SCM 源代码管理资源组的右键菜单',
  'sumiContributes.menu.api.SCMResourceFolderContext': 'SCM 源代码管理资源文件夹的右键菜单',
  'sumiContributes.menu.api.SCMTitle': 'SCM 源代码管理的顶部菜单项',
  'sumiContributes.menu.api.SCMInput': 'SCM 源代码管理的输入框右侧菜单',
  'sumiContributes.menu.api.SearchContext': '跨文件搜索结果的右键菜单',
  'sumiContributes.menu.api.StatusBarContext': '最底部状态栏的右键菜单',
  'sumiContributes.menu.api.ViewItemContext': '提供的自定义视图的右键菜单',
  'sumiContributes.menu.api.ViewTitle': '提供的自定义视图的顶部菜单项',
  'sumiContributes.menu.api.SettingsIconMenu': '左下角 “偏好设置" 的右键菜单',

  // submenu
  'sumiContributes.submenus': '提供子菜单项（属性的 key 是已经在 "contributes.menubars" 注册好的 menubar id）',
  'sumiContributes.submenus.id': '是已经在 "contributes.menus" 注册好的 menu id',
  'sumiContributes.submenus.title': '子菜单项的名称',
  'sumiContributes.submenus.icon':
    '(可选) 用于表示 UI 中的子菜单的图标。文件路径、具有深色和浅色主题的文件路径的对象，或者主题图标引用(如 "$(zap)")',
  'sumiContributes.submenus.icon.light': '使用浅色主题时的图标路径',
  'sumiContributes.submenus.icon.dark': '使用深色主题时的图标路径',
};
