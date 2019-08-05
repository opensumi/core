import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, BrowserModule, ClientApp, IClientAppOpts } from '@ali/ide-core-browser';
import { Injector, Domain } from '@ali/common-di';
import { createSocketConnection } from '@ali/ide-connection';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

export async function renderApp(main: Domain, modules?: Domain[]);
export async function renderApp(opts: IClientAppOpts);
export async function renderApp(arg1: IClientAppOpts | Domain, arg2: Domain[] = []) {
  let opts: IClientAppOpts;
  let modules: Domain[];

  const injector = new Injector();

  if (typeof arg1 === 'string') {
    modules = [arg1, ...arg2];
    // TODO 支持只传入一个模块的方式
    opts = { modules: [] };
  } else {
    opts = arg1 as IClientAppOpts;
  }

  opts.workspaceDir = opts.workspaceDir || process.env.WORKSPACE_DIR;
  opts.coreExtensionDir = opts.coreExtensionDir || process.env.CORE_EXTENSION_DIR;
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.injector = injector;
  // 没传配置，则使用模块列表第一个模块
  opts.layoutConfig = opts.layoutConfig || {
    main: {
      modules: [opts.modules[0]],
    },
  };

  const app = new ClientApp(opts);
  const iterModules = app.browserModules.values();
  // 默认的第一个 Module 的 Slot 必须是 main
  const firstModule = iterModules.next().value;
  // 默认的第二个Module为overlay（临时方案）
  const secondModule = iterModules.next().value;

  const netConnection = await (window as any).createRPCNetConnection();
  await app.start(document.getElementById('main')!, 'electron', createSocketConnection(netConnection));

  console.log('app.start done');
  const loadingDom = document.getElementById('loading');
  if (loadingDom) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    loadingDom.classList.add('loading-hidden');
    await new Promise((resolve) => setTimeout(resolve, 500));
    loadingDom.remove();
  }

}
