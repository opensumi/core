
/**
 * API OWENR: CC
 */

declare module 'vscode' {
	/**
	 * Namespace for dealing with the current window of the editor. That is visible
	 * and active editors, as well as, UI elements to show messages, selections, and
	 * asking for user input.
	 */
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
		 * Shows a selection list of [workspace folders](#workspace.workspaceFolders) to pick from.
		 * Returns `undefined` if no folder is open.
		 *
		 * @param options Configures the behavior of the workspace folder list.
		 * @return A promise that resolves to the workspace folder or `undefined`.
		 */
		export function showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined>;


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
		 * Creates a [Terminal](#Terminal). The cwd of the terminal will be the workspace directory
		 * if it exists, regardless of whether an explicit customStartPath setting exists.
		 *
		 * @param options A TerminalOptions object describing the characteristics of the new terminal.
		 * @return A new Terminal.
		 */
		export function createTerminal(options: TerminalOptions): Terminal;

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
	}

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
}