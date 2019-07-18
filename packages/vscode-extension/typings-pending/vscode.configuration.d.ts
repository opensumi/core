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
		 * Get a workspace configuration object.
		 *
		 * When a section-identifier is provided only that part of the configuration
		 * is returned. Dots in the section-identifier are interpreted as child-access,
		 * like `{ myExt: { setting: { doIt: true }}}` and `getConfiguration('myExt.setting').get('doIt') === true`.
		 *
		 * When a resource is provided, configuration scoped to that resource is returned.
		 *
		 * @param section A dot-separated identifier.
		 * @param resource A resource for which the configuration is asked for
		 * @return The full configuration or a subset.
		 */
		export function getConfiguration(section?: string, resource?: Uri | null): WorkspaceConfiguration;

    /**
		 * An event that is emitted when the [configuration](#WorkspaceConfiguration) changed.
		 */
    export const onDidChangeConfiguration: Event<ConfigurationChangeEvent>;

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

	export interface WorkspaceConfiguration {

		/**
		 * Return a value from this configuration.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @return The value `section` denotes or `undefined`.
		 */
		get<T>(section: string): T | undefined;

		/**
		 * Return a value from this configuration.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @param defaultValue A value should be returned when no value could be found, is `undefined`.
		 * @return The value `section` denotes or the default.
		 */
		get<T>(section: string, defaultValue: T): T;

		/**
		 * Check if this configuration has a certain value.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @return `true` if the section doesn't resolve to `undefined`.
		 */
		has(section: string): boolean;

		/**
		 * Retrieve all information about a configuration setting. A configuration value
		 * often consists of a *default* value, a global or installation-wide value,
		 * a workspace-specific value and a folder-specific value.
		 *
		 * The *effective* value (returned by [`get`](#WorkspaceConfiguration.get))
		 * is computed like this: `defaultValue` overwritten by `globalValue`,
		 * `globalValue` overwritten by `workspaceValue`. `workspaceValue` overwritten by `workspaceFolderValue`.
		 * Refer to [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings)
		 * for more information.
		 *
		 * *Note:* The configuration name must denote a leaf in the configuration tree
		 * (`editor.fontSize` vs `editor`) otherwise no result is returned.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @return Information about a configuration setting or `undefined`.
		 */
		inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T, workspaceFolderValue?: T } | undefined;

		/**
		 * Update a configuration value. The updated configuration values are persisted.
		 *
		 * A value can be changed in
		 *
		 * - [Global configuration](#ConfigurationTarget.Global): Changes the value for all instances of the editor.
		 * - [Workspace configuration](#ConfigurationTarget.Workspace): Changes the value for current workspace, if available.
		 * - [Workspace folder configuration](#ConfigurationTarget.WorkspaceFolder): Changes the value for the
		 * [Workspace folder](#workspace.workspaceFolders) to which the current [configuration](#WorkspaceConfiguration) is scoped to.
		 *
		 * *Note 1:* Setting a global value in the presence of a more specific workspace value
		 * has no observable effect in that workspace, but in others. Setting a workspace value
		 * in the presence of a more specific folder value has no observable effect for the resources
		 * under respective [folder](#workspace.workspaceFolders), but in others. Refer to
		 * [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings) for more information.
		 *
		 * *Note 2:* To remove a configuration value use `undefined`, like so: `config.update('somekey', undefined)`
		 *
		 * Will throw error when
		 * - Writing a configuration which is not registered.
		 * - Writing a configuration to workspace or folder target when no workspace is opened
		 * - Writing a configuration to folder target when there is no folder settings
		 * - Writing to folder target without passing a resource when getting the configuration (`workspace.getConfiguration(section, resource)`)
		 * - Writing a window configuration to folder target
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @param value The new value.
		 * @param configurationTarget The [configuration target](#ConfigurationTarget) or a boolean value.
		 *	- If `true` configuration target is `ConfigurationTarget.Global`.
		 *	- If `false` configuration target is `ConfigurationTarget.Workspace`.
		 *	- If `undefined` or `null` configuration target is
		 *	`ConfigurationTarget.WorkspaceFolder` when configuration is resource specific
		 *	`ConfigurationTarget.Workspace` otherwise.
		 */
		update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;

		/**
		 * Readable dictionary that backs this configuration.
		 */
		readonly [key: string]: any;
	}
}
