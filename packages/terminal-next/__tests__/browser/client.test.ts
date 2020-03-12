/**
 * Terminal Client Test
 */
import * as WebSocket from 'ws';
import * as httpProxy from 'http-proxy';
import { createProxyServer, createWsServer } from './proxy';
import {
  defaultName,
  defaultPid,
} from './mock.service';
import { TerminalClient } from '../../src/browser/terminal.client';
import { delay } from './utils';
import { createClient } from './controller.inject';

describe('Terminal Client', () => {
  let client: TerminalClient;
  let proxy: httpProxy;
  let server: WebSocket.Server;

  beforeAll(() => {
    server = createWsServer();
    proxy = createProxyServer();
    client = createClient();
  });

  it('Not Ready To Show it', () => {
    expect(client.notReadyToShow).toBeTruthy();
  });

  it('Apply DOM Node', () => {
    const div = document.getElementById('main') as HTMLDivElement;
    if (div) {
      client.applyDomNode(div);
    }
  });

  it('Focus Terminal which is not activated', () => {
    const res = client.focus();
    expect(res).toBeInstanceOf(Promise);
    // expect((client as any).focusPromiseResolve).toBeInstanceOf(Function);
  });

  it('Show Terminal which is not attched', () => {
    const res = client.show();
    expect(res).toBeInstanceOf(Promise);
    expect(client.activated).toBeFalsy();
    expect((client as any).showPromiseResolve).toBeInstanceOf(Function);
  });

  it('Attach Terminal', async () => {
    await client.attach();

    expect(client.attached).toBeTruthy();
    expect((client as any).attachPromise).toBeNull();

    // 等待终端返回
    await delay(500);

    client.clear();

    const line = client.term.buffer.getLine(0);
    const lineText = (line && line.translateToString()) || '';

    expect(lineText.trim().length).toBeGreaterThan(0);
  });

  it('Terminal Pid And Name', () => {
    expect(client.name).toEqual(defaultName);
    expect(client.pid).toEqual(defaultPid);
  });

  it('Show Terminal which is attached', async () => {
    const res = await client.show();
    expect(res).toBeUndefined();
    expect(client.activated).toBeTruthy();
    expect((client as any).showPromiseResolve).toBeNull();
  });

  it('Ready To Show it', async () => {
    client.layout();
    // JSDDOM 的 mock dom 的宽高一直为 0，所以这里无法完全测试渲染状态
    // await delay(1000);
    // expect(client.notReadyToShow).toBeFalsy();
  });

  it('Focus Terminal which is activated', async () => {
    const res = await client.focus();
    expect(res).toBeUndefined();
    // expect((client as any).focusPromiseResolve).toBeNull();
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
    await delay(500);

    const line = client.term.buffer.getLine(1);
    const lineText = (line && line.translateToString()) || '';

    expect(lineText.trim().length).toBeGreaterThan(0);
  });

  it('Terminal Find Next', async () => {
    const searched = '/User';
    client.findNext('/User');
    expect(client.term.getSelection()).toEqual(searched);
  });

  it('Terminal Dispose', async () => {
    client.dispose();

    expect(client.disposed).toBeTruthy();
    expect(client.container.children.length).toBe(0);
  });

  it('After Terminal Dispose', async () => {
    await client.attach();
    await client.show();
    await client.focus();
    await client.sendText('pwd\r');
    client.hide();
    client.layout();
  });

  afterAll(() => {
    server.close();
    proxy.close();
    client.dispose();
  });
});
