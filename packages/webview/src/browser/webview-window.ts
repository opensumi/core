import { IPlainWebviewWindow } from './types';
import { Injectable, Autowired } from '@ali/common-di';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { electronEnv } from '@ali/ide-core-browser/lib/utils/electron';
import { Emitter, Event, Disposable, URI } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class ElectronPlainWebviewWindow extends Disposable implements IPlainWebviewWindow {

  @Autowired(IElectronMainUIService)
  electronMainUIService: IElectronMainUIService;

  private _windowId: number;

  private _ready: Promise<void>;

  private _closed: boolean = false;

  constructor(options?: Electron.BrowserWindowConstructorOptions, env: {[key: string]: string} = {}) {
    super();
    this._ready = this.electronMainUIService.createBrowserWindow({
      webPreferences: {
        preload: new URI(electronEnv.plainWebviewPreload).codeUri.fsPath,
        additionalArguments: [
          '--additionalEnv=' + JSON.stringify(env),
          '--parentWindowWebContentsId=' + electronEnv.currentWebContentsId,
        ],
      },
      ...options,
    }).then((id) => {
      this._windowId = id;
      const listener = (event, {from, message}: { from: number, message: any }) => {
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
      this.addDispose(this.electronMainUIService.on('windowClosed', (windowId) => {
        if (windowId === this._windowId) {
          this._closed = true;
          this._onClosed.fire();
          this.dispose();
        }
      }));
    });
    this.addDispose({
      dispose: () => {
        this._close();
      },
    });
    this.addDispose(this._onMessage);
    this.addDispose(this._onClosed);
  }

  _onMessage: Emitter<any> = new Emitter<any>();
  onMessage: Event<any> = this._onMessage.event;

  _onClosed: Emitter<void> = new Emitter<void>();
  onClosed: Event<void> = this._onClosed.event;

  private _url: string;

  get url() {
    return this._url;
  }

  async loadURL(url: string): Promise<void> {
    await this._ready;
    this._url = url;
    return this.electronMainUIService.browserWindowLoadUrl(this._windowId, url);
  }

  show(): Promise<void> {
    return this.electronMainUIService.showBrowserWindow(this._windowId);
  }

  postMessage(message: any): Promise<void> {
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
}
