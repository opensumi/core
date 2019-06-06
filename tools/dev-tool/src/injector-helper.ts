import { ConstructorOf } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';
import { BrowserModule, ClientApp } from '@ali/ide-core-browser';
import { NodeModule } from '@ali/ide-core-node';
import { MockInjector } from './mock-injector';
import * as ws from 'ws';

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, inj?: Injector): MockInjector {
  const injector = inj || new MockInjector();
  const app = new ClientApp({ modules, injector });

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
