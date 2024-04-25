import { registerCSSVar } from '.';

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
  Popover: 100,
  OverlayTop: 1000,
} as const;

export const StackingLevelStr = Object.fromEntries(
  Object.entries(StackingLevel).map(([key, value]) => [key, value.toString()]),
) as Record<keyof typeof StackingLevel, string>;

Object.entries(StackingLevel).forEach(([key, value]) => {
  registerCSSVar(`stacking-level-${key.toLowerCase()}`, value.toString());
});
