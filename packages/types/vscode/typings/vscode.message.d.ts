declare module 'vscode' {
  /**
	 * Namespace for dealing with the current window of the editor. That is visible
	 * and active editors, as well as, UI elements to show messages, selections, and
	 * asking for user input.
	 */
  export namespace window {
    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    export function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show an information message to users. Optionally provide an array of items which will be presented as
		 * clickable buttons.
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showInformationMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show an information message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showInformationMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

		/**
		 * Show an information message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showInformationMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T | undefined>;

		/**
		 * Show a warning message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show a warning message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showWarningMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show a warning message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

		/**
		 * Show a warning message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T | undefined>;

		/**
		 * Show an error message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show an error message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showErrorMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

		/**
		 * Show an error message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showErrorMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

		/**
		 * Show an error message.
		 *
		 * @see [showInformationMessage](#window.showInformationMessage)
		 *
		 * @param message The message to show.
		 * @param options Configures the behaviour of the message.
		 * @param items A set of items that will be rendered as actions in the message.
		 * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
		 */
    export function showErrorMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T | undefined>;

  }

  /**
	 * Represents an action that is shown with an information, warning, or
	 * error message.
	 *
	 * @see [showInformationMessage](#window.showInformationMessage)
	 * @see [showWarningMessage](#window.showWarningMessage)
	 * @see [showErrorMessage](#window.showErrorMessage)
	 */
  export interface MessageItem {

		/**
		 * A short title like 'Retry', 'Open Log' etc.
		 */
    title: string;

		/**
		 * A hint for modal dialogs that the item should be triggered
		 * when the user cancels the dialog (e.g. by pressing the ESC
		 * key).
		 *
		 * Note: this option is ignored for non-modal messages.
		 */
    isCloseAffordance?: boolean;
  }

	/**
	 * Options to configure the behavior of the message.
	 *
	 * @see [showInformationMessage](#window.showInformationMessage)
	 * @see [showWarningMessage](#window.showWarningMessage)
	 * @see [showErrorMessage](#window.showErrorMessage)
	 */
  export interface MessageOptions {

		/**
		 * Indicates that this message should be modal.
		 */
    modal?: boolean;
  }
}
