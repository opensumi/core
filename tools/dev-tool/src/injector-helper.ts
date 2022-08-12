import { Injector, Injectable } from '@opensumi/di';
import { IContextKeyService, RecentFilesManager } from '@opensumi/ide-core-browser';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { BrowserModule } from '@opensumi/ide-core-browser/lib/browser-module';
import {
  CommonServerPath,
  ConstructorOf,
  getDebugLogger,
  ILogger,
  ILoggerManagerClient,
  ILogServiceManager,
  LogLevel,
  LogServiceForClientPath,
  OS,
} from '@opensumi/ide-core-common';
import { NodeModule, INodeLogger, ServerApp } from '@opensumi/ide-core-node';

import { MockLogger, MockLoggerManageClient, MockLoggerService } from '../../../packages/core-browser/__mocks__/logger';
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
      token: RecentFilesManager,
      useValue: {
        getMostRecentlyOpenedFiles: () => [],
      },
    },
    {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    },
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManageClient,
    },
    {
      token: ILogServiceManager,
      useClass: MockLoggerService,
    },
    {
      token: ILogger,
      useClass: MockLogger,
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

function getNodeMockInjector() {
  const injector = new MockInjector();
  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManageClient,
    },
    {
      token: ILogServiceManager,
      useClass: MockLoggerService,
    },
    {
      token: INodeLogger,
      useValue: getDebugLogger(),
    },
  );
  return injector;
}

export function createNodeInjector(modules: Array<ConstructorOf<NodeModule>>, inj?: Injector): MockInjector {
  const injector = inj || getNodeMockInjector();
  const app = new ServerApp({ modules, injector } as any);

  afterAll(() => {
    app.injector.disposeAll();
  });

  return app.injector as MockInjector;
}
