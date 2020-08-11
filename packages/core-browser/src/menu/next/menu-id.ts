// menu id 枚举值列表
export enum MenuId {
  ActivityBarContext = 'activityBar/context',
  ActivityBarExtra = 'activityBar/extra',
  CommandPalette = 'commandPalette',
  DebugBreakpointsContext = 'debug/breakpoints/context',
  DebugCallStackContext = 'debug/callstack/context',
  DebugConsoleContext = 'debug/console/context',
  DebugVariablesContext = 'debug/variables/context',
  DebugWatchContext = 'debug/watch/context',
  DebugToolBar = 'debug/toolbar',
  EditorContext = 'editor/context',
  EditorTitle = 'editor/title',
  EditorTitleContext = 'editor/title/context',
  EmptyEditorGroupContext = 'empty/editor/group/context',
  ExplorerContext = 'explorer/context',
  MenubarAppearanceMenu = 'menubar/appearance',
  MenubarAppMenu = 'menubar/app',
  MenubarDebugMenu = 'menubar/debug',
  MenubarEditMenu = 'menubar/edit',
  MenubarFileMenu = 'menubar/file/menu',
  MenubarGoMenu = 'menubar/go',
  MenubarHelpMenu = 'menubar/help',
  MenubarLayoutMenu = 'menubar/layout',
  MenubarNewBreakpointMenu = 'menubar/new/breakpoint',
  MenubarPreferencesMenu = 'menubar/preferences',
  MenubarRecentMenu = 'menubar/recent',
  MenubarSelectionMenu = 'menubar/selection',
  MenubarSwitchEditorMenu = 'menubar/switch/editor',
  MenubarSwitchGroupMenu = 'menubar/switch/group',
  MenubarTerminalMenu = 'menubar/terminal',
  MenubarViewMenu = 'menubar/view',
  OpenEditorsContext = 'open/editors/context',
  ProblemsPanelContext = 'problems/panel/context',
  SCMChangeTitle = 'scm/change/title',
  SCMResourceContext = 'scm/resourceState/context',
  SCMResourceGroupContext = 'scm/resourceGroup/context',
  SCMSourceControl = 'scm/sourceControl',
  SCMTitle = 'scm/title',
  SCMInput = 'scm/input',
  SearchContext = 'search/context',
  StatusBarWindowIndicatorMenu = 'statusbar/windowIndicator',
  TouchBarContext = 'touchBar/context', /* 并未实现 */
  ViewItemContext = 'view/item/context',
  ViewTitle = 'view/title',
  GlobalActivity = 'global/activity',
  ExtensionContext = 'extension/context', // 插件市场 item
  SettingsIconMenu = 'settings/icon/menu', // 右下角 setting menu
  // Below the comment panel text box
  CommentsCommentThreadContext = 'comments/commentThread/context',
  // In the comment panel head
  CommentsCommentThreadTitle = 'comments/commentThread/title',
  // In the comment panel comment reply
  CommentsCommentTitle = 'comments/comment/title',
  // Below the comment panel reply text box
  CommentsCommentContext = 'comments/comment/context',
  // ToolbarLocation
  KTToolbarLocationContext = 'kt/toolbar/context',
  // 插件市场未搜索到结果
  MarketplaceNoResultsContext = 'marketplace/noResults/context',
}

export function getTabbarCommonMenuId(location: string) {
  return `tabbar/${location}/common`;
}
