import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';
import httpProxy from 'http-proxy';
import WebSocket from 'ws';

import { Disposable, Event, FileUri, URI } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  IShellLaunchConfig,
  ITerminalClient,
  ITerminalClientFactory2,
  ITerminalGroupViewService,
  ITerminalInternalService,
  IWidget,
} from '../../src/common';

import { injector } from './inject';
import { createProxyServer, createWsServer } from './proxy';
import { createBufferLineArray, delay } from './utils';

import type { ITerminalAddon } from '@xterm/xterm';

function createDOMContainer() {
  const div = document.createElement('div');
  div.style.width = '400px';
  div.style.height = '400px';
  document.body.appendChild(div);
  return div;
}

class MockXTermAddonWebgl {
  WebglAddon() {
    return {
      activate: () => {},
      onContextLoss: Event.None,
      dispose: () => {},
    };
  }
}

jest.mock('@xterm/xterm', () => {
  const Terminal = class MockXTerminal {
    private _text = '';
    public options = {};
    get cols() {
      return 0;
    }
    get onLineFeed() {
      return Event.None;
    }
    get onResize() {
      return Event.None;
    }
    get onCursorMove() {
      return Event.None;
    }
    get onBinary() {
      return Event.None;
    }
    get onData() {
      return Event.None;
    }
    get onWriteParsed() {
      return Event.None;
    }
    getSelection() {
      // Mock for test
      return 'pwd';
    }
    get buffer() {
      return {
        active: {
          getLine: (index: number) =>
            createBufferLineArray(this._text.split('\n').map((text: string) => ({ text, width: text.length })))[index],
        },
      };
    }
    onSelectionChange() {}
    clearSelection() {}
    focus() {}
    write(text: string) {
      this._text = text;
    }
    clear() {
      this._text = '';
    }
    selectAll() {}
    dispose() {}
    loadAddon(addon: ITerminalAddon) {
      addon.activate(this as any);
    }
    hasSelection() {
      return true;
    }
    getSelectionPosition() {
      return {
        start: {
          x: 0,
          y: 0,
        },
        end: {
          x: this._text.length,
          y: 0,
        },
      };
    }
    registerLinkProvider() {
      return Disposable.create(() => {});
    }
  };
  return {
    ...jest.requireActual('@xterm/xterm'),
    Terminal,
  };
});
jest.mock('@xterm/addon-webgl', () => MockXTermAddonWebgl);

describe('Terminal Client', () => {
  let client: ITerminalClient;
  let widget: IWidget;
  let proxy: httpProxy;
  let server: WebSocket.Server;
  let view: ITerminalGroupViewService;
  let factory2: ITerminalClientFactory2;
  let workspaceService: IWorkspaceService;
  let root: URI | null;

  beforeAll(async () => {
    root = FileUri.create(path.join(os.tmpdir(), 'terminal-client-test'));

    await fs.ensureDir(root.path.toString());

    workspaceService = injector.get(IWorkspaceService);

    await workspaceService.setWorkspace({
      uri: root.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    });
    server = createWsServer();
    proxy = createProxyServer();
    factory2 = injector.get(ITerminalClientFactory2);
    view = injector.get(ITerminalGroupViewService);
    const index = view.createGroup();
    const group = view.getGroup(index);
    widget = view.createWidget(group);
    // clientHeight === 0 时会跳过视图渲染，这里强行修改一下 clientHeight 用于测试
    widget.element = new Proxy(createDOMContainer(), {
      get(target, prop, _receiver) {
        if (prop === 'clientHeight') {
          return 400;
        }
        return target[prop];
      },
    });
    client = await factory2(widget, {});
    client.addDispose(
      Disposable.create(async () => {
        if (root) {
          await fs.remove(root.path.toString());
        }
      }),
    );
    await client.attached.promise;
  });

  afterAll(async () => {
    await client.dispose();
    await server.close();
    await proxy.close();
    await injector.disposeAll();
  });

  it('Render Terminal', () => {
    expect(client.ready).toBeTruthy();
  });

  it('Terminal Pid And Name', () => {
    expect(client.name).toEqual('bash');
    expect(client.id).toEqual(widget.id);
  });

  it('Focus Terminal which is ready', async () => {
    client.focus();
  });

  it('Terminal SelectAll', () => {
    client.selectAll();
    const position = client.term.getSelectionPosition();
    expect(position && position.end.x).toEqual(client.term.cols);
  });

  it('Terminal getSelection', async () => {
    await client.attached.promise;
    await client.sendText('pwd\n');
    await delay(500);
    client.selectAll();
    const selection = client.getSelection();
    expect(selection.includes('pwd')).toBeTruthy();
  });

  it('Terminal Send Text', async () => {
    await client.attached.promise;
    client.clear();
    await client.sendText('pwd\n');
    await delay(500);

    const line = client.term.buffer.active.getLine(0);
    const lineText = (line && line.translateToString()) || '';
    expect(lineText.trim().length).toBeGreaterThan(0);
  });

  it('Terminal Find Next', async () => {
    const searched = 'pwd';
    client.findNext(searched);
    expect(client.term.getSelection()).toEqual(searched);
  });

  it('Terminal Dispose', (done) => {
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

  it('After Terminal Dispose', async () => {
    await client.attached.promise;
    client.sendText('pwd\n');
    client.focus();
    client.selectAll();
    client.updateTheme();
    client.clear();
  });

  it('should use isExtensionOwnedTerminal to determine the terminal process', async () => {
    let launchConfig1: IShellLaunchConfig | undefined;
    injector.mock(
      ITerminalInternalService,
      'attachByLaunchConfig',
      (sessionId: string, cols: number, rows: number, launchConfig: IShellLaunchConfig) => {
        launchConfig1 = launchConfig;
      },
    );
    const factory2 = injector.get(ITerminalClientFactory2) as ITerminalClientFactory2;
    await factory2(widget, {
      config: {
        isExtensionOwnedTerminal: true,
      },
    });
    expect(launchConfig1).toBeDefined();
    expect(launchConfig1?.customPtyImplementation).toBeDefined();
  });
});
