export const browserViews = {
  // 公用 properties，如 command
  "kaitianContributes.common.command": "",
  "kaitianContributes.common.when": "",
  "kaitianContributes.common.group": "",

  // browserViews
  "kaitianContributes.browserViews": "Provide a custom view to the editor",
  "kaitianContributes.browserViews.left": "Provide a view in the left activity bar container",
  "kaitianContributes.browserViews.right": "Provide a view in the right activity bar container",
  "kaitianContributes.browserViews.bottom": "Provides a view in the bottom tab bar container (no icon will be rendered, so a title is required)",
  "kaitianContributes.browserViews.location.custom": "Provide a view to the \"{0}\" container",
  "kaitianContributes.browserViews.view.id": "View id, browser/index needs to export a component with the same name as this id",
  "kaitianContributes.browserViews.view.icon": "Icon name, reference: [icon](https://docs.antfin-inc.com/iconfont-demo/)",
  "kaitianContributes.browserViews.view.iconPath": "local icon relative path",
  "kaitianContributes.browserViews.view.title": "View title (will be displayed when type is bottom)",
  "kaitianContributes.browserViews.view.titleComponentId": "The id of the custom view title component, the characteristics are exactly the same as the normal browserView",
  "kaitianContributes.browserViews.view.expanded": "Do you need to expand to full screen, which will cover up the editor area",

  // browserMain
  "kaitianContributes.browserMain": "Declare the extension browser entry (the path to the compiled code file relative to the extension directory)",

  // nodeMain
  "kaitianContributes.nodeMain": "Declare the extension node entry (the path to the compiled code file relative to the extension directory)",

  // workerMain
  "kaitianContributes.workerMain": "Declare the extension workser entry (the path to the compiled code file relative to the extension directory)",

  // viewsProxies
  "kaitianContributes.viewsProxies": "Declare the component id that needs to be bound to the componentProxy call, which is the same as the export name. For example, after declaring [\"component\"], the xxxx function of the component component of the browser layer can be called at the node layer through **`context.componentProxy.component.xxxx`**",

  // toolbar
  "kaitianContributes.toolbar": "",
  "kaitianContributes.toolbar.actions": "",
  "kaitianContributes.toolbar.actions.id": "",
  "kaitianContributes.toolbar.actions.weight": "",
  "kaitianContributes.toolbar.actions.preferredPosition": "",
  "kaitianContributes.toolbar.actions.preferredPosition.location": "",
  "kaitianContributes.toolbar.actions.preferredPosition.group": "",
  "kaitianContributes.toolbar.actions.strictPosition": "",
  "kaitianContributes.toolbar.actions.description": "",
  "kaitianContributes.toolbar.actions.command": "",
  "kaitianContributes.toolbar.actions.defaultState": "",
  "kaitianContributes.toolbar.actions.type": "",
  "kaitianContributes.toolbar.actions.type.button": "",
  "kaitianContributes.toolbar.actions.type.select": "",
  "kaitianContributes.toolbar.actions.title": "",
  "kaitianContributes.toolbar.actions.iconPath": "",
  "kaitianContributes.toolbar.actions.iconMaskMode": "",
  "kaitianContributes.toolbar.actions.button.states": "",
  "kaitianContributes.toolbar.actions.button.states.width": "",
  "kaitianContributes.toolbar.actions.button.states.height": "",
  "kaitianContributes.toolbar.actions.button.states.showTitle": "",
  "kaitianContributes.toolbar.actions.button.states.iconForeground": "",
  "kaitianContributes.toolbar.actions.button.states.iconBackground": "",
  "kaitianContributes.toolbar.actions.button.states.titleForeground": "",
  "kaitianContributes.toolbar.actions.button.states.titleBackground": "",
  "kaitianContributes.toolbar.actions.button.states.titleSize": "",
  "kaitianContributes.toolbar.actions.button.states.iconSize": "",
  "kaitianContributes.toolbar.actions.button.states.background": "",
  "kaitianContributes.toolbar.actions.button.states.btnStyle": "",
  "kaitianContributes.toolbar.actions.button.states.btnTitleStyle": "",
  "kaitianContributes.toolbar.actions.button.states.btnTitleStyle.vertical": "",
  "kaitianContributes.toolbar.actions.button.states.btnTitleStyle.horizontal": "",
  "kaitianContributes.toolbar.actions.popoverComponent": "",
  "kaitianContributes.toolbar.actions.popoverStyle": "",
  "kaitianContributes.toolbar.actions.popoverStyle.position": "",
  "kaitianContributes.toolbar.actions.popoverStyle.position.top": "",
  "kaitianContributes.toolbar.actions.popoverStyle.position.bottom": "",
  "kaitianContributes.toolbar.actions.popoverStyle.horizontalOffset": "",
  "kaitianContributes.toolbar.actions.popoverStyle.hideOnClickOutside": "",
  "kaitianContributes.toolbar.actions.popoverStyle.noContainerStyle": "",
  "kaitianContributes.toolbar.actions.popoverStyle.minWidth": "",
  "kaitianContributes.toolbar.actions.popoverStyle.minHeight": "",
  "kaitianContributes.toolbar.actions.when": "",
  "kaitianContributes.toolbar.actions.select.options": "",
  "kaitianContributes.toolbar.actions.select.options.iconPath": "",
  "kaitianContributes.toolbar.actions.select.options.iconMaskMode": "",
  "kaitianContributes.toolbar.actions.select.options.label": "",
  "kaitianContributes.toolbar.actions.select.options.value": "",
  "kaitianContributes.toolbar.actions.select.defaultValue": "",
  "kaitianContributes.toolbar.actions.select.optionEqualityKey": "",
  "kaitianContributes.toolbar.actions.select.states": "",
  "kaitianContributes.toolbar.actions.select.states.backgroundColor": "",
  "kaitianContributes.toolbar.actions.select.states.labelForegroundColor": "",
  "kaitianContributes.toolbar.actions.select.states.iconForegroundColor": "",
  "kaitianContributes.toolbar.actions.select.states.width": "",
  "kaitianContributes.toolbar.actions.select.states.minWidth": "",

  // menubars
  "kaitianContributes.menubars": "",
  "kaitianContributes.menubars.id": "",
  "kaitianContributes.menubars.title": "",
  "kaitianContributes.menubars.order": "",
  "kaitianContributes.menubars.nativeRole": "",

  // menu
  "kaitianContributes.menu": "",
  "kaitianContributes.menu.api.CommandPalette": "",
  "kaitianContributes.menu.api.ActivityBarExtra": "",
  "kaitianContributes.menu.api.DebugBreakpointsContext": "",
  "kaitianContributes.menu.api.DebugCallStackContext": "",
  "kaitianContributes.menu.api.DebugConsoleContext": "",
  "kaitianContributes.menu.api.DebugVariablesContext": "",
  "kaitianContributes.menu.api.DebugWatchContext": "",
  "kaitianContributes.menu.api.DebugToolBar": "",
  "kaitianContributes.menu.api.EditorContext": "",
  "kaitianContributes.menu.api.EditorTitle": "",
  "kaitianContributes.menu.api.EditorTitleContext": "",
  "kaitianContributes.menu.api.ExplorerContext": "",
  "kaitianContributes.menu.api.MenubarAppMenu": "",
  "kaitianContributes.menu.api.MenubarEditMenu": "",
  "kaitianContributes.menu.api.MenubarFileMenu": "",
  "kaitianContributes.menu.api.MenubarGoMenu": "",
  "kaitianContributes.menu.api.MenubarHelpMenu": "",
  "kaitianContributes.menu.api.MenubarViewMenu": "",
  "kaitianContributes.menu.api.MenubarSelectionMenu": "",
  "kaitianContributes.menu.api.MenubarTerminalMenu": "",
  "kaitianContributes.menu.api.TerminalInstanceContext": "",
  "kaitianContributes.menu.api.TerminalNewDropdownContext": "",
  "kaitianContributes.menu.api.TerminalTabContext": "",
  "kaitianContributes.menu.api.OpenEditorsContext": "",
  "kaitianContributes.menu.api.SCMResourceContext": "",
  "kaitianContributes.menu.api.SCMResourceGroupContext": "",
  "kaitianContributes.menu.api.SCMResourceFolderContext": "",
  "kaitianContributes.menu.api.SCMTitle": "",
  "kaitianContributes.menu.api.SCMInput": "",
  "kaitianContributes.menu.api.SearchContext": "",
  "kaitianContributes.menu.api.StatusBarContext": "",
  "kaitianContributes.menu.api.ViewItemContext": "",
  "kaitianContributes.menu.api.ViewTitle": "",
  "kaitianContributes.menu.api.SettingsIconMenu": "",

  // submenu
  "kaitianContributes.submenus": "",
  "kaitianContributes.submenus.id": "",
  "kaitianContributes.submenus.title": "",
  "kaitianContributes.submenus.icon": "",
  "kaitianContributes.submenus.icon.light": "",
  "kaitianContributes.submenus.icon.dark": "",
}
