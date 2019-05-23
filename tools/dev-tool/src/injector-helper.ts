import { ConstructorOf } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';
import { BrowserModule, RootApp, createClientConnection } from '@ali/ide-core-browser';
import { NodeModule } from '@ali/ide-core-node';
import { MockInjector } from './mock-injector';
import * as ws from 'ws';

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, cb?: (injector: any) => any): MockInjector {
  const injector = new MockInjector();
  const app = new RootApp({ modules, injector });
  (global as any).WebSocket = ws;
  createClientConnection(injector, modules, 'ws://127.0.0.1:8000/service', () => {
    if (cb) {
      cb(injector);
    }
  });

  return app.injector as MockInjector;
}

export function createNodeInjector(constructors: Array<ConstructorOf<NodeModule>>) {
  // TODO: 等 Node 这边的加载器写好之后，再把这里改一下
  const injector = new MockInjector();

  for (const item of constructors) {
    const instance = injector.get(item);
    if (instance.providers) {
      injector.addProviders(...instance.providers);
    }
  }

  return injector;
}
