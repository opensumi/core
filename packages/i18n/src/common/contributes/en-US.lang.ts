export const browserViews = {
  // 公用 properties，如 command
  'sumiContributes.common.command': 'The command to execute. The command must be declared in "contributes.command" (except built-in commands)',
  'sumiContributes.common.when': 'This condition must be true to display this item',
  'sumiContributes.common.group': 'The group this item belongs to',

  // browserViews
  'sumiContributes.browserViews': 'Provide a custom view to the editor',
  'sumiContributes.browserViews.left': 'Provide a view in the left activity bar container',
  'sumiContributes.browserViews.right': 'Provide a view in the right activity bar container',
  'sumiContributes.browserViews.bottom': 'Provides a view in the bottom tab bar container (no icon will be rendered, so a title is required)',
  'sumiContributes.browserViews.location.custom': 'Provide a view to the "{0}" container',
  'sumiContributes.browserViews.view.id': 'View id, browser/index needs to export a component with the same name as this id',
  'sumiContributes.browserViews.view.icon': 'Icon name, reference: [icon](https://opensumi.github.io/core/)',
  'sumiContributes.browserViews.view.iconPath': 'local icon relative path',
  'sumiContributes.browserViews.view.title': 'View title (will be displayed when type is bottom)',
  'sumiContributes.browserViews.view.titleComponentId': 'The id of the custom view title component, the characteristics are exactly the same as the normal browserView',
  'sumiContributes.browserViews.view.expanded': 'Do you need to expand to full screen, which will cover up the editor area',

  // browserMain
  'sumiContributes.browserMain': 'Declare the extension browser entry (the path to the compiled code file relative to the extension directory)',

  // nodeMain
  'sumiContributes.nodeMain': 'Declare the extension node entry (the path to the compiled code file relative to the extension directory)',

  // workerMain
  'sumiContributes.workerMain': 'Declare the extension workser entry (the path to the compiled code file relative to the extension directory)',

  // viewsProxies
  'sumiContributes.viewsProxies': 'Declare the component id that needs to be bound to the componentProxy call, which is the same as the export name. For example, after declaring ["component"], the xxxx function of the component component of the browser layer can be called at the node layer through **`context.componentProxy.component.xxxx`**',

  // toolbar
  'sumiContributes.toolbar': 'Toolbar is located on the right side of the menu bar at the top of the IDE by default, and can also be displayed as a separate column',
  'sumiContributes.toolbar.actions': 'Used to describe the elements on the Toolbar, currently only supports `button` and `select`, we call it action, in some cases it needs to be used with the Toolbar API',
  'sumiContributes.toolbar.actions.id': 'unique identifier',
  'sumiContributes.toolbar.actions.weight': 'Order weight, the larger the value, the higher the ranking',
  'sumiContributes.toolbar.actions.preferredPosition': `Register the position of this action, if strictPosition exists, this option has no effect
rule:
Note: Each location has two groups _head _tail by default, representing the first and last group
1. If a group value is provided, and the group is not _head and _tail
    1. If the group is registered, register it in the group and follow the group
    2. If the group is not registered
        1. If location exists, it will appear in the _tail of the specified location
        2. If the location does not exist, it will appear in the _tail of the default location
2. If a group value is provided, and group is _head or _tail
    1. If the location is registered, it will appear in the group location of the specified location.
    2. If the location is not registered it will appear in the group location of the default location.
3. If only the location value is provided
    1. If the location is registered, it will appear in the _tail position of the specified location.
    2. If the location is not registered it will appear in the _tail location of the default location.
4. If there is no position suggestion, it will appear in the _tail of the default location
The actual position is not calculated repeatedly, only when the Toolbar is first rendered (onStart), or when the action is registered after rendering.
But order is calculated repeatedly. `,
  'sumiContributes.toolbar.actions.preferredPosition.location': `location refers to the location of a toolbar unit. Due to the different integration of the framework, in different IDE integration products,
There may be different optional values ​​for location.

Generally speaking, the default location of the desktop version will have
toolbar-left
toolbar-right
toolbar-center

On the web version of the IDE, these two additional
menu-left (top menu right to left)
menu-right (top menu left to right)

Other locations may require specific integration offerings

Each integrated product will have a default location, if the location specified by preferredPosition cannot be found
will be placed in the default locaiton`,
  'sumiContributes.toolbar.actions.preferredPosition.group': `Multiple buttons can be grouped, and there will be a dividing line between groups to indicate division
At present, plugins can only be registered in the existing group of the integrated IDE button, and cannot customize the group. This feature may be added in the future
Each location has two built-in groups _head and _tail by default, which are used to represent the leftmost and rightmost of the location, respectively.
Buttons without a specified group will be placed in _tail by default`,
  'sumiContributes.toolbar.actions.strictPosition': `If this value exists, always seek the specified position.
If the location cannot be found (eg location does not exist, or group does not exist), the button will not be displayed`,
  'sumiContributes.toolbar.actions.description': 'The introduction of the current action, in order to let users understand what this component does, theoretically required',
  'sumiContributes.toolbar.actions.command': 'command to execute',
  'sumiContributes.toolbar.actions.defaultState': 'The key of the default style state',
  'sumiContributes.toolbar.actions.type': 'type of action',
  'sumiContributes.toolbar.actions.type.button': 'Button type',
  'sumiContributes.toolbar.actions.type.select': 'drop-down box type',
  'sumiContributes.toolbar.actions.title': 'Button copy',
  'sumiContributes.toolbar.actions.iconPath': 'Button icon path, relative to the plugin root directory',
  'sumiContributes.toolbar.actions.iconMaskMode': 'icon rendering mode',
  'sumiContributes.toolbar.actions.button.states': 'Button state, in addition to modifying different texts, icon paths and rendering modes, you can also modify the style, similar to declaring a set of ClassName, you can change the state of the button through the API',
  'sumiContributes.toolbar.actions.button.states.width': 'Specify the width of the button, if not specified, the default is 8px',
  'sumiContributes.toolbar.actions.button.states.height': 'Specify the button height, if not specified, the default is 22px',
  'sumiContributes.toolbar.actions.button.states.showTitle': 'whether to show title, default is true',
  'sumiContributes.toolbar.actions.button.states.iconForeground': 'Icon Foreground',
  'sumiContributes.toolbar.actions.button.states.iconBackground': 'icon background color',
  'sumiContributes.toolbar.actions.button.states.titleForeground': 'title foreground color',
  'sumiContributes.toolbar.actions.button.states.titleBackground': 'title background color',
  'sumiContributes.toolbar.actions.button.states.titleSize': 'title font size',
  'sumiContributes.toolbar.actions.button.states.iconSize': 'Icon size',
  'sumiContributes.toolbar.actions.button.states.background': 'Overall background color',
  'sumiContributes.toolbar.actions.button.states.btnStyle': `style type,
inline will not have an outer border
button is the button style
If not specified, the default is button
Inline mode showTitle will be invalid, only display icon`,
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle': 'button text position style',
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle.vertical': 'Up icon down text',
  'sumiContributes.toolbar.actions.button.states.btnTitleStyle.horizontal': 'left icon right text',
  'sumiContributes.toolbar.actions.popoverComponent': 'Specify custom Popover component id',
  'sumiContributes.toolbar.actions.popoverStyle': 'Specify the style of Popover',
  'sumiContributes.toolbar.actions.popoverStyle.position': 'Specify the position, the default is bottom',
  'sumiContributes.toolbar.actions.popoverStyle.position.top': 'On top of action',
  'sumiContributes.toolbar.actions.popoverStyle.position.bottom': 'below the action',
  'sumiContributes.toolbar.actions.popoverStyle.horizontalOffset': 'Offset from the right (px), default 30px',
  'sumiContributes.toolbar.actions.popoverStyle.hideOnClickOutside': 'Auto hide when clicking outside the component, default true',
  'sumiContributes.toolbar.actions.popoverStyle.noContainerStyle': 'Do not use default styles such as arrows, shadows, background colors, etc.',
  'sumiContributes.toolbar.actions.popoverStyle.minWidth': 'Specify the minimum width of popOver',
  'sumiContributes.toolbar.actions.popoverStyle.minHeight': 'Specify the minimum height of popOver',
  'sumiContributes.toolbar.actions.when': 'When conditions are met',
  'sumiContributes.toolbar.actions.select.options': 'Define select drop-down list items',
  'sumiContributes.toolbar.actions.select.options.iconPath': 'Button icon path, relative to the plugin root directory',
  'sumiContributes.toolbar.actions.select.options.iconMaskMode': 'icon rendering mode',
  'sumiContributes.toolbar.actions.select.options.label': 'Displayed text',
  'sumiContributes.toolbar.actions.select.options.value': 'Selected value',
  'sumiContributes.toolbar.actions.select.defaultValue': 'default value',
  'sumiContributes.toolbar.actions.select.optionEqualityKey': 'The key used to compare whether the values ​​are equal',
  'sumiContributes.toolbar.actions.select.states': 'Style states',
  'sumiContributes.toolbar.actions.select.states.backgroundColor': 'background color',
  'sumiContributes.toolbar.actions.select.states.labelForegroundColor': 'Copy foreground color',
  'sumiContributes.toolbar.actions.select.states.iconForegroundColor': 'icon foreground color',
  'sumiContributes.toolbar.actions.select.states.width': 'width',
  'sumiContributes.toolbar.actions.select.states.minWidth': 'minimum width',

  // menubars
  'sumiContributes.menubars': 'Registration menu bar',
  'sumiContributes.menubars.id': 'As the menu id of the menubar item, you can contribute menu items here later through menus',
  'sumiContributes.menubars.title': 'Displayed copy',
  'sumiContributes.menubars.order': 'Order weight, the smaller the higher the order',
  'sumiContributes.menubars.nativeRole': 'electron native menu usage (can be left blank on the web)',

  // menu
  'sumiContributes.menu': 'Provide menu items',
  'sumiContributes.menu.api.CommandPalette': 'Command Palette Menu',
  'sumiContributes.menu.api.ActivityBarExtra': 'The menu at the bottom of the left activity bar',
  'sumiContributes.menu.api.DebugBreakpointsContext': 'The right-click menu for debugging breakpoints',
  'sumiContributes.menu.api.DebugCallStackContext': 'The right-click menu of the debug call stack',
  'sumiContributes.menu.api.DebugConsoleContext': 'The right-click menu of the debug console log panel at the bottom',
  'sumiContributes.menu.api.DebugVariablesContext': 'The right-click menu of the debug variable panel',
  'sumiContributes.menu.api.DebugWatchContext': 'The right-click menu of the debug watch panel',
  'sumiContributes.menu.api.DebugToolBar': 'The menu of the debugging toolbar',
  'sumiContributes.menu.api.EditorContext': 'The right-click menu in the editor',
  'sumiContributes.menu.api.EditorTitle': 'Title menu in the upper right corner of the editor',
  'sumiContributes.menu.api.EditorTitleContext': 'The right-click menu of the tab above the editor',
  'sumiContributes.menu.api.ExplorerContext': 'Explorer context menu',
  'sumiContributes.menu.api.MenubarAppMenu': 'Submenu of the top-level main menu (local Electron side only)',
  'sumiContributes.menu.api.MenubarEditMenu': 'Submenu in top-level Edit menu',
  'sumiContributes.menu.api.MenubarFileMenu': 'Submenu in top-level \'File\' menu',
  'sumiContributes.menu.api.MenubarGoMenu': 'Submenu in top-level "Go" menu',
  'sumiContributes.menu.api.MenubarHelpMenu': 'Submenu in top-level Help menu',
  'sumiContributes.menu.api.MenubarViewMenu': 'Submenu in top-level \'View\' menu',
  'sumiContributes.menu.api.MenubarSelectionMenu': 'Submenu in top-level \'Selection\' menu',
  'sumiContributes.menu.api.MenubarTerminalMenu': 'Submenu in the top-level \'Terminal\' menu',
  'sumiContributes.menu.api.TerminalInstanceContext': 'The right-click menu of the terminal panel',
  'sumiContributes.menu.api.TerminalNewDropdownContext': 'The drop-down box submenu on the right side of the terminal tab',
  'sumiContributes.menu.api.TerminalTabContext': 'Right-click menu for terminal tabs',
  'sumiContributes.menu.api.OpenEditorsContext': 'The right-click menu of the "open editor" in the resource manager',
  'sumiContributes.menu.api.SCMResourceContext': 'Right-click menu for SCM source control status',
  'sumiContributes.menu.api.SCMResourceGroupContext': 'SCM source control resource group context menu',
  'sumiContributes.menu.api.SCMResourceFolderContext': 'Right-click menu for SCM source control resource folder',
  'sumiContributes.menu.api.SCMTitle': 'Top menu item for SCM source control',
  'sumiContributes.menu.api.SCMInput': 'SCM source control input box right menu',
  'sumiContributes.menu.api.SearchContext': 'Right-click menu for cross-file search results',
  'sumiContributes.menu.api.StatusBarContext': 'Right-click menu of the status bar at the bottom',
  'sumiContributes.menu.api.ViewItemContext': 'The right-click menu of the provided custom view',
  'sumiContributes.menu.api.ViewTitle': 'Top menu item for custom view provided',
  'sumiContributes.menu.api.SettingsIconMenu': 'Lower left corner \'Preferences\' context menu',

  // submenu
  'sumiContributes.submenus': 'Provide submenu items (the key of the attribute is the menubar id registered in "contributes.menubars")',
  'sumiContributes.submenus.id': 'It is the menu id registered in "contributes.menus"',
  'sumiContributes.submenus.title': 'Name of submenu item',
  'sumiContributes.submenus.icon': '(optional) The icon used to represent the submenus in the UI. file path, an object of file paths with dark and light themes, or a theme icon reference (e.g. "$(zap)")',
  'sumiContributes.submenus.icon.light': 'Icon path when using light theme',
  'sumiContributes.submenus.icon.dark': 'Icon path when using dark theme',
};
