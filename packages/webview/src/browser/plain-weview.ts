import { IPlainWebview } from './types';
import { Disposable, DomListener, electronEnv, Emitter, Deferred } from '@ali/ide-core-browser';

export class IframePlainWebview extends Disposable implements IPlainWebview {

  private _url: string | undefined;

  private _iframe: HTMLIFrameElement | null;

  private wrapper: HTMLIFrameElement | null;

  _onMessage = new Emitter<any>();
  onMessage = this._onMessage.event;

  private _ready = new Deferred();

  get ready() {
    return this._ready.promise;
  }

  constructor() {
    super();
    this.wrapper = document.createElement('iframe');
    this.wrapper.setAttribute('src', 'javascript:""');
    this.wrapper.style.width = '100%';
    this.wrapper.style.height = '100%';
    this.wrapper.style.display = 'block';
    this.wrapper.style.position = 'absolute';
    const disposer = this.addDispose(new DomListener(this.wrapper, 'load', () => {
      this.addDispose(new DomListener(this.wrapper!.contentWindow!, 'message', (e) => {
        this._onMessage.fire(e.data);
      }));
      this.wrapper!.contentDocument!.body.style.margin = '0';
      this._ready.resolve();
      disposer.dispose();
    }));

    this.addDispose(this._onMessage);
  }

  get url() {
    return this._url;
  }

  async loadURL(url: string): Promise<void> {
    if (!this.wrapper) {
      return ;
    }
    await this.ready;
    this._url = url;
    if (!this._iframe) {
      this._iframe = document.createElement('iframe');
      this._iframe.style.width = '100%';
      this._iframe.style.height = '100%';
      this._iframe.style.display = 'block';
      this.wrapper!.contentDocument!.body.appendChild(this._iframe);
    }
    this._iframe.setAttribute('src', url);
    return new Promise((resolve) => {
      const disposer = new DomListener(this._iframe!, 'load', () => {
        disposer.dispose();
        resolve();
      });
    });
  }

  appendTo(container: HTMLElement): void {
    if (this.wrapper) {
      if (this.wrapper.parentElement) {
        this.wrapper.remove();
      }
    }
    container.innerHTML = '';
    container.appendChild(this.wrapper!);
  }

  dispose() {
    this.wrapper!.remove();
    this.wrapper = null;
    this._iframe!.remove();
    this._iframe = null;
  }

  postMessage(message: any) {
    if (this._iframe) {
      this._iframe!.contentWindow!.postMessage(message, '*');
    }
  }

}

export class ElectronPlainWebview extends Disposable implements IPlainWebview {

  private _url: string | undefined;

  private webview: Electron.WebviewTag | null;

  private wrapper: HTMLDivElement | null;

  _onMessage = new Emitter<any>();
  onMessage = this._onMessage.event;

  constructor() {
    super();
    this.wrapper = document.createElement('div');
    this.addDispose(this._onMessage);
  }

  get url() {
    return this._url;
  }

  async loadURL(url: string): Promise<void> {
    if (!this.wrapper) {
      return ;
    }
    this._url = url;
    if (!this.webview) {
      this.webview = document.createElement('webview');
      this.wrapper!.appendChild(this.webview);
      this.webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'webview-message') {
          this._onMessage.fire(event.args);
        }
      });
    }
    this.webview.loadURL(url);
    return new Promise((resolve) => {
      const disposer = new DomListener(this.webview!, 'did-finish-load', () => {
        disposer.dispose();
        resolve();
      });
    });
  }

  appendTo(container: HTMLElement): void {
    container.appendChild(this.wrapper!);
  }

  dispose() {
    this.wrapper!.remove();
    this.wrapper = null;
    this.webview!.remove();
    this.webview = null;
  }

  postMessage(message: any) {
    if (this.webview) {
      this.webview!.send('message', message);
    }
  }

}
