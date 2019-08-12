import { IWebviewService, IPlainWebviewConstructionOptions, IPlainWebview, IWebview, IWebviewContentOptions, IWebviewThemeData, IEditorWebviewComponent, EDITOR_WEBVIEW_SCHEME, IEditorWebviewMetaData } from './types';
import { isElectronRenderer, getLogger, localize, URI, IEventBus, Disposable, MaybeNull } from '@ali/ide-core-browser';
import { ElectronPlainWebview, IframePlainWebview } from './plain-weview';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IFrameWebviewPanel } from './iframe-webview';
import { ITheme, IThemeService } from '@ali/ide-theme';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { getColorRegistry } from '@ali/ide-theme/lib/common/color-registry';
import { IEditorGroup, WorkbenchEditorService, ResourceNeedUpdateEvent, IResource, ResourceService } from '@ali/ide-editor';
import { EditorComponentRegistry, EditorComponentRenderMode } from '@ali/ide-editor/lib/browser';
import { EditorWebviewComponentView } from './editor-webview';

@Injectable()
export class WebviewServiceImpl implements IWebviewService {

  private webviewIdCount = 0;

  private editorWebviewIdCount = 0;

  public readonly editorWebviewComponents = new Map<string, EditorWebviewComponent<IWebview | IPlainWebview>>();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  constructor() {

  }

  createPlainWebview(options: IPlainWebviewConstructionOptions = {}): IPlainWebview {

    if (isElectronRenderer()) {
      if (options.preferredImpl && options.preferredImpl === 'iframe') {
        return new IframePlainWebview();
      }
      return new ElectronPlainWebview();
    } else {
      if (options.preferredImpl && options.preferredImpl === 'webview') {
        getLogger().warn(localize('webview.webviewTagUnavailable', '无法在非Electron环境使用Webview标签。回退至使用iframe。'));
      }
      return new IframePlainWebview();
    }

  }

  createWebview(options?: IWebviewContentOptions): IWebview {
    if (isElectronRenderer()) {
      return this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    } else {
      return this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    }
  }

  createEditorWebviewComponent(options?: IWebviewContentOptions): IEditorWebviewComponent<IWebview> {
    const id = (this.editorWebviewIdCount++).toString();
    const component = this.injector.get(EditorWebviewComponent, [id, () => this.createWebview(options)]) as EditorWebviewComponent<IWebview>;
    this.editorWebviewComponents.set(id, component);
    return component;
  }

  createEditorPlainWebviewComponent(options?: IPlainWebviewConstructionOptions): IEditorWebviewComponent<IPlainWebview> {
    const id = (this.editorWebviewIdCount++).toString();
    const component = this.injector.get(EditorWebviewComponent, [id, () => this.createPlainWebview(options)]) as EditorWebviewComponent<IPlainWebview>;
    this.editorWebviewComponents.set(id, component);
    return component;
  }

  getWebviewThemeData(theme: ITheme): IWebviewThemeData {
    const editorFontFamily = this.corePreferences['editor.fontFamily'];
    const editorFontWeight = this.corePreferences['editor.fontFamily'];
    const editorFontSize = this.corePreferences['editor.fontSize'];

    const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
      const color = theme.getColor(entry.id);
      if (color) {
        colors['vscode-' + entry.id.replace('.', '-')] = color.toString();
      }
      return colors;
    }, {} as { [key: string]: string });

    const styles = {
      'vscode-font-family': '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", ans-serif',
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

@Injectable({multiple: true})
export class EditorWebviewComponent<T extends IWebview | IPlainWebview> extends Disposable implements IEditorWebviewComponent<T> {

  group: IEditorGroup;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private _webview: MaybeNull<T>;

  open(groupIndex?: number | undefined) {
    this.workbenchEditorService.open(this.webviewUri, {index: groupIndex});
  }

  close() {
    this.workbenchEditorService.closeAll(this.webviewUri);
  }

  private _title: string = 'Webview';

  private _icon: string = '';

  get icon() {
    return this._icon;
  }

  set icon(icon: string) {
    this._icon = icon;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
  }

  get title() {
    return this._title;
  }

  set title(title: string) {
    this._title = title;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
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
        editorWebview: this,
      },
    };
  }

  get webviewUri(): URI {
    return URI.from({
      scheme: EDITOR_WEBVIEW_SCHEME,
      path: this.id,
    });
  }

  constructor(public readonly id: string, public webviewFactory: () =>  T) {
    super();
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.addDispose(this.editorComponentRegistry.registerEditorComponent<{editorWebview: IEditorWebviewComponent<IWebview | IPlainWebview>}>({
      scheme: EDITOR_WEBVIEW_SCHEME,
      uid: componentId,
      component: EditorWebviewComponentView,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    }));
    this.addDispose(this.editorComponentRegistry.registerEditorComponentResolver<{editorWebview: IEditorWebviewComponent<IWebview | IPlainWebview>}>(EDITOR_WEBVIEW_SCHEME, (resource, results) => {
      if (resource.uri.path.toString() === this.id) {
        results.push({
          type: 'component',
          componentId,
        });
      }
    }));

  }

  createWebview(): T {
    this._webview = this.webviewFactory();
    this.addDispose(this._webview!);
    return this._webview;
  }

  clear() {
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.editorComponentRegistry.clearPerWorkbenchComponentCache(componentId);
    this.webview.remove();
  }

}
