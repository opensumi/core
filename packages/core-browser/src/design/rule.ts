/**
 * 定义了 zIndex 的层级
 */
export const StackingLevel = {
  /**
   * 基础层级
   */
  Background: 0,

  Workbench: 1,
  WorkbenchEditor: 1,

  Toolbar: 2,

  XtermDecoration: 8, // xterm.css 中 decoration 的 z-index 是 7，所以这里要比它大一点

  ToolbarDropdown: 10,

  EditorTabbarCurrent: 11,
  EditorTabbarOverlay: 15,

  ResizeHandle: 12,

  EditorFloatingContainer: 20,

  /**
   * 一级弹窗
   */
  Popup: 100,
  Overlay: 800,

  PopoverComponent: 1000,
  PopoverComponentArrow: 1001,
  OverlayTop: 1000,
} as const;

export const StackingLevelStr = Object.fromEntries(
  Object.entries(StackingLevel).map(([key, value]) => [key, value.toString()]),
) as Record<keyof typeof StackingLevel, string>;
