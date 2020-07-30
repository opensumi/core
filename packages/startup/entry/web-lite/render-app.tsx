import { Injector } from '@ali/common-di';
import { ClientApp, IClientAppOpts, LogServiceForClientPath, DEFAULT_WORKSPACE_STORAGE_DIR_NAME } from '@ali/ide-core-browser';
import { ensureDir } from '@ali/ide-core-common/lib/browser-fs/ensure-dir';
import * as BrowserFS from 'browserfs';
import * as path from 'path';

import { MetaService } from './services/meta-service';
import { IMetaService } from './services/meta-service/base';
import { MockLogServiceForClient } from './overrides/mock-logger';

BrowserFS.configure({
  fs: 'IndexedDB',
  options: {},
}, (e) => {});

import { ExtensionNodeServiceServerPath } from '@ali/ide-kaitian-extension/lib/common';
import { FileSearchServicePath } from '@ali/ide-file-search';
import { ExtensionClientService } from './overrides/mock-extension-server';
import { MockFileSearch } from './overrides/mock-file-search';
import { HttpFileServiceBase, BROWSER_HOME_DIR } from '@ali/ide-file-service/lib/browser/browser-fs-provider';
import { AoneCodeHttpFileService } from './modules/file-provider/http-file.service';

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.injector = injector;

  // FIXME: 应尽快去掉 mock 模块的使用
  injector.addProviders({
    token: LogServiceForClientPath,
    useClass: MockLogServiceForClient,
  }, {
    token: ExtensionNodeServiceServerPath,
    useClass: ExtensionClientService,
  }, {
    token: FileSearchServicePath,
    useClass: MockFileSearch,
  }, {
    token: HttpFileServiceBase,
    useClass: AoneCodeHttpFileService,
  }, {
    token: IMetaService,
    useValue: new MetaService({
      projectId: process.env.PROJECT_ID! || encodeURIComponent('ide-s/TypeScript-Node-Starter'),
      group: 'ide-s',
      name: 'TypeScript-Node-Starter',
      ref: 'test',
      // branch: 'test',
    }),
  });

  const metaService = injector.get(IMetaService);
  opts.workspaceDir = path.join('/', metaService.ref, (opts.workspaceDir || process.env.WORKSPACE_DIR)!);
  // 跟后端通信部分配置，需要解耦
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath =  process.env.WS_PATH || 'ws://127.0.0.1:8000';  // 代理测试地址: ws://127.0.0.1:8001
  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST; // `http://127.0.0.1:8080/kaitian/ext/worker-host.js`; // 访问 Host
  opts.webviewEndpoint = opts.webviewEndpoint || `http://localhost:50998`;

  opts.editorBackgroudImage = 'https://img.alicdn.com/tfs/TB1Y6vriuL2gK0jSZFmXXc7iXXa-200-200.png';

  BrowserFS.initialize(new BrowserFS.FileSystem.IndexedDB(async () => {
    await ensureDir(opts.workspaceDir!);
    await ensureDir(BROWSER_HOME_DIR.codeUri.fsPath);
    await ensureDir(BROWSER_HOME_DIR.path.join(DEFAULT_WORKSPACE_STORAGE_DIR_NAME).toString());
    const app = new ClientApp(opts);
    app.fireOnReload = (forcedReload: boolean) => {
      window.location.reload(forcedReload);
    };
    await app.start(document.getElementById('main')!, undefined, undefined, () => {
      const loadingDom = document.getElementById('loading');
      if (loadingDom) {
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        loadingDom.classList.add('loading-hidden');
        // await new Promise((resolve) => setTimeout(resolve, 500));
        loadingDom.remove();
      }
    });
  }, 'kaitian-browser-fs'));
}
