import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  Emitter,
  Event,
  IExtensionInfo,
  Disposable as IDEDisposable,
  CancellationToken,
} from '@opensumi/ide-core-common';

import {
  IMainThreadWebview,
  IExtHostWebview,
  MainThreadAPIIdentifier,
  IWebviewPanelViewState,
  IWebviewOptions,
  Webview,
  WebviewPanel,
  IWebviewPanelOptions,
  ViewColumn,
  WebviewPanelOnDidChangeViewStateEvent,
  WebviewPanelSerializer,
  WebviewView,
  WebviewHandle,
  IMainThreadWebviewView,
  IExtHostWebviewView,
  IExtensionDescription,
  WebviewViewProvider,
} from '../../../common/vscode';
import { Uri, Disposable } from '../../../common/vscode/ext-types';


type IconPath = Uri | { light: Uri; dark: Uri };

export class ExtHostWebview implements Webview {
  private readonly _handle: string;
  private readonly _proxy: IMainThreadWebview;
  private _html: string;
  private _options: IWebviewOptions;
  private _isDisposed = false;

  public readonly _onMessageEmitter = new Emitter<any>();
  public readonly onDidReceiveMessage: Event<any> = this._onMessageEmitter.event;

  constructor(handle: string, proxy: IMainThreadWebview, options: IWebviewOptions, private cspResourceRoots: string[]) {
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

  public get resourceRoot() {
    return 'vscode-resource:';
  }

  public get cspSource() {
    return this.cspResourceRoots.join(' ');
  }

  public toWebviewResource(resource: Uri): Uri {
    return this.asWebviewUri(resource);
  }

  public asWebviewUri(localResource: Uri): Uri {
    if (localResource.scheme === 'file') {
      return Uri.from({
        scheme: 'vscode-resource',
        path: localResource.path,
        authority: localResource.authority,
        query: localResource.query,
        fragment: localResource.fragment,
      });
    } else {
      return localResource;
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
  private _isDisposed = false;
  private _viewColumn: ViewColumn;
  private _visible = true;
  private _active = true;

  readonly _onDisposeEmitter = new Emitter<void>();
  public readonly onDidDispose: Event<void> = this._onDisposeEmitter.event;

  readonly _onDidChangeViewStateEmitter = new Emitter<WebviewPanelOnDidChangeViewStateEvent>();
  public readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent> =
    this._onDidChangeViewStateEmitter.event;

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
      let param: { light: string; dark: string; hc: string } = { light: '', dark: '', hc: '' };
      if (Uri.isUri(value)) {
        param = { light: value.toString(), dark: value.toString(), hc: value.toString() };
      } else {
        const v = value as { light: Uri; dark: Uri };
        param = { light: v.light.toString(), dark: v.dark.toString(), hc: '' };
      }
      this._proxy.$setIconPath(this._handle, param);
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
  private webviewHandlePool = 1;

  private readonly _proxy: IMainThreadWebview;
  private readonly _webviewPanels = new Map<string, ExtHostWebviewPanel>();
  private readonly _localWebviews = new Map<string, ExtHostWebview>();
  private readonly _serializers = new Map<string, WebviewPanelSerializer>();
  private resourceRoots: string[] = [];

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWebview);
  }

  async $init() {
    return await this.init();
  }

  async init() {
    this.resourceRoots = await this._proxy.$getWebviewResourceRoots();
  }

  private getNextHandle() {
    let nextHandle = 'ext-host-webview-' + this.webviewHandlePool++;
    while (this._webviewPanels.has(nextHandle)) {
      nextHandle = 'ext-host-webview-' + this.webviewHandlePool++;
    }
    return nextHandle;
  }

  public createWebview(
    extensionLocation: Uri | undefined,
    viewType: string,
    title: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
    options: IWebviewPanelOptions & IWebviewOptions = {},
    extension: IExtensionInfo,
  ) {
    const viewColumn = typeof showOptions === 'object' ? showOptions.viewColumn : showOptions;
    const webviewShowOptions = {
      viewColumn,
      preserveFocus: typeof showOptions === 'object' && !!showOptions.preserveFocus,
    };

    const handle = this.getNextHandle();
    this._proxy.$createWebviewPanel(handle, viewType, title, webviewShowOptions, options, extension);

    const webview = new ExtHostWebview(handle, this._proxy, options, this.resourceRoots);
    const panel = new ExtHostWebviewPanel(handle, this._proxy, viewType, title, viewColumn, options, webview);
    this._webviewPanels.set(handle, panel);
    return panel;
  }

  $pipeBrowserHostedWebviewPanel(handle: string, viewType: string) {
    const webview = new ExtHostWebview(handle, this._proxy, {}, this.resourceRoots);
    const panel = new ExtHostWebviewPanel(handle, this._proxy, viewType, '', ViewColumn.One, {}, webview);
    this._webviewPanels.set(handle, panel);
  }

  createLocalWebview(handle: string) {
    const webview = new ExtHostWebview(handle, this._proxy, {}, this.resourceRoots);
    this._localWebviews.set(handle, webview);
    return webview;
  }

  public registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): Disposable {
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

  private getExtHostWebview(handle: string): ExtHostWebview | undefined {
    return this._localWebviews.get(handle) || this.getWebviewPanel(handle)?.webview;
  }

  public $onMessage(handle: string, message: any): void {
    this.getExtHostWebview(handle)?._onMessageEmitter.fire(message);
  }

  public $onDidChangeWebviewPanelViewState(handle: string, newState: IWebviewPanelViewState): void {
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

    const webview = new ExtHostWebview(webviewHandle, this._proxy, options, this.resourceRoots);
    const revivedPanel = new ExtHostWebviewPanel(
      webviewHandle,
      this._proxy,
      viewType,
      title,
      position,
      options,
      webview,
    );
    this._webviewPanels.set(webviewHandle, revivedPanel);

    return serializer.deserializeWebviewPanel(revivedPanel, state);
  }

  public getWebviewPanel(handle: string): ExtHostWebviewPanel | undefined {
    return this._webviewPanels.get(handle);
  }
}

class ExtHostWebviewView extends IDEDisposable implements WebviewView {
  readonly #handle: WebviewHandle;
  readonly #proxy: IMainThreadWebviewView;

  readonly #viewType: string;
  readonly #webview: ExtHostWebview;

  #isDisposed = false;
  #isVisible: boolean;
  #title: string | undefined;
  #description: string | undefined;

  constructor(
    handle: WebviewHandle,
    proxy: IMainThreadWebviewView,
    viewType: string,
    title: string | undefined,
    webview: ExtHostWebview,
    isVisible: boolean,
  ) {
    super();

    // @ts-ignore
    this.#viewType = viewType;
    this.#title = title;
    this.#handle = handle;
    this.#proxy = proxy;
    this.#webview = webview;
    this.#isVisible = isVisible;

    this.addDispose(this.#onDidChangeVisibility);
    this.addDispose(this.#onDidDispose);
  }

  public dispose() {
    if (this.#isDisposed) {
      return;
    }

    this.#isDisposed = true;
    this.#onDidDispose.fire();

    this.#webview.dispose();

    super.dispose();
  }

  readonly #onDidChangeVisibility = new Emitter<void>();
  public readonly onDidChangeVisibility = this.#onDidChangeVisibility.event;

  readonly #onDidDispose = new Emitter<void>();
  // @ts-ignore
  public readonly onDidDispose = this.#onDidDispose.event;

  public get title(): string | undefined {
    this.assertNotDisposed();
    return this.#title;
  }

  public set title(value: string | undefined) {
    this.assertNotDisposed();
    if (this.#title !== value) {
      this.#title = value;
      this.#proxy.$setWebviewViewTitle(this.#handle, value);
    }
  }

  public get description(): string | undefined {
    this.assertNotDisposed();
    return this.#description;
  }

  public set description(value: string | undefined) {
    this.assertNotDisposed();
    if (this.#description !== value) {
      this.#description = value;
      this.#proxy.$setWebviewViewDescription(this.#handle, value);
    }
  }

  public get visible(): boolean {
    return this.#isVisible;
  }

  public get webview(): Webview {
    return this.#webview;
  }

  public get viewType(): string {
    return this.#viewType;
  }

  /* internal */ _setVisible(visible: boolean) {
    if (visible === this.#isVisible || this.#isDisposed) {
      return;
    }

    this.#isVisible = visible;
    this.#onDidChangeVisibility.fire();
  }

  public show(preserveFocus?: boolean): void {
    this.assertNotDisposed();
    this.#proxy.$show(this.#handle, !!preserveFocus);
  }

  private assertNotDisposed() {
    if (this.#isDisposed) {
      throw new Error('Webview is disposed');
    }
  }
}

export class ExtHostWebviewViews implements IExtHostWebviewView {
  private readonly _proxy: IMainThreadWebviewView;

  private readonly _viewProviders = new Map<
    string,
    {
      readonly provider: WebviewViewProvider;
      readonly extension: IExtensionDescription;
    }
  >();

  private readonly _webviewViews = new Map<WebviewHandle, ExtHostWebviewView>();

  constructor(rpcProtocol: IRPCProtocol, private readonly _extHostWebview: ExtHostWebviewService) {
    this._proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWebviewView);
  }

  public registerWebviewViewProvider(
    extension: IExtensionDescription,
    viewType: string,
    provider: WebviewViewProvider,
    webviewOptions?: {
      retainContextWhenHidden?: boolean;
    },
  ): Disposable {
    if (this._viewProviders.has(viewType)) {
      throw new Error(`View provider for '${viewType}' already registered`);
    }

    this._viewProviders.set(viewType, { provider, extension });
    this._proxy.$registerWebviewViewProvider(extension, viewType, webviewOptions);

    return new Disposable(() => {
      this._viewProviders.delete(viewType);
      this._proxy.$unregisterWebviewViewProvider(viewType);
    });
  }

  async $resolveWebviewView(
    webviewHandle: string,
    viewType: string,
    title: string | undefined,
    state: any,
    cancellation: CancellationToken,
  ): Promise<void> {
    const entry = this._viewProviders.get(viewType);
    if (!entry) {
      throw new Error(`No view provider found for '${viewType}'`);
    }

    const { provider } = entry;

    const webview = this._extHostWebview.createLocalWebview(webviewHandle);
    const revivedView = new ExtHostWebviewView(webviewHandle, this._proxy, viewType, title, webview, true);

    this._webviewViews.set(webviewHandle, revivedView);

    await provider.resolveWebviewView(revivedView, { state }, cancellation);
  }

  async $onDidChangeWebviewViewVisibility(webviewHandle: string, visible: boolean) {
    const webviewView = this.getWebviewView(webviewHandle);
    webviewView._setVisible(visible);
  }

  async $disposeWebviewView(webviewHandle: string) {
    this._webviewViews.delete(webviewHandle);
    this._extHostWebview.getWebviewPanel(webviewHandle)?.dispose();
  }

  private getWebviewView(handle: string): ExtHostWebviewView {
    const entry = this._webviewViews.get(handle);
    if (!entry) {
      throw new Error('No webview found');
    }
    return entry;
  }
}
