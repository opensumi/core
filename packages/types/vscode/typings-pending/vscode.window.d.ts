
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
		 * Shows a selection list of [workspace folders](#workspace.workspaceFolders) to pick from.
		 * Returns `undefined` if no folder is open.
		 *
		 * @param options Configures the behavior of the workspace folder list.
		 * @return A promise that resolves to the workspace folder or `undefined`.
		 */
		export function showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined>;

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
}
