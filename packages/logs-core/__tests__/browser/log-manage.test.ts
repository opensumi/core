import { Injectable, Injector } from '@opensumi/di';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { LogModule } from '../../src/browser';
import { LoggerManagerClient } from '../../src/browser/log-manager';
import { ILoggerManagerClient, LogLevel, LogServiceForClientPath, SupportLogNamespace } from '../../src/common';

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

  async disposeAll() {
    this.hasDisposeAll = true;
  }
}

describe('log-manager', () => {
  let injector: Injector;
  let logManager: ILoggerManagerClient;

  beforeEach(() => {
    injector = createBrowserInjector([], new MockInjector([LogModule]));
    injector.overrideProviders({
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    });
    injector.addProviders({
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    });
    logManager = injector.get(ILoggerManagerClient);
  });

  test('getLogger', () => {
    const logger = logManager.getLogger(SupportLogNamespace.Browser);

    expect(logger).toBeDefined();
  });

  test('setGlobalLogLevel', async () => {
    await logManager.setGlobalLogLevel(LogLevel.Debug);

    expect(await logManager.getGlobalLogLevel()).toEqual(LogLevel.Debug);
  });

  test('dispose', async () => {
    await logManager.dispose();
    const logServiceForClient: MockLogServiceForClient = injector.get(LogServiceForClientPath);
    expect(logServiceForClient.hasDisposeAll).toEqual(true);
  });

  test('onDidChangeLogLevel', () => {
    let catchLevel: LogLevel;

    logManager.onDidChangeLogLevel((level) => {
      catchLevel = level;
    });

    logManager.onDidLogLevelChanged(LogLevel.Verbose);

    expect(catchLevel!).toEqual(LogLevel.Verbose);
  });
});
