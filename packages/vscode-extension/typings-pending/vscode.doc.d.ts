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


		/**
		 * All text documents currently known to the system.
		 * @Owner 木农
		 */
    export const textDocuments: TextDocument[];

		/**
		 * Register a text document content provider.
		 *
		 * Only one provider can be registered per scheme.
		 *
		 * @param scheme The uri-scheme to register for.
		 * @param provider A content provider.
		 * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
		 */
		export function registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;

	}
}
