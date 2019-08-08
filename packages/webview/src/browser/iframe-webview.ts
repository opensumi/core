import { IWebview, IWebviewContentOptions } from './types';
import { Event, URI, Disposable, DomListener, getLogger, IDisposable } from '@ali/ide-core-browser';
import { AbstractWebviewPanel } from './abstract-webview';

export class IFrameWebviewPanel extends AbstractWebviewPanel implements IWebview {

  private iframe: HTMLIFrameElement;

  constructor(public readonly id: string) {
    super(id);
    this.initEvents();
  }

  private initEvents() {

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

  protected _onWebviewMessage(channel: string, listener: (data: string) => any): IDisposable {
    return this.addDispose(new DomListener(window, 'message', (e) => {
      if (e.data && e.data.target === this.id && e.data.channel === channel) {
        listener(e.data.data);
      }
    }));
  }

  appendTo(container: HTMLElement) {
    if (this.iframe) {
      container.appendChild(this.iframe);
    }
  }

}
