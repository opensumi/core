/**
 * API OWENR: 木农
 */

declare module 'vscode' {
	export namespace workspace {

		/**
		 * Save all dirty files.
		 *
		 * @param includeUntitled Also save files that have been created during this session.
		 * @return A thenable that resolves when the files have been saved.
		 * @木农
		 */
		export function saveAll(includeUntitled?: boolean): Thenable<boolean>;
	}
}
