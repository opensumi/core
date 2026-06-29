import { AILayout } from '@opensumi/ide-ai-native/lib/browser/layout/ai-layout';
import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';

import { DefaultLayout } from '../layout';
import { getDefaultClientAppOpts, renderApp } from '../render-app';

const queries = new URLSearchParams(window.location.search);
const enableAINativeE2E = queries.get('aiNative') === 'true' || queries.has('webMcpProfile');
const panelLayout = queries.get('aiPanelLayout') === 'classic' ? 'classic' : 'agentic';

renderApp(
  getDefaultClientAppOpts({
    modules: enableAINativeE2E ? AIModules : [],
    opts: {
      ...(enableAINativeE2E
        ? {
            AINativeConfig: {
              layout: {
                panelLayout,
              },
              capabilities: {
                supportsMCP: true,
                supportsCustomLLMSettings: true,
              },
            },
            layoutComponent: AILayout,
          }
        : {
            // do not use design and ai layout for general e2e testing
            designLayout: {
              useMenubarView: false,
              useMergeRightWithLeftPanel: false,
            },
            layoutComponent: DefaultLayout,
          }),
    },
  }),
);
