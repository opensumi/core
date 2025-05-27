/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@opensumi/ide-core-browser';

import { DROP_BOTTOM_CONTAINER, DROP_RIGHT_CONTAINER } from '../common';

export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@opensumi/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: ['@opensumi/ide-toolbar-action'],
  },
  [SlotLocation.view]: {
    modules: [
      '@opensumi/ide-explorer',
      '@opensumi/ide-search',
      '@opensumi/ide-scm',
      '@opensumi/ide-extension-manager',
      '@opensumi/ide-debug',
      '@opensumi/ide-notebook',
    ],
  },
  [SlotLocation.extendView]: {
    modules: [DROP_RIGHT_CONTAINER],
  },
  [SlotLocation.main]: {
    modules: ['@opensumi/ide-editor'],
  },
  [SlotLocation.panel]: {
    modules: [
      DROP_BOTTOM_CONTAINER,
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
