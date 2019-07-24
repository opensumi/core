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
		 * Creates a new [output channel](#OutputChannel) with the given name.
		 *
		 * @param name Human-readable string which will be used to represent the channel in the UI.
		 */
		export function createOutputChannel(name: string): OutputChannel;

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
		 * ~~Reveal this channel in the UI.~~
		 *
		 * @deprecated Use the overload with just one parameter (`show(preserveFocus?: boolean): void`).
		 *
		 * @param column This argument is **deprecated** and will be ignored.
		 * @param preserveFocus When `true` the channel will not take focus.
		 */
		show(column?: ViewColumn, preserveFocus?: boolean): void;

		/**
		 * Hide this channel from the UI.
		 */
		hide(): void;

		/**
		 * Dispose and free associated resources.
		 */
		dispose(): void;
	}

}
