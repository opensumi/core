/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@opensumi/ide-core-browser';

import { DROP_EXTEND_VIEW_CONTAINER, DROP_PANEL_CONTAINER, DROP_VIEW_CONTAINER } from '../common';

export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@opensumi/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: ['@opensumi/ide-toolbar-action'],
  },
  [SlotLocation.view]: {
    modules: [
      DROP_VIEW_CONTAINER,
      '@opensumi/ide-explorer',
      '@opensumi/ide-search',
      '@opensumi/ide-scm',
      '@opensumi/ide-debug',
      '@opensumi/ide-extension-manager',
      '@opensumi/ide-notebook',
    ],
  },
  [SlotLocation.extendView]: {
    modules: [DROP_EXTEND_VIEW_CONTAINER],
  },
  [SlotLocation.main]: {
    modules: ['@opensumi/ide-editor'],
  },
  [SlotLocation.panel]: {
    modules: [
      DROP_PANEL_CONTAINER,
      '@opensumi/ide-terminal-next',
      '@opensumi/ide-output',
      'debug-console',
      '@opensumi/ide-markers',
    ],
  },
  [SlotLocation.statusBar]: {
    modules: ['@opensumi/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: ['breadcrumb-menu'],
  },
};
