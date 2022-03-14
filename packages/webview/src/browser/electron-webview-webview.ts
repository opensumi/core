import { Injectable, Autowired } from '@opensumi/di';
import {
  Disposable,
  DomListener,
  getDebugLogger,
  IDisposable,
  AppConfig,
  electronEnv,
} from '@opensumi/ide-core-browser';

import { WebviewScheme } from '../common';

import { AbstractWebviewPanel } from './abstract-webview';
import { IWebview, IWebviewContentOptions } from './types';

@Injectable({ multiple: true })
export class ElectronWebviewWebviewPanel extends AbstractWebviewPanel implements IWebview {
  private webview: Electron.WebviewTag;

  private _needReload = false;

  private _iframeDisposer: Disposable | null = new Disposable();

  private _isReady: boolean;

  @Autowired(AppConfig)
  config: AppConfig;

  constructor(public readonly id: string, options: IWebviewContentOptions = {}) {
    super(id, options);

    this.webview = document.createElement('webview');
    this.webview.src = `${WebviewScheme}://index.html`;
    this.webview.preload = electronEnv.webviewPreload;
    this.webview.style.border = 'none';
    this.webview.style.width = '100%';
    this.webview.style.position = 'absolute';
    this.webview.style.height = '100%';
    this.webview.style.zIndex = '2';
    super.init();
  }

  prepareContainer() {
    this.clear();
    this._iframeDisposer = new Disposable();
    this._ready = new Promise<void>((resolve) => {
      // tslint:disable-next-line: no-unused-variable
      const disposer = this._onWebviewMessage('webview-ready', () => {
        if (this._isReady) {
          // 这种情况一般是由于iframe在dom中的位置变动导致了重载。
          // 此时我们需要重新初始化
          // electronWebview不需要重新监听事件
          this.updateStyle();
          this.doUpdateContent();
        }
        this._isReady = true;
        resolve();
      });
    });
    this._needReload = false;
  }

  getDomNode() {
    return this.webview;
  }

  protected _sendToWebview(channel: string, data: any) {
    if (!this._isListening) {
      return;
    }
    this._ready
      .then(() => {
        if (!this.webview) {
          return;
        }
        this.webview.send(channel, data);
      })
      .catch((err) => {
        getDebugLogger().error(err);
      });
  }

  protected _onWebviewMessage(channel: string, listener: (data: any) => any): IDisposable {
    return this._iframeDisposer!.addDispose(
      new DomListener(this.webview, 'ipc-message', (e) => {
        if (!this.webview) {
          return;
        }
        if (e.channel === channel) {
          if (!this._isListening) {
            return;
          }
          listener(e.args[0]);
        }
      }),
    );
  }

  appendTo(container: HTMLElement) {
    if (this.webview) {
      if (container.style.position === 'static' || !container.style.position) {
        container.style.position = 'relative';
      }
      container.innerHTML = '';
      container.appendChild(this.webview);
      if (this._needReload) {
        this.init();
        this.doUpdateContent();
      }
    }
  }

  remove() {
    if (this.webview) {
      this.webview.remove();
      this._onRemove.fire();
      // remove 只是视图被销毁，但是html，state等内容保留，因此这里之前是改坏了
      // this.dispose();
      this.clear();
      this._needReload = true;
    }
  }

  clear() {
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
      this._iframeDisposer = null;
    }
    this._isReady = false;
  }

  dispose() {
    super.dispose();
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
    }
  }
}
// tslint:disable-next-line: no-unused-variable
const WebviewHTMLStr = `<!DOCTYPE html>
<html lang="en" style="width: 100%; height: 100%;">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; frame-src 'self'; style-src 'unsafe-inline'; worker-src 'self'; img-src * data: ;  " />

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Webview Panel Container</title>
</head>

<body style="margin: 0; overflow: hidden; width: 100%; height: 100%">
</body>

</html>`;
