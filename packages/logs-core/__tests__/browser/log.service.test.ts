import { Injector, Injectable } from '@opensumi/di';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { LogModule } from '../../src/browser';
import { LogServiceClient } from '../../src/browser/log.service';
import {
  ILoggerManagerClient,
  SupportLogNamespace,
  LogLevel,
  LogServiceForClientPath,
  ILogServiceClient,
} from '../../src/common';

@Injectable()
class MockLogServiceForClient {
  private level: LogLevel;

  catchLogArgs: any[];
  namespace: SupportLogNamespace;

  async setLevel(namespace, level) {
    this.level = level;
    this.namespace = namespace;
  }

  async getLevel() {
    return this.level;
  }

  async verbose(...args) {
    this.catchLogArgs = args;
  }

  async debug(...args) {
    this.catchLogArgs = args;
  }

  async log(...args) {
    this.catchLogArgs = args;
  }

  async warn(...args) {
    this.catchLogArgs = args;
  }

  async error(...args) {
    this.catchLogArgs = args;
  }

  async critical(...args) {
    this.catchLogArgs = args;
  }
}

describe('log-manager', () => {
  let injector: Injector;
  let logManager: ILoggerManagerClient;
  let logServiceClient: ILogServiceClient;
  let logServiceForClient: MockLogServiceForClient;

  beforeEach(() => {
    injector = createBrowserInjector([LogModule]);
    injector.addProviders({
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    });
    logManager = injector.get(ILoggerManagerClient);
    logServiceForClient = injector.get(LogServiceForClientPath);
    logServiceClient = new LogServiceClient(SupportLogNamespace.Browser, logServiceForClient);
  });

  test('setLevel', async () => {
    await logServiceClient.setLevel(LogLevel.Error);
    expect(await logServiceClient.getLevel()).toEqual(LogLevel.Error);
    expect(logServiceForClient.namespace).toEqual(SupportLogNamespace.Browser);
  });

  test('logs method', async () => {
    const list = ['verbose', 'debug', 'log', 'warn', 'critical'];
    for (const key of list) {
      await logServiceClient[key]('1', '2', { a: 3 });
      const result = logServiceForClient.catchLogArgs;
      expect(result[0]).toEqual(SupportLogNamespace.Browser);
      expect(result[1]).toEqual('1 2 {"a":3}');
    }
  });

  test('log error', async () => {
    await logServiceClient.error(new Error('ERROR'));
    const result = logServiceForClient.catchLogArgs;
    expect(result[0]).toEqual(SupportLogNamespace.Browser);
    expect(result[1].indexOf('\n') > -1).toEqual(true);
  });
});
