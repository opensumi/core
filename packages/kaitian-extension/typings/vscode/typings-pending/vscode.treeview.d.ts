/**
 * API OWENR: 魁武
 */

declare module 'vscode' {
	/**
	 * Namespace for dealing with the current window of the editor. That is visible
	 * and active editors, as well as, UI elements to show messages, selections, and
	 * asking for user input.
	 */
	export namespace window {
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

  }
}