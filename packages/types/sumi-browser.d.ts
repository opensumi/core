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
  viewState?: {
    width: number;
    height: number;
  };
}

/**
 * @deprecated `katian-browser` is deprecated. Please use `sumi-browser` instead.
 */
declare module 'kaitian-browser' {
  export * from 'sumi-browser';
}

declare module 'sumi-browser' {
  export * from '@opensumi/ide-components';

  import React from 'react';
  import type vscode from 'vscode';
  import { URI as Uri } from 'vscode-uri';

  import { ROTATE_TYPE, ANIM_TYPE } from '@opensumi/ide-components';

  interface IRelativePattern {
    base: string;
    pattern: string;
  }
  class Path {
    static separator: '/';
    static isDrive(segment: string): boolean;
    static splitPath(path: string): string[];
    static isRelative(path: string): boolean;
    static pathDepth(path: string): number;
    static normalizeDrive(path: string): string;
    readonly isAbsolute: boolean;
    readonly isRoot: boolean;
    readonly root: Path | undefined;
    readonly base: string;
    readonly name: string;
    readonly ext: string;
    private _dir;
    private readonly raw;
    constructor(raw: string);
    protected computeRoot(): Path | undefined;
    get dir(): Path;
    protected computeDir(): Path;
    join(...paths: string[]): Path;
    toString(): string;
    relative(path: Path): Path | undefined;
    isEqualOrParent(path: Path): boolean;
    isEqual(path: Path): boolean;
    relativity(path: Path): number;
  }
  export class URI {
    static from(components: {
      scheme: string;
      authority?: string;
      path?: string;
      query?: string;
      fragment?: string;
    }): URI;
    static file(path: string): URI;
    static parse(path: string): URI;
    static isUri(thing: any): thing is URI;
    static isUriString(str: string): boolean;
    static revive(data: any): Uri;
    readonly codeUri: Uri;
    private _path;
    constructor(uri?: string | Uri);
    get displayName(): string;
    /**
     * Return all uri from the current to the top most.
     */
    get allLocations(): URI[];
    get parent(): URI;
    relative(uri: URI): Path | undefined;
    resolve(path: string | Path): URI;
    /**
     * return a new URI replacing the current with the given scheme
     */
    withScheme(scheme: string): URI;
    /**
     * @deprecated
     * return this URI without a scheme
     */
    withoutScheme(): URI;
    /**
     * return a new URI replacing the current with the given authority
     */
    withAuthority(authority: string): URI;
    /**
     * return this URI without a authority
     */
    withoutAuthority(): URI;
    /**
     * return a new URI replacing the current with the given path
     */
    withPath(path: string | Path): URI;
    /**
     * return this URI without a path
     */
    withoutPath(): URI;
    /**
     * return a new URI replacing the current with the given query
     */
    withQuery(query: string): URI;
    /**
     * return this URI without a query
     */
    withoutQuery(): URI;
    /**
     * return a new URI replacing the current with the given fragment
     */
    withFragment(fragment: string): URI;
    /**
     * return this URI without a fragment
     */
    withoutFragment(): URI;
    get scheme(): string;
    get authority(): string;
    get path(): Path;
    get query(): string;
    get fragment(): string;
    toString(skipEncoding?: boolean): string;
    isEqualOrParent(uri: URI): boolean;
    isEqual(uri: URI): boolean;
    matchGlobPattern(pattern: string | IRelativePattern): boolean;
    static getDistinctParents(uris: URI[]): URI[];
    getParsedQuery(): {
      [key: string]: string;
    };
    static stringifyQuery(query: { [key: string]: any }): string;
  }

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
  export class Scroll extends React.Component<ScrollAreaProps, any> {}

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
  export const ResizeHandleHorizontal: React.ComponentType<ResizeHandleProps>;
  export const ResizeHandleVertical: React.ComponentType<ResizeHandleProps>;

  export const PlainWebview: React.ComponentType<{ id: string; appendToChild?: boolean; renderRoot?: HTMLElement }>;

  // scope 目前不是必要的，可以直接从 extension 拿到 id
  // 为了兼容已经在使用的插件，暂时先保留声明
  export function localize(key: string, defaultMessage?: string, scope?: string): string;

  /**
   * 格式化国际化文案
   * @example
   * ```js
   * kaitian.formatLocalize('task.label', '任务', '运行');
   * ```
   */
  export function formatLocalize(key: string, ...args: string[]): string;

  export function getIcon(iconKey: string, options?: { rotate?: ROTATE_TYPE; anim?: ANIM_TYPE }): string;

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

  export type ISumiBrowserConfig = IKaitianBrowserConfig;
  /**
   * @deprecated `IKaitianBrowserConfig` was renamed to `ISumiBrowserConfig`, use that instead.
   */
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
    panel: React.ComponentType;
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
  export namespace commands {
    /**
     * Executes the command denoted by the given command identifier.
     *
     * * *Note 1:* When executing an editor command not all types are allowed to
     * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
     * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
     * * *Note 2:* There are no restrictions when executing commands that have been contributed
     * by extensions.
     * * *Note 3:* Can not execute some builtin commands.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A promise that resolves to the returned value of the given command. `undefined` when
     * the command handler function doesn't return anything.
     */
    export function executeCommand<T>(command: string, ...rest: any[]): Promise<T | undefined>;
  }

  export interface IReporterTimer {
    timeEnd(msg?: string, extra?: any): number;
  }

  export namespace reporter {
    export function time(name: string): IReporterTimer;
    export function point(name: string, msg?: string, extra?: any): void;
  }
}
