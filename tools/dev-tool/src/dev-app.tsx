import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, SlotLocation, SlotMap, BrowserModule, AppProps, RootApp, IRootAppOpts } from '@ali/ide-core-browser';
import {StubClient} from '@ali/ide-connection';
import { Injector, ConstructorOf, Provider } from '@ali/common-di';

export function renderApp(main: BrowserModule, modules?: BrowserModule[]): void;
export function renderApp(opts: IRootAppOpts): void;
export function renderApp(arg1: BrowserModule | IRootAppOpts, arg2: BrowserModule[] = []) {
  let opts: IRootAppOpts;
  let modules: BrowserModule[];
  const slotMap: SlotMap = new Map();
  const injector = new Injector();
  if (arg1 instanceof BrowserModule) {
    modules = [arg1, ...arg2];
    opts = { modules: [], modulesInstances: modules, slotMap };
  } else {
    opts = arg1;
  }
  opts.injector = injector;

  const app = new RootApp(opts);
  const firstModule = app.browserModules.values().next().value;
  if (firstModule) {
    const { value: component } = firstModule.slotMap.values().next();
    slotMap.set(SlotLocation.main, component);
  }

  const clientConnection = new WebSocket('ws://127.0.0.1:8000/service');
  clientConnection.onopen = async () => {
    const stubClient = new StubClient(clientConnection);
    const backServiceArr: string[] = [];

    for (const module of opts.modules ) {
      const moduleInstance = injector.get(module);
      if (moduleInstance.backServices) {
        for (const backService of moduleInstance.backServices) {
          const {servicePath} = backService;
          if (!backServiceArr.includes(servicePath)) {
            backServiceArr.push(servicePath);
          }
        }
      }
    }
    for (const backServicePath of backServiceArr) {
      const service = await stubClient.getStubService(backServicePath);
      const injectService = {
        token: backServicePath,
        useValue: service,
      } as Provider;
      injector.addProviders(injectService);
    }

    for (const module of opts.modules ) {
      const moduleInstance = injector.get(module);

      if (moduleInstance.frontServices) {
        for (const frontService of moduleInstance.frontServices) {
          console.log('frontService.token', frontService.token);
          const serviceInstance = injector.get(frontService.token);
          stubClient.registerSubClientService(frontService.servicePath, serviceInstance);
        }
      }
    }

    ReactDom.render((
      <App app={ app } />
    ), document.getElementById('main'));
  };

}
