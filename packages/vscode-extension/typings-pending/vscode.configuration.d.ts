/**
 * API OWENR: 魁武
 */

declare module 'vscode' {

	/**
	 * Namespace for dealing with the current workspace. A workspace is the representation
	 * of the folder that has been opened. There is no workspace when just a file but not a
	 * folder has been opened.
	 *
	 * The workspace offers support for [listening](#workspace.createFileSystemWatcher) to fs
	 * events and for [finding](#workspace.findFiles) files. Both perform well and run _outside_
	 * the editor-process so that they should be always used instead of nodejs-equivalents.
	 */
	export namespace workspace {
    /**
		 * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
		 * * returns `undefined` when the given uri doesn't match any workspace folder
		 * * returns the *input* when the given uri is a workspace folder itself
		 *
		 * @param uri An uri.
		 * @return A workspace folder or `undefined`
		 */
		export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;

  }

  /**
	 * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
	 * are equal which means there is no notion of an active or master workspace folder.
	 */
	export interface WorkspaceFolder {

		/**
		 * The associated uri for this workspace folder.
		 *
		 * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
		 * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
		 */
		readonly uri: Uri;

		/**
		 * The name of this workspace folder. Defaults to
		 * the basename of its [uri-path](#Uri.path)
		 */
		readonly name: string;

		/**
		 * The ordinal number of this workspace folder.
		 */
		readonly index: number;
  }
  	/**
	 * Represents the configuration. It is a merged view of
	 *
	 * - Default configuration
	 * - Global configuration
	 * - Workspace configuration (if available)
	 * - Workspace folder configuration of the requested resource (if available)
	 *
	 * *Global configuration* comes from User Settings and shadows Defaults.
	 *
	 * *Workspace configuration* comes from Workspace Settings and shadows Global configuration.
	 *
	 * *Workspace Folder configuration* comes from `.vscode` folder under one of the [workspace folders](#workspace.workspaceFolders).
	 *
	 * *Note:* Workspace and Workspace Folder configurations contains `launch` and `tasks` settings. Their basename will be
	 * part of the section identifier. The following snippets shows how to retrieve all configurations
	 * from `launch.json`:
	 *
	 * ```ts
	 * // launch.json configuration
	 * const config = workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);
	 *
	 * // retrieve values
	 * const values = config.get('configurations');
	 * ```
	 *
	 * Refer to [Settings](https://code.visualstudio.com/docs/getstarted/settings) for more information.
	 */
}
