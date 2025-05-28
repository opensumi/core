import { Command, getIcon } from '@opensumi/ide-core-browser';
import { MenuCommandDesc } from '@opensumi/ide-core-browser/lib/menu/next';

/** @deprecated 请使用 main-layout.view.toggle */
export const TOGGLE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.toggle',
  delegate: 'main-layout.view.toggle',
};

/** @deprecated 请使用 main-layout.extendView.toggle */
export const TOGGLE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.toggle',
  delegate: 'main-layout.extend-view.toggle',
};

/** @deprecated 请使用 main-layout.panel.toggle */
export const TOGGLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.toggle',
  delegate: 'main-layout.panel.toggle',
};

/** @deprecated 请使用 main-layout.panel.is-visible */
export const IS_VISIBLE_BOTTOM_PANEL_COMMAND: Command = {
  id: 'main-layout.bottom-panel.is-visible',
  delegate: 'main-layout.panel.is-visible',
};

/** @deprecated 请使用 main-layout.view.is-visible */
export const IS_VISIBLE_LEFT_PANEL_COMMAND: Command = {
  id: 'main-layout.left-panel.is-visible',
  delegate: 'main-layout.view.is-visible',
};

/** @deprecated 请使用 main-layout.extend-view.is-visible */
export const IS_VISIBLE_RIGHT_PANEL_COMMAND: Command = {
  id: 'main-layout.right-panel.is-visible',
  delegate: 'main-layout.extend-view.is-visible',
};

/** @deprecated 请使用 main-layout.panel.expand */
export const EXPAND_BOTTOM_PANEL: Command = {
  id: 'main-layout.bottom-panel.expand',
  delegate: 'main-layout.panel.expand',
};

/** @deprecated 请使用 main-layout.panel.retract */
export const RETRACT_BOTTOM_PANEL: Command = {
  id: 'main-layout.bottom-panel.retract',
  delegate: 'main-layout.panel.retract',
};

export const WORKBENCH_ACTION_CLOSESIDECAR: Command = {
  id: 'workbench.action.closeSidebar',
  label: '%main-layout.sidebar.hide%',
};

export const WORKBENCH_ACTION_CLOSEPANEL: Command = {
  id: 'workbench.action.closePanel',
};

export const TOGGLE_VIEW_COMMAND: MenuCommandDesc = {
  id: 'main-layout.view.toggle',
  label: '%main-layout.view.toggle%',
};

export const TOGGLE_EXTEND_VIEW_COMMAND: MenuCommandDesc = {
  id: 'main-layout.extend-view.toggle',
  label: '%main-layout.extend-view.toggle%',
};

export const TOGGLE_PANEL_COMMAND: Command = {
  id: 'main-layout.panel.toggle',
  iconClass: getIcon('minus'),
  label: '%main-layout.panel.toggle%',
};

export const IS_VISIBLE_VIEW_COMMAND: Command = {
  id: 'main-layout.view.is-visible',
};

export const IS_VISIBLE_EXTEND_VIEW_COMMAND: Command = {
  id: 'main-layout.extend-view.is-visible',
};

export const IS_VISIBLE_PANEL_COMMAND: Command = {
  id: 'main-layout.panel.is-visible',
};

export const EXPAND_PANEL_COMMAND: Command = {
  id: 'main-layout.panel.expand',
  label: '%layout.tabbar.expand%',
  iconClass: getIcon('expand'),
};

export const RETRACT_PANEL_COMMAND: Command = {
  id: 'main-layout.panel.retract',
  label: '%layout.tabbar.retract%',
  iconClass: getIcon('shrink'),
};
