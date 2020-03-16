/**
 * Terminal Controller Test
 */
import * as WebSocket from 'ws';
import * as httpProxy from 'http-proxy';
import { Terminal } from 'xterm';
import { createProxyServer, createWsServer } from './proxy';
import { TerminalController } from '../../src/browser/terminal.controller';
import { createTerminalController } from './controller.inject';
import { existPtyProcessId } from './proxy';
import { TerminalClient } from '../../src/browser/terminal.client';

describe('Terminal Controller', () => {
  let proxy: httpProxy;
  let server: WebSocket.Server;
  let controller: TerminalController;

  beforeAll(() => {
    server = createWsServer();
    proxy = createProxyServer();
    controller = createTerminalController();
  });

  it('Controller Initialize', () => {
    controller.firstInitialize();
  });

  it('Controller Recovery Terminals', async () => {
    const res = await controller.recovery({
      groups: [[{ clientId: existPtyProcessId }]],
      current: existPtyProcessId,
    });
    expect(res).toBeUndefined();
  });

  it('Controller Add Widget', () => {
    controller.groups = [];
    controller.createGroup(true);
    const widgetId = controller.addWidget();
    controller.focusWidget(widgetId);
    const client: TerminalClient = controller.getCurrentClient();

    expect(client).toBeInstanceOf(TerminalClient);
    expect(client.term).toBeInstanceOf(Terminal);
  });

  it('Controller Delete Widget', () => {
    controller.removeFocused();
    const last: TerminalClient = controller.getCurrentClient();
    expect(last).toBeUndefined();
    expect(controller.groups.length).toEqual(0);
  });

  it('Controller Clear Client', () => {
    controller.createGroup(true);
    const widgetId = controller.addWidget();
    controller.focusWidget(widgetId);
    controller.clearCurrentWidget();
    controller.clearAllGroups();
  });

  it('Controller Search Input Operations', () => {
    controller.openSearchInput();
    expect(controller.searchState.show).toBeTruthy();
    controller.searchState.input = 'test input';
    controller.search();
    controller.clearSearchInput();
    expect(controller.searchState.input).toEqual('');
    controller.closeSearchInput();
    expect(controller.searchState.show).toBeFalsy();
  });

  it('Controller Group Operations', () => {
    expect(controller.groups.length).toEqual(1);

    const oldClient: TerminalClient = controller.getCurrentClient();

    controller.createGroup(true);
    const widgetId = controller.addWidget();
    controller.focusWidget(widgetId);

    expect(controller.groups.length).toEqual(2);

    const newClient: TerminalClient = controller.getCurrentClient();

    expect(newClient.id).not.toEqual(oldClient.id);
    expect(controller.state.index).toEqual(1);

    controller.selectGroup(0);
    controller.focusWidget(oldClient.widget.id);

    expect(controller.getCurrentClient().id).toEqual(oldClient.id);
    expect(controller.state.index).toEqual(0);

    controller.removeAllGroups();

    expect(controller.groups.length).toEqual(0);
  });

  it('Container search while no group', () => {
    try {
      controller.search();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  afterAll(() => {
    server.close();
    proxy.close();
    controller.dispose();
  });
});
