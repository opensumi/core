/**
 * API OWENR: 墨蛰
 */

declare module 'vscode' {
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
	}
}