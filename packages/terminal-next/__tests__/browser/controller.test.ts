/**
 * Terminal Controller Test
 */
// import * as WebSocket from 'ws';
// import * as httpProxy from 'http-proxy';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { ITerminalController } from '../../src/common';
import { injector } from './inject';

describe('Terminal Controller', () => {
  let controller: ITerminalController;
  let server;
  let proxy;
  beforeAll(() => {
    resetPort();
    server = createWsServer();
    proxy = createProxyServer();
    controller = injector.get(ITerminalController);
  });

  it('Recovery', () => {
    controller.recovery({ groups: [[]], current: undefined });
  });

  it('Controller Initialize', () => {
    controller.firstInitialize();
  });

  afterAll(() => {
    server.close();
    proxy.close();
  });
});
