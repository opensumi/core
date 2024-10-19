import { SlotLocation } from '@opensumi/ide-core-browser';
import { DESIGN_MENUBAR_CONTAINER_VIEW_ID, DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { NotebookModule } from '@opensumi/ide-notebook/lib/browser';
import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';
import { MENU_BAR_FEATURE_TIP } from '@opensumi/ide-startup/lib/browser/menu-bar-help-icon';

import { getDefaultClientAppOpts, renderApp } from './render-app';

renderApp(
  getDefaultClientAppOpts({
    // modules: [...AIModules],
    modules: [...AIModules, NotebookModule],
    opts: {
      layoutViewSize: {
        menubarHeight: 48,
      },
      layoutConfig: {
        [DESIGN_MENU_BAR_RIGHT]: {
          modules: [MENU_BAR_FEATURE_TIP],
        },
        [SlotLocation.top]: {
          modules: [DESIGN_MENUBAR_CONTAINER_VIEW_ID],
        },
      },
      measure: {
        connection: {
          minimumReportThresholdTime: 400,
        },
      },
      notebookServerHost: 'localhost:8888',
    },
  }),
);
