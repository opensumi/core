import { IMainThreadWebview, IExtHostWebview, MainThreadAPIIdentifier, IWebviewPanelViewState, IWebviewOptions, Webview, WebviewPanel, IWebviewPanelOptions, ViewColumn, WebviewPanelOnDidChangeViewStateEvent, WebviewPanelSerializer } from '../../common';
import { Emitter, Event } from '@ali/ide-core-common';
import { Uri, Disposable } from '../../common/ext-types';
import { IRPCProtocol } from '@ali/ide-connection';

type IconPath = Uri | { light: Uri, dark: Uri };

export class ExtHostWebview implements Webview {
  private readonly _handle: string;
  private readonly _proxy: IMainThreadWebview;
  private _html: string;
  private _options: IWebviewOptions;
  private _isDisposed: boolean = false;

  public readonly _onMessageEmitter = new Emitter<any>();
  public readonly onDidReceiveMessage: Event<any> = this._onMessageEmitter.event;

  constructor(
    handle: string,
    proxy: IMainThreadWebview,
    options: IWebviewOptions,
  ) {
    this._handle = handle;
    this._proxy = proxy;
    this._options = options;
  }

  public dispose() {
    this._onMessageEmitter.dispose();
  }

  public get html(): string {
    this.assertNotDisposed();
    return this._html;
  }

  public set html(value: string) {
    this.assertNotDisposed();
    if (this._html !== value) {
      this._html = value;
      this._proxy.$setHtml(this._handle, value);
    }
  }

  public get options(): IWebviewOptions {
    this.assertNotDisposed();
    return this._options as any;
  }

  public set options(newOptions: IWebviewOptions) {
    this.assertNotDisposed();
    this._proxy.$setOptions(this._handle, newOptions as any);
    this._options = newOptions;
  }

  public postMessage(message: any): Thenable<boolean> {
    this.assertNotDisposed();
    return this._proxy.$postMessage(this._handle, message);
  }

  private assertNotDisposed() {
    if (this._isDisposed) {
      throw new Error('Webview is disposed');
    }
  }
}

export class ExtHostWebviewPanel implements WebviewPanel {

  private readonly _handle: string;
  private readonly _proxy: IMainThreadWebview;
  private readonly _viewType: string;
  private _title: string;
  private _iconPath: IconPath | undefined;

  private readonly _options: IWebviewPanelOptions;
  private readonly _webview: ExtHostWebview;
  private _isDisposed: boolean = false;
  private _viewColumn: ViewColumn;
  private _visible: boolean = true;
  private _active: boolean = true;

  readonly _onDisposeEmitter = new Emitter<void>();
  public readonly onDidDispose: Event<void> = this._onDisposeEmitter.event;

  readonly _onDidChangeViewStateEmitter = new Emitter<WebviewPanelOnDidChangeViewStateEvent>();
  public readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent> = this._onDidChangeViewStateEmitter.event;

  constructor(
    handle: string,
    proxy: IMainThreadWebview,
    viewType: string,
    title: string,
    viewColumn: ViewColumn,
    editorOptions: IWebviewPanelOptions,
    webview: ExtHostWebview,
  ) {
    this._handle = handle;
    this._proxy = proxy;
    this._viewType = viewType;
    this._options = editorOptions;
    this._viewColumn = viewColumn;
    this._title = title;
    this._webview = webview;
  }

  public dispose() {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._onDisposeEmitter.fire();

    this._proxy.$disposeWebview(this._handle);

    this._webview.dispose();

    this._onDisposeEmitter.dispose();
    this._onDidChangeViewStateEmitter.dispose();
  }

  get webview() {
    this.assertNotDisposed();
    return this._webview;
  }

  get viewType(): string {
    this.assertNotDisposed();
    return this._viewType;
  }

  get title(): string {
    this.assertNotDisposed();
    return this._title;
  }

  set title(value: string) {
    this.assertNotDisposed();
    if (this._title !== value) {
      this._title = value;
      this._proxy.$setTitle(this._handle, value);
    }
  }

  get iconPath(): IconPath | undefined {
    this.assertNotDisposed();
    return this._iconPath;
  }

  set iconPath(value: IconPath | undefined) {
    this.assertNotDisposed();
    if (this._iconPath !== value) {
      this._iconPath = value;

      this._proxy.$setIconPath(this._handle, Uri.isUri(value) ? { light: value, dark: value } : value);
    }
  }

  get options() {
    return this._options;
  }

  get viewColumn(): ViewColumn {
    this.assertNotDisposed();
    return this._viewColumn;
  }

  _setViewColumn(value: ViewColumn) {
    this.assertNotDisposed();
    this._viewColumn = value;
  }

  public get active(): boolean {
    this.assertNotDisposed();
    return this._active;
  }

  _setActive(value: boolean) {
    this.assertNotDisposed();
    this._active = value;
  }

  public get visible(): boolean {
    this.assertNotDisposed();
    return this._visible;
  }

  _setVisible(value: boolean) {
    this.assertNotDisposed();
    this._visible = value;
  }

  public postMessage(message: any): Thenable<boolean> {
    this.assertNotDisposed();
    return this._proxy.$postMessage(this._handle, message);
  }

  public reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void {
    this.assertNotDisposed();
    this._proxy.$reveal(this._handle, {
      viewColumn,
      preserveFocus: !!preserveFocus,
    });
  }

  private assertNotDisposed() {
    if (this._isDisposed) {
      throw new Error('Webview is disposed');
    }
  }
}

export class ExtHostWebviewService implements IExtHostWebview {
  private static webviewHandlePool = 1;

  private static newHandle(): string {
    return ExtHostWebviewService.webviewHandlePool++ + '';
  }

  private readonly _proxy: IMainThreadWebview;
  private readonly _webviewPanels = new Map<string, ExtHostWebviewPanel>();
  private readonly _serializers = new Map<string, WebviewPanelSerializer>();

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWebview);
  }

  public createWebview(
    extensionLocation: Uri,
    viewType: string,
    title: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn, preserveFocus?: boolean },
    options: (IWebviewPanelOptions & IWebviewOptions) = {},
  ) {
    const viewColumn = typeof showOptions === 'object' ? showOptions.viewColumn : showOptions;
    const webviewShowOptions = {
      viewColumn,
      preserveFocus: typeof showOptions === 'object' && !!showOptions.preserveFocus,
    };

    const handle = ExtHostWebviewService.newHandle();
    this._proxy.$createWebviewPanel(handle, viewType, title, webviewShowOptions, options);

    const webview = new ExtHostWebview(handle, this._proxy, options);
    const panel = new ExtHostWebviewPanel(handle, this._proxy, viewType, title, viewColumn, options, webview);
    this._webviewPanels.set(handle, panel);
    return panel;
  }

  public registerWebviewPanelSerializer(
    viewType: string,
    serializer: WebviewPanelSerializer,
  ): Disposable {
    if (this._serializers.has(viewType)) {
      throw new Error(`Serializer for '${viewType}' already registered`);
    }

    this._serializers.set(viewType, serializer);
    this._proxy.$registerSerializer(viewType);

    return new Disposable(() => {
      this._serializers.delete(viewType);
      this._proxy.$unregisterSerializer(viewType);
    });
  }

  public $onMessage(
    handle: string,
    message: any,
  ): void {
    const panel = this.getWebviewPanel(handle);
    if (panel) {
      panel.webview._onMessageEmitter.fire(message);
    }
  }

  public $onDidChangeWebviewPanelViewState(
    handle: string,
    newState: IWebviewPanelViewState,
  ): void {
    const panel = this.getWebviewPanel(handle);
    if (panel) {
      const viewColumn = newState.position;
      if (panel.active !== newState.active || panel.visible !== newState.visible || panel.viewColumn !== viewColumn) {
        panel._setActive(newState.active);
        panel._setVisible(newState.visible);
        panel._setViewColumn(viewColumn);
        panel._onDidChangeViewStateEmitter.fire({ webviewPanel: panel });
      }
    }
  }

  async $onDidDisposeWebviewPanel(handle: string): Promise<void> {
    const panel = this.getWebviewPanel(handle);
    if (panel) {
      panel.dispose();
      this._webviewPanels.delete(handle);
    }
  }

  async $deserializeWebviewPanel(
    webviewHandle: string,
    viewType: string,
    title: string,
    state: any,
    position: ViewColumn,
    options: IWebviewOptions & IWebviewPanelOptions,
  ): Promise<void> {
    const serializer = this._serializers.get(viewType);
    if (!serializer) {
      throw new Error(`No serializer found for '${viewType}'`);
    }

    const webview = new ExtHostWebview(webviewHandle, this._proxy, options);
    const revivedPanel = new ExtHostWebviewPanel(webviewHandle, this._proxy, viewType, title, position, options, webview);
    this._webviewPanels.set(webviewHandle, revivedPanel);
    return serializer.deserializeWebviewPanel(revivedPanel, state);
  }

  private getWebviewPanel(handle: string): ExtHostWebviewPanel | undefined {
    return this._webviewPanels.get(handle);
  }
}
