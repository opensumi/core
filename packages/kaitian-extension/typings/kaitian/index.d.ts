declare module "kaitian" {

  export namespace layout {
    export function toggleBottomPanel(): Promise<void>;
  }

  export namespace ideWindow {
    export function reloadWindow(): void;
  }

  export namespace lifecycle {
    export function setExtensionDir(extensionDir: string): Promise<void>;

    export function setExtensionCandidate(extensionCandidate: ExtensionCandiDate[]): Promise<void>;
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
}