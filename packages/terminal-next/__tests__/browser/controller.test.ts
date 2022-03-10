/**
 * Terminal Controller Test
 */
import WebSocket from 'ws';

import { ITerminalController } from '../../src/common';

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
});
