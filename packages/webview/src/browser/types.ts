import { Event, URI, IDisposable, MaybeNull, MaybePromise } from '@opensumi/ide-core-common';
import { IEditorGroup } from '@opensumi/ide-editor';
import { ITheme } from '@opensumi/ide-theme';

export const EDITOR_WEBVIEW_SCHEME = 'editor-webview';
/**
 * webview Panel实际上是一个iframe中的内容
 * 叫webview panel只是为了和以前vscode中的说法一致
 * 它会存在两种具体的实现，
 *  对于Electron, 使用webview进行一次包裹，里面再嵌入iframe，可以保证各个WebviewPanel的内容的独立性
 *  对于Web， 需要将每个iframe的src挂载在一个webviewEndPoint上，（同一个webviewEndPoint的内容共享一个线程，
 *      因此如果有些webview需要保证安全和稳定性的话需要使用不同的EndPoint）
 */
export interface IWebview extends IDisposable {
  readonly id: string;

  readonly options: IWebviewContentOptions;

  /**
   * 一开始的滚动位置
   */
  initialScrollProgress: number;

  /**
   * 状态值
   */
  state: any;

  postMessage(message: any): Promise<void>;

  getContent(): string;

  setContent(html: string): Promise<void>;

  /**
   * 更新选项
   * @param options 选项
   * @param longLive 是否保留webview对象在内存中
   */
  updateOptions(options: IWebviewContentOptions): void;

  /**
   * 更新内部iframe大小使其适应外部大小
   */
  layout(): void;

  /**
   * 挂在一个
   * @param parent
   */
  appendTo(container: HTMLElement): void;

  focus(): void;

  reload(): void;

  getDomNode(): MaybeNull<HTMLElement>;

  remove(): void;

  onDispose: Event<void>;

  readonly onDidFocus: Event<void>;
  readonly onDidBlur: Event<void>;
  readonly onDidClickLink: Event<URI>;
  readonly onDidScroll: Event<IWebviewContentScrollPosition>;
  readonly onDidUpdateState: Event<any>;
  readonly onMessage: Event<any>;
  readonly onRemove: Event<void>;

  setListenMessages(listening: boolean): void;

  setKeybindingDomTarget(target: HTMLElement): void;
}

export interface IWebviewContentOptions {
  readonly allowScripts?: boolean;
  readonly allowForms?: boolean;
  readonly svgWhiteList?: string[];
  readonly localResourceRoots?: ReadonlyArray<URI>;
  readonly longLive?: boolean;
  readonly enableFindWidget?: boolean;
}

export interface IWebviewContentScrollPosition {
  scrollYPercentage: number;
  scrollXPercentage: number;
}

// 纯粹的Webview或者Iframe元素。加载一个url
export interface IPlainWebview extends IDisposable {
  readonly url: string | undefined;

  loadURL(url: string): Promise<void>;

  appendTo(container: HTMLElement): void;

  postMessage(message: any): void;

  onMessage: Event<any>;

  getDomNode(): MaybeNull<HTMLElement>;

  onDispose: Event<void>;

  readonly onRemove: Event<void>;

  remove(): void;

  onLoadURL: Event<string>;
}

/**
 * 打开一个新的窗口，并显示一个url中的内容
 * 暂时仅限 electron 中使用
 */
export interface IPlainWebviewWindow extends IDisposable {
  ready: Promise<void>;

  readonly url: string | undefined;

  loadURL(url: string): Promise<void>;

  show(): Promise<void>;

  hide(): Promise<void>;

  postMessage(message: any): Promise<void>;

  onMessage: Event<any>;

  onClosed: Event<void>;

  setSize(size: { width?: number; height?: number }): Promise<void>;

  setAlwaysOnTop(flag: boolean): Promise<void>;

  windowId: number;

  webContentsId: number;
}

export const IWebviewService = Symbol('IWebviewService');

export interface IWebviewService {
  createPlainWebview(options?: IPlainWebviewConstructionOptions): IPlainWebview;

  createWebview(options?: IWebviewContentOptions): IWebview;

  getWebview(id: string): IWebview | undefined;

  createEditorWebviewComponent(options?: IWebviewContentOptions, id?: string): IEditorWebviewComponent<IWebview>;

  createEditorPlainWebviewComponent(
    options?: IPlainWebviewConstructionOptions,
    id?: string,
  ): IEditorWebviewComponent<IPlainWebview>;

  getWebviewThemeData(theme: ITheme): IWebviewThemeData;

  getOrCreatePlainWebviewComponent(
    id: string,
    options?: IPlainWebviewConstructionOptions,
  ): IPlainWebviewComponentHandle;

  getEditorPlainWebviewComponent(id: string): IEditorWebviewComponent<IPlainWebview> | undefined;

  getPlainWebviewComponent(id: string): IPlainWebviewComponentHandle | undefined;

  /**
   * 创建一个 window 的 webview 容器, 暂时只支持 electron
   * @param options electron的创建的options
   * @param env 会传递给 webview内的 window.env 的内容
   */
  createWebviewWindow(
    options?: Electron.BrowserWindowConstructorOptions,
    env?: { [key: string]: string },
  ): IPlainWebviewWindow;

  registerWebviewReviver(reviver: IWebviewReviver): IDisposable;

  tryReviveWebviewComponent(id: string): Promise<void>;
}

export interface IPlainWebviewConstructionOptions {
  // 喜好使用的实现
  // 在web上无法使用 webview
  preferredImpl?: 'webview' | 'iframe';
}

export interface IWebviewThemeData {
  readonly activeTheme: string;
  readonly styles: { readonly [key: string]: string | number };
}

export interface IEditorWebviewComponent<T extends IWebview | IPlainWebview> extends IDisposable {
  // 唯一id
  id: string;

  // webview
  webview: T;

  // 容纳它的
  group: IEditorGroup | undefined;

  icon: string;

  title: string;

  open(options: { groupIndex?: number; relativeGroupIndex?: number });

  close();

  webviewUri: URI;

  componentId: string;

  onDidChangeGroupIndex: Event<number>;

  /**
   * 是否支持恢复
   */
  supportsRevive: boolean;
}

export interface IPlainWebviewComponentHandle extends IDisposable {
  // 唯一id
  id: string;

  webview: IPlainWebview;
}

export interface IEditorWebviewMetaData {
  id: string;
  options?: IWebviewContentOptions;
}

export interface IWebviewReviver {
  /**
   * revive 动作
   */
  revive: (id: string) => MaybePromise<void>;

  /**
   * 返回是否由它revive的优先级
   * 负数表示不处理
   */
  handles: (id: string) => MaybePromise<number>;
}

export function isWebview(webview: IWebview | IPlainWebview): webview is IWebview {
  return webview && !!(webview as IWebview).setContent;
}
