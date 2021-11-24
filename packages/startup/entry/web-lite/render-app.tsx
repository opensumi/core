import { Injector } from '@opensumi/di';
import { ClientApp, IClientAppOpts, LogServiceForClientPath, DEFAULT_WORKSPACE_STORAGE_DIR_NAME } from '@opensumi/ide-core-browser';
import { ensureDir } from '@opensumi/ide-core-common/lib/browser-fs/ensure-dir';
import BrowserFS from 'browserfs';
import path from 'path';

import { MetaService } from './services/meta-service';
import { IMetaService } from './services/meta-service/base';
import { MockLogServiceForClient } from './overrides/mock-logger';

import React from 'react';
import ReactDOM from 'react-dom';

BrowserFS.configure({
  fs: 'IndexedDB',
  options: {},
}, (e) => {});

import { ExtensionNodeServiceServerPath } from '@opensumi/ide-extension/lib/common';
import { FileSearchServicePath } from '@opensumi/ide-file-search';
import { ExtensionClientService } from './overrides/mock-extension-server';
import { MockFileSearch } from './overrides/mock-file-search';
import { AbstractHttpFileService, BROWSER_HOME_DIR } from './modules/file-provider/browser-fs-provider';
import { AoneCodeHttpFileService } from './modules/file-provider/http-file.service';

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.injector = injector;

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
    token: AbstractHttpFileService,
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

  opts.editorBackgroundImage = 'https://img.alicdn.com/tfs/TB1Y6vriuL2gK0jSZFmXXc7iXXa-200-200.png';

  BrowserFS.initialize(new BrowserFS.FileSystem.IndexedDB(async () => {
    await ensureDir(opts.workspaceDir!);
    await ensureDir(BROWSER_HOME_DIR.codeUri.fsPath);
    await ensureDir(BROWSER_HOME_DIR.path.join(DEFAULT_WORKSPACE_STORAGE_DIR_NAME).toString());
    const app = new ClientApp(opts);
    app.fireOnReload = (forcedReload: boolean) => {
      window.location.reload(forcedReload);
    };

    const targetDom = document.getElementById('main')!;
    await app.start((app) => {
      const MyApp = <div id='custom-wrapper' style={{ height: '100%' }}>{app}</div>;
      return new Promise((resolve) => {
        ReactDOM.render(MyApp, targetDom, resolve);
      });
    });
    const loadingDom = document.getElementById('loading');
    if (loadingDom) {
      // await new Promise((resolve) => setTimeout(resolve, 1000));
      loadingDom.classList.add('loading-hidden');
      // await new Promise((resolve) => setTimeout(resolve, 500));
      loadingDom.remove();
    }
  }, 'kaitian-browser-fs'));
}
