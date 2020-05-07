/* tslint:disable callable-types */
declare module 'kaitian' {
  export * from 'vscode';

  import { ExtensionContext as VSCodeExtensionContext, Disposable, TextEditor, TextEditorEdit } from 'vscode';

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
    export function getThemeColors(): Promise<{ [key: string]: string }>;

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

    activate(): void;

    deactivate(): void;

    onActivate: Event<void>;

    onInActivate: Event<void>;

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
    export function registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable;

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
    export function registerCommandWithPermit(id: string, command: <T>(...args: any[]) => T | Promise<T>, isPermitted: PermittedHandler): Disposable;
  }

}
