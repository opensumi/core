/**
 * Terminal Client Test
 */
import * as WebSocket from 'ws';
import * as httpProxy from 'http-proxy';
import * as os from 'os';
import { createProxyServer, createWsServer } from './proxy';
import {
  defaultName,
  defaultPid,
} from './mock.service';
import { ITerminalClientFactory, ITerminalGroupViewService, ITerminalClient, IWidget } from '../../src/common';
import { delay } from './utils';
import { injector } from './inject';

function createDOMContainer() {
  const div = document.createElement('div');
  div.style.width = '400px';
  div.style.height = '400px';
  document.body.appendChild(div);
  return div;
}

describe('Terminal Client', () => {
  let client: ITerminalClient;
  let widget: IWidget;
  let proxy: httpProxy;
  let server: WebSocket.Server;
  let view: ITerminalGroupViewService;
  let factory: ITerminalClientFactory;

  beforeAll(() => {
    factory = injector.get(ITerminalClientFactory);
    view = injector.get(ITerminalGroupViewService);
    server = createWsServer();
    proxy = createProxyServer();
  });

  it('Not Ready To Show it', async () => {
    const index = view.createGroup();
    const group = view.getGroup(index);
    widget = view.createWidget(group);
    client = factory(widget, {}, false);
    expect(client.ready).toBeFalsy();
  });

  it('Focus Terminal which is not ready', () => {
    try {
      client.focus();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('Render Terminal', async () => {
    widget.element = createDOMContainer();
    await client.attached.promise;
    expect(client.ready).toBeTruthy();
  });

  it('Terminal Pid And Name', () => {
    expect(client.name).toEqual(defaultName);
    expect(client.pid).toEqual(defaultPid);
  });

  it('Focus Terminal which is ready', async () => {
    client.focus();
  });

  it('Terminal SelectAll', () => {
    client.selectAll();
    const position = client.term.getSelectionPosition();
    expect(position && position.endColumn)
      .toEqual(client.term.cols);
  });

  it('Terminal Send Text', async () => {
    client.clear();
    client.sendText('pwd\r');
    await delay(200);

    const line = client.term.buffer.active.getLine(1);
    const lineText = (line && line.translateToString()) || '';

    expect(lineText.trim().length).toBeGreaterThan(0);
  });

  it('Terminal Find Next', async () => {
    const searched = (os.platform() === 'linux') ? 'root' : 'User';
    client.findNext(searched);
    expect(client.term.getSelection()).toEqual(searched);
  });

  it('Terminal Dispose', async () => {
    client.dispose();

    expect(client.disposed).toBeTruthy();
    expect(client.container.children.length).toBe(0);
  });

  it('After Terminal Dispose', async () => {
    await client.attach();
    await client.sendText('pwd\r');
    client.focus();
    client.selectAll();
    client.updateTheme();
    client.clear();
  });

  afterAll(() => {
    server.close();
    proxy.close();
    client.dispose();
  });
});
