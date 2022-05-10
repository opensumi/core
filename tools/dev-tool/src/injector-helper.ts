import { Injector, Injectable } from '@opensumi/di';
import {
  BrowserModule,
  ClientApp,
  getDebugLogger,
  IContextKeyService,
  MonacoService,
} from '@opensumi/ide-core-browser';
import {
  CommonServerPath,
  ConstructorOf,
  ILoggerManagerClient,
  LogLevel,
  LogServiceForClientPath,
  OS,
} from '@opensumi/ide-core-common';
import { NodeModule, INodeLogger } from '@opensumi/ide-core-node';
import {
  EditorCollectionService,
  EditorComponentRegistry,
  EmptyDocCacheImpl,
  IDocPersistentCacheProvider,
  IEditorDecorationCollectionService,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  IEditorFeatureRegistry,
  ILanguageService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import {
  EditorDocumentModelContentRegistryImpl,
  EditorDocumentModelServiceImpl,
} from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { EditorCollectionServiceImpl } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import { EditorFeatureRegistryImpl } from '@opensumi/ide-editor/lib/browser/feature';
import { LanguageService } from '@opensumi/ide-editor/lib/browser/language/language.service';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { useMockStorage } from '../../../packages/core-browser/__mocks__/storage';
import { MockContextKeyService } from '../../../packages/monaco/__mocks__/monaco.context-key.service';
import { MockedMonacoService } from '../../../packages/monaco/__mocks__/monaco.service.mock';

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
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: WorkbenchEditorService,
      useClass: WorkbenchEditorServiceImpl,
    },
    {
      token: ResourceService,
      useClass: ResourceServiceImpl,
    },
    {
      token: EditorComponentRegistry,
      useClass: EditorComponentRegistryImpl,
    },
    {
      token: IEditorDecorationCollectionService,
      useClass: EditorDecorationCollectionService,
    },
    {
      token: IEditorDocumentModelContentRegistry,
      useClass: EditorDocumentModelContentRegistryImpl,
    },
    {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    },
    {
      token: ILanguageService,
      useClass: LanguageService,
    },
    {
      token: MonacoService,
      useClass: MockedMonacoService,
    },
    {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
    },
    {
      token: IEditorFeatureRegistry,
      useClass: EditorFeatureRegistryImpl,
    },
  );
}

@Injectable()
class MockLogServiceForClient {
  private level: LogLevel;

  hasDisposeAll = false;

  async setGlobalLogLevel(level) {
    this.level = level;
  }

  async getGlobalLogLevel() {
    return this.level;
  }
  async getLevel() {
    return this.level;
  }
  async setLevel(level: LogLevel) {
    this.level = level;
  }
  async verbose() {
    //
  }
  async debug() {}
  async warn() {}
  async log() {}
  async error() {}
  async critical() {}
  async dispose() {}
  async disposeAll() {
    this.hasDisposeAll = true;
  }
}

function getBrowserMockInjector() {
  const injector = new MockInjector();
  useMockStorage(injector);
  injector.addProviders(
    {
      token: IContextKeyService,
      useClass: MockContextKeyService,
    },
    {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    },
  );
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
