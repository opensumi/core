/**
 * Terminal Controller Test
 */
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { ITerminalController } from '../../src/common';
import { injector } from './inject';
import WebSocket from 'ws';

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
    proxy.close();
    ws.close((err) => {
      console.log(err);
    });
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
