interface IComponentMethod {
  [methodName: string]: any; // Function
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
  export * from '@ali/ide-components';

  import * as vscode from 'vscode';
  import * as React from 'react';

  export enum VALIDATE_TYPE {
    INFO = 0,
    WRANING = 1,
    ERROR = 2,
  }
  export interface ValidateMessage {
    message: string | void;
    type: VALIDATE_TYPE;
  }
  export interface ValidateInputProp extends React.InputHTMLAttributes<HTMLInputElement> {
    validate: (value: string) => ValidateMessage;
  }
  // export const Input: React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement> & React.RefAttributes<HTMLInputElement>>;
  export enum CheckBoxSize {
    SMALL = 0,
    NORMAL = 1,
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
  export const ResizeHandleVertical: React.FunctionComponent<ResizeHandleProps>;

  export const ValidateInput: React.FC<ValidateInputProp>;

  export const PlainWebview: React.FunctionComponent<{ id: string }>;

  export function localize(key: string, defaultMessage?: string, env?: string): string;

  export function getIcon(iconKey: string, options?: { rotate?: ROTATE_TYPE, anim?: ANIM_TYPE }): string;

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
  export function getThemeColors(): { [key: string]: string };

  export enum ToolBarPosition {
    /**
     * 左边
     */
    LEFT = 1,
    /**
     * 中间
     */
    CENTER = 2,
    /**
     * 右边
     */
    RIGHT = 3,
  }

  export interface IKaitianBrowserConfig {
    left?: {
      component: ITabBarComponentContribution[];
    };
    right?: {
      component: ITabBarComponentContribution[];
    };
    bottom?: {
      component: ITabBarComponentContribution[];
    };
    editor?: {
      component: IEditorComponentContribution[];
    };
    toolBar?: {
      position?: ToolBarPosition;
      component: IToolBarComponentContribution[];
    };
  }

  export interface IToolBarComponentContribution {
    /**
     * id
     */
    id: string;
    /**
     * ToolBar 组件主体
     */
    panel: React.ComponentType;
    /**
     * 位置
     */
    position: ToolBarPosition;
  }
  export interface ITabBarComponentContribution {
    /**
     * id
     */
    id: string;
    /**
     * Tabbar组件主体
     */
    panel: React.ComponentType;
    /**
     * 内置icon名称
     */
    icon?: string;
    /**
     * 相对于插件路径的icon地址
     */
    iconPath?: string;
    /**
     * 用于激活的快捷键
     */
    keyBinding?: string;
    /**
     * 名称
     */
    title: string;
    /**
     * 排序权重
     */
    priority?: number;
    /**
     * 禁止面板的resize功能
     */
    noResize?: boolean;
    /**
     * 是否全部展开
     */
    expanded?: boolean;
  }

  export enum EditorComponentRenderMode {
    ONE_PER_RESOURCE = 1, // 每个resource渲染一个新的
    ONE_PER_GROUP = 2, // 每个Group最多存在一个新的
    ONE_PER_WORKBENCH = 3, // 整个IDE只有一个, 视图会被重用
  }

  export interface IEditorComponentContribution {
    /**
     * id
     */
    id: string;
    /**
     * 适配的scheme, 如果不填，默认为file协议
     */
    scheme?: string;
    /**
     * editor组件主体
     */
    panel: React.FC;
    /**
     * 渲染方式
     */
    renderMode?: EditorComponentRenderMode;
    /**
     * 仅作用于file协议
     * 要处理的文件的后缀
     */
    fileExt?: string[];
    /**
     * 仅作用于file协议
     * 判断一个path是否要被处理
     * @deprecated
     */
    // shouldPreview?: (path: Path) => boolean;
    /**
     * 判断一个uri是否要被处理(传入参数为vscode uri)
     * 如果不存在handles方法，则默认显示（file协议还要过shouldPreview和fileExt)
     */
    handles?: (uri: vscode.Uri) => boolean;
    /**
     * 如果这个资源有多个打开方式，这个会作为打开方式名称
     */
    title?: string;
    /**
     * 排序权重， 默认为10
     */
    priority?: number;
    /**
     * Tab名称，如果需要更复杂的名称Resolve，需要在kaitian node进程中注册ResourceProvider
     */
    tabTitle?: string;
    /**
    * 相对于插件路径的icon地址
    * 如果需要更复杂的图标Resolve，需要在kaitian node进程中注册ResourceProvider
    */
    tabIconPath?: string;
  }
}
