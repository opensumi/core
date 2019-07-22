/**
 * API OWENR: 蛋总
 */

declare module 'vscode' {

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

	

	/**
	 * Options to configure the behavior of the input box UI.
	 */
	export interface InputBoxOptions {

		/**
		 * The value to prefill in the input box.
		 */
		value?: string;

		/**
		 * Selection of the prefilled [`value`](#InputBoxOptions.value). Defined as tuple of two number where the
		 * first is the inclusive start index and the second the exclusive end index. When `undefined` the whole
		 * word will be selected, when empty (start equals end) only the cursor will be set,
		 * otherwise the defined range will be selected.
		 */
		valueSelection?: [number, number];

		/**
		 * The text to display underneath the input box.
		 */
		prompt?: string;

		/**
		 * An optional string to show as place holder in the input box to guide the user what to type.
		 */
		placeHolder?: string;

		/**
		 * Set to `true` to show a password prompt that will not show the typed value.
		 */
		password?: boolean;

		/**
		 * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
		 */
		ignoreFocusOut?: boolean;

		/**
		 * An optional function that will be called to validate input and to give a hint
		 * to the user.
		 *
		 * @param value The current value of the input box.
		 * @return A human readable string which is presented as diagnostic message.
		 * Return `undefined`, `null`, or the empty string when 'value' is valid.
		 */
		validateInput?(value: string): string | undefined | null | Thenable<string | undefined | null>;
	}

		/**
	 * A concrete [QuickInput](#QuickInput) to let the user input a text value.
	 *
	 * Note that in many cases the more convenient [window.showInputBox](#window.showInputBox)
	 * is easier to use. [window.createInputBox](#window.createInputBox) should be used
	 * when [window.showInputBox](#window.showInputBox) does not offer the required flexibility.
	 */
	export interface InputBox extends QuickInput {

		/**
		 * Current input value.
		 */
		value: string;

		/**
		 * Optional placeholder in the filter text.
		 */
		placeholder: string | undefined;

		/**
		 * If the input value should be hidden. Defaults to false.
		 */
		password: boolean;

		/**
		 * An event signaling when the value has changed.
		 */
		readonly onDidChangeValue: Event<string>;

		/**
		 * An event signaling when the user indicated acceptance of the input value.
		 */
		readonly onDidAccept: Event<void>;

		/**
		 * Buttons for actions in the UI.
		 */
		buttons: ReadonlyArray<QuickInputButton>;

		/**
		 * An event signaling when a button was triggered.
		 */
		readonly onDidTriggerButton: Event<QuickInputButton>;

		/**
		 * An optional prompt text providing some ask or explanation to the user.
		 */
		prompt: string | undefined;

		/**
		 * An optional validation message indicating a problem with the current input value.
		 */
		validationMessage: string | undefined;
	}

	/**
	 * Button for an action in a [QuickPick](#QuickPick) or [InputBox](#InputBox).
	 */
	export interface QuickInputButton {

		/**
		 * Icon for the button.
		 */
		readonly iconPath: Uri | { light: Uri; dark: Uri } | ThemeIcon;

		/**
		 * An optional tooltip.
		 */
		readonly tooltip?: string | undefined;
	}

	/**
	 * Predefined buttons for [QuickPick](#QuickPick) and [InputBox](#InputBox).
	 */
	export class QuickInputButtons {

		/**
		 * A back button for [QuickPick](#QuickPick) and [InputBox](#InputBox).
		 *
		 * When a navigation 'back' button is needed this one should be used for consistency.
		 * It comes with a predefined icon, tooltip and location.
		 */
		static readonly Back: QuickInputButton;

		/**
		 * @hidden
		 */
		private constructor();
	}

	/**
	 * A light-weight user input UI that is initially not visible. After
	 * configuring it through its properties the extension can make it
	 * visible by calling [QuickInput.show](#QuickInput.show).
	 *
	 * There are several reasons why this UI might have to be hidden and
	 * the extension will be notified through [QuickInput.onDidHide](#QuickInput.onDidHide).
	 * (Examples include: an explicit call to [QuickInput.hide](#QuickInput.hide),
	 * the user pressing Esc, some other input UI opening, etc.)
	 *
	 * A user pressing Enter or some other gesture implying acceptance
	 * of the current state does not automatically hide this UI component.
	 * It is up to the extension to decide whether to accept the user's input
	 * and if the UI should indeed be hidden through a call to [QuickInput.hide](#QuickInput.hide).
	 *
	 * When the extension no longer needs this input UI, it should
	 * [QuickInput.dispose](#QuickInput.dispose) it to allow for freeing up
	 * any resources associated with it.
	 *
	 * See [QuickPick](#QuickPick) and [InputBox](#InputBox) for concrete UIs.
	 */
	export interface QuickInput {

		/**
		 * An optional title.
		 */
		title: string | undefined;

		/**
		 * An optional current step count.
		 */
		step: number | undefined;

		/**
		 * An optional total step count.
		 */
		totalSteps: number | undefined;

		/**
		 * If the UI should allow for user input. Defaults to true.
		 *
		 * Change this to false, e.g., while validating user input or
		 * loading data for the next step in user input.
		 */
		enabled: boolean;

		/**
		 * If the UI should show a progress indicator. Defaults to false.
		 *
		 * Change this to true, e.g., while loading more data or validating
		 * user input.
		 */
		busy: boolean;

		/**
		 * If the UI should stay open even when loosing UI focus. Defaults to false.
		 */
		ignoreFocusOut: boolean;

		/**
		 * Makes the input UI visible in its current configuration. Any other input
		 * UI will first fire an [QuickInput.onDidHide](#QuickInput.onDidHide) event.
		 */
		show(): void;

		/**
		 * Hides this input UI. This will also fire an [QuickInput.onDidHide](#QuickInput.onDidHide)
		 * event.
		 */
		hide(): void;

		/**
		 * An event signaling when this input UI is hidden.
		 *
		 * There are several reasons why this UI might have to be hidden and
		 * the extension will be notified through [QuickInput.onDidHide](#QuickInput.onDidHide).
		 * (Examples include: an explicit call to [QuickInput.hide](#QuickInput.hide),
		 * the user pressing Esc, some other input UI opening, etc.)
		 */
		onDidHide: Event<void>;

		/**
		 * Dispose of this input UI and any associated resources. If it is still
		 * visible, it is first hidden. After this call the input UI is no longer
		 * functional and no additional methods or properties on it should be
		 * accessed. Instead a new input UI should be created.
		 */
		dispose(): void;
	}

  /**
	 * Namespace for dealing with the current window of the editor. That is visible
	 * and active editors, as well as, UI elements to show messages, selections, and
	 * asking for user input.
	 */
  export namespace window {
	
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

		/**
		 * Opens an input box to ask the user for input.
		 *
		 * The returned value will be `undefined` if the input box was canceled (e.g. pressing ESC). Otherwise the
		 * returned value will be the string typed by the user or an empty string if the user did not type
		 * anything but dismissed the input box with OK.
		 *
		 * @param options Configures the behavior of the input box.
		 * @param token A token that can be used to signal cancellation.
		 * @return A promise that resolves to a string the user provided or to `undefined` in case of dismissal.
		 */
		export function showInputBox(options?: InputBoxOptions, token?: CancellationToken): Thenable<string | undefined>;

		

		/**
		 * Creates a [InputBox](#InputBox) to let the user enter some text input.
		 *
		 * Note that in many cases the more convenient [window.showInputBox](#window.showInputBox)
		 * is easier to use. [window.createInputBox](#window.createInputBox) should be used
		 * when [window.showInputBox](#window.showInputBox) does not offer the required flexibility.
		 *
		 * @return A new [InputBox](#InputBox).
		 */
		export function createInputBox(): InputBox;
		
	}
}
