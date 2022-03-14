import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import {
  getDebugLogger,
  localize,
  URI,
  IEventBus,
  Disposable,
  MaybeNull,
  ILogger,
  addElement,
  Emitter,
  StorageProvider,
  IStorage,
  STORAGE_SCHEMA,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { IEditorGroup, WorkbenchEditorService, ResourceNeedUpdateEvent, IResource } from '@opensumi/ide-editor';
import {
  EditorComponentRegistry,
  EditorComponentRenderMode,
  EditorPreferences,
  EditorGroupChangeEvent,
} from '@opensumi/ide-editor/lib/browser';
import { ITheme } from '@opensumi/ide-theme';
import { getColorRegistry } from '@opensumi/ide-theme/lib/common/color-registry';

import { EditorWebviewComponentView } from './editor-webview';
import { ElectronWebviewWebviewPanel } from './electron-webview-webview';
import { IFrameWebviewPanel } from './iframe-webview';
import { ElectronPlainWebview, IframePlainWebview } from './plain-webview';
import {
  IWebviewService,
  IPlainWebviewConstructionOptions,
  IPlainWebview,
  IWebview,
  IWebviewContentOptions,
  IWebviewThemeData,
  IEditorWebviewComponent,
  EDITOR_WEBVIEW_SCHEME,
  IEditorWebviewMetaData,
  IPlainWebviewComponentHandle,
  IPlainWebviewWindow,
  IWebviewReviver,
} from './types';
import { ElectronPlainWebviewWindow } from './webview-window';

@Injectable()
export class WebviewServiceImpl implements IWebviewService {
  private webviewIdCount = 0;

  private editorWebviewIdCount = 0;

  public readonly editorWebviewComponents = new Map<string, EditorWebviewComponent<IWebview | IPlainWebview>>();

  public readonly plainWebviewsComponents = new Map<string, IPlainWebviewComponentHandle>();

  private readonly webviews = new Map<string, IWebview>();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(EditorPreferences)
  protected readonly editorPreferences: EditorPreferences;

  private _revivers: IWebviewReviver[] = [];

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  storage: Promise<IStorage>;

  constructor() {
    this.storage = this.getStorage(new URI('editor-webview').withScheme(STORAGE_SCHEMA.SCOPE));
  }

  async tryReviveWebviewComponent(id: string) {
    if (this._revivers.length > 0) {
      let targetReviver:
        | {
            weight: number;
            reviver: IWebviewReviver;
          }
        | undefined;
      for (const reviver of this._revivers) {
        try {
          const weight = await reviver.handles(id);
          if (weight >= 0 && (!targetReviver || targetReviver.weight < weight)) {
            targetReviver = {
              weight,
              reviver,
            };
          }
        } catch (e) {
          this.logger.error(e);
        }
      }
      if (targetReviver) {
        try {
          await targetReviver.reviver.revive(id);
          return;
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
    throw new Error('Cannot revive webview ' + id);
  }

  registerWebviewReviver(reviver: IWebviewReviver) {
    return addElement(this._revivers, reviver);
  }

  createPlainWebview(options: IPlainWebviewConstructionOptions = {}): IPlainWebview {
    if (this.appConfig.isElectronRenderer) {
      if (options.preferredImpl && options.preferredImpl === 'iframe') {
        return new IframePlainWebview();
      }
      return new ElectronPlainWebview();
    } else {
      if (options.preferredImpl && options.preferredImpl === 'webview') {
        getDebugLogger().warn(
          localize('webview.webviewTagUnavailable', '无法在非Electron环境使用Webview标签。回退至使用iframe。'),
        );
      }
      return new IframePlainWebview();
    }
  }

  createWebview(options?: IWebviewContentOptions): IWebview {
    let webview: IWebview;
    if (this.appConfig.isElectronRenderer) {
      webview = this.injector.get(ElectronWebviewWebviewPanel, [(this.webviewIdCount++).toString(), options]);
    } else {
      webview = this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount++).toString(), options]);
    }
    this.webviews.set(webview.id, webview);
    webview.onRemove(() => {
      this.webviews.delete(webview.id);
    });
    return webview;
  }

  getWebview(id: string): IWebview | undefined {
    return this.webviews.get(id);
  }

  private async storeWebviewResource(id: string) {
    return this.storage.then((storage) => {
      if (this.editorWebviewComponents.has(id)) {
        const res = { ...this.editorWebviewComponents.get(id)!.resource };
        storage.set(id, JSON.stringify(res));
      } else {
        storage.delete(id);
      }
    });
  }

  public async tryRestoredWebviewComponent(id: string): Promise<void> {
    const storage = await this.storage;
    const resource: IResource<IEditorWebviewMetaData> | null = storage.get(id) ? JSON.parse(storage.get(id)!) : null;
    if (resource) {
      const component = this.createEditorWebviewComponent(resource.metadata?.options, resource.metadata?.id);
      component.title = resource.name;
      component.supportsRevive = !!resource.supportsRevive;
      this.tryReviveWebviewComponent(id);
    }
  }

  createEditorWebviewComponent(options?: IWebviewContentOptions, id?: string): IEditorWebviewComponent<IWebview> {
    if (!id) {
      id = (this.editorWebviewIdCount++).toString();
    }
    if (this.editorWebviewComponents.has(id)) {
      return this.editorWebviewComponents.get(id) as IEditorWebviewComponent<IWebview>;
    }
    const component = this.injector.get(EditorWebviewComponent, [
      id,
      () => this.createWebview(options),
    ]) as EditorWebviewComponent<IWebview>;
    this.editorWebviewComponents.set(id, component);
    component.addDispose({
      dispose: () => {
        this.editorWebviewComponents.delete(id!);
      },
    });
    component.onDidUpdateResource(() => {
      this.storeWebviewResource(id!);
    });
    return component;
  }

  createEditorPlainWebviewComponent(
    options: IPlainWebviewConstructionOptions = {},
    id: string,
  ): IEditorWebviewComponent<IPlainWebview> {
    id = id || (this.editorWebviewIdCount++).toString();
    if (this.editorWebviewComponents.has(id)) {
      return this.editorWebviewComponents.get(id) as IEditorWebviewComponent<IPlainWebview>;
    }
    const component = this.injector.get(EditorWebviewComponent, [
      id,
      () => this.createPlainWebview(options),
    ]) as EditorWebviewComponent<IPlainWebview>;
    this.editorWebviewComponents.set(id, component);
    component.addDispose({
      dispose: () => {
        this.editorWebviewComponents.delete(id!);
      },
    });
    return component;
  }

  getWebviewThemeData(theme: ITheme): IWebviewThemeData {
    const editorFontFamily = this.editorPreferences['editor.fontFamily'];
    const editorFontWeight = this.editorPreferences['editor.fontFamily'];
    const editorFontSize = this.editorPreferences['editor.fontSize'];

    const exportedColors = getColorRegistry()
      .getColors()
      .reduce((colors, entry) => {
        const color = theme.getColor(entry.id);
        if (color) {
          colors['vscode-' + entry.id.replace('.', '-')] = color.toString();
        }
        return colors;
      }, {} as { [key: string]: string });

    const styles = {
      'vscode-font-family':
        '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", ans-serif',
      'vscode-font-weight': 'normal',
      'vscode-font-size': '13px',
      'vscode-editor-font-family': editorFontFamily,
      'vscode-editor-font-weight': editorFontWeight,
      'vscode-editor-font-size': editorFontSize,
      ...exportedColors,
    };

    const activeTheme = ApiThemeClassName.fromTheme(theme);
    return { styles, activeTheme };
  }

  getOrCreatePlainWebviewComponent(
    id: string,
    options?: IPlainWebviewConstructionOptions | undefined,
  ): IPlainWebviewComponentHandle {
    if (!this.plainWebviewsComponents.has(id)) {
      const webview = this.createPlainWebview(options);
      const component = this.injector.get(PlainWebviewComponent, [id, webview]);
      this.plainWebviewsComponents.set(id, component);
      component.onDispose(() => {
        this.plainWebviewsComponents.delete(id);
      });
    }
    return this.plainWebviewsComponents.get(id)!;
  }

  getEditorPlainWebviewComponent(id: string): IEditorWebviewComponent<IPlainWebview> | undefined {
    const component = this.editorWebviewComponents.get(id);
    if (component && (component.webview as IPlainWebview).loadURL) {
      return component as IEditorWebviewComponent<IPlainWebview>;
    }
  }
  getPlainWebviewComponent(id: string): IPlainWebviewComponentHandle | undefined {
    return this.plainWebviewsComponents.get(id);
  }

  createWebviewWindow(
    options?: Electron.BrowserWindowConstructorOptions,
    env?: { [key: string]: string },
  ): IPlainWebviewWindow {
    if (this.appConfig.isElectronRenderer) {
      return this.injector.get(ElectronPlainWebviewWindow, [options, env]);
    }
    throw new Error('not supported!');
  }
}

enum ApiThemeClassName {
  light = 'vscode-light',
  dark = 'vscode-dark',
  highContrast = 'vscode-high-contrast',
}

namespace ApiThemeClassName {
  export function fromTheme(theme: ITheme): ApiThemeClassName {
    if (theme.type === 'light') {
      return ApiThemeClassName.light;
    } else if (theme.type === 'dark') {
      return ApiThemeClassName.dark;
    } else {
      return ApiThemeClassName.highContrast;
    }
  }
}

@Injectable({ multiple: true })
export class EditorWebviewComponent<T extends IWebview | IPlainWebview>
  extends Disposable
  implements IEditorWebviewComponent<T>
{
  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private _webview: MaybeNull<T>;

  private _onDidUpdateResource = new Emitter<IResource<IEditorWebviewMetaData>>();
  public readonly onDidUpdateResource = this._onDidUpdateResource.event;

  private _onDidChangeGroupIndex = new Emitter<number>();
  public onDidChangeGroupIndex = this._onDidChangeGroupIndex.event;

  private _supportsRevive = false;

  get supportsRevive() {
    return this._supportsRevive;
  }

  set supportsRevive(value: boolean) {
    this._supportsRevive = value;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
    this._onDidUpdateResource.fire(this.resource);
  }

  open(options: { groupIndex?: number; relativeGroupIndex?: number }) {
    return this.workbenchEditorService.open(this.webviewUri, { ...options, preview: false });
  }

  close() {
    this.workbenchEditorService.closeAll(this.webviewUri);
  }

  private _title = 'Webview';

  private _icon = '';

  get icon() {
    return this._icon;
  }

  set icon(icon: string) {
    this._icon = icon;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
    this._onDidUpdateResource.fire(this.resource);
  }

  get title() {
    return this._title;
  }

  set title(title: string) {
    this._title = title;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
    this._onDidUpdateResource.fire(this.resource);
  }

  get webview() {
    if (!this._webview) {
      this.createWebview();
    }
    return this._webview!;
  }

  get resource(): IResource<IEditorWebviewMetaData> {
    return {
      icon: this.icon,
      name: this.title,
      uri: this.webviewUri,
      metadata: {
        id: this.id,
        options: (this.webview as IWebview).options,
      },
      supportsRevive: this.supportsRevive,
    };
  }

  get webviewUri(): URI {
    return URI.from({
      scheme: EDITOR_WEBVIEW_SCHEME,
      path: this.id,
    });
  }

  get editorGroup(): IEditorGroup | undefined {
    const uri = this.webviewUri;
    return this.workbenchEditorService.editorGroups.find(
      (g) => g.resources.findIndex((r) => r.uri.isEqual(uri)) !== -1,
    );
  }

  get group() {
    return this.editorGroup;
  }

  get componentId() {
    return EDITOR_WEBVIEW_SCHEME + '_' + this.id;
  }

  constructor(public readonly id: string, public webviewFactory: () => T) {
    super();
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.addDispose(
      this.editorComponentRegistry.registerEditorComponent<IEditorWebviewMetaData>({
        scheme: EDITOR_WEBVIEW_SCHEME,
        uid: componentId,
        component: EditorWebviewComponentView,
        renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
      }),
    );
    this.addDispose(
      this.editorComponentRegistry.registerEditorComponentResolver<IEditorWebviewMetaData>(
        EDITOR_WEBVIEW_SCHEME,
        (resource, results) => {
          if (resource.uri.path.toString() === this.id) {
            results.push({
              type: 'component',
              componentId,
            });
          }
        },
      ),
    );
    this.addDispose({
      dispose: () => {
        this.workbenchEditorService.closeAll(this.webviewUri, true);
      },
    });
    this.addDispose(
      this.eventBus.on(EditorGroupChangeEvent, (e) => {
        if (e.payload.newResource?.uri.isEqual(this.webviewUri)) {
          this._onDidChangeGroupIndex.fire(e.payload.group.index);
        }
      }),
    );
  }

  createWebview(): T {
    this._webview = this.webviewFactory();
    this.addDispose(this._webview!);
    if (typeof (this._webview as IWebview).onDidFocus === 'function') {
      this.addDispose(
        (this._webview as IWebview).onDidFocus(() => {
          if (this.editorGroup) {
            (this.editorGroup as any).gainFocus();
          }
        }),
      );
    }
    return this._webview;
  }

  clear() {
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.editorComponentRegistry.clearPerWorkbenchComponentCache(componentId);
    this.webview.remove();
  }
}

@Injectable({ multiple: true })
export class PlainWebviewComponent extends Disposable implements IPlainWebviewComponentHandle {
  constructor(public readonly id: string, public readonly webview) {
    super();
    this.addDispose(this.webview);
  }
}
