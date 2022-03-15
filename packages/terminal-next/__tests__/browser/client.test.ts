/**
 * Terminal Client Test
 */
import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';
import httpProxy from 'http-proxy';
import WebSocket from 'ws';

import { Disposable, FileUri, URI } from '@opensumi/ide-core-common';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { ITerminalClientFactory2, ITerminalGroupViewService, ITerminalClient, IWidget } from '../../src/common';

import { injector } from './inject';
import { defaultName } from './mock.service';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import { delay } from './utils';

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
  let factory: ITerminalClientFactory2;
  let workspaceService: IWorkspaceService;
  let root: URI | null;

  beforeAll(async () => {
    root = FileUri.create(path.join(os.tmpdir(), 'terminal-client-test'));

    await fs.ensureDir(root.path.toString());

    workspaceService = injector.get(IWorkspaceService);

    injector.addProviders({
      token: EnvironmentVariableServiceToken,
      useValue: {
        mergedCollection: undefined,
        onDidChangeCollections: () => Disposable.NULL,
      },
    });

    await workspaceService.setWorkspace({
      uri: root.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    });
    resetPort();
    factory = injector.get(ITerminalClientFactory2);
    view = injector.get(ITerminalGroupViewService);
    server = createWsServer();
    proxy = createProxyServer();
    const index = view.createGroup();
    const group = view.getGroup(index);
    widget = view.createWidget(group);
    // clientHeight === 0 时会跳过视图渲染，这里强行修改一下 clientHeight 用于测试
    widget.element = new Proxy(createDOMContainer(), {
      get(target, prop) {
        if (prop === 'clientHeight') {
          return 400;
        }
        return target[prop];
      },
    });
    client = await factory(widget, {});
    client.addDispose(
      Disposable.create(async () => {
        if (root) {
          try {
            await fs.remove(root.path.toString());
          } catch (e) {}
        }
      }),
    );
    await client.attached.promise;
    (client.term as any)._core._renderService.dimensions.actualCellWidth = 12;
    (client.term as any)._core._renderService.dimensions.actualCellHeight = 12;
  });

  afterAll(() => {
    client.dispose();
    server.close();
    proxy.close();
    injector.disposeAll();
  });

  it('Render Terminal', () => {
    expect(client.ready).toBeTruthy();
  });

  it('Terminal Pid And Name', () => {
    expect(client.name).toEqual(defaultName);
  });

  it('Focus Terminal which is ready', async () => {
    client.focus();
  });

  it('Terminal SelectAll', () => {
    client.selectAll();
    const position = client.term.getSelectionPosition();
    expect(position && position.endColumn).toEqual(client.term.cols);
  });

  it.skip('Terminal getSelection', async () => {
    await client.sendText('pwd\r');
    await delay(500);
    client.selectAll();
    const selection = client.getSelection();
    expect(selection.includes('pwd')).toBeTruthy();
  });

  it.skip('Terminal Send Text', async () => {
    client.clear();
    await client.sendText('pwd\r');
    await delay(500);

    const line = client.term.buffer.active.getLine(0);
    const lineText = (line && line.translateToString()) || '';
    expect(lineText.trim().length).toBeGreaterThan(0);
  });

  it.skip('Terminal Find Next', async () => {
    const searched = 'pwd';
    client.findNext(searched);
    expect(client.term.getSelection()).toEqual(searched);
  });

  it.skip('Terminal Dispose', (done) => {
    client.onExit((e) => {
      expect(e.code).toBe(-1);
      expect(e.id).toBe(client.id);
      done();
    });
    client['_attachAddon']._onExit.fire(-1);
    client.dispose();

    expect(client.disposed).toBeTruthy();
    expect(client.container.children.length).toBe(0);
  });

  it.skip('After Terminal Dispose', async () => {
    client.sendText('pwd\r');
    client.focus();
    client.selectAll();
    client.updateTheme();
    client.clear();
  });
});
