import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';

import { getDefaultClientAppOpts, renderApp } from './render-app';

renderApp(
  getDefaultClientAppOpts({
    modules: [...AIModules],
  }),
);
