import { IWebview, IWebviewContentOptions } from './types';
import { Event, URI, Disposable, DomListener, getLogger, IDisposable, AppConfig } from '@ali/ide-core-browser';
import { AbstractWebviewPanel } from './abstract-webview';
import { Injectable, Autowired } from '@ali/common-di';

@Injectable({multiple: true})
export class IFrameWebviewPanel extends AbstractWebviewPanel implements IWebview {

  private iframe: HTMLIFrameElement;

  @Autowired(AppConfig)
  config: AppConfig;

  constructor(public readonly id: string, options: IWebviewContentOptions = {}) {
    super(id, options);
    this.initEvents();
    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    this.iframe.setAttribute('src', `${this.config.webviewEndpoint}/index.html?id=${this.id}`);
    this.iframe.style.border = 'none';
    this.iframe.style.width = '100%';
    this.iframe.style.position = 'absolute';
    this.iframe.style.height = '100%';
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
    return this.addDispose(new DomListener(window, 'message', (e) => {
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
    }
  }

}
