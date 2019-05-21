import { ConstructorOf } from '@ali/ide-core-common';
import { Injector } from '@ali/common-di';
import { BrowserModule, RootApp } from '@ali/ide-core-browser';
import { NodeModule } from '@ali/ide-core-node';

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>) {
  const app = new RootApp({ modules });
  return app.injector;
}

export function createNodeInjector(constructors: Array<ConstructorOf<NodeModule>>) {
  // TODO: 等 Node 这边的加载器写好之后，再把这里改一下
  const injector = new Injector();

  for (const item of constructors) {
    const instance = injector.get(item);
    if (instance.providers) {
      injector.addProviders(...instance.providers);
    }
  }

  return injector;
}
