import { ExtHostEnv, createEnvApiFactory } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.env';
import { Emitter, ILoggerManagerClient, Uri, uuid } from '@opensumi/ide-core-common';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { RPCProtocol } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { MainThreadEnv } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.env';
import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MockLoggerManagerClient } from '../../../../__mocks__/loggermanager';
import { UIKind } from '@opensumi/ide-extension/lib/common/vscode/ext-types';

import type vscode from 'vscode';

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

let extHost: ExtHostEnv;
let mainThread: MainThreadEnv;

describe('vscode extHostEnv Test', () => {
  const injector = createBrowserInjector([]);
  injector.addProviders(
    {
      token: ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    },
    {
      token: WSChannelHandler,
      useValue: mockService({
        clientId: uuid(),
      }),
    },
  );
  const extensionService = mockService({});
  const extStorage = mockService({});
  const extHostTerminal = mockService({
    shellPath: 'shellPath',
  });
  let env: typeof vscode.env;
  extHost = new ExtHostEnv(rpcProtocolExt);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostEnv, extHost);

  mainThread = rpcProtocolMain.set(
    MainThreadAPIIdentifier.MainThreadEnv,
    injector.get(MainThreadEnv, [rpcProtocolMain, extStorage]),
  );

  beforeEach(() => {
    env = createEnvApiFactory(rpcProtocolExt, extensionService, extHost, extHostTerminal);
  });

  afterAll(() => {
    mainThread.dispose();
  });

  it('env is set', () => {
    expect(typeof env.language).toBe('string');
    expect(typeof env.appRoot).toBe('string');
    expect(typeof env.appName).toBe('string');
    expect(typeof env.appHost).toBe('string');
    expect(typeof env.machineId).toBe('string');
    expect(typeof env.sessionId).toBe('string');
    expect(typeof env.shell).toBe('string');
  });

  it('env is readonly', () => {
    // 加上 any 防止 ts 静态检测
    expect(() => ((env as any).language = '234')).toThrowError();
    expect(() => ((env as any).appRoot = '234')).toThrowError();
    expect(() => ((env as any).appName = '234')).toThrowError();
    expect(() => ((env as any).machineId = '234')).toThrowError();
    expect(() => ((env as any).sessionId = '234')).toThrowError();
  });

  it('get uiKind', () => {
    expect(env.uiKind).toBe(UIKind.Web);
  });

  describe('asExternalUrl', () => {
    const oldWindowLocationHostname = window.location.hostname;
    const oldWindowLocationHref = window.location.href;
    const ideHostName = 'ide.aliababa.com';
    const ideUrl = `https://${ideHostName}/workspace?id=1`;
    beforeAll(() => {
      Object.defineProperty(window, 'location', {
        value: {
          href: ideUrl,
          hostname: ideHostName,
        },
      });
    });

    afterAll(() => {
      Object.defineProperty(window, 'location', {
        value: {
          href: oldWindowLocationHref,
          hostname: oldWindowLocationHostname,
        },
      });
    });

    it('asExternalUri localhost uri', async () => {
      const uri = Uri.parse('http://localhost:8080?userId=1');
      const externalUri = await env.asExternalUri(uri);
      expect(externalUri.scheme).toBe('https');
      expect(externalUri.authority).toBe('ide.aliababa.com:8080');
      expect(externalUri.path.toString()).toBe('/');
      expect(externalUri.query).toBe('userId=1');
      expect(externalUri.toString(true)).toBe('https://ide.aliababa.com:8080/?userId=1');
    });

    it('asExternalUri remote uri', async () => {
      const uri = Uri.parse('https://opensumi.com/workspaces/5fb21cc29b67dcd76a27272f');
      const externalUri = await env.asExternalUri(uri);
      expect(externalUri.scheme).toBe('https');
      expect(externalUri.authority).toBe('opensumi.com');
      expect(externalUri.path.toString()).toBe('/workspaces/5fb21cc29b67dcd76a27272f');
      expect(externalUri.toString(true)).toBe('https://opensumi.com/workspaces/5fb21cc29b67dcd76a27272f');
    });

    it('asExternalUri appUriScheme', async () => {
      const uri = Uri.parse(`${env.uriScheme}://my.extension/did-authenticate?userId=1`);
      const externalUri = await env.asExternalUri(uri);
      expect(externalUri.scheme).toBe(env.uriScheme);
      expect(externalUri.authority).toBe('my.extension');
      expect(externalUri.path.toString()).toBe('/did-authenticate');
      const query = new URLSearchParams(externalUri.query);
      expect(query.get('userId')).toBe('1');
      expect(query.get('windowId')).toBeTruthy();
    });
  });

  describe('isNewAppInstall', () => {
    const getExtHost = (date) =>
      mockService({
        getEnvValues() {
          return {
            firstSessionDate: date,
          };
        },
      });

    it('用户首次访问时间大于一天', async () => {
      const envApi = createEnvApiFactory(
        rpcProtocolExt,
        extensionService,
        getExtHost(new Date(new Date().getTime() - 25 * 60 * 60 * 1000).toUTCString()),
        extHostTerminal,
      );

      expect(envApi.isNewAppInstall).toBe(false);
    });

    it('用户首次访问时间小于一天', () => {
      const envApi = createEnvApiFactory(
        rpcProtocolExt,
        extensionService,
        getExtHost(new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toUTCString()),
        extHostTerminal,
      );

      expect(envApi.isNewAppInstall).toBe(true);
    });
  });
});
