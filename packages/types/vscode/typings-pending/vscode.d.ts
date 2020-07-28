/// <reference path="./../typings/vscode.editor.d.ts" />
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

declare module 'vscode' {


	/**
	 * Options to configure the behaviour of the [workspace folder](#WorkspaceFolder) pick UI.
	 */
	export interface WorkspaceFolderPickOptions {

		/**
		 * An optional string to show as place holder in the input box to guide the user what to pick on.
		 */
		placeHolder?: string;

		/**
		 * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
		 */
		ignoreFocusOut?: boolean;
	}





	/**
	 * A text edit represents edits that should be applied
	 * to a document.
	 */




















	/**
	 * The completion item provider interface defines the contract between extensions and
	 * [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense).
	 *
	 * Providers can delay the computation of the [`detail`](#CompletionItem.detail)
	 * and [`documentation`](#CompletionItem.documentation) properties by implementing the
	 * [`resolveCompletionItem`](#CompletionItemProvider.resolveCompletionItem)-function. However, properties that
	 * are needed for the initial sorting and filtering, like `sortText`, `filterText`, `insertText`, and `range`, must
	 * not be changed during resolve.
	 *
	 * Providers are asked for completions either explicitly by a user gesture or -depending on the configuration-
	 * implicitly when typing words or trigger characters.
	 */




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

	/**
	 * An output channel is a container for readonly textual information.
	 *
	 * To get an instance of an `OutputChannel` use
	 * [createOutputChannel](#window.createOutputChannel).
	 */
	/**
	 * Defines a generalized way of reporting progress updates.
	 */
	export interface Progress<T> {

		/**
		 * Report a progress update.
		 * @param value A progress item, like a message and/or an
		 * report on how much work finished
		 */
		report(value: T): void;
	}

	/**
	 * Defines a port mapping used for localhost inside the webview.
	 */
	export interface WebviewPortMapping {
		/**
		 * Localhost port to remap inside the webview.
		 */
		readonly webviewPort: number;

		/**
		 * Destination port. The `webviewPort` is resolved to this port.
		 */
		readonly extensionHostPort: number;
	}


	/**
	 * Namespace for dealing with commands. In short, a command is a function with a
	 * unique identifier. The function is sometimes also called _command handler_.
	 *
	 * Commands can be added to the editor using the [registerCommand](#commands.registerCommand)
	 * and [registerTextEditorCommand](#commands.registerTextEditorCommand) functions. Commands
	 * can be executed [manually](#commands.executeCommand) or from a UI gesture. Those are:
	 *
	 * * palette - Use the `commands`-section in `package.json` to make a command show in
	 * the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
	 * * keybinding - Use the `keybindings`-section in `package.json` to enable
	 * [keybindings](https://code.visualstudio.com/docs/getstarted/keybindings#_customizing-shortcuts)
	 * for your extension.
	 *
	 * Commands from other extensions and from the editor itself are accessible to an extension. However,
	 * when invoking an editor command not all argument types are supported.
	 *
	 * This is a sample that registers a command handler and adds an entry for that command to the palette. First
	 * register a command handler with the identifier `extension.sayHello`.
	 * ```javascript
	 * commands.registerCommand('extension.sayHello', () => {
	 * 	window.showInformationMessage('Hello World!');
	 * });
	 * ```
	 * Second, bind the command identifier to a title under which it will show in the palette (`package.json`).
	 * ```json
	 * {
	 * 	"contributes": {
	 * 		"commands": [{
	 * 			"command": "extension.sayHello",
	 * 			"title": "Hello World"
	 * 		}]
	 * 	}
	 * }
	 * ```
	 */


	/**
	 * A uri handler is responsible for handling system-wide [uris](#Uri).
	 *
	 * @see [window.registerUriHandler](#window.registerUriHandler).
	 */
	export interface UriHandler {

		/**
		 * Handle the provided system-wide [uri](#Uri).
		 *
		 * @see [window.registerUriHandler](#window.registerUriHandler).
		 */
		handleUri(uri: Uri): ProviderResult<void>;
	}

	/**
	 * An event describing a change to the set of [workspace folders](#workspace.workspaceFolders).
	 */
	export interface WorkspaceFoldersChangeEvent {
		/**
		 * Added workspace folders.
		 */
		readonly added: ReadonlyArray<WorkspaceFolder>;

		/**
		 * Removed workspace folders.
		 */
		readonly removed: ReadonlyArray<WorkspaceFolder>;
	}
	/**
	 * An event describing the change in Configuration
	 */
	export interface ConfigurationChangeEvent {

		/**
		 * Returns `true` if the given section for the given resource (if provided) is affected.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @param resource A resource Uri.
		 * @return `true` if the given section for the given resource (if provided) is affected.
		 */
		affectsConfiguration(section: string, resource?: Uri): boolean;
	}

	//#endregion
}

