import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, BrowserModule, ClientApp, IClientAppOpts, electronEnv } from '@ali/ide-core-browser';
import { Injector, Domain } from '@ali/common-di';
import { createSocketConnection } from '@ali/ide-connection';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';
// 引入本地icon，不使用cdn版本，与useCdnIcon配套使用
import '@ali/ide-core-browser/lib/style/icon.less';

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

  opts.workspaceDir = electronEnv.env.WORKSPACE_DIR;
  opts.coreExtensionDir = electronEnv.env.CORE_EXTENSION_DIR;
  opts.extensionDir = electronEnv.metadata.extensionDir;
  opts.injector = injector;
  const app = new ClientApp(opts);

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
