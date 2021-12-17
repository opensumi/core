/* tslint:disable callable-types */
/**
 * @deprecated `kaitian` was deprecated, Please use `sumi` instead.
 */
declare module 'kaitian' {
  export * from 'sumi';
}
declare module 'sumi' {
  export * from 'vscode';

  import {
    ExtensionContext as VSCodeExtensionContext,
    Disposable,
    TextEditor,
    TextEditorEdit,
    ExtensionKind,
  } from 'vscode';

  /**
   * Represents an extension.
   *
   * To get an instance of an `Extension` use [getExtension](#extensions.getExtension).
   */
  export interface Extension<T> {
    /**
     * The canonical extension identifier in the form of: `publisher.name`.
     */
    readonly id: string;

    /**
     * The absolute file path of the directory containing this extension.
     */
    readonly extensionPath: string;

    /**
     * `true` if the extension has been activated.
     */
    readonly isActive: boolean;

    /**
     * The parsed contents of the extension's package.json.
     */
    readonly packageJSON: any;

    /**
     * The extension kind describes if an extension runs where the UI runs
     * or if an extension runs where the remote extension host runs. The extension kind
     * if defined in the `package.json` file of extensions but can also be refined
     * via the the `remote.extensionKind`-setting. When no remote extension host exists,
     * the value is [`ExtensionKind.UI`](#ExtensionKind.UI).
     */
    extensionKind: ExtensionKind;

    /**
     * The public API exported by this extension. It is an invalid action
     * to access this field before this extension has been activated.
     */
    readonly exports: T;

    /**
     * The public API exported by this extension's node entry. It is an invalid action
     * to access this field before this extension has been activated.
     */
    readonly extendExports: T;

    /**
     * Activates this extension and returns its public API.
     *
     * @return A promise that will resolve when this extension has been activated.
     */
    activate(): Thenable<T>;
  }

  export namespace extensions {
    /**
     * Get an extension by its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    export function getExtension(extensionId: string): Extension<any> | undefined;

    /**
     * Get an extension its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    export function getExtension<T>(extensionId: string): Extension<T> | undefined;

    /**
     * All extensions currently known to the system.
     */
    export const all: ReadonlyArray<Extension<any>>;

    /**
     * An event which fires when `extensions.all` changes. This can happen when extensions are
     * installed, uninstalled, enabled or disabled.
     */
    export const onDidChange: Event<void>;
  }

  export namespace event {
    /**
     * 事件响应的返回结果
     */
    interface IEventResult<R> {
      /**
       * 如果存在err，说明本次调用存在错误
       */
      err?: string;
      /**
       * 调用结果
       */
      result?: R;
    }

    /**
     * 订阅一个事件
     * @param eventId 事件id
     * @param callback 事件订阅回调
     */
    export function subscribe(eventId: string, callback: (...args: any[]) => any): IDisposable;

    /**
     * 发送一个事件
     * @param eventId 事件id
     * @param args 事件参数
     * @returns Promise 返回处理事件响应的listener的返回值
     */
    export function fire<R = any>(eventId: string, ...args: any[]): Promise<IEventResult<R>[]>;
  }

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
     * 获取一个 Tab 的 Handle
     * @param id tab id, 不限制在本插件注册的handle，需要自己进行字符串拼接
     */
    export function getExtensionTabbarHandler(id: string, extensionId?: string): ITabbarHandle;

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

  export interface IIDEWindowWebviewOptions {
    /**
     * 窗口宽度，默认 `800`
     */
    width?: number;
    /**
     * 窗口高度，默认 `600`
     */
    height?: number;

    [key: string]: any;
  }

  export interface IIDEWindowWebviewEnv {
    /**
     * 注入webview中的环境变量
     */
    [key: string]: any;
  }

  export interface IIDEWebviewWindow extends Disposable {
    /**
     * 加载webview窗口内的资源地址
     * @param url
     */
    loadUrl(url: string): Promise<void>;
    /**
     * 隐藏webview窗口
     */
    hide(): Promise<void>;
    /**
     * 展示webview窗口
     */
    show(): Promise<void>;
    /**
     * 设置webview窗口大小
     * @param size
     */
    setSize(size: { width: number; height: number }): Promise<void>;
    /**
     * 设置webview窗口是否置顶
     * @param flag
     */
    setAlwaysOnTop(flag: boolean): Promise<void>;
    /**
     * 传递消息至webview窗口
     * @param message
     */
    postMessage(message: any): Promise<void>;
    /**
     * 接收webview窗口回传消息事件
     */
    onMessage: Event<any>;
    /**
     * 接收webview窗口关闭事件
     */
    onClosed: Event<void>;

    /**
     * Electron Window 的 windowId
     */
    windowId: number;

    /**
     * Electron Window 的 webContentsId
     */
    webContentsId: number;
  }

  export namespace ideWindow {
    /**
     * 刷新当前 IDE 窗口
     */
    export function reloadWindow(): void;
    /**
     * 打开新的窗口 仅支持 Electron 环境
     */
    export function createWebviewWindow(
      webviewId: string,
      options?: IIDEWindowWebviewOptions,
      env?: IIDEWindowWebviewEnv,
    ): Promise<IIDEWebviewWindow>;
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
    export function setExtensionCandidate(extensionCandidate: ExtensionCandidate[]): Promise<void>;
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
    export function getThemeColors(): Promise<{ [key: string]: string }>;
  }

  export enum ExtensionHostKind {
    NODE_HOST = 1,
    WORKER_HOST = 2,
  }

  export interface ExtensionCandidate {
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

  export type Event<T> = (listener: (e: T) => any, thisArgs?: any) => IDisposable;

  export interface IExtHostPlainWebview extends IPlainWebviewHandle, IDisposable {
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
    export function createPlainWebview(title: string, iconPath?: string): IExtHostPlainWebview;
  }

  interface IProxy {
    [methodName: string]: any; // Function;
  }

  interface IComponentProxy {
    [componentIds: string]: IProxy;
  }

  export interface ExtensionContext<T = IComponentProxy> extends VSCodeExtensionContext {
    registerExtendModuleService<S>(service: S): void;

    componentProxy: T;
  }

  export interface IReporterTimer {
    timeEnd(msg?: string, extra?: any): number;
  }

  export namespace reporter {
    export function time(name: string): IReporterTimer;
    export function point(name: string, msg?: string, extra?: any): void;
  }

  export interface ITabbarHandle {
    setSize(size: number): void;

    /**
     * 修改 Tabbar 标题
     * @param title 标题
     *
     * @example
     * ```ts
     * const tabbar = kaitian.layout.getTabbarHandler('TabbarIconTest');
     * tabbar.setTitle('New Title');
     * ```
     */
    setTitle(title: string): void;

    /**
     * 修改 Tarbbar 图标
     * @param iconPath 图标路径
     *
     * @example
     * ```ts
     * const tabbar = kaitian.layout.getTabbarHandler('TabbarIconTest');
     * tabbar.setIcon('http://path/to/icon.svg');
     * ```
     */
    setIcon(iconPath: string): void;

    /**
     * 修改 Tabbar 徽标文案
     * @param badge 徽标文案
     *
     * ![badge](https://img.alicdn.com/tfs/TB1.UPih4vbeK8jSZPfXXariXXa-336-136.png)
     *
     * @example
     * ```ts
     *  const tabbar = kaitian.layout.getTabbarHandler('TabbarIconTest');
     *  tabbar.setBadge('12');
     * ```
     */
    setBadge(badge: string): void;

    activate(): void;

    deactivate(): void;

    onActivate: Event<void>;

    onInActivate: Event<void>;

    setVisible(visible: boolean): void;
  }

  interface IExtensionInfo {
    /**
     * package.json 里的 publisher.name
     * 用于插件之前的相互调用
     */
    readonly id: string;
    /**
     * 插件市场 id
     */
    readonly extensionId: string;
    /**
     * 是否为内置插件
     */
    readonly isBuiltin: boolean;
  }

  export type PermittedHandler = (extensionInfo: IExtensionInfo, ...args: any[]) => boolean;

  export namespace commands {
    /**
     * Registers a command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Registering a command with an existing command identifier twice
     * will cause an error.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function.
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    export function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;

    /**
     * Executes the command denoted by the given command identifier.
     *
     * * *Note 1:* When executing an editor command not all types are allowed to
     * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
     * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
     * * *Note 2:* There are no restrictions when executing commands that have been contributed
     * by extensions.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A thenable that resolves to the returned value of the given command. `undefined` when
     * the command handler function doesn't return anything.
     */
    export function executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined>;

    /**
     * Retrieve the list of all available commands. Commands starting an underscore are
     * treated as internal commands.
     *
     * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
     * @return Thenable that resolves to a list of command ids.
     */
    export function getCommands(filterInternal?: boolean): Thenable<string[]>;
    /**
     * Registers a text editor command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Text editor commands are different from ordinary [commands](#commands.registerCommand) as
     * they only execute when there is an active editor when the command is called. Also, the
     * command handler of an editor command has access to the active editor and to an
     * [edit](#TextEditorEdit)-builder.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function with access to an [editor](#TextEditor) and an [edit](#TextEditorEdit).
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    export function registerTextEditorCommand(
      command: string,
      callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void,
      thisArg?: any,
    ): Disposable;

    /**
     * Register a command that requires authentication
     * This command is only registered in the extension host
     * Does not appear in the menu and command palette
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function.
     * @param isPermitted Check if you have permission to execute command.It first argument is extension information to help you judge.
     * @return Disposable which unregisters this command on disposal.
     */
    export function registerCommandWithPermit(
      id: string,
      command: <T>(...args: any[]) => T | Promise<T>,
      isPermitted: PermittedHandler,
    ): Disposable;
  }

  export namespace toolbar {
    export interface IToolbarButtonActionHandle {
      /**
       * 当按钮被点击时触发
       */
      onClick: Event<void>;

      /**
       * 设置 Button 的 State
       * state 需要对应在 kaitianContributes 中配置
       * @param state
       * @param 额外改变的 title
       */
      setState(state: string, title?: string): Promise<void>;

      /**
       * 提供了自定义 Popover 组件的场景下，设置 Popover 组件 props 接收到的 context 状态
       *
       * @example
       * ```ts
       * // extension
       * const action = await kaitian.toolbar.getToolbarButtonHandle(<action-id>);
       * action.setContext({ name: 'World' });
       *
       * // CustomPopOverComponent
       *
       * const PopOver = (props) => {
       *  return (
       *    <div>Hello {props?.name}</div>
       *  );
       * };
       * ```
       * @param context {any}
       */
      setContext(context: any): void;

      /**
       * State 改变时触发
       */
      onStateChanged: Event<{ from: string; to: string }>;

      /**
       * 显示 button 元素对应的 popover 元素，需要在 kaitianContributes 中配置
       */
      showPopover(): Promise<void>;

      hidePopover(): Promise<void>;
    }

    export interface IToolbarSelectActionHandle<T> {
      /**
       * 设置 Select 的 State
       * state 需要对应在 kaitianContributes 中配置
       * @param state
       */
      setState(state: string): Promise<void>;

      /**
       * 修改可用 options
       * 注意：如果修改过后的options变更，会导致当前选中变更（原有选中如果在新的options中找不到，默认使用第一个），
       * 那么它会引起 onSelect 被触发
       * @param options
       */
      setOptions(
        options: {
          iconPath?: string;
          iconMaskMode?: boolean;
          label?: string;
          value: T;
        }[],
      ): void;

      /**
       * Select 值改变时触发
       */
      onSelect: Event<T>;

      /**
       * State 改变时触发
       */
      onStateChanged: Event<{ from: string; to: string }>;

      /**
       * 使用代码更改选择
       * @param value
       */
      setSelect(value: T): Promise<void>;

      /**
       * 获得当前选择值
       */
      getValue(): T;
    }

    export interface IToolbarActionBasicContribution {
      id: string;
      preferredPosition?: {
        location?: string;
        group?: string;
      };
      strictPosition?: {
        location: string;
        group: string;
      };
      description: string;
    }

    export interface IToolbarSelectStyle {
      // 背景色
      backgroundColor?: string;

      // 下拉菜单前景色
      labelForegroundColor?: string;

      // icon 前景色
      iconForegroundColor?: string;

      // 宽度
      width?: number;

      // 最小宽度
      minWidth?: number;
    }

    export interface IToolbarActionBtnStyle {
      // 指定按钮宽度
      // 不指定，则按默认8px左右边距
      width?: number;

      // 指定按钮高度
      // 默认值为 22
      height?: number;

      // 是否显示 Title
      showTitle?: boolean;

      // icon 前景色
      iconForeground?: string;

      // icon 背景色
      iconBackground?: string;

      // title 前景色
      titleForeground?: string;

      // title 背景色
      titleBackground?: string;

      // title 字体大小
      titleSize?: string;

      // icon 图标大小
      iconSize?: string;

      // 整体背景色
      background?: string;

      // 样式类型，
      // inline则不会有外边框
      // button则为按钮样式
      btnStyle?: 'inline' | 'button';

      // button 的文本位置样式
      // vertical: 上icon 下文本
      // horizontal: 左icon 右文本
      btnTitleStyle?: 'vertical' | 'horizontal';
    }

    export interface IToolbarPopoverStyle {
      /**
       * 在上方还是在下方, 默认下方
       * // TODO: 暂时只支持 bottom;
       */
      position?: 'top' | 'bottom';

      /**
       * ```text
       * 距离右边的偏移量(px), 默认 30
       *     [ button ]
       *          /\  |<-offset->|
       *  [------   -------------]
       *  [                      ]
       *  [      popover         ]
       *  [                      ]
       *  [______________________]
       * ```
       */
      horizontalOffset?: number;

      /**
       * 点击组件外部时自动隐藏, 默认 true
       */
      hideOnClickOutside?: boolean;

      /**
       * 不要带箭头，阴影，背景色等默认样式
       */
      noContainerStyle?: boolean;

      /**
       * 指定 popOver 的最小宽度
       */
      minWidth?: number;

      /**
       * 指定 popOver 的最小高度
       */
      minHeight?: number;
    }
    export interface IToolbarButtonContribution extends IToolbarActionBasicContribution {
      type: 'button';
      command?: string;
      title: string;
      iconPath: string;
      iconMaskMode?: boolean;
      popoverComponent?: string;
      popoverStyle?: IToolbarPopoverStyle;
      states?: {
        [key: string]: {
          title?: string;
          iconPath?: string;
          iconMaskMode?: boolean;
        } & IToolbarActionBtnStyle;
      };
      defaultState?: string;
    }

    export interface IToolbarSelectContribution<T = any> extends IToolbarActionBasicContribution {
      type: 'select';
      command?: string;
      options: {
        iconPath?: string;
        iconMaskMode?: boolean;
        label?: string;
        value: T;
      }[];
      defaultValue: T;
      optionEqualityKey?: string;
      states?: {
        [key: string]: IToolbarSelectStyle;
      };
      defaultState?: string;
    }

    /**
     * 注册一个 select 类型的 toolbar Action
     * @param contribution IToolbarSelectContribution
     * 返回一个用于操作和响应 toolbar 上对应 select 控件的 handle
     */
    export function registerToolbarAction<T>(
      contribution: IToolbarSelectContribution<T>,
    ): Promise<IToolbarSelectActionHandle<T>>;
    /**
     * 注册一个 button 类型的 toolbar action
     * @param contribution IToolbarButtonContribution
     * 返回一个用于操作和响应 toolbar 上对应 button 控件的 handle
     */
    export function registerToolbarAction(
      contribution: IToolbarButtonContribution,
    ): Promise<IToolbarButtonActionHandle>;

    /**
     * 获得一个 toolbar action 的 handle， 用于操作和响应 toolbar 上的 button
     * @param id
     */
    export function getToolbarActionButtonHandle(id: string): Promise<IToolbarButtonActionHandle>;

    /**
     * 获得一个 toolbar action 的 handle， 用于操作和响应 toolbar 上的 select
     * @param id
     */
    export function getToolbarActionSelectHandle<T = any>(id: string): Promise<IToolbarSelectActionHandle<T>>;
  }
}
