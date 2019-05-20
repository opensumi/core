import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, SlotLocation, SlotMap, BrowserModule, AppProps, RootApp, IRootAppOpts } from '@ali/ide-core-browser';
// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

export function renderApp(main: BrowserModule, modules?: BrowserModule[]): void;
export function renderApp(opts: IRootAppOpts): void;
export function renderApp(arg1: BrowserModule | IRootAppOpts, arg2: BrowserModule[] = []) {
  let opts: IRootAppOpts;
  let modules: BrowserModule[];
  const slotMap: SlotMap = new Map();

  if (arg1 instanceof BrowserModule) {
    modules = [arg1, ...arg2];
    opts = { modules: [], modulesInstances: modules, slotMap };
  } else {
    opts = arg1;
  }

  const app = new RootApp(opts);
  const firstModule = app.browserModules.values().next().value;
  if (firstModule) {
    const { value: component } = firstModule.slotMap.values().next();
    slotMap.set(SlotLocation.main, component);
  }

  ReactDom.render((
    <App app={ app } />
  ), document.getElementById('main'));
}
