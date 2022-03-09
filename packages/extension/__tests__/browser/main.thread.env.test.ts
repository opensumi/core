// @ts-nocheck
import { Injector, Injectable } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { AppConfig } from '@opensumi/ide-core-browser';
import {
  Emitter,
  ILoggerManagerClient,
  LogServiceForClientPath,
  LogLevel,
  getLanguageId,
} from '@opensumi/ide-core-common';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage';
import { MainThreadEnv } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.env';
import { MainThreadStorage } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.storage';
import {
  IMainThreadEnv,
  MainThreadAPIIdentifier,
  ExtHostAPIIdentifier,
  IMainThreadStorage,
} from '@opensumi/ide-extension/lib/common/vscode';
import { createEnvApiFactory, ExtHostEnv, envValue } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.env';
import { ExtHostStorage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.storage';
import { ExtHostTerminal } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.terminal';
import ExtensionHostServiceImpl from '@opensumi/ide-extension/lib/hosted/ext.host';
import { LoggerManagerClient } from '@opensumi/ide-logs/lib/browser/log-manage';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);

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

describe('MainThreadEnvAPI Test Suites ', () => {
  const injector = createBrowserInjector([], new Injector([]));
  let extHostEnvAPI: ReturnType<typeof createEnvApiFactory>;
  const appConfig = {
    appName: 'sumi',
    uriScheme: 'sumi',
    appHost: 'opensumi.dev',
    workspaceDir: '',
  };
  beforeAll((done) => {
    injector.overrideProviders(
      ...[
        {
          token: ExtensionHostServiceImpl,
          useValue: {},
        },
        {
          token: LogServiceForClientPath,
          useClass: MockLogServiceForClient,
        },
        {
          token: ILoggerManagerClient,
          useClass: LoggerManagerClient,
        },
        {
          token: AppConfig,
          useValue: appConfig,
        },
        {
          token: IExtensionStorageService,
          useValue: {
            whenReady: Promise.resolve(true),
            extensionStoragePath: {},
            set() {},
            get() {},
            getAll() {},
            reConnectInit() {},
          },
        },
      ],
    );

    const extHostEnv = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostEnv, new ExtHostEnv(rpcProtocolExt));
    const extHostTerminal = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostTerminal,
      new ExtHostTerminal(rpcProtocolExt),
    );

    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostStorage, new ExtHostStorage(rpcProtocolExt));

    const MainThreadStorageAPI = injector.get(MainThreadStorage, [rpcProtocolMain]);
    const MainThreadEnvAPI = injector.get(MainThreadEnv, [rpcProtocolMain, MainThreadStorageAPI]);

    rpcProtocolMain.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadEnv, MainThreadEnvAPI);
    rpcProtocolMain.set<IMainThreadStorage>(MainThreadAPIIdentifier.MainThreadStorage, MainThreadStorageAPI);

    setTimeout(() => {
      extHostEnvAPI = createEnvApiFactory(
        rpcProtocolExt,
        injector.get(ExtensionHostServiceImpl),
        extHostEnv,
        extHostTerminal,
      );
      done();
    }, 0);
  });

  it('should have enough API', (done) => {
    expect(typeof extHostEnvAPI.appName).toBe('string');
    expect(typeof extHostEnvAPI.appHost).toBe('string');
    expect(typeof extHostEnvAPI.appRoot).toBe('string');
    expect(typeof extHostEnvAPI.uriScheme).toBe('string');
    expect(typeof extHostEnvAPI.language).toBe('string');
    expect(typeof extHostEnvAPI.sessionId).toBe('string');
    // expect(typeof extHostEnvAPI.machineId).toBe('string');
    expect(typeof extHostEnvAPI.appRoot).toBe('string');
    expect(typeof extHostEnvAPI.remoteName).toBe('string');
    expect(typeof extHostEnvAPI.clipboard).toBe('object');
    expect(typeof extHostEnvAPI.clipboard.readText).toBe('function');
    expect(typeof extHostEnvAPI.clipboard.writeText).toBe('function');
    expect(typeof extHostEnvAPI.openExternal).toBe('function');
    expect(typeof extHostEnvAPI.logLevel).toBe('number');
    expect(typeof extHostEnvAPI.isNewAppInstall).toBe('boolean');
    expect(typeof extHostEnvAPI.isTelemetryEnabled).toBe('boolean');
    expect(typeof extHostEnvAPI.onDidChangeTelemetryEnabled).toBe('function');
    done();
  });

  it('should hava correct env', (done) => {
    expect(extHostEnvAPI.appName).toBe(appConfig.appName);
    expect(extHostEnvAPI.uriScheme).toBe(appConfig.uriScheme);
    expect(extHostEnvAPI.language).toBe(getLanguageId());
    expect(extHostEnvAPI.sessionId).toBe(envValue.sessionId);
    expect(extHostEnvAPI.machineId).toBe(envValue.machineId);
    done();
  });

  it('can read/write text via clipboard', async (done) => {
    const text = 'test for env';
    await extHostEnvAPI.clipboard.writeText(text);
    expect(global.navigator.clipboard.readText()).toBe(text);
    const target = await extHostEnvAPI.clipboard.readText();
    expect(target).toBe(text);
    done();
  });

  it.skip('can get loglevel', async (done) => {
    const logManager = injector.get(ILoggerManagerClient);
    logManager.onDidLogLevelChanged(LogLevel.Error);
    expect(extHostEnvAPI.logLevel).toBe(await logManager.getGlobalLogLevel());
    done();
  });
});
