import { ClientApp, IContextKeyService } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';
import { TerminalNextModule } from '@ali/ide-terminal-next/lib/browser';
import { MainLayoutModule } from '@ali/ide-main-layout/lib/browser';
import { ThemeModule } from '@ali/ide-theme/lib/browser';
import { OverlayModule } from '@ali/ide-overlay/lib/browser';
import { LogModule } from '@ali/ide-logs/lib/browser';
import { PreferencesModule } from '@ali/ide-preferences/lib/browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { IStatusBarService } from '@ali/ide-status-bar/lib/common';
import { DefaultLayout } from './layout';
import { MockContextKeyService, MockStatusBarService, MockEditorService } from './mock';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';

const modules = [
  MainLayoutModule,
  OverlayModule,
  LogModule,
  FileServiceClientModule,
  ThemeModule,
  WorkspaceModule,
  PreferencesModule,
  TerminalNextModule,
];

export const defaultConfig = {
  terminal: {
    modules: ['@ali/ide-terminal-next'],
  },
};
export async function renderApp() {
  const injector = new Injector([
    {
      token: IStatusBarService,
      useClass: MockStatusBarService,
    },
    {
      token: IContextKeyService,
      useClass: MockContextKeyService,
    },
    {
      token: WorkbenchEditorService,
      useClass: MockEditorService,
    },
  ]);

  const app = new ClientApp({
    modules,
    injector,
    layoutConfig: defaultConfig,
    layoutComponent: DefaultLayout,
  });

  app.fireOnReload = (forcedReload: boolean) => {
    window.location.reload(forcedReload);
  };

  await app.start(document.getElementById('main')!, 'web');
  const loadingDom = document.getElementById('loading');
  if (loadingDom) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadingDom.classList.add('loading-hidden');
    await new Promise((resolve) => setTimeout(resolve, 500));
    loadingDom.remove();
  }
}

renderApp();
