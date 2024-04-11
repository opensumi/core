import { Injectable } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { LogLevel, LogServiceForClientPath, getLanguageId } from '@opensumi/ide-core-common';
import { MainThreadEnv } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.env';
import { MainThreadStorage } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.storage';
import {
  ExtHostAPIIdentifier,
  IMainThreadEnv,
  IMainThreadStorage,
  MainThreadAPIIdentifier,
} from '@opensumi/ide-extension/lib/common/vscode';
import { createEnvApiFactory, envValue } from '@opensumi/ide-extension/lib/hosted/api/vscode/env/envApiFactory';
import { ExtHostEnv } from '@opensumi/ide-extension/lib/hosted/api/vscode/env/ext.host.env';
import { ExtHostStorage } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.storage';
import { ExtHostTerminal } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.terminal';
import ExtensionHostServiceImpl from '@opensumi/ide-extension/lib/hosted/ext.host';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { createMockPairRPCProtocol } from '../../__mocks__/initRPCProtocol';
import { MockExtensionStorageService } from '../hosted/__mocks__/extensionStorageService';

const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();

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

describe('MainThreadEnvAPI Test Suites', () => {
  const injector = createBrowserInjector([]);
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
          token: AppConfig,
          useValue: appConfig,
        },
        {
          token: IExtensionStorageService,
          useValue: MockExtensionStorageService,
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
        injector.get(ExtensionHostServiceImpl) as any,
        extHostEnv,
        extHostTerminal,
      );
      done();
    }, 0);
  });

  it('should have enough API', (done) => {
    expect(typeof extHostEnvAPI.appName).toBe('string');
    expect(typeof extHostEnvAPI.appHost).toBe('string');
    expect(typeof extHostEnvAPI.appRoot).toBe('undefined');
    expect(typeof extHostEnvAPI.uriScheme).toBe('string');
    expect(typeof extHostEnvAPI.language).toBe('string');
    expect(typeof extHostEnvAPI.sessionId).toBe('string');
    expect(typeof extHostEnvAPI.remoteName).toBe('string');
    expect(typeof extHostEnvAPI.clipboard).toBe('object');
    expect(typeof extHostEnvAPI.clipboard.readText).toBe('function');
    expect(typeof extHostEnvAPI.clipboard.writeText).toBe('function');
    expect(typeof extHostEnvAPI.openExternal).toBe('function');
    expect(typeof extHostEnvAPI.isNewAppInstall).toBe('boolean');
    expect(typeof extHostEnvAPI.isTelemetryEnabled).toBe('boolean');
    expect(typeof extHostEnvAPI.onDidChangeTelemetryEnabled).toBe('function');
    done();
  });

  it('should hava correct env', (done) => {
    expect(extHostEnvAPI.appName).toBe(appConfig.appName);
    expect(extHostEnvAPI.uriScheme).toBe(appConfig.uriScheme);
    expect(extHostEnvAPI.language).toBe(getLanguageId().toLowerCase());
    expect(extHostEnvAPI.sessionId).toBe(envValue.sessionId);
    expect(extHostEnvAPI.machineId).toBe(envValue.machineId);
    done();
  });

  it('can read/write text via clipboard', async () => {
    const text = 'test for env';
    await extHostEnvAPI.clipboard.writeText(text);
    expect(navigator.clipboard.readText()).toBe(text);
    const target = await extHostEnvAPI.clipboard.readText();
    expect(target).toBe(text);
  });
});
