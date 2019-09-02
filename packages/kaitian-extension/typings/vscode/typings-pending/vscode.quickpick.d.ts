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
		
	}
}
