// menu id 枚举值列表
export enum MenuId {
  AccountsContext = 'accounts/context',
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
  TerminalInstanceContext = 'terminal/instance/context',
  OpenEditorsContext = 'open/editors/context',
  ProblemsPanelContext = 'problems/panel/context',
  SCMChangeTitle = 'scm/change/title',
  SCMResourceContext = 'scm/resourceState/context',
  SCMResourceGroupContext = 'scm/resourceGroup/context',
  SCMResourceFolderContext = 'scm/resourceFolder/context',
  SCMSourceControl = 'scm/sourceControl',
  SCMTitle = 'scm/title',
  SCMInput = 'scm/input',
  SearchContext = 'search/context',
  StatusBarContext = 'statusbar/context',
  StatusBarWindowIndicatorMenu = 'statusbar/windowIndicator',
  TouchBarContext = 'touchBar/context' /* 并未实现 */,
  ViewItemContext = 'view/item/context',
  ViewTitle = 'view/title',
  GlobalActivity = 'global/activity',
  ExtensionContext = 'extension/context', // 插件市场 item
  SettingsIconMenu = 'settings/icon/menu', // 右下角 setting menu
  // The contributed comment thread context menu, rendered as buttons below the comment editor
  CommentsCommentThreadContext = 'comments/commentThread/context',
  // The contributed comment thread title menu
  CommentsCommentThreadTitle = 'comments/commentThread/title',
  // The contributed comment title menu
  CommentsCommentTitle = 'comments/comment/title',
  // The contributed comment context menu, rendered as buttons below the comment editor
  CommentsCommentContext = 'comments/comment/context',
  // ToolbarLocation
  KTToolbarLocationContext = 'kt/toolbar/context',
  // 插件市场未搜索到结果
  MarketplaceNoResultsContext = 'marketplace/noResults/context',
  // Testing glyph margin
  TestingGlyphMarginContext = 'testing/glyphMargin/context',
}

export function getTabbarCommonMenuId(location: string) {
  return `tabbar/${location}/common`;
}
