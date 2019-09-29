import * as React from 'react';
import { App, ClientApp, IClientAppOpts } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.workspaceDir = opts.workspaceDir || process.env.WORKSPACE_DIR;
  opts.coreExtensionDir = opts.coreExtensionDir || process.env.CORE_EXTENSION_DIR;

  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.injector = injector;
  opts.wsPath = 'ws://127.0.0.1:8000'; // 代理测试地址: ws://127.0.0.1:8001

  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST; // `http://127.0.0.1:8080/kaitian/ext/worker-host.js`; // 访问 Host

  // 使用不一样的host名称
  const anotherHostName = window.location.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  opts.webviewEndpoint = `http://${anotherHostName}:9090`;

  const app = new ClientApp(opts);

  app.onReload((forcedReload: boolean) => {
    window.location.reload(forcedReload);
  });

  await app.start(document.getElementById('main')!, 'web');
  const loadingDom = document.getElementById('loading');
  if (loadingDom) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadingDom.classList.add('loading-hidden');
    await new Promise((resolve) => setTimeout(resolve, 500));
    loadingDom.remove();
  }
  console.log('app.start done at workspace:', opts.workspaceDir);

}
