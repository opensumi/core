/**
 * 定义了 zIndex 的层级
 */
export const StackingLevel = Object.freeze({
  /**
   * 基础层级
   */
  Background: 0,

  /**
   * IDE 的主要内容区域，基础控件
   */
  Workbench: 1,

  /**
   * 顶部的工具栏
   */
  Toolbar: 2,

  /**
   * xterm.css 中 decoration 的 z-index 是 7，所以这里要比它大一点
   */
  XtermDecoration: 8,

  /**
   * 顶部工具栏的下拉菜单
   */
  ToolbarDropdown: 10,

  EditorTabbarCurrent: 11,

  ResizeHandle: 12,

  EditorTabbarOverlay: 15,

  EditorFloatingContainer: 20,

  /**
   * Find 控件的 zIndex 是 25
   */
  FindWidget: 25,

  // #region 中级弹窗区域
  Popup: 100,
  // #endregion

  // #region 顶级弹窗区域
  Overlay: 800,
  PopoverComponent: 999,
  PopoverComponentArrow: 1000,
  OverlayTop: 1000,
  // #endregion
} as const);

export const StackingLevelStr = Object.fromEntries(
  Object.entries(StackingLevel).map(([key, value]) => [key, value.toString()]),
) as Record<keyof typeof StackingLevel, string>;
