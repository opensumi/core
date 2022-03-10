// eslint-disable-next-line import/order
import { mockElectronRenderer } from '@opensumi/ide-core-common/lib/mocks/electron/browserMock';

mockElectronRenderer();
import { MockedElectronIpcRenderer } from '@opensumi/ide-core-common/lib/mocks/electron/ipcRenderer';

import { ElectronWebviewChannel } from '../../src/electron-webview/host-channel';
import { WebIframeChannel } from '../../src/webview-host/web-preload';
import { WebviewPanelManager } from '../../src/webview-host/webview-manager';

const { JSDOM } = require('jsdom');

describe('electron webview test', () => {
  const ipcRenderer = require('electron').ipcRenderer as MockedElectronIpcRenderer;
  const manager = new WebviewPanelManager(new ElectronWebviewChannel());
  (global as any).DOMParser = class DOMParser {
    parseFromString(text, type) {
      const jsdom = new JSDOM(text);
      return jsdom.window.document;
    }
  };

  it.skip('electron webview test', async (done) => {
    (manager as any).init();
    const styles = { test: 'red' };
    await ipcRenderer.emit('styles', {}, { styles });
    expect((manager as any).styles).toBe(styles);
    await ipcRenderer.emit('focus', {}, {});
    await ipcRenderer.emit('content', {}, { options: { allowScripts: true }, content: 'htmldata' });
    done();
  });
});

describe('web iframe webview test', () => {
  const manager = new WebviewPanelManager(new WebIframeChannel());

  it.skip('iframe webview test', () => {
    (manager as any).init();
  });
});
