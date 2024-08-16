import React, { useEffect } from 'react';

import { SlotLocation } from '@opensumi/ide-core-browser';
import { DESIGN_MENUBAR_CONTAINER_VIEW_ID, DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { NotebookModule } from '@opensumi/ide-notebook/lib/browser';
import { getDefaultClientAppOpts, renderApp } from '@opensumi/ide-startup/entry/web/render-app';
import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';
import { MENU_BAR_FEATURE_TIP } from '@opensumi/ide-startup/lib/browser/menu-bar-help-icon';

export default () => {
  useEffect(() => {
    renderApp(
      getDefaultClientAppOpts({
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
        },
      }),
    );
  }, []);
  return <div id='main' style={{ width: '100vw', height: '100vh' }}></div>;
};
