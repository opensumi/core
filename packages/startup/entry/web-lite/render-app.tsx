import { Injector } from '@ali/common-di';
import { ClientApp, IClientAppOpts, LogServiceForClientPath, IContextKeyService, StorageProvider, IFileServiceClient } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IThemeService } from '@ali/ide-theme';
import { MockLogServiceForClient } from './mock-implements/mock-logger';
import { MockContextKeyService } from './mock-implements/mock-monaco.context-key.service';
import { MockedStorageProvider } from './mock-implements/mock-storage';
import { injectMockPreferences } from './mock-implements/mock-preference';
import { MockWorkspace } from './mock-implements/mock-workspace';
import { MockFileServiceClient } from './mock-implements/mock-fs';
import { MockThemeService } from './mock-implements/mock-theme';

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.workspaceDir = opts.workspaceDir || process.env.WORKSPACE_DIR;
  opts.injector = injector;

  injector.addProviders({
    token: LogServiceForClientPath,
    useClass: MockLogServiceForClient,
  }, {
    token: IContextKeyService,
    useClass: MockContextKeyService,
  }, {
    token: StorageProvider,
    useValue: MockedStorageProvider,
  }, {
    token: IWorkspaceService,
    useClass: MockWorkspace,
  }, {
    token: IFileServiceClient,
    useClass: MockFileServiceClient,
  }, {
    token: IThemeService,
    useClass: MockThemeService,
  });
  injectMockPreferences(injector);

  // 跟后端通信部分配置，需要解耦
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath =  process.env.WS_PATH || 'ws://127.0.0.1:8000';  // 代理测试地址: ws://127.0.0.1:8001
  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST; // `http://127.0.0.1:8080/kaitian/ext/worker-host.js`; // 访问 Host
  opts.webviewEndpoint = opts.webviewEndpoint || `http://localhost:50998`;

  opts.editorBackgroudImage = 'https://img.alicdn.com/tfs/TB1Y6vriuL2gK0jSZFmXXc7iXXa-200-200.png';

  const app = new ClientApp(opts);

  app.fireOnReload = (forcedReload: boolean) => {
    window.location.reload(forcedReload);
  };

  // FIXME: 支持剥离connection
  await app.start(document.getElementById('main')!);
  const loadingDom = document.getElementById('loading');
  if (loadingDom) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadingDom.classList.add('loading-hidden');
    await new Promise((resolve) => setTimeout(resolve, 500));
    loadingDom.remove();
  }
}
