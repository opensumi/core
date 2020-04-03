// menu id 枚举值列表
export enum MenuId {
  ActivityBarContext = 'activity/bar/context',
  ActivityBarExtra = 'activity/bar/extra',
  CommandPalette = 'command/palette',
  DebugBreakpointsContext = 'debug/breakpoints/context',
  DebugCallStackContext = 'debug/call/stack/context',
  DebugConsoleContext = 'debug/console/context',
  DebugVariablesContext = 'debug/variables/context',
  DebugWatchContext = 'debug/watch/context',
  DebugToolBar = 'debug/tool/bar',
  EditorContext = 'editor/context',
  EditorTitle = 'editor/title',
  EditorTitleContext = 'editor/title/context',
  EmptyEditorGroupContext = 'empty/editor/group/context',
  ExplorerContext = 'explorer/context',
  MenubarAppearanceMenu = 'menubar/appearance/menu',
  MenubarAppMenu = 'menubar/app',
  MenubarDebugMenu = 'menubar/debug/menu',
  MenubarEditMenu = 'menubar/edit/menu',
  MenubarFileMenu = 'menubar/file/menu',
  MenubarGoMenu = 'menubar/go/menu',
  MenubarHelpMenu = 'menubar/help/menu',
  MenubarLayoutMenu = 'menubar/layout/menu',
  MenubarNewBreakpointMenu = 'menubar/new/breakpoint/menu',
  MenubarPreferencesMenu = 'menubar/preferences/menu',
  MenubarRecentMenu = 'menubar/recent/menu',
  MenubarSelectionMenu = 'menubar/selection/menu',
  MenubarSwitchEditorMenu = 'menubar/switch/editor/menu',
  MenubarSwitchGroupMenu = 'menubar/switch/group/menu',
  MenubarTerminalMenu = 'menubar/terminal/menu',
  MenubarViewMenu = 'menubar/view/menu',
  OpenEditorsContext = 'open/editors/context',
  ProblemsPanelContext = 'problems/panel/context',
  SCMChangeContext = 'scm/change/context',
  SCMResourceContext = 'scm/resource/context',
  SCMResourceGroupContext = 'scm/resource/group/context',
  SCMSourceControl = 'scm/source/control',
  SCMTitle = 'scm/title',
  SearchContext = 'search/context',
  StatusBarWindowIndicatorMenu = 'status/bar/window/indicator/menu',
  TouchBarContext = 'touch/bar/context',
  ViewItemContext = 'view/item/context',
  ViewTitle = 'view/title',
  GlobalActivity = 'global/activity',
  ExtensionContext = 'extension/context', // 插件市场 item
  SettingsIconMenu = 'settings/icon/menu', // 右下角 setting menu
  // Below the comment panel text box
  CommentsCommentThreadContext = 'comments/commentThread/context',
  // In the comment panel head
  CommentsCommentThreadTitle = 'comments/commentThread/title',
  // In the comment panel comment
  CommentsCommentThreadComment = 'comments/commentThread/comment',
  // In the comment panel comment reply
  CommentsCommentTitle = 'comments/comment/title',
  // Below the comment panel reply text box
  CommentsCommentContext = 'comments/comment/context',
}

export function getTabbarCommonMenuId(location: string) {
  return `tabbar/${location}/common`;
}
