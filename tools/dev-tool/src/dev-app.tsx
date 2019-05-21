import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, SlotLocation, SlotMap, BrowserModule, AppProps, RootApp, IRootAppOpts, createClientConnection } from '@ali/ide-core-browser';
import { Injector, ConstructorOf, Provider } from '@ali/common-di';
// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

export function renderApp(main: BrowserModule, modules?: BrowserModule[]): void;
export function renderApp(opts: IRootAppOpts): void;
export function renderApp(arg1: BrowserModule | IRootAppOpts, arg2: BrowserModule[] = []) {
  let opts: IRootAppOpts;
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

  opts.injector = injector;
  opts.slotMap = slotMap;

  const app = new RootApp(opts);
  const firstModule = app.browserModules.values().next().value;
  if (firstModule) {
    const { value: component } = firstModule.slotMap.values().next();
    slotMap.set(SlotLocation.main, component);
  }

  createClientConnection(injector, opts.modules, 'ws://127.0.0.1:8000/service', () => {
    console.log('connection callback');
    ReactDom.render((
      <App app={ app } />
    ), document.getElementById('main'));
  });
}
