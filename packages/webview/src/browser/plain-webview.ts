import { Disposable, DomListener, electronEnv, Emitter, Deferred, Event } from '@opensumi/ide-core-browser';

import { IPlainWebview } from './types';

export class IframePlainWebview extends Disposable implements IPlainWebview {
  private _url: string | undefined;

  private _iframe: HTMLIFrameElement | null;

  private wrapper: HTMLIFrameElement | null;

  _onMessage = new Emitter<any>();
  onMessage = this._onMessage.event;

  _onRemove: Emitter<void> = new Emitter<void>();
  onRemove: Event<void> = this._onRemove.event;

  _onLoadURL: Emitter<string> = new Emitter<string>();
  onLoadURL: Event<string> = this._onLoadURL.event;

  private _ready = new Deferred<void>();

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
    this.wrapper.style.border = 'none';
    this.wrapper.style.zIndex = '2';
    const disposer = this.addDispose(
      new DomListener(this.wrapper, 'load', () => {
        this.addDispose(
          new DomListener(this.wrapper!.contentWindow!, 'message', (e) => {
            this._onMessage.fire(e.data);
          }),
        );
        this.wrapper!.contentDocument!.body.style.margin = '0';
        this._ready.resolve();
        disposer.dispose();
      }),
    );

    this.addDispose(this._onMessage);
  }

  get url() {
    return this._url;
  }

  async loadURL(url: string): Promise<void> {
    if (!this.wrapper) {
      return;
    }
    await this.ready;
    if (!this.wrapper) {
      return;
    }
    this._url = url;
    if (!this._iframe) {
      this._iframe = document.createElement('iframe');
      this._iframe.style.width = '100%';
      this._iframe.style.height = '100%';
      this._iframe.style.display = 'block';
      this._iframe.style.border = 'none';
      this.wrapper!.contentWindow!.document.body.appendChild(this._iframe);
    }
    this._iframe.setAttribute('src', url);
    this._onLoadURL.fire(url);
    return new Promise<void>((resolve) => {
      this.addDispose(
        new DomListener(this._iframe!, 'load', () => {
          resolve();
        }),
      );
    });
  }

  getDomNode() {
    return this.wrapper;
  }

  appendTo(container: HTMLElement): void {
    if (this.wrapper) {
      if (this.wrapper.parentElement) {
        this.wrapper.remove();
      }
    }
    container.innerHTML = '';
    container.appendChild(this.wrapper!);
    if (this._url) {
      this.loadURL(this._url);
    }
  }

  dispose() {
    super.dispose();
    if (this.wrapper) {
      this.wrapper!.remove();
      this.wrapper = null;
    }
    if (this._iframe) {
      this._iframe!.remove();
      this._iframe = null;
    }
  }

  postMessage(message: any) {
    if (this._iframe) {
      this._iframe!.contentWindow!.postMessage(message, '*');
    }
  }

  remove() {
    if (this.wrapper) {
      this.wrapper.remove();
      if (this._iframe) {
        this._iframe.remove();
        this._iframe = null;
      }
      this._onRemove.fire();
    }
  }
}

export class ElectronPlainWebview extends Disposable implements IPlainWebview {
  private _url: string | undefined;

  private webview: Electron.WebviewTag | null;

  private wrapper: HTMLDivElement | null;

  private webviewDomReady: Deferred<void> = new Deferred();

  _onMessage = new Emitter<any>();
  onMessage = this._onMessage.event;

  _onRemove: Emitter<void> = new Emitter<void>();
  onRemove: Event<void> = this._onRemove.event;

  _onLoadURL: Emitter<string> = new Emitter<string>();
  onLoadURL: Event<string> = this._onLoadURL.event;

  constructor() {
    super();
    this.wrapper = document.createElement('div');
    this.wrapper.style.width = '100%';
    this.wrapper.style.height = '100%';
    this.wrapper.style.display = 'block';
    this.wrapper.style.position = 'absolute';
    this.wrapper.style.border = 'none';
    this.wrapper.style.zIndex = '2';
    this.addDispose(this._onMessage);
  }

  get url() {
    return this._url;
  }

  getDomNode() {
    return this.wrapper;
  }

  async loadURL(url: string): Promise<void> {
    if (!this.wrapper) {
      return;
    }
    this._url = url;
    if (!this.webview) {
      this.webview = document.createElement('webview');
      this.wrapper!.appendChild(this.webview);
      this.webview.style.width = '100%';
      this.webview.style.height = '100%';
      this.webview.style.border = 'none';
      this.webview.style.zIndex = '2';
      this.webview.src = url;
      this.webview.preload = electronEnv.plainWebviewPreload;
      this.webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'webview-message') {
          this._onMessage.fire(event.args[0]);
        }
      });
      this.addDispose(
        new DomListener(this.webview!, 'dom-ready', () => {
          this.webviewDomReady.resolve();
        }),
      );
      this.addDispose(
        new DomListener(this.webview!, 'destroyed', () => {
          this.webviewDomReady = new Deferred();
        }),
      );
    }
    this._url = url;
    if (document.body.contains(this.wrapper)) {
      return this.doLoadURL();
    }
  }

  private async doLoadURL(): Promise<void> {
    return new Promise<void>(async (resolve) => {
      await this.webviewDomReady.promise;
      this.webview!.loadURL(this.url!);
      const disposer = this.addDispose(
        new DomListener(this.webview!, 'did-finish-load', () => {
          disposer.dispose();
          this._onLoadURL.fire(this.url!);
          resolve();
        }),
      );
    });
  }

  appendTo(container: HTMLElement): void {
    container.appendChild(this.wrapper!);
    if (this._url) {
      this.doLoadURL();
    }
  }

  dispose() {
    this.wrapper!.remove();
    this.wrapper = null;
    this.webview!.remove();
    this.webview = null;
  }

  postMessage(message: any) {
    if (this.webview) {
      this.webview!.send('webview-message', message);
    }
  }

  remove() {
    if (this.wrapper) {
      this.wrapper.remove();
      this._onRemove.fire();
    }
  }
}
