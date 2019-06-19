import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, BrowserModule, ClientApp, IClientAppOpts } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

export async function renderApp(main: BrowserModule, modules?: BrowserModule[]);
export async function renderApp(opts: IClientAppOpts);
export async function renderApp(arg1: BrowserModule | IClientAppOpts, arg2: BrowserModule[] = []) {
  let opts: IClientAppOpts;
  let modules: BrowserModule[];

  const injector = new Injector();

  if (arg1 instanceof BrowserModule) {
    modules = [arg1, ...arg2];
    // TODO 支持只传入一个模块的方式
    opts = { modules: [], modulesInstances: modules };
  } else {
    opts = arg1;
  }

  opts.workspaceDir = process.env.WORKSPACE_DIR;
  opts.injector = injector;
  opts.wsPath = 'ws://127.0.0.1:8000';
  // 没传配置，则使用模块列表第一个模块
  opts.layoutConfig = opts.layoutConfig || {
    main: {
      modules: [opts.modules[0]],
      moduleNames: ['name'],
    },
  };

  const app = new ClientApp(opts);

  // 默认的第一个 Module 的 Slot 必须是 main
  const firstModule = app.browserModules.values().next().value;

  await app.start();

  ReactDom.render((
    <App app={app} component={firstModule.component as React.FunctionComponent} />
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
