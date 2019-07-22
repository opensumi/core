/**
 * API OWENR: 蛋总
 */

declare module 'vscode' {
  export namespace window {
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
