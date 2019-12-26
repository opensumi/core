declare module "kaitian" {

  export * from 'vscode';

  export namespace layout {
    /**
     * 切换底部面板显示/隐藏
     */
    export function toggleBottomPanel(): Promise<void>;

    /**
     * 获取一个 Tab 的 Handle
     * @param id tab id
     */
    export function getTabbarHandler(id: string): ITabbarHandle;
    
    /**
     * 切换左侧面板显示/隐藏
     */
    export function toggleLeftPanel(): Promise<void>;

    /**
     * 切换右侧面板显示/隐藏
     */
    export function toggleRightPanel(): Promise<void>;

    /**
     * 显示右侧面板
     */
    export function showRightPanel(): Promise<void>;

    /**
     * 隐藏右侧面板
     */
    export function hideRightPanel(): Promise<void>;

    /**
     * 激活指定 id 的面板，需在注册时指定 activateKeyBinding
     * @param id 
     */
    export function activatePanel(id: string): Promise<void>;

    /**
     * 返回底部面板是否可见
     */
    export function isBottomPanelVisible(): Promise<boolean>;

    /**
     * 返回左侧面板是否可见
     */
    export function isLeftPanelVisible(): Promise<boolean>;

    /**
     * 返回右侧面板是否可见
     */
    export function isRightPanelVisible(): Promise<boolean>;
  }

  export namespace ideWindow {

    /**
     * 刷新当前 IDE 窗口
     */
    export function reloadWindow(): void;
  }

  export namespace lifecycle {
    /**
     * 设置 IDE 所加载的插件目录，仅 Electron 下可用，调用后需刷新当前窗口
     * @param extensionDir 插件目录
     */
    export function setExtensionDir(extensionDir: string): Promise<void>;

    /**
     * 设置 IDE 所加载的额外插件列表，具体到插件路径
     * @param extensionCandidate 插件列表
     * 
     * @example
     * ```typescript
     * lifecycle.setExtensionCandidate([
     *  { path: '/path/to/ext-1.0', isBuintin: true }
     * ]);
     * ```
     */
    export function setExtensionCandidate(extensionCandidate: ExtensionCandiDate[]): Promise<void>;
  }

  /**
   * 主题相关API
   */
  export namespace theme {
    
    /**
     * 当主题被改变时的通知
     */
    export const onThemeChanged: Event<void>;

    /**
     * 获得当前主题的颜色值
     * 格式 '-分割的颜色名':'颜色值(rgb, rgba或hex)'
     * @example
     * ```json
     * {
     *  'editor-background':'#000000',
     * }
     * ```
     */
    export function getThemeColors(): Promise<{[key: string]: string}>;

  }

  export interface ExtensionCandiDate {
    path: string;
    isBuintin: boolean;
  }

  export interface IPlainWebviewHandle {

    /**
     * 向webview内部发送消息
     * @param message
     */
    postMessage(message: any): Promise<boolean>;

    /**
     * 接受来自webview的信息
     * @example
     * ```typescript
     * const handle = getPlainWebviewHandle('id');
     * handle.onMessage((e: any) => {
     *   // your code
     * })
     * ```
     */
    onMessage: Event<any>;

    /**
     * 加载一个url
     */
    loadUrl(url: string): Promise<void>;

  }

  export interface IDisposable {
    /**
     * Dispose this object.
     */
    dispose(): void;
  }

  export interface Event<T> {
    (listener: (e: T) => any, thisArgs?: any): IDisposable;
  }

  export interface IExtHostPlainWebview extends IPlainWebviewHandle, IDisposable{

    reveal(groupIndex: number): Promise<void>;

  }

  export namespace webview {

    /**
     * 获取一个使用<Webview id='xxx'>组件创造的plainWebview的Handle
     * @param id
     */
    export function getPlainWebviewHandle(id: string): IPlainWebviewHandle;

    /**
     * 创建一个用于在编辑器区域展示的plain webview组件
     * @param title
     * @param iconPath
     */
    export function createPlainWebview(title: string, iconPath?: string): IExtHostPlainWebview

  }

  interface IProxy {
    [methodName: string]: Function;
  }

  interface IComponentProxy {
    [comonentIds: string]: IProxy;
  }

  export interface ExtensionContext<T = IComponentProxy> {
    registerExtendModuleService<S>(service: S): void;

    componentProxy: T;
  }

  export namespace reporter {
    export function time(name: string): void;
    export function timeEnd(name: string, msg?: string): void;
    export function point(name: string, msg?: string): void;
  }

  export interface ITabbarHandle {

    setSize(size: number): void;

    activate(): void;

    deactivate(): void;

    onActivate: Event<void>;

    onInActivate: Event<void>;

  }

}



interface IComponentMethod {
  [methodName: string]: Function;
}

interface IComponentProps<N, W = any> {
  kaitianExtendSet: {
    set<T = IComponentMethod>(methods: T): void;
  };
  kaitianExtendService: {
    node: N;
    worker: W;
  };
}


declare module 'kaitian-browser' {
  export enum VALIDATE_TYPE {
    INFO = 0,
    WRANING = 1,
    ERROR = 2
  }
  export interface ValidateMessage {
      message: string | void;
      type: VALIDATE_TYPE;
  }
  export interface ValidateInputProp extends React.InputHTMLAttributes<HTMLInputElement> {
      validate: (value: string) => ValidateMessage;
  }
  export const Input: React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement> & React.RefAttributes<HTMLInputElement>>;
  export enum CheckBoxSize {
      SMALL = 0,
      NORMAL = 1
  }
  export const CheckBox: React.FC<{
      id: string;
      insertClass?: string;
      label?: string;
      size?: CheckBoxSize;
      [key: string]: any;
  }>;


  export interface ScrollAreaProps {
    className?: string;
    onScroll?: (position: ScrollPosition) => any;
    atTopClassName?: string;
    style?: any;
    containerStyle?: any;
 }
  export interface ScrollPosition {
      top: number;
      left: number;
  }
  export class Scroll extends React.Component<ScrollAreaProps, any> {

  }

  export interface ResizeHandleProps {
    onFinished?: () => void;
    onResize?: () => void;
    max?: number;
    min?: number;
    preserve?: number;
    className?: string;
    delegate?: (delegate: IResizeHandleDelegate) => void;
  }
  export interface IResizeHandleDelegate {
      setSize(prev: number, next: number): void;
  }
  export const ResizeHandleHorizontal: React.FunctionComponent<ResizeHandleProps>;
  export const ResizeHandleVertical:  React.FunctionComponent<ResizeHandleProps>;

  export const ValidateInput: React.FC<ValidateInputProp>;

  export const PlainWebview: React.FunctionComponent<{id: string}>

  export function localize(key: string, defaultMessage?: string, env?: string): string;

  export function getIcon(iconKey: string, options?: {rotate?: ROTATE_TYPE, anim?: ANIM_TYPE} ): string;

  export enum ROTATE_TYPE {
    rotate_90,
    rotate_180,
    rotate_270,
    flip_horizontal,
    flip_vertical,
    flip_both,
  }

  export enum ANIM_TYPE {
    spin,
    pulse,
  }

  /**
   * 获得当前主题的颜色值
   * 格式 '-分割的颜色名':'颜色值(rgb, rgba或hex)'
   * @example
   * ```json
   * {
   *  'editor-background':'#000000',
   * }
   * ```
   */
  export function getThemeColors(): {[key: string]: string}
}