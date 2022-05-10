import { Injector, Injectable } from '@opensumi/di';
import { BrowserModule, ClientApp, getDebugLogger, IContextKeyService } from '@opensumi/ide-core-browser';
import { CommonServerPath, ConstructorOf, ILoggerManagerClient, OS } from '@opensumi/ide-core-common';
import { NodeModule, INodeLogger } from '@opensumi/ide-core-node';
import {
  EmptyDocCacheImpl,
  IDocPersistentCacheProvider,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';

import { useMockStorage } from '../../../packages/core-browser/__mocks__/storage';
import { MockContextKeyService } from '../../../packages/monaco/__mocks__/monaco.context-key.service';

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
  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useValue: {
        getLogger() {
          return getDebugLogger();
        },
      },
    },
    {
      token: CommonServerPath,
      useValue: {
        getBackendOS: jest.fn(() => OS.Type.OSX),
      },
    },
  );
  const app = new ClientApp({
    modules: [MockMainLayout, ...modules],
    injector,
    layoutConfig: {},
  } as any) as MockClientApp;
  await app.start(document.getElementById('main')!);
  return app;
}

export function addEditorProviders(injector: MockInjector) {
  injector.addProviders(
    {
      token: IDocPersistentCacheProvider,
      useClass: EmptyDocCacheImpl,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass: EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    },
  );
}

function getBrowserMockInjector() {
  const injector = new MockInjector();
  useMockStorage(injector);
  addEditorProviders(injector);
  injector.addProviders({
    token: IContextKeyService,
    useClass: MockContextKeyService,
  });
  return injector;
}

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, inj?: Injector): MockInjector {
  const injector = inj || getBrowserMockInjector();
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
