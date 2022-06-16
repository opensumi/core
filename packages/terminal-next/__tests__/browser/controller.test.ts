/**
 * Terminal Controller Test
 */
import WebSocket from 'ws';

import { Uri } from '@opensumi/ide-core-common';

import { ITerminalController, TerminalOptions } from '../../src/common';

import { injector } from './inject';
import { createProxyServer, createWsServer, resetPort } from './proxy';

describe('Terminal Controller', () => {
  let controller: ITerminalController;
  let proxy;
  let ws: WebSocket.Server;

  beforeAll(() => {
    // FIXME: happy test
    resetPort();
    ws = createWsServer();
    proxy = createProxyServer();
    controller = injector.get(ITerminalController);
    controller.initContextKey(document.createElement('div'));
  });

  afterAll(() => {
    controller.dispose();
    // 不知道为啥 ws.close 就会报错，看其他的 test 没有这个问题
    // 先注释掉
    // ws.close();
    proxy.close();
  });

  it('Recovery', async () => {
    await controller.recovery({ groups: [[]], current: undefined });
  });

  it('Controller Initialize', async () => {
    controller.firstInitialize();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  it('create terminal', async () => {
    await controller.createTerminal({
      config: {
        profileName: 'bash',
        path: 'bash',
        isDefault: false,
      },
    });
  });

  it('can transform terminal options', async () => {
    const terminalOptions = {
      name: 'name',
      shellPath: 'shellPath',
      shellArgs: ['123'],
      cwd: 'cwd',
      env: {
        asd: 'asd',
      },
      iconPath: Uri.file('iconPath'),
      color: { id: '#fff' },
      strictEnv: true,
      hideFromUser: true,
      isExtensionTerminal: true,
      isTransient: true,
    } as TerminalOptions;

    const launchConfig = controller.convertTerminalOptionsToLaunchConfig(terminalOptions);
    expect(launchConfig.name).toEqual(terminalOptions.name);
    expect(launchConfig.executable).toEqual(terminalOptions.shellPath);
    expect(launchConfig.args).toEqual(terminalOptions.shellArgs);
    expect(launchConfig.cwd).toEqual(terminalOptions.cwd);
    expect(launchConfig.env).toEqual(terminalOptions.env);
    expect(launchConfig.icon).toEqual(terminalOptions.iconPath);
    expect(launchConfig.color).toEqual((terminalOptions.color as any).id);
    expect(launchConfig.initialText).toEqual(terminalOptions.message);
    expect(launchConfig.strictEnv).toEqual(terminalOptions.strictEnv);
    expect(launchConfig.hideFromUser).toEqual(terminalOptions.hideFromUser);
    expect(launchConfig.isExtensionOwnedTerminal).toEqual(terminalOptions.isExtensionTerminal);
    expect(launchConfig.disablePersistence).toEqual(terminalOptions.isTransient);
  });
});
