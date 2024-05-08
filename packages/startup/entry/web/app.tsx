import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';
import { MENU_BAR_FEATURE_TIP } from '@opensumi/ide-startup/lib/browser/menu-bar-help-icon';

import { StartupModule } from '../../src/browser/index';

import { getDefaultClientAppOpts, renderApp } from './render-app';

renderApp(
  getDefaultClientAppOpts({
    modules: [...AIModules, StartupModule],
    opts: {
      layoutConfig: {
        [DESIGN_MENU_BAR_RIGHT]: {
          modules: [MENU_BAR_FEATURE_TIP],
        },
      },
    },
  }),
);
