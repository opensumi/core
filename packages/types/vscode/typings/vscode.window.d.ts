declare module 'vscode' {

  /**
   * Represents the alignment of status bar items.
   */
  export enum StatusBarAlignment {

    /**
     * Aligned to the left side.
     */
    Left = 1,

    /**
     * Aligned to the right side.
     */
    Right = 2,
  }

  /**
   * A status bar item is a status bar contribution that can
   * show text and icons and run a command on click.
   */
  export interface StatusBarItem {

    /**
     * The identifier of this item.
     *
     * *Note*: if no identifier was provided by the {@link window.createStatusBarItem `window.createStatusBarItem`}
     * method, the identifier will match the {@link Extension.id extension identifier}.
     */
    readonly id: string;

    /**
     * The alignment of this item.
     */
    readonly alignment: StatusBarAlignment;

    /**
     * The priority of this item. Higher value means the item should
     * be shown more to the left.
     */
    readonly priority?: number;

    /**
     * The name of the entry, like 'Python Language Indicator', 'Git Status' etc.
     * Try to keep the length of the name short, yet descriptive enough that
     * users can understand what the status bar item is about.
     */
    name: string | undefined;

    /**
     * The text to show for the entry. You can embed icons in the text by leveraging the syntax:
     *
     * `My text $(icon-name) contains icons like $(icon-name) this one.`
     *
     * Where the icon-name is taken from the [octicon](https://octicons.github.com) icon set, e.g.
     * `light-bulb`, `thumbsup`, `zap` etc.
     */
    text: string;

    /**
     * The tooltip text when you hover over this entry.
     */
    tooltip: string | undefined;

    /**
     * The foreground color for this entry.
     */
    color: string | ThemeColor | undefined;

    /**
     * The background color for this entry.
     *
     * *Note*: only the following colors are supported:
     * * `new ThemeColor('statusBarItem.errorBackground')`
     * * `new ThemeColor('statusBarItem.warningBackground')`
     *
     * More background colors may be supported in the future.
     *
     * *Note*: when a background color is set, the statusbar may override
     * the `color` choice to ensure the entry is readable in all themes.
     */
    backgroundColor: ThemeColor | undefined;

    /**
     * The identifier of a command to run on click. The command must be
     * [known](#commands.getCommands).
     */
    command: string | Command | undefined;
    /**
     * Accessibility information used when screen reader interacts with this StatusBar item
     */
    accessibilityInformation?: AccessibilityInformation;

    /**
     * Shows the entry in the status bar.
     */
    show(): void;

    /**
     * Hide the entry in the status bar.
     */
    hide(): void;

    /**
     * Dispose and free associated resources. Call
     * [hide](#StatusBarItem.hide).
     */
    dispose(): void;
  }

  export interface OutputChannel {

    /**
     * The human-readable name of this output channel.
     */
    readonly name: string;

    /**
     * Append the given value to the channel.
     *
     * @param value A string, falsy values will not be printed.
     */
    append(value: string): void;

    /**
     * Append the given value and a line feed character
     * to the channel.
     *
     * @param value A string, falsy values will be printed.
     */
    appendLine(value: string): void;

    /**
     * Removes all output from the channel.
     */
    clear(): void;

    /**
     * Reveal this channel in the UI.
     *
     * @param preserveFocus When `true` the channel will not take focus.
     */
    show(preserveFocus?: boolean): void;

    /**
     * Hide this channel from the UI.
     */
    hide(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
  }

  /**
   * Options to configure the behaviour of a file open dialog.
   *
   * * Note 1: A dialog can select files, folders, or both. This is not true for Windows
   * which enforces to open either files or folder, but *not both*.
   * * Note 2: Explicitly setting `canSelectFiles` and `canSelectFolders` to `false` is futile
   * and the editor then silently adjusts the options to select files.
   */
  export interface OpenDialogOptions {
    /**
     * The resource the dialog shows when opened.
     */
    defaultUri?: Uri;

    /**
     * A human-readable string for the open button.
     */
    openLabel?: string;

    /**
     * Allow to select files, defaults to `true`.
     */
    canSelectFiles?: boolean;

    /**
     * Allow to select folders, defaults to `false`.
     */
    canSelectFolders?: boolean;

    /**
     * Allow to select many files or folders.
     */
    canSelectMany?: boolean;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *   'Images': ['png', 'jpg']
     *   'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[] };
    /**
     * Dialog title.
     *
     * This parameter might be ignored, as not all operating systems display a title on open dialogs
     * (for example, macOS).
     */
    title?: string;
  }

  /**
   * Options to configure the behaviour of a file save dialog.
   */
  export interface SaveDialogOptions {
    /**
     * The resource the dialog shows when opened.
     */
    defaultUri?: Uri;

    /**
     * A human-readable string for the save button.
     */
    saveLabel?: string;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *   'Images': ['png', 'jpg']
     *   'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[] };
    /**
     * Dialog title.
     *
     * This parameter might be ignored, as not all operating systems display a title on save dialogs
     * (for example, macOS).
     */
    title?: string;
  }
  export namespace window {

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @param hideAfterTimeout Timeout in milliseconds after which the message will be disposed.
     * @return A disposable which hides the status bar message.
     */
    // tslint:disable-next-line: unified-signatures
    export function setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable;

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @param hideWhenDone Thenable on which completion (resolve or reject) the message will be disposed.
     * @return A disposable which hides the status bar message.
     */
    // tslint:disable-next-line: unified-signatures
    export function setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable;

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * *Note* that status bar messages stack and that they must be disposed when no
     * longer used.
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @return A disposable which hides the status bar message.
     */
    export function setStatusBarMessage(text: string): Disposable;

    /**
     * Creates a status bar [item](#StatusBarItem).
     *
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @return A new status bar item.
     */
    export function createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;

    /**
     * Creates a status bar {@link StatusBarItem item}.
     *
     * @param id The unique identifier of the item.
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @return A new status bar item.
     */
    export function createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem;

    /**
     * Creates a new [output channel](#OutputChannel) with the given name.
     *
     * @param name Human-readable string which will be used to represent the channel in the UI.
     */
    export function createOutputChannel(name: string): OutputChannel;

    /**
     * The currently opened terminals or an empty array.
     */
    export const terminals: ReadonlyArray<Terminal>;

    /**
     * The currently active terminal or `undefined`. The active terminal is the one that
     * currently has focus or most recently had focus.
     */
    export const activeTerminal: Terminal | undefined;

    /**
     * An [event](#Event) which fires when the [active terminal](#window.activeTerminal)
     * has changed. *Note* that the event also fires when the active terminal changes
     * to `undefined`.
     */
    export const onDidChangeActiveTerminal: Event<Terminal | undefined>;

    /**
     * An [event](#Event) which fires when a terminal has been created, either through the
     * [createTerminal](#window.createTerminal) API or commands.
     */
    export const onDidOpenTerminal: Event<Terminal>;

    /**
     * An [event](#Event) which fires when a terminal is disposed.
     */
    export const onDidCloseTerminal: Event<Terminal>;

    /**
     * Represents the current window's state.
     */
    export const state: WindowState;

    /**
     * An [event](#Event) which fires when the focus state of the current window
     * changes. The value of the event represents whether the window is focused.
     */
    export const onDidChangeWindowState: Event<WindowState>;

    /**
     * Creates a [Terminal](#Terminal). The cwd of the terminal will be the workspace directory
     * if it exists, regardless of whether an explicit customStartPath setting exists.
     *
     * @param name Optional human-readable string which will be used to represent the terminal in the UI.
     * @param shellPath Optional path to a custom shell executable to be used in the terminal.
     * @param shellArgs Optional args for the custom shell executable. A string can be used on Windows only which
     * allows specifying shell args in [command-line format](https://msdn.microsoft.com/en-au/08dfcab2-eb6e-49a4-80eb-87d4076c98c6).
     * @return A new Terminal.
     */
    export function createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): Terminal;

    /**
     * Create and show a new webview panel.
     *
     * @param viewType Identifies the type of the webview panel.
     * @param title Title of the panel.
     * @param showOptions Where to show the webview in the editor. If preserveFocus is set, the new webview will not take focus.
     * @param options Settings for the new panel.
     *
     * @return New webview panel.
     */
    export function createWebviewPanel(viewType: string, title: string, showOptions: ViewColumn | { viewColumn: ViewColumn, preserveFocus?: boolean }, options?: WebviewPanelOptions & WebviewOptions): WebviewPanel;

    /**
     * Registers a webview panel serializer.
     *
     * Extensions that support reviving should have an `"onWebviewPanel:viewType"` activation event and
     * make sure that [registerWebviewPanelSerializer](#registerWebviewPanelSerializer) is called during activation.
     *
     * Only a single serializer may be registered at a time for a given `viewType`.
     *
     * @param viewType Type of the webview panel that can be serialized.
     * @param serializer Webview serializer.
     */
    export function registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): Disposable;
    /**
     * Register a new provider for webview views.
     *
     * @param viewId Unique id of the view. This should match the `id` from the
     *   `views` contribution in the package.json.
     * @param provider Provider for the webview views.
     *
     * @return Disposable that unregisters the provider.
     */
    export function registerWebviewViewProvider(viewId: string, provider: WebviewViewProvider, options?: {
      /**
       * Content settings for the webview created for this view.
       */
      readonly webviewOptions?: {
        /**
         * Controls if the webview element itself (iframe) is kept around even when the view
         * is no longer visible.
         *
         * Normally the webview's html context is created when the view becomes visible
         * and destroyed when it is hidden. Extensions that have complex state
         * or UI can set the `retainContextWhenHidden` to make VS Code keep the webview
         * context around, even when the webview moves to a background tab. When a webview using
         * `retainContextWhenHidden` becomes hidden, its scripts and other dynamic content are suspended.
         * When the view becomes visible again, the context is automatically restored
         * in the exact same state it was in originally. You cannot send messages to a
         * hidden webview, even with `retainContextWhenHidden` enabled.
         *
         * `retainContextWhenHidden` has a high memory overhead and should only be used if
         * your view's context cannot be quickly saved and restored.
         */
        readonly retainContextWhenHidden?: boolean;
      };
    }): Disposable;
    /**
     * Register a provider for custom editors for the `viewType` contributed by the `customEditors` extension point.
     *
     * When a custom editor is opened, VS Code fires an `onCustomEditor:viewType` activation event. Your extension
     * must register a [`CustomTextEditorProvider`](#CustomTextEditorProvider), [`CustomReadonlyEditorProvider`](#CustomReadonlyEditorProvider),
     * [`CustomEditorProvider`](#CustomEditorProvider)for `viewType` as part of activation.
     *
     * @param viewType Unique identifier for the custom editor provider. This should match the `viewType` from the
     *   `customEditors` contribution point.
     * @param provider Provider that resolves custom editors.
     * @param options Options for the provider.
     *
     * @return Disposable that unregisters the provider.
     */
    export function registerCustomEditorProvider(viewType: string, provider: CustomTextEditorProvider | CustomReadonlyEditorProvider | CustomEditorProvider, options?: {
      /**
       * Content settings for the webview panels created for this custom editor.
       */
      readonly webviewOptions?: WebviewPanelOptions;

      /**
       * Only applies to `CustomReadonlyEditorProvider | CustomEditorProvider`.
       *
       * Indicates that the provider allows multiple editor instances to be open at the same time for
       * the same resource.
       *
       * By default, VS Code only allows one editor instance to be open at a time for each resource. If the
       * user tries to open a second editor instance for the resource, the first one is instead moved to where
       * the second one was to be opened.
       *
       * When `supportsMultipleEditorsPerDocument` is enabled, users can split and create copies of the custom
       * editor. In this case, the custom editor must make sure it can properly synchronize the states of all
       * editor instances for a resource so that they are consistent.
       */
      readonly supportsMultipleEditorsPerDocument?: boolean;
    }): Disposable;
    /**
     * Register provider that enables the detection and handling of links within the terminal.
     * @param provider The provider that provides the terminal links.
     * @return Disposable that unregisters the provider.
     */
    export function registerTerminalLinkProvider(provider: TerminalLinkProvider): Disposable;
    /**
     * Registers a provider for a contributed terminal profile.
     * @param id The ID of the contributed terminal profile.
     * @param provider The terminal profile provider.
     */
    export function registerTerminalProfileProvider(id: string, provider: TerminalProfileProvider): Disposable;
    /**
     * ~~Show progress in the Source Control viewlet while running the given callback and while
     * its returned promise isn't resolve or rejected.~~
     *
     * @deprecated Use `withProgress` instead.
     *
     * @param task A callback returning a promise. Progress increments can be reported with
     * the provided [progress](#Progress)-object.
     * @return The thenable the task did return.
     */
    export function withScmProgress<R>(task: (progress: Progress<number>) => Thenable<R>): Thenable<R>;

    /**
     * Show progress in the editor. Progress is shown while running the given callback
     * and while the promise it returned isn't resolved nor rejected. The location at which
     * progress should show (and other details) is defined via the passed [`ProgressOptions`](#ProgressOptions).
     *
     * @param task A callback returning a promise. Progress state can be reported with
     * the provided [progress](#Progress)-object.
     *
     * To report discrete progress, use `increment` to indicate how much work has been completed. Each call with
     * a `increment` value will be summed up and reflected as overall progress until 100% is reached (a value of
     * e.g. `10` accounts for `10%` of work done).
     * Note that currently only `ProgressLocation.Notification` is capable of showing discrete progress.
     *
     * To monitor if the operation has been cancelled by the user, use the provided [`CancellationToken`](#CancellationToken).
     * Note that currently only `ProgressLocation.Notification` is supporting to show a cancel button to cancel the
     * long running operation.
     *
     * @return The thenable the task-callback returned.
     */
    export function withProgress<R>(options: ProgressOptions, task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Thenable<R>): Thenable<R>;

    /**
     * Register a [TreeDataProvider](#TreeDataProvider) for the view contributed using the extension point `views`.
     * This will allow you to contribute data to the [TreeView](#TreeView) and update if the data changes.
     *
     * **Note:** To get access to the [TreeView](#TreeView) and perform operations on it, use [createTreeView](#window.createTreeView).
     *
     * @param viewId Id of the view contributed using the extension point `views`.
     * @param treeDataProvider A [TreeDataProvider](#TreeDataProvider) that provides tree data for the view
     */
    export function registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable;

    /**
     * Create a [TreeView](#TreeView) for the view contributed using the extension point `views`.
     * @param viewId Id of the view contributed using the extension point `views`.
     * @param options Options for creating the [TreeView](#TreeView)
     * @returns a [TreeView](#TreeView).
     */
    export function createTreeView<T>(viewId: string, options: TreeViewOptions<T>): TreeView<T>;

    /**
     * Options for creating a [TreeView](#TreeView)
     */
    export interface TreeViewOptions<T> {

      /**
       * A data provider that provides tree data.
       */
      treeDataProvider: TreeDataProvider<T>;

      /**
       * Whether to show collapse all action or not.
       */
      showCollapseAll?: boolean;
    }
    /**
     * Shows a file open dialog to the user which allows to select a file
     * for opening-purposes.
     *
     * @param options Options that control the dialog.
     * @returns A promise that resolves to the selected resources or `undefined`.
     */
    export function showOpenDialog(options: OpenDialogOptions): Thenable<Uri[] | undefined>;

    /**
     * Shows a file save dialog to the user which allows to select a file
     * for saving-purposes.
     *
     * @param options Options that control the dialog.
     * @returns A promise that resolves to the selected resource or `undefined`.
     */
    export function showSaveDialog(options: SaveDialogOptions): Thenable<Uri | undefined>;
    /**
     * Shows a selection list of [workspace folders](#workspace.workspaceFolders) to pick from.
     * Returns `undefined` if no folder is open.
     *
     * @param options Configures the behavior of the workspace folder list.
     * @return A promise that resolves to the workspace folder or `undefined`.
     */
    export function showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined>;

    /**
     * Registers a [uri handler](#UriHandler) capable of handling system-wide [uris](#Uri).
     * In case there are multiple windows open, the topmost window will handle the uri.
     * A uri handler is scoped to the extension it is contributed from; it will only
     * be able to handle uris which are directed to the extension itself. A uri must respect
     * the following rules:
     *
     * - The uri-scheme must be `vscode.env.uriScheme`;
     * - The uri-authority must be the extension id (e.g. `my.extension`);
     * - The uri-path, -query and -fragment parts are arbitrary.
     *
     * For example, if the `my.extension` extension registers a uri handler, it will only
     * be allowed to handle uris with the prefix `product-name://my.extension`.
     *
     * An extension can only register a single uri handler in its entire activation lifetime.
     *
     * * *Note:* There is an activation event `onUri` that fires when a uri directed for
     * the current extension is about to be handled.
     *
     * @param handler The uri handler to register for this extension.
     */
    export function registerUriHandler(handler: UriHandler): Disposable;

    /**
     * The currently active color theme as configured in the settings. The active
     * theme can be changed via the `workbench.colorTheme` setting.
     */
    export let activeColorTheme: ColorTheme;

    /**
     * An [event](#Event) which fires when the active theme changes or one of it's colors chnage.
     */
    export const onDidChangeActiveColorTheme: Event<ColorTheme>;
  }

  /**
 * A panel that contains a webview.
 */
  interface WebviewPanel {
    /**
     * Identifies the type of the webview panel, such as `'markdown.preview'`.
     */
    readonly viewType: string;

    /**
     * Title of the panel shown in UI.
     */
    title: string;

    /**
     * Icon for the panel shown in UI.
     */
    iconPath?: Uri | { light: Uri; dark: Uri };

    /**
     * Webview belonging to the panel.
     */
    readonly webview: Webview;

    /**
     * Content settings for the webview panel.
     */
    readonly options: WebviewPanelOptions;

    /**
     * Editor position of the panel. This property is only set if the webview is in
     * one of the editor view columns.
     */
    readonly viewColumn?: ViewColumn;

    /**
     * Whether the panel is active (focused by the user).
     */
    readonly active: boolean;

    /**
     * Whether the panel is visible.
     */
    readonly visible: boolean;

    /**
     * Fired when the panel's view state changes.
     */
    readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

    /**
     * Fired when the panel is disposed.
     *
     * This may be because the user closed the panel or because `.dispose()` was
     * called on it.
     *
     * Trying to use the panel after it has been disposed throws an exception.
     */
    readonly onDidDispose: Event<void>;

    /**
     * Show the webview panel in a given column.
     *
     * A webview panel may only show in a single column at a time. If it is already showing, this
     * method moves it to a new column.
     *
     * @param viewColumn View column to show the panel in. Shows in the current `viewColumn` if undefined.
     * @param preserveFocus When `true`, the webview will not take focus.
     */
    reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;

    /**
     * Dispose of the webview panel.
     *
     * This closes the panel if it showing and disposes of the resources owned by the webview.
     * Webview panels are also disposed when the user closes the webview panel. Both cases
     * fire the `onDispose` event.
     */
    dispose(): any;
  }

  /**
   * Restore webview panels that have been persisted when vscode shuts down.
   *
   * There are two types of webview persistence:
   *
   * - Persistence within a session.
   * - Persistence across sessions (across restarts of VS Code).
   *
   * A `WebviewPanelSerializer` is only required for the second case: persisting a webview across sessions.
   *
   * Persistence within a session allows a webview to save its state when it becomes hidden
   * and restore its content from this state when it becomes visible again. It is powered entirely
   * by the webview content itself. To save off a persisted state, call `acquireVsCodeApi().setState()` with
   * any json serializable object. To restore the state again, call `getState()`
   *
   * ```js
   * // Within the webview
   * const vscode = acquireVsCodeApi();
   *
   * // Get existing state
   * const oldState = vscode.getState() || { value: 0 };
   *
   * // Update state
   * setState({ value: oldState.value + 1 })
   * ```
   *
   * A `WebviewPanelSerializer` extends this persistence across restarts of VS Code. When the editor is shutdown,
   * VS Code will save off the state from `setState` of all webviews that have a serializer. When the
   * webview first becomes visible after the restart, this state is passed to `deserializeWebviewPanel`.
   * The extension can then restore the old `WebviewPanel` from this state.
   *
   * @param T Type of the webview's state.
   */
  interface WebviewPanelSerializer<T = unknown> {
    /**
     * Restore a webview panel from its serialized `state`.
     *
     * Called when a serialized webview first becomes visible.
     *
     * @param webviewPanel Webview panel to restore. The serializer should take ownership of this panel. The
     * serializer must restore the webview's `.html` and hook up all webview events.
     * @param state Persisted state from the webview content.
     *
     * @return Thenable indicating that the webview has been fully restored.
     */
    deserializeWebviewPanel(webviewPanel: WebviewPanel, state: T): Thenable<void>;
  }

  /**
   * Event fired when a webview panel's view state changes.
   */
  export interface WebviewPanelOnDidChangeViewStateEvent {
    /**
     * Webview panel whose view state changed.
     */
    readonly webviewPanel: WebviewPanel;
  }

  /**
 * A webview based view.
 */
  /**
 * A webview based view.
 */
  export interface WebviewView {
    /**
     * Identifies the type of the webview view, such as `'hexEditor.dataView'`.
     */
    readonly viewType: string;

    /**
     * The underlying webview for the view.
     */
    readonly webview: Webview;

    /**
     * View title displayed in the UI.
     *
     * The view title is initially taken from the extension `package.json` contribution.
     */
    title?: string;

    /**
     * Human-readable string which is rendered less prominently in the title.
     */
    description?: string;

    /**
     * Event fired when the view is disposed.
     *
     * Views are disposed when they are explicitly hidden by a user (this happens when a user
     * right clicks in a view and unchecks the webview view).
     *
     * Trying to use the view after it has been disposed throws an exception.
     */
    readonly onDidDispose: Event<void>;

    /**
     * Tracks if the webview is currently visible.
     *
     * Views are visible when they are on the screen and expanded.
     */
    readonly visible: boolean;

    /**
     * Event fired when the visibility of the view changes.
     *
     * Actions that trigger a visibility change:
     *
     * - The view is collapsed or expanded.
     * - The user switches to a different view group in the sidebar or panel.
     *
     * Note that hiding a view using the context menu instead disposes of the view and fires `onDidDispose`.
     */
    readonly onDidChangeVisibility: Event<void>;

    /**
     * Reveal the view in the UI.
     *
     * If the view is collapsed, this will expand it.
     *
     * @param preserveFocus When `true` the view will not take focus.
     */
    show(preserveFocus?: boolean): void;
  }

  /**
   * Additional information the webview view being resolved.
   *
   * @param T Type of the webview's state.
   */
  interface WebviewViewResolveContext<T = unknown> {
    /**
     * Persisted state from the webview content.
     *
     * To save resources, VS Code normally deallocates webview documents (the iframe content) that are not visible.
     * For example, when the user collapse a view or switches to another top level activity in the sidebar, the
     * `WebviewView` itself is kept alive but the webview's underlying document is deallocated. It is recreated when
     * the view becomes visible again.
     *
     * You can prevent this behavior by setting `retainContextWhenHidden` in the `WebviewOptions`. However this
     * increases resource usage and should be avoided wherever possible. Instead, you can use persisted state to
     * save off a webview's state so that it can be quickly recreated as needed.
     *
     * To save off a persisted state, inside the webview call `acquireVsCodeApi().setState()` with
     * any json serializable object. To restore the state again, call `getState()`. For example:
     *
     * ```js
     * // Within the webview
     * const vscode = acquireVsCodeApi();
     *
     * // Get existing state
     * const oldState = vscode.getState() || { value: 0 };
     *
     * // Update state
     * setState({ value: oldState.value + 1 })
     * ```
     *
     * VS Code ensures that the persisted state is saved correctly when a webview is hidden and across
     * editor restarts.
     */
    readonly state: T | undefined;
  }

  /**
   * Provider for creating `WebviewView` elements.
   */
  export interface WebviewViewProvider {
    /**
     * Revolves a webview view.
     *
     * `resolveWebviewView` is called when a view first becomes visible. This may happen when the view is
     * first loaded or when the user hides and then shows a view again.
     *
     * @param webviewView Webview view to restore. The provider should take ownership of this view. The
     *    provider must set the webview's `.html` and hook up all webview events it is interested in.
     * @param context Additional metadata about the view being resolved.
     * @param token Cancellation token indicating that the view being provided is no longer needed.
     *
     * @return Optional thenable indicating that the view has been fully resolved.
     */
    resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken): Thenable<void> | void;
  }

  /**
   * Represents a color theme kind.
   */
  export enum ColorThemeKind {
    Light = 1,
    Dark = 2,
    HighContrast = 3,
  }

  /**
   * Represents a color theme.
   */
  export interface ColorTheme {

    /**
     * The kind of this color theme: light, dark or high contrast.
     */
    readonly kind: ColorThemeKind;
  }

}
