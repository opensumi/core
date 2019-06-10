import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, SlotLocation, SlotMap, BrowserModule, ClientApp, IClientAppOpts } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

export async function renderApp(main: BrowserModule, modules?: BrowserModule[]);
export async function renderApp(opts: IClientAppOpts);
export async function renderApp(arg1: BrowserModule | IClientAppOpts, arg2: BrowserModule[] = []) {
  let opts: IClientAppOpts;
  let modules: BrowserModule[];

  const injector = new Injector();

  let slotMap: SlotMap;
  if (arg1 instanceof BrowserModule) {
    modules = [arg1, ...arg2];
    slotMap = new Map();
    opts = { modules: [], modulesInstances: modules };
  } else {
    opts = arg1;
    slotMap = opts.slotMap || new Map();
  }

  opts.workspaceDir = URI.file(process.env.WORKSPACE_DIR as string).toString();
  opts.injector = injector;
  opts.slotMap = slotMap;
  opts.terminalHost = 'ws://127.0.0.1:8000';

  const app = new ClientApp(opts);

  // 默认的第一个 Module 的 Slot 必须是 main
  const firstModule = app.browserModules.values().next().value;
  if (firstModule) {
    const { value: component } = firstModule.slotMap.values().next();
    slotMap.set(SlotLocation.main, component);
  }

  await app.start();

  ReactDom.render((
    <App app={app} />
  ), document.getElementById('main'), async () => {
    // TODO 先实现加的 Loading，待状态接入后基于 stateService 来管理加载流程
    const loadingDom = document.getElementById('loading');
    if (loadingDom) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      loadingDom.classList.add('loading-hidden');
      await new Promise((resolve) => setTimeout(resolve, 500));
      loadingDom.remove();
    }
  });

}
