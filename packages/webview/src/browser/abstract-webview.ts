import { Autowired, Injectable } from '@opensumi/di';
import {
  Event,
  URI,
  Disposable,
  IDisposable,
  Emitter,
  IEventBus,
  MaybeNull,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { ITheme, IThemeService } from '@opensumi/ide-theme';
import { ThemeChangedEvent } from '@opensumi/ide-theme/lib/common/event';

import { IWebview, IWebviewContentOptions, IWebviewContentScrollPosition, IWebviewService } from './types';

@Injectable({ multiple: true })
export abstract class AbstractWebviewPanel extends Disposable implements IWebview {
  protected _html = '';

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

  protected _isListening = true;

  private _focused = false;

  protected _ready: Promise<void>;

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(StaticResourceService)
  staticResourceService: StaticResourceService;

  protected _keybindingDomTarget: HTMLElement | undefined = undefined;

  public setKeybindingDomTarget(target) {
    this._keybindingDomTarget = target;
  }

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

    this._onWebviewMessage('do-reload', () => {
      this.doUpdateContent();
    });

    this._onWebviewMessage('load-resource', () => {
      // TODO: 资源相关
    });

    this._onWebviewMessage('load-localhost', () => {
      // TODO: 好像是消息转发
    });

    this._onWebviewMessage('did-focus', () => {
      this.handleFocusChange(true);
    });

    this._onWebviewMessage('did-blur', () => {
      this.handleFocusChange(false);
    });

    this._onWebviewMessage('do-update-state', (state) => {
      this.state = state;
      this._onDidUpdateState.fire(state);
    });

    this._onWebviewMessage('did-keydown', (event) => {
      // Create a fake KeyboardEvent from the data provided
      const emulatedKeyboardEvent = new KeyboardEvent('keydown', event);
      // Force override the target
      Object.defineProperty(emulatedKeyboardEvent, 'target', {
        get: () => this._keybindingDomTarget || this.getDomNode(),
      });
      // And re-dispatch
      window.dispatchEvent(emulatedKeyboardEvent);
    });

    this.updateStyle();
  }

  protected updateStyle() {
    this.style(this.themeService.getCurrentThemeSync());
    this.addDispose(
      this.eventBus.on(ThemeChangedEvent, (e) => {
        this.style(e.payload.theme);
      }),
    );
  }

  getContent(): string {
    return this._html;
  }

  async setContent(html: string): Promise<void> {
    this._html = html;
    await this.doUpdateContent();
  }

  protected preprocessHtml(html: string): string {
    if (this.appConfig.isElectronRenderer) {
      // 将vscode-resource:/User/xxx 转换为 vscode-resource:///User/xxx
      return html.replace(
        /(["'])vscode-resource:(\/\/|)([^\s'"]+?)(["'])/gi,
        (_, startQuote, slash, path, endQuote) => `${startQuote}vscode-resource://${path}${endQuote}`,
      );
    }
    return html.replace(
      /(["'])vscode-resource:([^\s'"]+?)(["'])/gi,
      (_, startQuote, path, endQuote) =>
        `${startQuote}${this.staticResourceService.resolveStaticResource(URI.file(path))}${endQuote}`,
    );
  }

  protected doUpdateContent() {
    return this._sendToWebview('content', {
      contents: this.preprocessHtml(this._html),
      options: this._options,
      state: this.state,
    });
  }

  public abstract appendTo(container: HTMLElement);

  protected abstract _sendToWebview(channel: string, data: any);

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
  }

  abstract prepareContainer(): any;

  abstract getDomNode(): MaybeNull<HTMLElement>;

  abstract remove(): void;
}
