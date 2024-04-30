/**
 * 定义了 zIndex 的层级
 */
export const StackingLevel = {
  /**
   * 基础层级
   */
  Base: 0,
  Background: 0,

  Workbench: 1,
  WorkbenchEditor: 1,

  Toolbar: 2,
  ToolbarDropdown: 10,

  /**
   * 一级弹窗
   */
  Popup: 100,

  PopoverContainer: 1070,
  PopoverComponent: 10000,
  PopoverComponentArrow: 10001,
  Overlay: 800,
  OverlayTop: 1000,
} as const;

export const StackingLevelStr = Object.fromEntries(
  Object.entries(StackingLevel).map(([key, value]) => [key, value.toString()]),
) as Record<keyof typeof StackingLevel, string>;
