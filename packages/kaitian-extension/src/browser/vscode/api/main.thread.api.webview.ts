import { IMainThreadWebview, WebviewPanelShowOptions, IWebviewPanelOptions, IWebviewOptions, ExtHostAPIIdentifier, IExtHostWebview, IWebviewPanelViewState } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { UriComponents } from '../../../common/vscode/ext-types';
import { IWebviewService, IEditorWebviewComponent, IWebview, EDITOR_WEBVIEW_SCHEME, IPlainWebview, IPlainWebviewComponentHandle } from '@ali/ide-webview';
import { IRPCProtocol } from '@ali/ide-connection';
import { WorkbenchEditorService, IResource } from '@ali/ide-editor';
import { IDisposable, Disposable, URI, MaybeNull, IEventBus, ILogger } from '@ali/ide-core-browser';
import { EditorGroupChangeEvent } from '@ali/ide-editor/lib/browser';
import { IKaitianExtHostWebviews } from '../../../common/kaitian/webview';
import { IIconService } from '@ali/ide-theme';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

@Injectable({multiple: true})
export class MainThreadWebview extends Disposable implements IMainThreadWebview {

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  private webivewPanels: Map<string, IWebviewPanel> = new Map();

  private plainWebviews: Map<string, IEditorWebviewComponent<IPlainWebview> |  IPlainWebviewComponentHandle > = new Map();

  private activeWebivewPanel: string;

  private readonly _revivers = new Set<string>();

  private webviewPanelStates: Map<string, IWebviewPanelViewState> = new Map();

  private proxy: IExtHostWebview;

  private kaitianProxy: IKaitianExtHostWebviews;

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

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWebivew);
    this.kaitianProxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.KaitianExtHostWebview);
    this.initEvents();
  }

  initEvents() {
    this.addDispose(this.editorService.onActiveResourceChange(() => {
      this.onChange();
    }));

    this.addDispose(this.eventBus.on(EditorGroupChangeEvent, () => {
      this.onChange();
    }));
  }

  onChange() {
    const currentResource = this.editorService.currentResource;
    const visibleResources: {
      resource: MaybeNull<IResource>,
      index: number,
    }[] = this.editorService.editorGroups.map((g) => {
      return {
        resource: g.currentResource,
        index: g.index,
      };
    });
    this.webviewPanelStates.forEach((state, id) => {
      if (!this.hasWebviewPanel(id)) {
        return ;
      }
      let hasChange = false;
      const webviewPanel = this.getWebivewPanel(id);
      if (state.active) {
        if (!currentResource || !webviewPanel.resourceUri.isEqual(currentResource.uri)) {
          state.active = false;
          hasChange = true;
        }
      } else {
        if (currentResource && webviewPanel.resourceUri.isEqual(currentResource.uri)) {
          state.active = true;
          hasChange = true;
        }
      }

      if (state.visible) {
        const exist = visibleResources.find((r) => r.resource && r.resource.uri.isEqual(webviewPanel.resourceUri));
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
        const exist = visibleResources.find((r) => r.resource && r.resource.uri.isEqual(webviewPanel.resourceUri));
        if (exist) {
          state.visible = true;
          state.position = exist.index;
          hasChange = true;
        }
      }

      if (hasChange) {
        this.proxy.$onDidChangeWebviewPanelViewState(id, state);
      }

    });
  }

  $createWebviewPanel(id: string, viewType: string , title: string, showOptions: WebviewPanelShowOptions = {}, options: IWebviewPanelOptions & IWebviewOptions = {}): void {
    const editorWebview = this.webviewService.createEditorWebviewComponent({allowScripts: options.enableScripts, longLive: options.retainContextWhenHidden});
    const disposer = new Disposable();
    editorWebview.title = title;
    disposer.addDispose(editorWebview);
    disposer.addDispose(editorWebview.webview.onMessage((message) => {
      this.proxy.$onMessage(id, message);
    }));
    disposer.addDispose(editorWebview.webview.onDispose(() => {
      this.proxy.$onDidDisposeWebviewPanel(id);
    }));
    this.webviewPanelStates.set(id, {
      active: false,
      visible: false,
      position: -1,
    });
    this.webivewPanels.set(id, {
      id,
      resourceUri: editorWebview.webviewUri,
      editorWebview,
      showOptions,
      dispose: disposer.dispose.bind(disposer),
    });
    this.addDispose({dispose: () => {
      if (this.webivewPanels.has(id)) {
        this.getWebivewPanel(id).dispose();
      }
    }});
    editorWebview.webview.onDidClickLink((e) => {
      window.open(e.toString());
    });
    editorWebview.open(showOptions.viewColumn);

  }

  private getWebivewPanel(id): IWebviewPanel  {
    if (!this.webivewPanels.has(id)) {
      throw new Error('拥有ID ' + id + ' 的webviewPanel不存在在browser进程中！');
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
  }
  $reveal(id: string, showOptions: WebviewPanelShowOptions = {}): void {
    const webviewPanel = this.getWebivewPanel(id);
    webviewPanel.editorWebview.open(Object.assign({}, webviewPanel.showOptions, showOptions).viewColumn);
  }

  $setTitle(id: string, value: string): void {
    const webviewPanel = this.getWebivewPanel(id);
    webviewPanel.editorWebview.title = value;
  }

  $setIconPath(id: string, value: { light: string; dark: string; hc: string; } | undefined): void {
    const webviewPanel = this.getWebivewPanel(id);
    if (!value) {
      webviewPanel.editorWebview.icon = '';
    } else {
      webviewPanel.editorWebview.icon = this.iconService.fromIconUrl(value)! + ' background-tab-icon';
    }
  }

  $setHtml(id: string, value: string): void {
    const webviewPanel = this.getWebivewPanel(id);
    webviewPanel.editorWebview.webview.setContent(value);
  }

  $setOptions(id: string, options: IWebviewOptions): void {
    const webviewPanel = this.getWebivewPanel(id);
    webviewPanel.editorWebview.webview.updateOptions({allowScripts: options.enableScripts});
  }

  async $postMessage(id: string, value: any): Promise<boolean> {
    try {
      const webviewPanel = this.getWebivewPanel(id);
      await webviewPanel.editorWebview.webview.postMessage(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  $registerSerializer(viewType: string): void {
    // TODO
  }

  $unregisterSerializer(viewType: string): void {
   // TODO
  }

  $connectPlainWebview(id: string) {
    if (!this.plainWebviews.has(id)) {
      const handle = this.webviewService.getEditorPlainWebviewComponent(id) || this.webviewService.getOrCreatePlainWebviewComponent(id);
      if (handle) {
        this.plainWebviews.set(id, handle);
        handle.webview.onMessage((message) => {
          this.kaitianProxy.$acceptMessage(id, message);
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
    await (handle as IEditorWebviewComponent<IPlainWebview>).open(groupIndex);
  }

  async $getWebviewResourceRoots(): Promise<string[]> {
    return Array.from(this.staticResourceService.resourceRoots);
  }

}

interface IWebviewPanel extends IDisposable {
  id: string;
  resourceUri: URI;
  editorWebview: IEditorWebviewComponent<IWebview>;
  showOptions: WebviewPanelShowOptions;
}
