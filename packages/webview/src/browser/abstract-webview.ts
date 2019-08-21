import { IWebview, IWebviewContentOptions, IWebviewContentScrollPosition, IWebviewService } from './types';
import { Event, URI, Disposable, DomListener, getLogger, IDisposable, Emitter, IEventBus, MaybeNull } from '@ali/ide-core-browser';
import { ITheme, IThemeService } from '@ali/ide-theme';
import { Autowired, Injectable } from '@ali/common-di';
import { ThemeChangedEvent } from '@ali/ide-theme/lib/common/event';

@Injectable({multiple: true})
export abstract class AbstractWebviewPanel extends Disposable implements IWebview {

  protected _html;

  protected _options: IWebviewContentOptions;

  initialScrollProgress: number;

  state: any;

  _onDidFocus: Emitter<void> = new Emitter<void>();
  onDidFocus: Event<void> = this._onDidFocus.event;

  _onDidBlur: Emitter<void> = new Emitter<void>();
  onDidBlur: Event<void> = this._onDidFocus.event;

  _onDidClickLink: Emitter<URI> = new Emitter<URI>();
  onDidClickLink: Event<URI> = this._onDidClickLink.event;

  _onDidScroll: Emitter<IWebviewContentScrollPosition> = new Emitter<IWebviewContentScrollPosition>();
  onDidScroll: Event<IWebviewContentScrollPosition> = this._onDidScroll.event;

  _onDidUpdateState: Emitter<any> = new Emitter<any>();
  onDidUpdateState: Event<any> = this._onDidUpdateState.event;

  _onRemove: Emitter<void> = new Emitter<void>();
  onRemove: Event<void> = this._onRemove.event;

  protected _isListening: boolean = true;

  private _focused = false;

  protected _ready: Promise<void>;

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  constructor(public readonly id: string, options: IWebviewContentOptions = {}) {
    super();
    this._options = options;
  }

  init() {
    this.prepareContainer();

    this.initEvents();
  }

  async postMessage(message: any): Promise<void> {
    return this._sendToWebview('message', message);
  }

  public get options() {
    return this._options;
  }

  onMessage(listener: (message: any) => any): IDisposable {
    return this._onWebviewMessage('onmessage', listener);
  }

  protected initEvents() {

    this._onWebviewMessage('did-click-link', (data) => {
      this._onDidClickLink.fire(new URI(data));
    });

    this._onWebviewMessage('did-scroll', (data) => {
      this._onDidScroll.fire(data);
    });

    this._onWebviewMessage('do-reload', (data) => {
      this.doUpdateContent();
    });

    this._onWebviewMessage('load-resource', (data) => {
      // TODO 资源相关
    });

    this._onWebviewMessage('load-localhost', (data) => {
      // TODO 好像是消息转发
    });

    this._onWebviewMessage('did-focus', (data) => {
      this.handleFocusChange(true);
    });

    this._onWebviewMessage('did-blur', (data) => {
      this.handleFocusChange(false);
    });

    this._onWebviewMessage('do-update-state', (state) => {
      this.state = state;
      this._onDidUpdateState.fire(state);
    });

    this.updateStyle();
  }

  protected updateStyle() {
    this.style(this.themeService.getCurrentThemeSync());
    this.addDispose(this.eventBus.on(ThemeChangedEvent, (e) => {
      this.style(e.payload.theme);
    }));
  }

  getContent(): string {
    return this._html;
  }

  async setContent(html: string): Promise<void> {
    this._html = html;
    await this.doUpdateContent();
  }

  protected doUpdateContent() {
    return this._sendToWebview('content', {
      contents: this._html,
      options: this._options,
      state: this.state,
    });
  }

  public abstract appendTo(container: HTMLElement);

  protected abstract  _sendToWebview(channel: string, data: any);

  protected abstract _onWebviewMessage(channel: string, listener: (data: any) => any): IDisposable;

  updateOptions(options: IWebviewContentOptions): void {
    this._options = Object.assign(this._options, options);
    this.doUpdateContent();
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

  protected handleFocusChange(isFocused: boolean): void {
    this._focused = isFocused;
    if (this._focused) {
      this._onDidFocus.fire();
    } else {
      this._onDidBlur.fire();
    }
  }

  private style(theme: ITheme): void {
    const { styles, activeTheme } = this.webviewService.getWebviewThemeData(theme);
    this._sendToWebview('styles', { styles, activeTheme });
  }

  setListenMessages(listening: boolean): void {
    this._isListening = listening;
    if (listening) {
      this.doUpdateContent();
    }
  }

  abstract prepareContainer(): any;

  abstract getDomNode(): MaybeNull<HTMLElement>;

  abstract remove(): void;
}
