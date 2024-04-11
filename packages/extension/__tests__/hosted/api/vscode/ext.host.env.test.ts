import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { Uri, uuid } from '@opensumi/ide-core-common';
import { MainThreadEnv } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.env';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { UIKind } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { createEnvApiFactory } from '@opensumi/ide-extension/lib/hosted/api/vscode/env/envApiFactory';
import { ExtHostEnv } from '@opensumi/ide-extension/lib/hosted/api/vscode/env/ext.host.env';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { createMockPairRPCProtocol } from '../../../../__mocks__/initRPCProtocol';

import type vscode from 'vscode';

const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();

let extHost: ExtHostEnv;
let mainThread: MainThreadEnv;

describe('vscode extHostEnv Test', () => {
  const injector = createBrowserInjector([]);
  injector.addProviders({
    token: WSChannelHandler,
    useValue: mockService({
      clientId: uuid(),
    }),
  });
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
    expect(() => ((env as any).language = '234')).toThrow();
    expect(() => ((env as any).appRoot = '234')).toThrow();
    expect(() => ((env as any).appName = '234')).toThrow();
    expect(() => ((env as any).machineId = '234')).toThrow();
    expect(() => ((env as any).sessionId = '234')).toThrow();
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

    it("The user's first visit is more than a day old", async () => {
      const envApi = createEnvApiFactory(
        rpcProtocolExt,
        extensionService,
        getExtHost(new Date(new Date().getTime() - 25 * 60 * 60 * 1000).toUTCString()),
        extHostTerminal,
      );

      expect(envApi.isNewAppInstall).toBe(false);
    });

    it("The user's first visit is less than a day old", () => {
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
