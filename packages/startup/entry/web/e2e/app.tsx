import { DefaultLayout } from '../layout';
import { getDefaultClientAppOpts, renderApp } from '../render-app';

renderApp(
  getDefaultClientAppOpts({
    opts: {
      // do not use design and ai layout for e2e testing
      designLayout: {
        useMenubarView: false,
        useMergeRightWithLeftPanel: false,
      },
      layoutComponent: DefaultLayout,
    },
  }),
);
