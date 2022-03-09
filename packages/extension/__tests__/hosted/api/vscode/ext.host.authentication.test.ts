import type vscode from 'vscode';

import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import { IMenuRegistry, MenuId, IMenuItem } from '@opensumi/ide-core-browser/src/menu/next';
import {
  Emitter,
  ILoggerManagerClient,
  StorageProvider,
  IAuthenticationService,
  CommandRegistry,
} from '@opensumi/ide-core-common';
import { ActivationEventServiceImpl } from '@opensumi/ide-extension/lib/browser/activation.service';
import { IActivationEventService } from '@opensumi/ide-extension/lib/browser/types';
import { MainThreadAuthentication } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.authentication';
import {
  MainThreadAPIIdentifier,
  IMainThreadAuthentication,
  ExtHostAPIIdentifier,
} from '@opensumi/ide-extension/lib/common/vscode';
import {
  ExtHostAuthentication,
  createAuthenticationApiFactory,
} from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.authentication';
import { IMessageService } from '@opensumi/ide-overlay';
import { QuickPickService } from '@opensumi/ide-quick-open';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MockLoggerManagerClient } from '../../../../__mocks__/loggermanager';

describe('extension/__tests__/hosted/api/vscode/ext.host.authentication.test.ts', () => {
  let injector: Injector;
  let authenticationAPI: typeof vscode.authentication;
  let extHostAuthentication: ExtHostAuthentication;
  let mainThreadAuthentication: IMainThreadAuthentication;
  let authenticationService: IAuthenticationService;
  const extensionId = 'vscode.vim';
  const emitterExt = new Emitter<any>();
  const emitterMain = new Emitter<any>();
  let authenticationProvider: vscode.AuthenticationProvider;

  const mockClientExt = {
    send: (msg) => emitterMain.fire(msg),
    onMessage: emitterExt.event,
  };
  const mockClientMain = {
    send: (msg) => emitterExt.fire(msg),
    onMessage: emitterMain.event,
  };
  const rpcProtocolExt = new RPCProtocol(mockClientExt);
  const rpcProtocolMain = new RPCProtocol(mockClientMain);

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IActivationEventService,
        useClass: ActivationEventServiceImpl,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManagerClient,
      },
      {
        token: IMessageService,
        useValue: mockService({}),
      },
      {
        token: QuickPickService,
        useValue: mockService({}),
      },
    );
    injector.overrideProviders({
      token: StorageProvider,
      useValue: MockedStorageProvider,
    });
    const extension = mockService({
      id: extensionId,
      identifier: extensionId,
      extensionId,
      name: 'vim',
      displayName: 'Vim',
      isBuiltin: false,
    });
    extHostAuthentication = rpcProtocolMain.set(
      ExtHostAPIIdentifier.ExtHostAuthentication,
      new ExtHostAuthentication(rpcProtocolMain),
    ) as ExtHostAuthentication;
    mainThreadAuthentication = rpcProtocolExt.set(
      MainThreadAPIIdentifier.MainThreadAuthentication,
      injector.get(MainThreadAuthentication, [rpcProtocolExt]),
    );
    authenticationAPI = createAuthenticationApiFactory(extension, extHostAuthentication);
    const sessions: vscode.AuthenticationSession[] = [];
    const onDidChangeSessions = new Emitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    let id = 1;
    authenticationProvider = {
      onDidChangeSessions: onDidChangeSessions.event,
      getSessions: async () => sessions,
      createSession: async (scopeList) => {
        const session = {
          id: id++ + '',
          accessToken: 'this_is_github_token',
          account: { label: '蛋总', id: 'xinglong.wangwxl' },
          scopes: scopeList,
        };
        const sessionIndex = sessions.findIndex((s) => s.id === session.id);
        if (sessionIndex > -1) {
          sessions.splice(sessionIndex, 1, session);
        } else {
          sessions.push(session);
        }
        onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
        return session;
      },
      removeSession: async (id) => {
        const sessionIndex = sessions.findIndex((session) => session.id === id);
        if (sessionIndex > -1) {
          const session = sessions[sessionIndex];
          sessions.splice(sessionIndex, 1);
          onDidChangeSessions.fire({ added: [], removed: [session], changed: [] });
        }
      },
    };
    // 初始化一个 provider
    authenticationAPI.registerAuthenticationProvider('github', 'GitHub', authenticationProvider);
    authenticationService = injector.get(IAuthenticationService);
    await authenticationService.initialize();
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('get session by default option', async () => {
    const $ensureProvider = jest.spyOn(mainThreadAuthentication, '$ensureProvider');
    const $getSession = jest.spyOn(mainThreadAuthentication, '$getSession');
    const $requestNewSession = jest.spyOn(mainThreadAuthentication, '$requestNewSession');
    const session = await authenticationAPI.getSession('github', ['getRepo']);
    expect($ensureProvider).toBeCalledWith('github');
    expect($getSession).toBeCalledWith('github', ['getRepo'], 'vscode.vim', 'Vim', {});
    expect($requestNewSession).toBeCalled();
    const commandRegistry: CommandRegistry = injector.get(CommandRegistry);
    const menuRegistry: IMenuRegistry = injector.get(IMenuRegistry);
    const signInCommandId = `${extensionId}signIn`;
    // 默认会注册一个请求登录的命令
    expect(commandRegistry.getCommand(signInCommandId)).toBeTruthy();
    // 也会注册一个菜单
    expect(
      menuRegistry.getMenuItems(MenuId.AccountsContext).some((menu: IMenuItem) => menu.command === signInCommandId),
    ).toBeTruthy();
    // 这时候获取的是 undefined
    expect(session).toBeUndefined();
  });

  it('get session with createIfNone', async () => {
    const loginSpy = jest.spyOn(authenticationProvider, 'createSession');
    const $ensureProvider = jest.spyOn(mainThreadAuthentication, '$ensureProvider');
    const $getSession = jest.spyOn(mainThreadAuthentication, '$getSession');
    // 默认点击允许
    const $loginPrompt = jest.spyOn(mainThreadAuthentication, '$loginPrompt').mockReturnValue(Promise.resolve(true));
    const session = await authenticationAPI.getSession('github', ['getRepo'], {
      createIfNone: true,
    });
    expect(loginSpy).toBeCalledWith(['getRepo']);
    expect($ensureProvider).toBeCalledWith('github');
    expect($getSession).toBeCalledWith('github', ['getRepo'], 'vscode.vim', 'Vim', { createIfNone: true });
    expect($loginPrompt).toBeCalled();
    expect(session).toStrictEqual({
      id: '1',
      accessToken: 'this_is_github_token',
      account: { label: '蛋总', id: 'xinglong.wangwxl' },
      scopes: ['getRepo'],
    });
  });

  it('get session with clearSessionPreference', async () => {
    const session = {
      id: 'test',
      accessToken: 'this_is_gitlab_token',
      account: { label: '蛋总', id: 'xinglong.wangwxl' },
      scopes: ['getRepo'],
    };
    // mock
    jest.spyOn(authenticationProvider, 'getSessions').mockReturnValue(Promise.resolve([session]));
    const $selectSession = jest.spyOn(mainThreadAuthentication, '$selectSession');
    const authenticationService: IAuthenticationService = injector.get(IAuthenticationService);
    const removeExtensionSessionId = jest.spyOn(authenticationService, 'removeExtensionSessionId');
    jest.spyOn(authenticationService, 'supportsMultipleAccounts').mockReturnValue(true);
    const quickPickService: QuickPickService = injector.get(QuickPickService);
    jest.spyOn(quickPickService, 'show').mockReturnValue(Promise.resolve(session));
    await authenticationAPI.getSession('github', ['getRepo'], {
      clearSessionPreference: true,
    });
    expect($selectSession).toBeCalled();
    // 会清空 session
    expect(removeExtensionSessionId).toBeCalled();
  });

  it('logout', async () => {
    // 默认点击允许
    const logoutSpy = jest.spyOn(authenticationProvider, 'removeSession');
    const $logout = jest.spyOn(mainThreadAuthentication, '$logout');
    const $loginPrompt = jest.spyOn(mainThreadAuthentication, '$loginPrompt').mockReturnValue(Promise.resolve(true));
    const session = await authenticationAPI.getSession('github', ['getRepo'], {
      createIfNone: true,
    });
    expect($loginPrompt).toBeCalled();
    await authenticationAPI.logout('github', session.id);
    expect(logoutSpy).toBeCalled();
    expect($logout).toBeCalledWith('github', session.id);
  });

  it('onDidChangeSessions', (done) => {
    // 默认点击允许
    jest.spyOn(mainThreadAuthentication, '$loginPrompt').mockReturnValue(Promise.resolve(true));
    authenticationAPI.onDidChangeSessions((e) => {
      expect(e.provider.id).toBe('github');
      expect(e.provider.label).toBe('GitHub');
      done();
    });
    authenticationAPI.getSession('github', ['getRepo'], {
      createIfNone: true,
    });
  });

  it('onDidChangeAuthenticationProviders', (done) => {
    authenticationAPI.onDidChangeAuthenticationProviders((e) => {
      expect(e.added[0].id).toBe('github');
      expect(e.added[0].label).toBe('GitHub');
      done();
    });
    const onDidChangeSessions = new Emitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    authenticationAPI.registerAuthenticationProvider('gitlab', 'Github', {
      onDidChangeSessions: onDidChangeSessions.event,
      getSessions: async () => [],
      createSession: async (scopeList) => {
        const session = {
          id: 'test',
          accessToken: 'this_is_gitlab_token',
          account: { label: '蛋总', id: 'xinglong.wangwxl' },
          scopes: scopeList,
        };
        return session;
      },
      removeSession: async () => {},
    });
  });
});
