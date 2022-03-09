import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event, Disposable, URI } from '@opensumi/ide-core-browser';
import { electronEnv } from '@opensumi/ide-core-browser/lib/utils/electron';
import { IElectronMainUIService, IElectronPlainWebviewWindowOptions } from '@opensumi/ide-core-common/lib/electron';

import { IPlainWebviewWindow } from './types';

@Injectable({ multiple: true })
export class ElectronPlainWebviewWindow extends Disposable implements IPlainWebviewWindow {
  @Autowired(IElectronMainUIService)
  electronMainUIService: IElectronMainUIService;

  private _windowId: number;

  private _webContentsId: number;

  private _ready: Promise<void>;

  private _closed = false;

  constructor(options?: IElectronPlainWebviewWindowOptions, env: { [key: string]: string } = {}) {
    super();
    this._ready = this.electronMainUIService
      .createBrowserWindow({
        ...options,
        webPreferences: {
          preload: new URI(electronEnv.plainWebviewPreload).codeUri.fsPath,
          additionalArguments: [
            '--additionalEnv=' + JSON.stringify(env),
            '--parentWindowWebContentsId=' + electronEnv.currentWebContentsId,
          ],
          ...options?.webPreferences,
        },
      })
      .then(async (id) => {
        this._windowId = id;
        this._webContentsId = await this.electronMainUIService.getWebContentsId(this._windowId);
      })
      .then(() => {
        const listener = (event: any, { from, message }: { from: number; message: any }) => {
          if (from === this._windowId) {
            this._onMessage.fire(message);
          }
        };
        electronEnv.ipcRenderer.on('cross-window-webview-message', listener);
        this.addDispose({
          dispose: () => {
            electronEnv.ipcRenderer.removeListener('cross-window-webview-message', listener);
          },
        });
        this.addDispose(
          this.electronMainUIService.on('windowClosed', (windowId) => {
            if (windowId === this._windowId) {
              this._closed = true;
              this._onClosed.fire();
              this.dispose();
            }
          }),
        );
      });
    this.addDispose(this._onMessage);
    this.addDispose(this._onClosed);
    this.addDispose({
      dispose: () => {
        this._close();
      },
    });
  }

  _onMessage: Emitter<any> = new Emitter<any>();
  onMessage: Event<any> = this._onMessage.event;

  _onClosed: Emitter<void> = new Emitter<void>();
  onClosed: Event<void> = this._onClosed.event;

  private _url: string;

  get ready() {
    return this._ready;
  }

  get url() {
    return this._url;
  }

  async loadURL(url: string): Promise<void> {
    await this._ready;
    this._url = url;
    return this.electronMainUIService.browserWindowLoadUrl(this._windowId, url);
  }

  async show() {
    return this.electronMainUIService.showBrowserWindow(this._windowId);
  }

  async hide() {
    return this.electronMainUIService.hideBrowserWindow(this._windowId);
  }

  async setSize(size: { width: number; height: number }) {
    return this.electronMainUIService.setSize(this._windowId, size);
  }

  async setAlwaysOnTop(flag: boolean) {
    return this.electronMainUIService.setAlwaysOnTop(this._windowId, flag);
  }

  async postMessage(message: any) {
    return this.electronMainUIService.postMessageToBrowserWindow(this._windowId, 'webview-message', message);
  }

  _close() {
    if (this._closed) {
      return;
    }
    try {
      return this.electronMainUIService.closeBrowserWindow(this._windowId);
    } catch (e) {
      // ignore
    }
  }

  get windowId() {
    return this._windowId;
  }

  get webContentsId() {
    return this._webContentsId;
  }
}
