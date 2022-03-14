import { Injector, Injectable } from '@opensumi/di';
import { BrowserModule, ClientApp, getDebugLogger } from '@opensumi/ide-core-browser';
import { ConstructorOf, ILoggerManagerClient } from '@opensumi/ide-core-common';
import { NodeModule, INodeLogger } from '@opensumi/ide-core-node';

import { MockInjector } from './mock-injector';
import { MainLayout } from './mock-main';

@Injectable()
class MockMainLayout extends BrowserModule {
  component = MainLayout;
}

export interface MockClientApp extends ClientApp {
  injector: MockInjector;
}

export async function createBrowserApp(
  modules: Array<ConstructorOf<BrowserModule>>,
  inj?: MockInjector,
): Promise<MockClientApp> {
  const injector = inj || new MockInjector();
  // 需要依赖前后端模块
  injector.addProviders({
    token: ILoggerManagerClient,
    useValue: {
      getLogger() {},
    },
  });
  const app = new ClientApp({
    modules: [MockMainLayout, ...modules],
    injector,
    layoutConfig: {},
  } as any) as MockClientApp;
  await app.start(document.getElementById('main')!);
  return app;
}

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, inj?: Injector): MockInjector {
  const injector = inj || new MockInjector();
  const app = new ClientApp({ modules, injector } as any);

  afterAll(() => {
    app.injector.disposeAll();
  });

  return app.injector as MockInjector;
}

export function createNodeInjector(constructors: Array<ConstructorOf<NodeModule>>, inj?: Injector): MockInjector {
  const injector = inj || new MockInjector();

  // Mock logger
  injector.addProviders({
    token: INodeLogger,
    useValue: getDebugLogger(),
  });

  for (const item of constructors) {
    const instance = injector.get(item);
    if (instance.providers) {
      injector.addProviders(...instance.providers);
    }
  }

  afterAll(() => {
    injector.disposeAll();
  });

  return injector as MockInjector;
}
