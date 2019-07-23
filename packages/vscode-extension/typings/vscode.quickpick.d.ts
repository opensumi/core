/**
 * API OWENR: 蛋总
 */

declare module 'vscode' {

	/**
	 * Represents an item that can be selected from
	 * a list of items.
	 */
	export interface QuickPickItem {

		/**
		 * A human readable string which is rendered prominent.
		 */
		label: string;

		/**
		 * A human readable string which is rendered less prominent.
		 */
		description?: string;

		/**
		 * A human readable string which is rendered less prominent.
		 */
		detail?: string;

		/**
		 * Optional flag indicating if this item is picked initially.
		 * (Only honored when the picker allows multiple selections.)
		 *
		 * @see [QuickPickOptions.canPickMany](#QuickPickOptions.canPickMany)
		 * not implemented yet
		 */
		picked?: boolean;

		/**
		 * Always show this item.
		 * not implemented yet
		 */
		alwaysShow?: boolean;
	}


		/**
	 * A concrete [QuickInput](#QuickInput) to let the user pick an item from a
	 * list of items of type T. The items can be filtered through a filter text field and
	 * there is an option [canSelectMany](#QuickPick.canSelectMany) to allow for
	 * selecting multiple items.
	 *
	 * Note that in many cases the more convenient [window.showQuickPick](#window.showQuickPick)
	 * is easier to use. [window.createQuickPick](#window.createQuickPick) should be used
	 * when [window.showQuickPick](#window.showQuickPick) does not offer the required flexibility.
	 */
	export interface QuickPick<T extends QuickPickItem> extends QuickInput {

		/**
		 * Current value of the filter text.
		 */
		value: string;

		/**
		 * Optional placeholder in the filter text.
		 */
		placeholder: string | undefined;

		/**
		 * An event signaling when the value of the filter text has changed.
		 */
		readonly onDidChangeValue: Event<string>;

		/**
		 * An event signaling when the user indicated acceptance of the selected item(s).
		 */
		readonly onDidAccept: Event<void>;

		/**
		 * Buttons for actions in the UI.
		 * not implemented yet
		 */
		buttons: ReadonlyArray<QuickInputButton>;

		/**
		 * An event signaling when a button was triggered.
		 */
		readonly onDidTriggerButton: Event<QuickInputButton>;

		/**
		 * Items to pick from.
		 */
		items: ReadonlyArray<T>;

		/**
		 * If multiple items can be selected at the same time. Defaults to false.
		 * not implemented yet
		 */
		canSelectMany: boolean;

		/**
		 * If the filter text should also be matched against the description of the items. Defaults to false.
		 */
		matchOnDescription: boolean;

		/**
		 * If the filter text should also be matched against the detail of the items. Defaults to false.
		 */
		matchOnDetail: boolean;

		/**
		 * Active items. This can be read and updated by the extension.
		 * not implemented yet
		 */
		activeItems: ReadonlyArray<T>;

		/**
		 * An event signaling when the active items have changed.
		 */
		readonly onDidChangeActive: Event<T[]>;

		/**
		 * Selected items. This can be read and updated by the extension.
		 * not implemented yet
		 */
		selectedItems: ReadonlyArray<T>;

		/**
		 * An event signaling when the selected items have changed.
		 */
		readonly onDidChangeSelection: Event<T[]>;
	}

	/**
	 * Options to configure the behavior of the quick pick UI.
	 */
	export interface QuickPickOptions {
		/**
		 * An optional flag to include the description when filtering the picks.
		 */
		matchOnDescription?: boolean;

		/**
		 * An optional flag to include the detail when filtering the picks.
		 */
		matchOnDetail?: boolean;

		/**
		 * An optional string to show as place holder in the input box to guide the user what to pick on.
		 */
		placeHolder?: string;

		/**
		 * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
		 */
		ignoreFocusOut?: boolean;

		/**
		 * An optional flag to make the picker accept multiple selections, if true the result is an array of picks.
		 * not implemented yet
		 */
		canPickMany?: boolean;

		/**
		 * An optional function that is invoked whenever an item is selected.
		 */
		onDidSelectItem?(item: QuickPickItem | string): any;
	}
	export namespace window {
		/**
		 * Creates a [QuickPick](#QuickPick) to let the user pick an item from a list
		 * of items of type T.
		 *
		 * Note that in many cases the more convenient [window.showQuickPick](#window.showQuickPick)
		 * is easier to use. [window.createQuickPick](#window.createQuickPick) should be used
		 * when [window.showQuickPick](#window.showQuickPick) does not offer the required flexibility.
		 *
		 * @return A new [QuickPick](#QuickPick).
		 */
		export function createQuickPick<T extends QuickPickItem>(): QuickPick<T>;
		/**
		 * Shows a selection list allowing multiple selections.
		 *
		 * @param items An array of strings, or a promise that resolves to an array of strings.
		 * @param options Configures the behavior of the selection list.
		 * @param token A token that can be used to signal cancellation.
		 * @return A promise that resolves to the selected items or `undefined`.
		 */
		export function showQuickPick(items: string[] | Thenable<string[]>, options: QuickPickOptions & { canPickMany: true; }, token?: CancellationToken): Thenable<string[] | undefined>;

		/**
		 * Shows a selection list.
		 *
		 * @param items An array of strings, or a promise that resolves to an array of strings.
		 * @param options Configures the behavior of the selection list.
		 * @param token A token that can be used to signal cancellation.
		 * @return A promise that resolves to the selection or `undefined`.
		 */
		export function showQuickPick(items: string[] | Thenable<string[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<string | undefined>;

		/**
		 * Shows a selection list allowing multiple selections.
		 *
		 * @param items An array of items, or a promise that resolves to an array of items.
		 * @param options Configures the behavior of the selection list.
		 * @param token A token that can be used to signal cancellation.
		 * @return A promise that resolves to the selected items or `undefined`.
		 */
		export function showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions & { canPickMany: true; }, token?: CancellationToken): Thenable<T[] | undefined>;

		/**
		 * Shows a selection list.
		 *
		 * @param items An array of items, or a promise that resolves to an array of items.
		 * @param options Configures the behavior of the selection list.
		 * @param token A token that can be used to signal cancellation.
		 * @return A promise that resolves to the selected item or `undefined`.
		 */
		export function showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<T | undefined>;
	}
}
