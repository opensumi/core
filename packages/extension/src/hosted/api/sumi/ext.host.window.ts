import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Disposable, IDisposable, DisposableCollection } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import {
  IExtHostIDEWindow,
  IMainThreadIDEWindow,
  IIDEWindowWebviewOptions,
  IIDEWindowWebviewEnv,
  IExtPlainWebviewWindow,
  IWindowInfo,
} from '../../../common/sumi/window';
import { IExtHostCommands } from '../../../common/vscode';

export class ExtHostIDEWindow implements IExtHostIDEWindow {
  private proxy: IMainThreadIDEWindow;

  private _windowMaps: Map<string, ExtIDEWebviewWindow> = new Map();

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadIDEWindow);
  }

  async createWebviewWindow(webviewId: string, options?: IIDEWindowWebviewOptions, env?: IIDEWindowWebviewEnv) {
    if (this._windowMaps.has(webviewId)) {
      const window = this._windowMaps.get(webviewId);
      window?.show();
      return window;
    }
    const windowInfo = await this.proxy.$createWebviewWindow(webviewId, options, env);
    const window = new ExtIDEWebviewWindow(
      webviewId,
      windowInfo,
      this.proxy,
      Disposable.create(() => {
        this._windowMaps.delete(webviewId);
      }),
    );
    this._windowMaps.set(webviewId, window);
    return window;
  }

  async $postMessage(webviewId: string, message: any) {
    if (this._windowMaps.has(webviewId)) {
      const window = this._windowMaps.get(webviewId);
      window?.dispatchMessage(message);
    }
  }

  async $dispatchClosed(webviewId: string) {
    if (this._windowMaps.has(webviewId)) {
      const window = this._windowMaps.get(webviewId);
      window?.dispatchClosed();
    }
  }
}

export class ExtIDEWebviewWindow implements IExtPlainWebviewWindow {
  private _onMessageEmitter: Emitter<any> = new Emitter();
  private _onClosedEmitter: Emitter<void> = new Emitter();

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor(
    private webviewId: string,
    private info: IWindowInfo,
    private proxy: IMainThreadIDEWindow,
    dispose: IDisposable,
  ) {
    this.disposableCollection.push(dispose);
    this.disposableCollection.push(
      Disposable.create(() => {
        this.proxy.$destroy(this.webviewId);
      }),
    );
  }

  get webContentsId() {
    return this.info.webContentsId;
  }

  get windowId() {
    return this.info.windowId;
  }

  get onMessage() {
    return this._onMessageEmitter.event;
  }

  get onClosed() {
    return this._onClosedEmitter.event;
  }

  async show() {
    return await this.proxy.$show(this.webviewId);
  }

  async hide() {
    return await this.proxy.$hide(this.webviewId);
  }
  async postMessage(message: any) {
    return await this.proxy.$postMessage(this.webviewId, message);
  }

  async loadUrl(url: string) {
    return await this.proxy.$loadURL(this.webviewId, url);
  }

  async setSize(size: { width: number; height: number }) {
    return await this.proxy.$setSize(this.webviewId, size);
  }

  async setAlwaysOnTop(flag: boolean) {
    return await this.proxy.$setAlwaysOnTop(this.webviewId, flag);
  }

  dispose() {
    this.disposableCollection.dispose();
  }

  async dispatchClosed() {
    this._onClosedEmitter.fire();
  }

  async dispatchMessage(message: any) {
    this._onMessageEmitter.fire(message);
  }
}

export function createWindowApiFactory(extHostCommands: IExtHostCommands, extHostWindow: ExtHostIDEWindow) {
  return {
    reloadWindow: async () => await extHostCommands.executeCommand('reload_window'),
    createWebviewWindow: async (webviewId: string, options?: IIDEWindowWebviewOptions, env?: IIDEWindowWebviewEnv) =>
      await extHostWindow.createWebviewWindow(webviewId, options, env),
  };
}
