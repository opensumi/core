/**
 * Terminal Controller Test
 */
// import WebSocket from 'ws';
// import httpProxy from 'http-proxy';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { ITerminalController } from '../../src/common';
import { injector } from './inject';

describe('Terminal Controller', () => {
  let controller: ITerminalController;
  let proxy;

  beforeAll(() => {
    // FIXME: happy test
    resetPort();
    createWsServer();
    proxy = createProxyServer();
    controller = injector.get(ITerminalController);
    controller.initContextKey(document.createElement('div'));
  });

  afterAll(() => {
    proxy.close();
  });

  it('Recovery', () => {
    controller.recovery({ groups: [[]], current: undefined });
  });

  it('Controller Initialize', () => {
    controller.firstInitialize();
  });
});
