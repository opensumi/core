import { IWebview, IWebviewContentOptions, IWebviewContentScrollPosition } from './types';
import { Event, URI, Disposable, DomListener, getLogger, IDisposable, Emitter } from '@ali/ide-core-browser';

export abstract class AbstractWebviewPanel extends Disposable implements IWebview {

  protected _html;

  options: IWebviewContentOptions;

  initialScrollProgress: number;

  state: any;

  _onDidFocus: Emitter<void> = new Emitter<void>();
  onDidFocus: Event<void> = this._onDidFocus.event;

  _onDidClickLink: Emitter<URI> = new Emitter<URI>();
  onDidClickLink: Event<URI> = this._onDidClickLink.event;

  _onDidScroll: Emitter<IWebviewContentScrollPosition> = new Emitter<IWebviewContentScrollPosition>();
  onDidScroll: Event<IWebviewContentScrollPosition> = this._onDidScroll.event;

  _onDidUpdateState: Emitter<any> = new Emitter<any>();
  onDidUpdateState: Event<any> = this._onDidUpdateState.event;

  protected _ready: Promise<void>;

  constructor(public readonly id: string) {
    super();
    this._ready = new Promise((resolve) => {
      const disposer = this._onWebviewMessage('webview-ready', () => {
        disposer.dispose();
        resolve();
      });
    });
  }

  async postMessage(message: any): Promise<void> {
    return this._sendToWebview('message', message);
  }

  onMessage(listener: (message: any) => any): IDisposable {
    return this._onWebviewMessage('message', listener);
  }

  getContent(): string {
    return this._html;
  }

  async setContent(html: string): Promise<void> {
    this._html = html;
    await this._sendToWebview('content', {
      contents: this._html,
      options: this.options,
      state: this.state,
    });
  }

  public abstract appendTo(container: HTMLElement);

  protected abstract  _sendToWebview(channel: string, data: any);

  protected abstract _onWebviewMessage(channel: string, listener: (data: string) => any): IDisposable;

  updateOptions(options: IWebviewContentOptions, longLive: boolean): void {
    throw new Error('Method not implemented.');
  }

  layout(): void {
    throw new Error('Method not implemented.');
  }

  focus(): void {
    throw new Error('Method not implemented.');
  }

  reload(): void {
    throw new Error('Method not implemented.');
  }

}
