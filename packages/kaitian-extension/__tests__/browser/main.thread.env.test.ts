// @ts-nocheck
import { Injector, Injectable } from '@ali/common-di';
import { Emitter, ILoggerManagerClient, LogServiceForClientPath, LogLevel, getLanguageId } from '@ali/ide-core-common';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { createEnvApiFactory, ExtHostEnv, envValue } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.env';
import { ExtHostTerminal } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.terminal';
import { MainThreadEnv } from '@ali/ide-kaitian-extension/lib/browser/vscode/api/main.thread.env';
import { IMainThreadEnv, MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '@ali/ide-kaitian-extension/lib/common/vscode';
import ExtensionHostServiceImpl from '@ali/ide-kaitian-extension/lib/hosted/ext.host';
import { LoggerManagerClient } from '@ali/ide-logs/lib/browser/log-manage';
import { AppConfig } from '@ali/ide-core-browser';

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

  hasDisposeAll: boolean = false;

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
    appName: 'kaitian',
    uriScheme: 'kaitian',
  };
  beforeAll((done) => {
    injector.overrideProviders(...[{
      token: ExtensionHostServiceImpl,
      useValue: {},
    }, {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    }, {
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    }, {
      token: AppConfig,
      useValue: appConfig,
    }]);
    const extHostEnv = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostEnv, new ExtHostEnv(rpcProtocolExt));
    const extHostTerminal = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTerminal, new ExtHostTerminal(rpcProtocolExt));
    const MainThreadEnvAPI = injector.get(MainThreadEnv, [rpcProtocolMain]);
    rpcProtocolMain.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadEnv, MainThreadEnvAPI);
    setTimeout(() => {
      extHostEnvAPI = createEnvApiFactory(rpcProtocolExt, injector.get(ExtensionHostServiceImpl), extHostEnv, extHostTerminal);
      done();
    }, 0);
  });

  it('should have enough API', (done) => {
    expect(typeof extHostEnvAPI.appName!).toBe('string');
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
