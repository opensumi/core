declare module 'vscode' {

	/**
	 * Namespace for participating in language-specific editor [features](https://code.visualstudio.com/docs/editor/editingevolved),
	 * like IntelliSense, code actions, diagnostics etc.
	 *
	 * Many programming languages exist and there is huge variety in syntaxes, semantics, and paradigms. Despite that, features
	 * like automatic word-completion, code navigation, or code checking have become popular across different tools for different
	 * programming languages.
	 *
	 * The editor provides an API that makes it simple to provide such common features by having all UI and actions already in place and
	 * by allowing you to participate by providing data only. For instance, to contribute a hover all you have to do is provide a function
	 * that can be called with a [TextDocument](#TextDocument) and a [Position](#Position) returning hover info. The rest, like tracking the
	 * mouse, positioning the hover, keeping the hover stable etc. is taken care of by the editor.
	 *
	 * ```javascript
	 * languages.registerHoverProvider('javascript', {
    * 	provideHover(document, position, token) {
    * 		return new Hover('I am a hover!');
    * 	}
    * });
    * ```
    *
    * Registration is done using a [document selector](#DocumentSelector) which is either a language id, like `javascript` or
    * a more complex [filter](#DocumentFilter) like `{ language: 'typescript', scheme: 'file' }`. Matching a document against such
    * a selector will result in a [score](#languages.match) that is used to determine if and how a provider shall be used. When
    * scores are equal the provider that came last wins. For features that allow full arity, like [hover](#languages.registerHoverProvider),
    * the score is only checked to be `>0`, for other features, like [IntelliSense](#languages.registerCompletionItemProvider) the
    * score is used for determining the order in which providers are asked to participate.
    */
   export namespace languages {
 
     /**
      * Return the identifiers of all known languages.
      * @return Promise resolving to an array of identifier strings.
      */
     export function getLanguages(): Thenable<string[]>;
 
     /**
      * Set (and change) the [language](#TextDocument.languageId) that is associated
      * with the given document.
      *
      * *Note* that calling this function will trigger the [`onDidCloseTextDocument`](#workspace.onDidCloseTextDocument) event
      * followed by the [`onDidOpenTextDocument`](#workspace.onDidOpenTextDocument) event.
      *
      * @param document The document which language is to be changed
      * @param languageId The new language identifier.
      * @returns A thenable that resolves with the updated document.
      */
     export function setTextDocumentLanguage(document: TextDocument, languageId: string): Thenable<TextDocument>;
 
     
 
     /**
      * An [event](#Event) which fires when the global set of diagnostics changes. This is
      * newly added and removed diagnostics.
      */
     export const onDidChangeDiagnostics: Event<DiagnosticChangeEvent>;
 
     /**
      * Get all diagnostics for a given resource. *Note* that this includes diagnostics from
      * all extensions but *not yet* from the task framework.
      *
      * @param resource A resource
      * @returns An array of [diagnostics](#Diagnostic) objects or an empty array.
      */
     export function getDiagnostics(resource: Uri): Diagnostic[];
 
     /**
      * Get all diagnostics. *Note* that this includes diagnostics from
      * all extensions but *not yet* from the task framework.
      *
      * @returns An array of uri-diagnostics tuples or an empty array.
      */
     export function getDiagnostics(): [Uri, Diagnostic[]][];
 
     /**
      * Create a diagnostics collection.
      *
      * @param name The [name](#DiagnosticCollection.name) of the collection.
      * @return A new diagnostic collection.
      */
     export function createDiagnosticCollection(name?: string): DiagnosticCollection;
 
     
 
     /**
      * Register a code action provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A code action provider.
      * @param metadata Metadata about the kind of code actions the provider providers.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable;
 
     
 
     /**
      * Register an implementation provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider An implementation provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable;
 
     
 
     /**
      * Register a declaration provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A declaration provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDeclarationProvider(selector: DocumentSelector, provider: DeclarationProvider): Disposable;
 
     
 
     /**
      * Register a document symbol provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A document symbol provider.
      * @param metaData metadata about the provider
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider, metaData?: DocumentSymbolProviderMetadata): Disposable;
 
     /**
      * Register a workspace symbol provider.
      *
      * Multiple providers can be registered. In that case providers are asked in parallel and
      * the results are merged. A failing provider (rejected promise or exception) will not cause
      * a failure of the whole operation.
      *
      * @param provider A workspace symbol provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): Disposable;
 
     
 
     /**
      * Register a rename provider.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and the best-matching provider is used. Failure
      * of the selected provider will cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A rename provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable;
 
     /**
      * Register a formatting provider for a document.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and the best-matching provider is used. Failure
      * of the selected provider will cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A document formatting edit provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDocumentFormattingEditProvider(selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable;
 
     
 
     
 
     /**
      * Register a signature help provider.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and called sequentially until a provider returns a
      * valid result.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A signature help provider.
      * @param triggerCharacters Trigger signature help when the user types one of the characters, like `,` or `(`.
      * @param metadata Information about the provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, ...triggerCharacters: string[]): Disposable;
     export function registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, metadata: SignatureHelpProviderMetadata): Disposable;
 
     
     
 
     /**
      * Register a selection range provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A selection range provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerSelectionRangeProvider(selector: DocumentSelector, provider: SelectionRangeProvider): Disposable;
 
     
   }	

	/**
	 * A code action represents a change that can be performed in code, e.g. to fix a problem or
	 * to refactor code.
	 *
	 * A CodeAction must set either [`edit`](#CodeAction.edit) and/or a [`command`](#CodeAction.command). If both are supplied, the `edit` is applied first, then the command is executed.
	 */
	export class CodeAction {

		/**
		 * A short, human-readable, title for this code action.
		 */
		title: string;

		/**
		 * A [workspace edit](#WorkspaceEdit) this code action performs.
		 */
		edit?: WorkspaceEdit;

		/**
		 * [Diagnostics](#Diagnostic) that this code action resolves.
		 */
		diagnostics?: Diagnostic[];

		/**
		 * A [command](#Command) this code action executes.
		 */
		command?: Command;

		/**
		 * [Kind](#CodeActionKind) of the code action.
		 *
		 * Used to filter code actions.
		 */
		kind?: CodeActionKind;

		/**
		 * Marks this as a preferred action. Preferred actions are used by the `auto fix` command and can be targeted
		 * by keybindings.
		 *
		 * A quick fix should be marked preferred if it properly addresses the underlying error.
		 * A refactoring should be marked preferred if it is the most reasonable choice of actions to take.
		 */
		isPreferred?: boolean;

		/**
		 * Creates a new code action.
		 *
		 * A code action must have at least a [title](#CodeAction.title) and [edits](#CodeAction.edit)
		 * and/or a [command](#CodeAction.command).
		 *
		 * @param title The title of the code action.
		 * @param kind The kind of the code action.
		 */
		constructor(title: string, kind?: CodeActionKind);
	}

}