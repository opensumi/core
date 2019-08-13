import { IWebview, IWebviewContentOptions } from './types';
import { Event, URI, Disposable, DomListener, getLogger, IDisposable, AppConfig } from '@ali/ide-core-browser';
import { AbstractWebviewPanel } from './abstract-webview';
import { Injectable, Autowired } from '@ali/common-di';

@Injectable({multiple: true})
export class IFrameWebviewPanel extends AbstractWebviewPanel implements IWebview {

  private iframe: HTMLIFrameElement;

  private _needReload: boolean = false;

  private _iframeDisposer: Disposable | null = new Disposable();

  @Autowired(AppConfig)
  config: AppConfig;

  constructor(public readonly id: string, options: IWebviewContentOptions = {}) {
    super(id, options);

    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    this.iframe.setAttribute('src', `${this.config.webviewEndpoint}/index.html?id=${this.id}`);
    this.iframe.style.border = 'none';
    this.iframe.style.width = '100%';
    this.iframe.style.position = 'absolute';
    this.iframe.style.height = '100%';
  }

  prepareContainer() {
    this.clear();
    this._iframeDisposer = new Disposable();
    this._ready = new Promise((resolve) => {
      const disposer = this._onWebviewMessage('webview-ready', () => {
        disposer.dispose();
        resolve();
      });
    });
    this._needReload = false;
  }

  getDomNode() {
    return this.iframe;
  }

  protected _sendToWebview(channel: string, data: any) {
    this._ready.then(() => {
      if (!this.iframe) {
        return;
      }
      this.iframe.contentWindow!.postMessage({
        channel,
        data,
      }, '*');
    }).catch((err) => {
      getLogger().error(err);
    });
  }

  protected _onWebviewMessage(channel: string, listener: (data: any) => any): IDisposable {
    return this._iframeDisposer!.addDispose(new DomListener(window, 'message', (e) => {
      if (e.data && e.data.target === this.id && e.data.channel === channel) {
        listener(e.data.data);
      }
    }));
  }

  appendTo(container: HTMLElement) {
    if (this.iframe) {
      if (container.style.position === 'static' || !container.style.position) {
        container.style.position = 'relative';
      }
      container.innerHTML = '';
      container.appendChild(this.iframe);
      if (this._needReload) {
        this.init();
        this.doUpdateContent();
      }
    }
  }

  remove() {
    if (this.iframe) {
      this.iframe.remove();
      this._onRemove.fire();
      this.clear();
      this._needReload = true;
    }
  }

  clear() {
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
      this._iframeDisposer = null;
    }
  }

  dispose() {
    super.dispose();
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
    }
  }

}
