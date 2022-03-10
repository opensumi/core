import throttle = require('lodash.throttle');

import { Injectable, Autowired, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  Disposable,
  URI,
  MaybeNull,
  IEventBus,
  ILogger,
  Schemas,
  IExtensionInfo,
  CommandRegistry,
  StorageProvider,
  STORAGE_SCHEMA,
  IStorage,
  IDisposable,
  addMapElement,
} from '@opensumi/ide-core-browser';
import { IOpenerService } from '@opensumi/ide-core-browser';
import { CommandOpener } from '@opensumi/ide-core-browser/lib/opener/command-opener';
import { HttpOpener } from '@opensumi/ide-core-browser/lib/opener/http-opener';
import { CancellationToken, WithEventBus, OnEvent } from '@opensumi/ide-core-common';
import { WorkbenchEditorService, IResource } from '@opensumi/ide-editor';
import { EditorGroupChangeEvent, IEditorOpenType } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService, ViewCollapseChangedEvent } from '@opensumi/ide-main-layout';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { IIconService, IconType } from '@opensumi/ide-theme';
import {
  IWebviewService,
  IEditorWebviewComponent,
  IWebview,
  IPlainWebview,
  IPlainWebviewComponentHandle,
} from '@opensumi/ide-webview';

import { ISumiExtHostWebviews } from '../../../common/sumi/webview';
import {
  IMainThreadWebview,
  WebviewPanelShowOptions,
  IWebviewPanelOptions,
  IWebviewOptions,
  ExtHostAPIIdentifier,
  IExtHostWebview,
  IWebviewPanelViewState,
  IMainThreadWebviewView,
  IWebviewExtensionDescription,
  IExtHostWebviewView,
  WebviewViewResolverRegistrationEvent,
  WebviewViewResolverRegistrationRemovalEvent,
  WebviewViewOptions,
} from '../../../common/vscode';
import { viewColumnToResourceOpenOptions } from '../../../common/vscode/converter';
import { WebviewViewShouldShowEvent } from '../../components/extension-webview-view';
import { IActivationEventService } from '../../types';

@Injectable({ multiple: true })
export class MainThreadWebview extends Disposable implements IMainThreadWebview {
  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  @Autowired(IActivationEventService)
  activation: IActivationEventService;

  private webivewPanels: Map<string, WebviewPanel> = new Map();

  private webviews: Map<string, IWebview> = new Map();

  private plainWebviews: Map<string, IEditorWebviewComponent<IPlainWebview> | IPlainWebviewComponentHandle> = new Map();

  private webviewPanelStates: Map<string, IWebviewPanelViewState> = new Map();

  private proxy: IExtHostWebview;

  private sumiProxy: ISumiExtHostWebviews;

  private _hasSerializer = new Set<string>();

  @Autowired(StorageProvider)
  private getStorage: StorageProvider;

  @Autowired()
  editorService: WorkbenchEditorService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(StaticResourceService)
  staticResourceService: StaticResourceService;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  private statePersister = new Map<string, Promise<(state: any) => Promise<void>>>();

  private extWebviewStorage: Promise<IStorage>;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWebview);
    this.sumiProxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.SumiExtHostWebview);
    this.initEvents();
    this.extWebviewStorage = this.getStorage(new URI('extension-webview-panels').withScheme(STORAGE_SCHEMA.SCOPE));
    this.webviewService.registerWebviewReviver({
      revive: (id) => this.reviveWebview(id),
      handles: async (id: string) => {
        const persistedWebviewPanelMeta: IWebviewPanelData | undefined = (
          await this.extWebviewStorage
        ).get<IWebviewPanelData>(id);
        if (persistedWebviewPanelMeta) {
          return 10;
        } else {
          return -1;
        }
      },
    });
  }

  async init() {
    await this.proxy.$init();
  }

  private isSupportedLink(uri: URI, options: IWebviewOptions, extension: IExtensionInfo) {
    if (HttpOpener.standardSupportedLinkSchemes.has(uri.scheme)) {
      return true;
    }
    // webview 支持打开 command 协议
    if (!!options.enableCommandUris && uri.scheme === Schemas.command) {
      // 从 webview 过来的 command 也要做安全校验
      const { id, args } = CommandOpener.parseURI(uri);
      const isPermitted = this.commandRegistry.isPermittedCommand(id, extension, ...args);
      if (!isPermitted) {
        throw new Error(`Extension ${extension.id} has not permit to execute ${id}`);
      }
      return true;
    }
    return false;
  }

  initEvents() {
    this.addDispose(
      this.editorService.onActiveResourceChange(() => {
        this.onChange();
      }),
    );

    this.addDispose(
      this.eventBus.on(EditorGroupChangeEvent, () => {
        this.onChange();
      }),
    );
  }

  isActive(webviewPanel: WebviewPanel, resource: IResource, openType: MaybeNull<IEditorOpenType>) {
    return (
      webviewPanel.resourceState.uri.isEqual(resource?.uri) &&
      webviewPanel.resourceState.openTypeId === openType?.componentId
    );
  }

  onChange() {
    const currentResource = this.editorService.currentResource;
    const currentOpenType = this.editorService.currentEditorGroup.currentOpenType;
    const visibleResources: {
      resource: MaybeNull<IResource>;
      openType: MaybeNull<IEditorOpenType>;
      index: number;
    }[] = this.editorService.editorGroups.map((g) => ({
      resource: g.currentResource,
      openType: g.currentOpenType,
      index: g.index + 1,
    }));
    this.webviewPanelStates.forEach((state, id) => {
      if (!this.hasWebviewPanel(id)) {
        return;
      }
      let hasChange = false;
      const webviewPanel = this.getWebivewPanel(id);
      if (state.active) {
        if (!currentResource || !this.isActive(webviewPanel, currentResource, currentOpenType)) {
          state.active = false;
          hasChange = true;
        }
      } else {
        if (currentResource && this.isActive(webviewPanel, currentResource, currentOpenType)) {
          state.active = true;
          hasChange = true;
        }
      }

      if (state.visible) {
        const exist = visibleResources.find((r) => r.resource && this.isActive(webviewPanel, r.resource, r.openType));
        if (!exist) {
          state.visible = false;
          state.position = -1;
          hasChange = true;
        } else {
          if (exist.index !== state.position) {
            state.position = exist.index;
            hasChange = true;
          }
        }
      } else {
        const exist = visibleResources.find((r) => r.resource && this.isActive(webviewPanel, r.resource, r.openType));
        if (exist) {
          state.visible = true;
          state.position = exist.index;
          hasChange = true;
        }
      }

      if (hasChange) {
        this.proxy.$onDidChangeWebviewPanelViewState(id, state);
        if (state.position !== this.getWebivewPanel(id)!.viewColumn) {
          this.getWebivewPanel(id)!.viewColumn = state.position;
          this._persistWebviewPanelMeta(id);
        }
      }
    });
  }

  $createWebviewPanel(
    id: string,
    viewType: string,
    title: string,
    showOptions: WebviewPanelShowOptions = {},
    options: IWebviewPanelOptions & IWebviewOptions = {},
    extension: IExtensionInfo,
  ): void {
    this.doCreateWebviewPanel(id, viewType, title, showOptions, options, extension);
  }

  public pipeBrowserHostedWebviewPanel(
    webview: IWebview,
    resourceState: {
      uri: URI;
      openTypeId: string;
    },
    viewType: string,
    options: IWebviewPanelOptions,
    extension: IExtensionInfo,
  ) {
    const id = webview.id;
    const webviewPanel = new WebviewPanel(id, viewType, resourceState, {}, {}, extension, webview);
    this.onCreateWebviewPanel(webviewPanel);
    this.proxy.$pipeBrowserHostedWebviewPanel(id, viewType);
  }

  public async reviveWebview(id: string) {
    const persistedWebivewPanelMeta: IWebviewPanelData | undefined = (
      await this.extWebviewStorage
    ).get<IWebviewPanelData>(id);
    if (!persistedWebivewPanelMeta) {
      throw new Error('No revival info for webview ' + id);
    }
    const { viewType, webviewOptions, extensionInfo, title } = persistedWebivewPanelMeta;
    await this.activation.fireEvent('onWebviewPanel', viewType);
    const state = await this.getPersistedWebviewState(viewType, id);
    const editorWebview = this.webviewService.createEditorWebviewComponent(
      {
        allowScripts: webviewOptions.enableScripts,
        allowForms: webviewOptions.enableForms ?? webviewOptions.enableScripts,
        longLive: webviewOptions.retainContextWhenHidden,
      },
      id,
    );
    const viewColumn = editorWebview.group ? editorWebview.group.index + 1 : persistedWebivewPanelMeta.viewColumn;
    await this.doCreateWebviewPanel(id, viewType, title, { viewColumn }, webviewOptions, extensionInfo, state);
    await this.proxy.$deserializeWebviewPanel(
      id,
      viewType,
      title,
      await this.getPersistedWebviewState(viewType, id),
      viewColumn,
      webviewOptions,
    );
  }

  private onCreateWebviewPanel(webviewPanel: WebviewPanel) {
    this.webivewPanels.set(webviewPanel.id, webviewPanel);
    const webview = webviewPanel.webview;
    const id = webviewPanel.id;
    if (webviewPanel.editorWebview) {
      webviewPanel.addDispose(webviewPanel.editorWebview);
    }

    webviewPanel.addDispose(this.connectWebview(webviewPanel.id, webviewPanel.webview));
    webviewPanel.addDispose(
      webview.onRemove(() => {
        webview.dispose();
        this.proxy.$onDidDisposeWebviewPanel(id);
      }),
    );
    this.webviewPanelStates.set(webviewPanel.id, {
      active: false,
      visible: false,
      position: -1,
    });

    this.addDispose({
      dispose: () => {
        if (this.webivewPanels.has(id)) {
          this.getWebivewPanel(id).dispose();
        }
      },
    });
    webview.onDidClickLink((e) => {
      if (this.isSupportedLink(e, webviewPanel.options, webviewPanel.extensionInfo)) {
        this.openerService.open(e);
      }
    });

    this.addDispose(
      webview.onDidUpdateState((state) => {
        if (this._hasSerializer.has(webviewPanel.viewType)) {
          this.persistWebviewState(webviewPanel.viewType, id, state);
        }
      }),
    );
    this._persistWebviewPanelMeta(id);
  }

  private async doCreateWebviewPanel(
    id: string,
    viewType: string,
    title: string,
    showOptions: WebviewPanelShowOptions = {},
    options: IWebviewPanelOptions & IWebviewOptions = {},
    extension: IExtensionInfo,
    initialState?: any,
  ) {
    const editorWebview = this.webviewService.createEditorWebviewComponent(
      {
        allowScripts: options.enableScripts,
        allowForms: options.enableForms ?? options.enableScripts,
        longLive: options.retainContextWhenHidden,
      },
      id,
    );
    const webviewPanel = new WebviewPanel(
      id,
      viewType,
      {
        uri: editorWebview.webviewUri,
        openTypeId: editorWebview.componentId,
      },
      showOptions,
      options,
      extension,
      editorWebview.webview,
      editorWebview,
    );

    editorWebview.title = title;
    this.onCreateWebviewPanel(webviewPanel);
    editorWebview.supportsRevive = this._hasSerializer.has(webviewPanel.viewType);
    const editorOpenOptions = viewColumnToResourceOpenOptions(showOptions.viewColumn);
    editorWebview.open(editorOpenOptions);
    if (initialState) {
      webviewPanel.webview.state = initialState;
    }
  }

  private getWebivewPanel(id): WebviewPanel {
    if (!this.webivewPanels.has(id)) {
      throw new Error('拥有ID ' + id + ' 的 webview 不存在在browser进程中！');
    }
    return this.webivewPanels.get(id)!;
  }

  private hasWebviewPanel(id): boolean {
    return this.webivewPanels.has(id);
  }

  $disposeWebview(id: string): void {
    const webviewPanel = this.getWebivewPanel(id);
    webviewPanel.dispose();
    this.webivewPanels.delete(id);
    this._persistWebviewPanelMeta(id);
  }

  $reveal(id: string, showOptions: WebviewPanelShowOptions = {}): void {
    const webviewPanel = this.getWebivewPanel(id);
    const viewColumn = Object.assign({}, webviewPanel.showOptions, showOptions).viewColumn;
    webviewPanel.editorWebview?.open(viewColumnToResourceOpenOptions(viewColumn));
  }

  $setTitle(id: string, value: string): void {
    const webviewPanel = this.getWebivewPanel(id);
    if (!webviewPanel.editorWebview) {
      return;
    }
    webviewPanel.editorWebview.title = value;
    webviewPanel.title = value;
    this._persistWebviewPanelMeta(id);
  }

  $setIconPath(id: string, value: { light: string; dark: string; hc: string } | undefined): void {
    const webviewPanel = this.getWebivewPanel(id);
    if (!webviewPanel.editorWebview) {
      return;
    }
    if (!value) {
      webviewPanel.editorWebview.icon = '';
    } else {
      webviewPanel.editorWebview.icon =
        this.iconService.fromIcon('', value, IconType.Background)! + ' background-tab-icon';
    }
  }

  public connectWebview(id: string, webview: IWebview): IDisposable {
    this.webviews.set(id, webview);
    const disposable = new Disposable();
    disposable.addDispose(
      webview.onMessage((message) => {
        this.proxy.$onMessage(id, message);
      }),
    );

    disposable.addDispose(addMapElement(this.webviews, id, webview));
    webview.onDispose(() => {
      disposable.dispose();
    });
    return disposable;
  }

  private getWebivew(id: string): IWebview | undefined {
    return this.webviews.get(id);
  }

  $setHtml(id: string, value: string): void {
    this.getWebivew(id)?.setContent(value);
  }

  $setOptions(id: string, options: IWebviewOptions): void {
    this.getWebivew(id)?.updateOptions({ allowScripts: options.enableScripts, allowForms: options.enableForms });
  }

  async $postMessage(id: string, value: any): Promise<boolean> {
    try {
      await this.getWebivew(id)?.postMessage(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  $registerSerializer(viewType: string): void {
    this._hasSerializer.add(viewType);
    this.webivewPanels.forEach((panel) => {
      if (panel.viewType === viewType) {
        if (panel.editorWebview) {
          panel.editorWebview.supportsRevive = true;
        }
      }
    });
  }

  $unregisterSerializer(viewType: string): void {
    this._hasSerializer.add(viewType);
  }

  private _persistWebviewPanelMeta(id: string) {
    return this.extWebviewStorage.then((storage) => {
      if (this.webivewPanels.has(id)) {
        storage.set(id, this.getWebivewPanel(id)!.toJSON());
      } else {
        storage.delete(id);
      }
    });
  }

  async persistWebviewState(viewType: string, id: string, state: any) {
    if (!this.statePersister.has(viewType)) {
      this.statePersister.set(
        viewType,
        this.getStorage(new URI('extension-webview/' + viewType).withScheme(STORAGE_SCHEMA.SCOPE)).then((storage) => {
          const func = throttle((state: any) => storage.set(id, state), 500);
          return async (state: any) => {
            await func(state);
          };
        }),
      );
    }
    (await this.statePersister.get(viewType)!)(state);
  }

  async getPersistedWebviewState(viewType, id): Promise<any> {
    const storage = await this.getStorage(new URI('extension-webview/' + viewType).withScheme(STORAGE_SCHEMA.SCOPE));
    return storage.get(id);
  }

  $connectPlainWebview(id: string) {
    if (!this.plainWebviews.has(id)) {
      const handle =
        this.webviewService.getEditorPlainWebviewComponent(id) ||
        this.webviewService.getOrCreatePlainWebviewComponent(id);
      if (handle) {
        this.plainWebviews.set(id, handle);
        handle.webview.onMessage((message) => {
          this.sumiProxy.$acceptMessage(id, message);
        });
        handle.webview.onDispose(() => {
          this.plainWebviews.delete(id);
        });
      }
    }
  }
  async $postMessageToPlainWebview(id: string, value: any): Promise<boolean> {
    if (this.plainWebviews.has(id)) {
      try {
        await this.plainWebviews.get(id)!.webview.postMessage(value);
        return true;
      } catch (e) {
        this.logger.error(e);
        return false;
      }
    }
    return false;
  }
  async $createPlainWebview(id: string, title: string, iconPath?: string | undefined): Promise<void> {
    const webviewComponent = this.webviewService.createEditorPlainWebviewComponent({}, id);
    webviewComponent.title = title;
    if (iconPath) {
      webviewComponent.icon = this.iconService.fromIcon('', iconPath) || '';
    }
    this.$connectPlainWebview(id);
  }
  async $plainWebviewLoadUrl(id: string, uri: string): Promise<void> {
    if (!this.plainWebviews.has(id)) {
      throw new Error('No Plain Webview With id ' + id);
    }
    await this.plainWebviews.get(id)!.webview.loadURL(uri);
  }

  async $disposePlainWebview(id: string): Promise<void> {
    if (this.plainWebviews.has(id)) {
      this.plainWebviews.get(id)?.dispose();
    }
  }

  async $revealPlainWebview(id: string, groupIndex: number): Promise<void> {
    if (!this.plainWebviews.has(id)) {
      throw new Error('No Plain Webview With id ' + id);
    }
    const handle = this.plainWebviews.get(id);
    if (!(handle as IEditorWebviewComponent<IPlainWebview>).open) {
      throw new Error('not able to open plain webview id:' + id);
    }
    await (handle as IEditorWebviewComponent<IPlainWebview>).open({ groupIndex });
  }

  async $getWebviewResourceRoots(): Promise<string[]> {
    return Array.from(this.staticResourceService.resourceRoots);
  }
}

class WebviewPanel extends Disposable {
  public title: string;

  public viewColumn: number;

  constructor(
    public readonly id: string,
    public readonly viewType: string,
    public readonly resourceState: {
      uri: URI;
      openTypeId: string;
    },
    public readonly showOptions: WebviewPanelShowOptions,
    public readonly options: IWebviewOptions,
    public readonly extensionInfo: IExtensionInfo,
    public readonly webview: IWebview,
    public readonly editorWebview?: IEditorWebviewComponent<IWebview>,
  ) {
    super();
  }

  toJSON(): IWebviewPanelData {
    return {
      id: this.id,
      viewType: this.viewType,
      viewColumn: this.viewColumn,
      extensionInfo: this.extensionInfo,
      webviewOptions: this.options,
      title: this.title,
    };
  }
}

class WebviewView extends Disposable {
  public title: string;

  public viewColumn: number;

  constructor(
    public readonly id: string,
    public readonly viewType: string,
    public readonly extension: IWebviewExtensionDescription,
    public readonly webview: IWebview,
  ) {
    super();
  }
}

type ViewType = string;
@Injectable({ multiple: true })
export class MainThreadWebviewView extends WithEventBus implements IMainThreadWebviewView {
  private _webviewViews = new Map<string, WebviewView>();

  private _resolvers = new Map<
    ViewType,
    {
      extension: IWebviewExtensionDescription;
      options: WebviewViewOptions;
    }
  >();

  proxy: IExtHostWebviewView;

  @Autowired(IMainLayoutService)
  mainLayout: IMainLayoutService;

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  constructor(rpcProtocol: IRPCProtocol, private mainThreadWebview: MainThreadWebview) {
    super();
    this.proxy = rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWebviewView);
  }

  $registerWebviewViewProvider(
    extension: IWebviewExtensionDescription,
    viewType: string,
    options: WebviewViewOptions = {},
  ): void {
    this._resolvers.set(viewType, {
      extension,
      options,
    });
    this.eventBus.fire(
      new WebviewViewResolverRegistrationEvent({
        viewType,
        options,
      }),
    );
  }

  $unregisterWebviewViewProvider(viewType: string): void {
    this._resolvers.delete(viewType);
    this.eventBus.fire(
      new WebviewViewResolverRegistrationRemovalEvent({
        viewType,
      }),
    );
  }

  $setWebviewViewTitle(handle: string, value: string | undefined): void {
    const webviewView = this._webviewViews.get(handle);
    if (webviewView) {
      this.mainLayout.getTabbarHandler(webviewView.viewType)?.updateViewTitle(webviewView.viewType, value || '');
    }
  }

  $setWebviewViewDescription(handle: string, value: string | undefined): void {
    const webviewView = this._webviewViews.get(handle);
    if (webviewView) {
    }
  }

  @OnEvent(WebviewViewShouldShowEvent)
  onWebviewViewShouldShow(e: WebviewViewShouldShowEvent) {
    const viewType = e.payload.viewType;
    if (this._resolvers.has(viewType)) {
      e.payload.disposer.addDispose(
        this.resolveWebviewView(e.payload.container, viewType, e.payload.title, e.payload.cancellationToken),
      );
    } else {
      // 等待注册完成
      this.addDispose(
        this.eventBus.on(WebviewViewResolverRegistrationEvent, (re) => {
          if (re.payload.viewType === viewType && this._resolvers.has(viewType)) {
            e.payload.disposer.addDispose(
              this.resolveWebviewView(e.payload.container, viewType, e.payload.title, e.payload.cancellationToken),
            );
          }
        }),
      );
    }
  }

  public resolveWebviewView(
    container: HTMLElement,
    viewType: string,
    title: string,
    cancellationToken: CancellationToken,
  ): IDisposable {
    const disposer = new Disposable();
    const webview = this.webviewService.createWebview()!;
    const options = this._resolvers.get(viewType)?.options;
    const extension = this._resolvers.get(viewType)!.extension;
    const id = webview.id;
    const webviewView = new WebviewView(id, viewType, extension, webview);
    webviewView.addDispose(this.mainThreadWebview.connectWebview(id, webview));
    webviewView.addDispose(addMapElement(this._webviewViews, id, webviewView));
    webviewView.addDispose(webview);

    // 如果当前 view container 变化时触发 webview 的显隐
    const changeWebviewViewVisibility = () => {
      const isVisible = this.mainLayout.isViewVisible(viewType);
      this.proxy.$onDidChangeWebviewViewVisibility(id, isVisible);
      if (!options?.retainContextWhenHidden) {
        if (isVisible) {
          webview.appendTo(container);
        } else {
          webview.remove();
        }
      }
    };

    disposer.addDispose(
      this.eventBus.on(ViewCollapseChangedEvent, (e) => {
        if (e.payload.viewId === viewType) {
          changeWebviewViewVisibility();
        }
      }),
    );
    const tabbarHandler = this.mainLayout.getTabbarHandler(viewType);
    if (tabbarHandler) {
      disposer.addDispose(
        tabbarHandler?.onActivate(() => {
          changeWebviewViewVisibility();
        }),
      );
      disposer.addDispose(
        tabbarHandler?.onInActivate(() => {
          changeWebviewViewVisibility();
        }),
      );
    }
    this.proxy.$resolveWebviewView(id, viewType, title, webview.state, cancellationToken);
    const isVisible = this.mainLayout.isViewVisible(viewType);
    this.proxy.$onDidChangeWebviewViewVisibility(id, isVisible);
    if (options?.retainContextWhenHidden || isVisible) {
      webview.appendTo(container);
    }
    disposer.addDispose(webviewView);
    return {
      dispose: () => webviewView.dispose(),
    };
  }

  $show(handle: string, preserveFocus: boolean): void {
    const webviewView = this._webviewViews.get(handle);
    if (webviewView) {
      this.mainLayout.revealView(webviewView.viewType);
    }
  }
}

interface IWebviewPanelData {
  id: string;
  viewType: string;
  viewColumn: number;
  webviewOptions: IWebviewOptions & IWebviewPanelOptions;
  title: string;
  extensionInfo: IExtensionInfo;
}
