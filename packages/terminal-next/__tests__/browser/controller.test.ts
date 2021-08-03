/**
 * Terminal Controller Test
 */
// import * as WebSocket from 'ws';
// import * as httpProxy from 'http-proxy';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { ITerminalController } from '../../src/common';
import { injector } from './inject';
import { enableJSDOM } from '@ali/ide-core-browser/lib/mocks/jsdom';

describe('Terminal Controller', () => {
  let controller: ITerminalController;
  let disableJSDOM;
  let server;
  let proxy;

  beforeAll(() => {
    disableJSDOM = enableJSDOM();
    resetPort();
    server = createWsServer();
    proxy = createProxyServer();
    controller = injector.get(ITerminalController);
    controller.initContextKey(document.createElement('div'));
  });

  afterAll(() => {
    server.close();
    proxy.close();
    disableJSDOM();
  });

  it('Recovery', () => {
    controller.recovery({ groups: [[]], current: undefined });
  });

  it('Controller Initialize', () => {
    controller.firstInitialize();
  });
});
