import { Injector, Injectable } from '@opensumi/di';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { LogModule } from '../../src/browser';
import { ILoggerManagerClient, SupportLogNamespace, LogLevel, LogServiceForClientPath } from '../../src/common';

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
    injector = createBrowserInjector([LogModule]);
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
