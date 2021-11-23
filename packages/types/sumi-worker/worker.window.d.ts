declare module 'kaitian-worker';
declare module 'sumi-worker' {
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
    * 	'Images': ['png', 'jpg']
    * 	'TypeScript': ['ts', 'tsx']
    * }
    * ```
    */
    filters?: { [name: string]: string[] };
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
    * 	'Images': ['png', 'jpg']
    * 	'TypeScript': ['ts', 'tsx']
    * }
    * ```
    */
    filters?: { [name: string]: string[] };
  }
  export namespace window {

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
  * Event fired when a webview panel's view state changes.
  */
  export interface WebviewPanelOnDidChangeViewStateEvent {
    /**
    * Webview panel whose view state changed.
    */
    readonly webviewPanel: WebviewPanel;
  }

}
