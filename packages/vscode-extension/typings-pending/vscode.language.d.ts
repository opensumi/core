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
      * Compute the match between a document [selector](#DocumentSelector) and a document. Values
      * greater than zero mean the selector matches the document.
      *
      * A match is computed according to these rules:
      * 1. When [`DocumentSelector`](#DocumentSelector) is an array, compute the match for each contained `DocumentFilter` or language identifier and take the maximum value.
      * 2. A string will be desugared to become the `language`-part of a [`DocumentFilter`](#DocumentFilter), so `"fooLang"` is like `{ language: "fooLang" }`.
      * 3. A [`DocumentFilter`](#DocumentFilter) will be matched against the document by comparing its parts with the document. The following rules apply:
      *  1. When the `DocumentFilter` is empty (`{}`) the result is `0`
      *  2. When `scheme`, `language`, or `pattern` are defined but one doesn’t match, the result is `0`
      *  3. Matching against `*` gives a score of `5`, matching via equality or via a glob-pattern gives a score of `10`
      *  4. The result is the maximum value of each match
      *
      * Samples:
      * ```js
      * // default document from disk (file-scheme)
      * doc.uri; //'file:///my/file.js'
      * doc.languageId; // 'javascript'
      * match('javascript', doc); // 10;
      * match({language: 'javascript'}, doc); // 10;
      * match({language: 'javascript', scheme: 'file'}, doc); // 10;
      * match('*', doc); // 5
      * match('fooLang', doc); // 0
      * match(['fooLang', '*'], doc); // 5
      *
      * // virtual document, e.g. from git-index
      * doc.uri; // 'git:/my/file.js'
      * doc.languageId; // 'javascript'
      * match('javascript', doc); // 10;
      * match({language: 'javascript', scheme: 'git'}, doc); // 10;
      * match('*', doc); // 5
      * ```
      *
      * @param selector A document selector.
      * @param document A text document.
      * @return A number `>0` when the selector matches and `0` when the selector does not match.
      */
     export function match(selector: DocumentSelector, document: TextDocument): number;
 
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
      * Register a completion provider.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and groups of equal score are sequentially asked for
      * completion items. The process stops when one or many providers of a group return a
      * result. A failing provider (rejected promise or exception) will not fail the whole
      * operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A completion provider.
      * @param triggerCharacters Trigger completion when the user types one of the characters, like `.` or `:`.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable;
 
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
      * Register a code lens provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A code lens provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable;
 
     /**
      * Register a definition provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A definition provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable;
 
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
      * Register a type definition provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A type definition provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable;
 
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
      * Register a hover provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A hover provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;
 
     /**
      * Register a document highlight provider.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and groups sequentially asked for document highlights.
      * The process stops when a provider returns a `non-falsy` or `non-failure` result.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A document highlight provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable;
 
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
      * Register a reference provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A reference provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable;
 
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
      * Register a formatting provider for a document range.
      *
      * *Note:* A document range provider is also a [document formatter](#DocumentFormattingEditProvider)
      * which means there is no need to [register](#languages.registerDocumentFormattingEditProvider) a document
      * formatter when also registering a range provider.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and the best-matching provider is used. Failure
      * of the selected provider will cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A document range formatting edit provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDocumentRangeFormattingEditProvider(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable;
 
     /**
      * Register a formatting provider that works on type. The provider is active when the user enables the setting `editor.formatOnType`.
      *
      * Multiple providers can be registered for a language. In that case providers are sorted
      * by their [score](#languages.match) and the best-matching provider is used. Failure
      * of the selected provider will cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider An on type formatting edit provider.
      * @param firstTriggerCharacter A character on which formatting should be triggered, like `}`.
      * @param moreTriggerCharacter More trigger characters.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerOnTypeFormattingEditProvider(selector: DocumentSelector, provider: OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacter: string[]): Disposable;
 
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
      * Register a document link provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A document link provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable;
 
     /**
      * Register a color provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged. A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A color provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable;
 
     /**
      * Register a folding range provider.
      *
      * Multiple providers can be registered for a language. In that case providers are asked in
      * parallel and the results are merged.
      * If multiple folding ranges start at the same position, only the range of the first registered provider is used.
      * If a folding range overlaps with an other range that has a smaller position, it is also ignored.
      *
      * A failing provider (rejected promise or exception) will
      * not cause a failure of the whole operation.
      *
      * @param selector A selector that defines the documents this provider is applicable to.
      * @param provider A folding range provider.
      * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
      */
     export function registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable;
 
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
 
     /**
      * Set a [language configuration](#LanguageConfiguration) for a language.
      *
      * @param language A language identifier like `typescript`.
      * @param configuration Language configuration.
      * @return A [disposable](#Disposable) that unsets this configuration.
      */
     export function setLanguageConfiguration(language: string, configuration: LanguageConfiguration): Disposable;
   }
   

	/**
	 * Kind of a code action.
	 *
	 * Kinds are a hierarchical list of identifiers separated by `.`, e.g. `"refactor.extract.function"`.
	 *
	 * Code action kinds are used by VS Code for UI elements such as the refactoring context menu. Users
	 * can also trigger code actions with a specific kind with the `editor.action.codeAction` command.
	 */
	export class CodeActionKind {
		/**
		 * Empty kind.
		 */
		static readonly Empty: CodeActionKind;

		/**
		 * Base kind for quickfix actions: `quickfix`.
		 *
		 * Quick fix actions address a problem in the code and are shown in the normal code action context menu.
		 */
		static readonly QuickFix: CodeActionKind;

		/**
		 * Base kind for refactoring actions: `refactor`
		 *
		 * Refactoring actions are shown in the refactoring context menu.
		 */
		static readonly Refactor: CodeActionKind;

		/**
		 * Base kind for refactoring extraction actions: `refactor.extract`
		 *
		 * Example extract actions:
		 *
		 * - Extract method
		 * - Extract function
		 * - Extract variable
		 * - Extract interface from class
		 * - ...
		 */
		static readonly RefactorExtract: CodeActionKind;

		/**
		 * Base kind for refactoring inline actions: `refactor.inline`
		 *
		 * Example inline actions:
		 *
		 * - Inline function
		 * - Inline variable
		 * - Inline constant
		 * - ...
		 */
		static readonly RefactorInline: CodeActionKind;

		/**
		 * Base kind for refactoring rewrite actions: `refactor.rewrite`
		 *
		 * Example rewrite actions:
		 *
		 * - Convert JavaScript function to class
		 * - Add or remove parameter
		 * - Encapsulate field
		 * - Make method static
		 * - Move method to base class
		 * - ...
		 */
		static readonly RefactorRewrite: CodeActionKind;

		/**
		 * Base kind for source actions: `source`
		 *
		 * Source code actions apply to the entire file and can be run on save
		 * using `editor.codeActionsOnSave`. They also are shown in `source` context menu.
		 */
		static readonly Source: CodeActionKind;

		/**
		 * Base kind for an organize imports source action: `source.organizeImports`.
		 */
		static readonly SourceOrganizeImports: CodeActionKind;

		/**
		 * Base kind for auto-fix source actions: `source.fixAll`.
		 *
		 * Fix all actions automatically fix errors that have a clear fix that do not require user input.
		 * They should not suppress errors or perform unsafe fixes such as generating new types or classes.
		 */
		static readonly SourceFixAll: CodeActionKind;

		private constructor(value: string);

		/**
		 * String value of the kind, e.g. `"refactor.extract.function"`.
		 */
		readonly value: string;

		/**
		 * Create a new kind by appending a more specific selector to the current kind.
		 *
		 * Does not modify the current kind.
		 */
		append(parts: string): CodeActionKind;

		/**
		 * Checks if this code action kind intersects `other`.
		 *
		 * The kind `"refactor.extract"` for example intersects `refactor`, `"refactor.extract"` and ``"refactor.extract.function"`,
		 * but not `"unicorn.refactor.extract"`, or `"refactor.extractAll"`.
		 *
		 * @param other Kind to check.
		 */
		intersects(other: CodeActionKind): boolean;

		/**
		 * Checks if `other` is a sub-kind of this `CodeActionKind`.
		 *
		 * The kind `"refactor.extract"` for example contains `"refactor.extract"` and ``"refactor.extract.function"`,
		 * but not `"unicorn.refactor.extract"`, or `"refactor.extractAll"` or `refactor`.
		 *
		 * @param other Kind to check.
		 */
		contains(other: CodeActionKind): boolean;
	}

	/**
	 * Contains additional diagnostic information about the context in which
	 * a [code action](#CodeActionProvider.provideCodeActions) is run.
	 */
	export interface CodeActionContext {
		/**
		 * An array of diagnostics.
		 */
		readonly diagnostics: ReadonlyArray<Diagnostic>;

		/**
		 * Requested kind of actions to return.
		 *
		 * Actions not of this kind are filtered out before being shown by the lightbulb.
		 */
		readonly only?: CodeActionKind;
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

	/**
	 * The code action interface defines the contract between extensions and
	 * the [light bulb](https://code.visualstudio.com/docs/editor/editingevolved#_code-action) feature.
	 *
	 * A code action can be any command that is [known](#commands.getCommands) to the system.
	 */
	export interface CodeActionProvider {
		/**
		 * Provide commands for the given document and range.
		 *
		 * @param document The document in which the command was invoked.
		 * @param range The selector or range for which the command was invoked. This will always be a selection if
		 * there is a currently active editor.
		 * @param context Context carrying additional information.
		 * @param token A cancellation token.
		 * @return An array of commands, quick fixes, or refactorings or a thenable of such. The lack of a result can be
		 * signaled by returning `undefined`, `null`, or an empty array.
		 */
		provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]>;
	}

	/**
	 * Metadata about the type of code actions that a [CodeActionProvider](#CodeActionProvider) providers
	 */
	export interface CodeActionProviderMetadata {
		/**
		 * [CodeActionKinds](#CodeActionKind) that this provider may return.
		 *
		 * The list of kinds may be generic, such as `CodeActionKind.Refactor`, or the provider
		 * may list our every specific kind they provide, such as `CodeActionKind.Refactor.Extract.append('function`)`
		 */
		readonly providedCodeActionKinds?: ReadonlyArray<CodeActionKind>;
	}

	/**
	 * A code lens represents a [command](#Command) that should be shown along with
	 * source text, like the number of references, a way to run tests, etc.
	 *
	 * A code lens is _unresolved_ when no command is associated to it. For performance
	 * reasons the creation of a code lens and resolving should be done to two stages.
	 *
	 * @see [CodeLensProvider.provideCodeLenses](#CodeLensProvider.provideCodeLenses)
	 * @see [CodeLensProvider.resolveCodeLens](#CodeLensProvider.resolveCodeLens)
	 */
	export class CodeLens {

		/**
		 * The range in which this code lens is valid. Should only span a single line.
		 */
		range: Range;

		/**
		 * The command this code lens represents.
		 */
		command?: Command;

		/**
		 * `true` when there is a command associated.
		 */
		readonly isResolved: boolean;

		/**
		 * Creates a new code lens object.
		 *
		 * @param range The range to which this code lens applies.
		 * @param command The command associated to this code lens.
		 */
		constructor(range: Range, command?: Command);
	}

	/**
	 * A code lens provider adds [commands](#Command) to source text. The commands will be shown
	 * as dedicated horizontal lines in between the source text.
	 */
	export interface CodeLensProvider {

		/**
		 * An optional event to signal that the code lenses from this provider have changed.
		 */
		onDidChangeCodeLenses?: Event<void>;

		/**
		 * Compute a list of [lenses](#CodeLens). This call should return as fast as possible and if
		 * computing the commands is expensive implementors should only return code lens objects with the
		 * range set and implement [resolve](#CodeLensProvider.resolveCodeLens).
		 *
		 * @param document The document in which the command was invoked.
		 * @param token A cancellation token.
		 * @return An array of code lenses or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined`, `null`, or an empty array.
		 */
		provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]>;

		/**
		 * This function will be called for each visible code lens, usually when scrolling and after
		 * calls to [compute](#CodeLensProvider.provideCodeLenses)-lenses.
		 *
		 * @param codeLens code lens that must be resolved.
		 * @param token A cancellation token.
		 * @return The given, resolved code lens or thenable that resolves to such.
		 */
		resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): ProviderResult<CodeLens>;
	}


	/**
	 * A hover represents additional information for a symbol or word. Hovers are
	 * rendered in a tooltip-like widget.
	 */
	export class Hover {

		/**
		 * The contents of this hover.
		 */
		contents: MarkedString[];

		/**
		 * The range to which this hover applies. When missing, the
		 * editor will use the range at the current position or the
		 * current position itself.
		 */
		range?: Range;

		/**
		 * Creates a new hover object.
		 *
		 * @param contents The contents of the hover.
		 * @param range The range to which the hover applies.
		 */
		constructor(contents: MarkedString | MarkedString[], range?: Range);
	}

	/**
	 * The hover provider interface defines the contract between extensions and
	 * the [hover](https://code.visualstudio.com/docs/editor/intellisense)-feature.
	 */
	export interface HoverProvider {

		/**
		 * Provide a hover for the given position and document. Multiple hovers at the same
		 * position will be merged by the editor. A hover can have a range which defaults
		 * to the word range at the position when omitted.
		 *
		 * @param document The document in which the command was invoked.
		 * @param position The position at which the command was invoked.
		 * @param token A cancellation token.
		 * @return A hover or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined` or `null`.
		 */
		provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>;
	}

	/**
	 * A document highlight kind.
	 */
	export enum DocumentHighlightKind {

		/**
		 * A textual occurrence.
		 */
		Text = 0,

		/**
		 * Read-access of a symbol, like reading a variable.
		 */
		Read = 1,

		/**
		 * Write-access of a symbol, like writing to a variable.
		 */
		Write = 2
	}

	/**
	 * A document highlight is a range inside a text document which deserves
	 * special attention. Usually a document highlight is visualized by changing
	 * the background color of its range.
	 */
	export class DocumentHighlight {

		/**
		 * The range this highlight applies to.
		 */
		range: Range;

		/**
		 * The highlight kind, default is [text](#DocumentHighlightKind.Text).
		 */
		kind?: DocumentHighlightKind;

		/**
		 * Creates a new document highlight object.
		 *
		 * @param range The range the highlight applies to.
		 * @param kind The highlight kind, default is [text](#DocumentHighlightKind.Text).
		 */
		constructor(range: Range, kind?: DocumentHighlightKind);
	}

	/**
	 * The document highlight provider interface defines the contract between extensions and
	 * the word-highlight-feature.
	 */
	export interface DocumentHighlightProvider {

		/**
		 * Provide a set of document highlights, like all occurrences of a variable or
		 * all exit-points of a function.
		 *
		 * @param document The document in which the command was invoked.
		 * @param position The position at which the command was invoked.
		 * @param token A cancellation token.
		 * @return An array of document highlights or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined`, `null`, or an empty array.
		 */
		provideDocumentHighlights(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<DocumentHighlight[]>;
	}

}