/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'sumi-worker' {
  export namespace languages {
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
    export function registerCompletionItemProvider(
      selector: DocumentSelector,
      provider: CompletionItemProvider,
      ...triggerCharacters: string[]
    ): Disposable;
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
    export function registerTypeDefinitionProvider(
      selector: DocumentSelector,
      provider: TypeDefinitionProvider,
    ): Disposable;
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
    export function registerDocumentHighlightProvider(
      selector: DocumentSelector,
      provider: DocumentHighlightProvider,
    ): Disposable;
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
    export function registerDocumentRangeFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentRangeFormattingEditProvider,
    ): Disposable;
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
    export function registerOnTypeFormattingEditProvider(
      selector: DocumentSelector,
      provider: OnTypeFormattingEditProvider,
      firstTriggerCharacter: string,
      ...moreTriggerCharacter: string[]
    ): Disposable;
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
    export function registerDocumentLinkProvider(
      selector: DocumentSelector,
      provider: DocumentLinkProvider,
    ): Disposable;
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
     * Register a inlay hints provider.
     *
     * Multiple providers can be registered for a language. In that case providers are asked in
     * parallel and the results are merged. A failing provider (rejected promise or exception) will
     * not cause a failure of the whole operation.
     *
     * @param selector A selector that defines the documents this provider is applicable to.
     * @param provider An inlay hints provider.
     * @return A {@link Disposable} that unregisters this provider when being disposed.
     */
    export function registerInlayHintsProvider(selector: DocumentSelector, provider: InlayHintsProvider): Disposable;

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
    export function registerFoldingRangeProvider(
      selector: DocumentSelector,
      provider: FoldingRangeProvider,
    ): Disposable;
    /**
     * Set a [language configuration](#LanguageConfiguration) for a language.
     *
     * @param language A language identifier like `typescript`.
     * @param configuration Language configuration.
     * @return A [disposable](#Disposable) that unsets this configuration.
     */
    export function setLanguageConfiguration(language: string, configuration: LanguageConfiguration): Disposable;

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
    export function registerCodeActionsProvider(
      selector: DocumentSelector,
      provider: CodeActionProvider,
      metadata?: CodeActionProviderMetadata,
    ): Disposable;

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
    export function registerImplementationProvider(
      selector: DocumentSelector,
      provider: ImplementationProvider,
    ): Disposable;

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
    export function registerDocumentSymbolProvider(
      selector: DocumentSelector,
      provider: DocumentSymbolProvider,
      metaData?: DocumentSymbolProviderMetadata,
    ): Disposable;

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
    export function registerDocumentFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentFormattingEditProvider,
    ): Disposable;

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
    export function registerSignatureHelpProvider(
      selector: DocumentSelector,
      provider: SignatureHelpProvider,
      ...triggerCharacters: string[]
    ): Disposable;
    export function registerSignatureHelpProvider(
      selector: DocumentSelector,
      provider: SignatureHelpProvider,
      metadata: SignatureHelpProviderMetadata,
    ): Disposable;

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
    export function registerSelectionRangeProvider(
      selector: DocumentSelector,
      provider: SelectionRangeProvider,
    ): Disposable;
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
    provideCodeActions(
      document: TextDocument,
      range: Range | Selection,
      context: CodeActionContext,
      token: CancellationToken,
    ): ProviderResult<(Command | CodeAction)[]>;
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

  /**
   * A code lens provider adds [commands](#Command) to source text. The commands will be shown
   * as dedicated horizontal lines in between the source text.
   */
  export interface CodeLensProvider<T extends CodeLens = CodeLens> {
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
    provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<T[]>;

    /**
     * This function will be called for each visible code lens, usually when scrolling and after
     * calls to [compute](#CodeLensProvider.provideCodeLenses)-lenses.
     *
     * @param codeLens code lens that must be resolved.
     * @param token A cancellation token.
     * @return The given, resolved code lens or thenable that resolves to such.
     */
    resolveCodeLens?(codeLens: T, token: CancellationToken): ProviderResult<T>;
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
    Write = 2,
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
    provideDocumentHighlights(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<DocumentHighlight[]>;
  }
  /**
   * A completion item represents a text snippet that is proposed to complete text that is being typed.
   *
   * It is sufficient to create a completion item from just a [label](#CompletionItem.label). In that
   * case the completion item will replace the [word](#TextDocument.getWordRangeAtPosition)
   * until the cursor with the given label or [insertText](#CompletionItem.insertText). Otherwise the
   * given [edit](#CompletionItem.textEdit) is used.
   *
   * When selecting a completion item in the editor its defined or synthesized text edit will be applied
   * to *all* cursors/selections whereas [additionalTextEdits](#CompletionItem.additionalTextEdits) will be
   * applied as provided.
   *
   * @see [CompletionItemProvider.provideCompletionItems](#CompletionItemProvider.provideCompletionItems)
   * @see [CompletionItemProvider.resolveCompletionItem](#CompletionItemProvider.resolveCompletionItem)
   */
  export class CompletionItem {
    /**
     * The label of this completion item. By default
     * this is also the text that is inserted when selecting
     * this completion.
     */
    label: string;

    /**
     * The kind of this completion item. Based on the kind
     * an icon is chosen by the editor.
     */
    kind?: CompletionItemKind;

    /**
     * A human-readable string with additional information
     * about this item, like type or symbol information.
     */
    detail?: string;

    /**
     * A human-readable string that represents a doc-comment.
     */
    documentation?: string | MarkdownString;

    /**
     * A string that should be used when comparing this item
     * with other items. When `falsy` the [label](#CompletionItem.label)
     * is used.
     */
    sortText?: string;

    /**
     * A string that should be used when filtering a set of
     * completion items. When `falsy` the [label](#CompletionItem.label)
     * is used.
     */
    filterText?: string;

    /**
     * Select this item when showing. *Note* that only one completion item can be selected and
     * that the editor decides which item that is. The rule is that the *first* item of those
     * that match best is selected.
     */
    preselect?: boolean;

    /**
     * A string or snippet that should be inserted in a document when selecting
     * this completion. When `falsy` the [label](#CompletionItem.label)
     * is used.
     */
    insertText?: string | SnippetString;

    /**
     * A range of text that should be replaced by this completion item.
     *
     * Defaults to a range from the start of the [current word](#TextDocument.getWordRangeAtPosition) to the
     * current position.
     *
     * *Note:* The range must be a [single line](#Range.isSingleLine) and it must
     * [contain](#Range.contains) the position at which completion has been [requested](#CompletionItemProvider.provideCompletionItems).
     */
    range?: Range;

    /**
     * An optional set of characters that when pressed while this completion is active will accept it first and
     * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
     * characters will be ignored.
     */
    commitCharacters?: string[];

    /**
     * Keep whitespace of the [insertText](#CompletionItem.insertText) as is. By default, the editor adjusts leading
     * whitespace of new lines so that they match the indentation of the line for which the item is accepted - setting
     * this to `true` will prevent that.
     */
    keepWhitespace?: boolean;

    /**
     * @deprecated Use `CompletionItem.insertText` and `CompletionItem.range` instead.
     *
     * ~~An [edit](#TextEdit) which is applied to a document when selecting
     * this completion. When an edit is provided the value of
     * [insertText](#CompletionItem.insertText) is ignored.~~
     *
     * ~~The [range](#Range) of the edit must be single-line and on the same
     * line completions were [requested](#CompletionItemProvider.provideCompletionItems) at.~~
     */
    textEdit?: TextEdit;

    /**
     * An optional array of additional [text edits](#TextEdit) that are applied when
     * selecting this completion. Edits must not overlap with the main [edit](#CompletionItem.textEdit)
     * nor with themselves.
     */
    additionalTextEdits?: TextEdit[];

    /**
     * An optional [command](#Command) that is executed *after* inserting this completion. *Note* that
     * additional modifications to the current document should be described with the
     * [additionalTextEdits](#CompletionItem.additionalTextEdits)-property.
     */
    command?: Command;

    /**
     * Creates a new completion item.
     *
     * Completion items must have at least a [label](#CompletionItem.label) which then
     * will be used as insert text as well as for sorting and filtering.
     *
     * @param label The label of the completion.
     * @param kind The [kind](#CompletionItemKind) of the completion.
     */
    constructor(label: string, kind?: CompletionItemKind);
  }

  /**
   * Represents a collection of [completion items](#CompletionItem) to be presented
   * in the editor.
   */
  export class CompletionList {
    /**
     * This list is not complete. Further typing should result in recomputing
     * this list.
     */
    isIncomplete?: boolean;

    /**
     * The completion items.
     */
    items: CompletionItem[];

    /**
     * Creates a new completion list.
     *
     * @param items The completion items.
     * @param isIncomplete The list is not complete.
     */
    constructor(items?: CompletionItem[], isIncomplete?: boolean);
  }
  /**
   * A document link is a range in a text document that links to an internal or external resource, like another
   * text document or a web site.
   * @木农
   */
  export class DocumentLink {
    /**
     * The range this link applies to.
     */
    range: Range;

    /**
     * The uri this link points to.
     */
    target?: Uri;

    /**
     * The tooltip text when you hover over this link.
     *
     * If a tooltip is provided, is will be displayed in a string that includes instructions on how to
     * trigger the link, such as `{0} (ctrl + click)`. The specific instructions vary depending on OS,
     * user settings, and localization.
     */
    tooltip?: string;

    /**
     * Creates a new document link.
     *
     * @param range The range the document link applies to. Must not be empty.
     * @param target The uri the document link points to.
     */
    constructor(range: Range, target?: Uri);
  }

  /**
   * The document link provider defines the contract between extensions and feature of showing
   * links in the editor.
   */
  export interface DocumentLinkProvider {
    /**
     * Provide links for the given document. Note that the editor ships with a default provider that detects
     * `http(s)` and `file` links.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @return An array of [document links](#DocumentLink) or a thenable that resolves to such. The lack of a result
     * can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<DocumentLink[]>;

    /**
     * Given a link fill in its [target](#DocumentLink.target). This method is called when an incomplete
     * link is selected in the UI. Providers can implement this method and return incomplete links
     * (without target) from the [`provideDocumentLinks`](#DocumentLinkProvider.provideDocumentLinks) method which
     * often helps to improve performance.
     *
     * @param link The link that is to be resolved.
     * @param token A cancellation token.
     */
    resolveDocumentLink?(link: DocumentLink, token: CancellationToken): ProviderResult<DocumentLink>;
  }

  /**
   * The document color provider defines the contract between extensions and feature of
   * picking and modifying colors in the editor.
   */
  export interface DocumentColorProvider {
    /**
     * Provide colors for the given document.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @return An array of [color information](#ColorInformation) or a thenable that resolves to such. The lack of a result
     * can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentColors(document: TextDocument, token: CancellationToken): ProviderResult<ColorInformation[]>;

    /**
     * Provide [representations](#ColorPresentation) for a color.
     *
     * @param color The color to show and insert.
     * @param context A context object with additional information
     * @param token A cancellation token.
     * @return An array of color presentations or a thenable that resolves to such. The lack of a result
     * can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideColorPresentations(
      color: Color,
      context: { document: TextDocument; range: Range },
      token: CancellationToken,
    ): ProviderResult<ColorPresentation[]>;
  }

  /**
   * A line based folding range. To be valid, start and end line must be bigger than zero and smaller than the number of lines in the document.
   * Invalid ranges will be ignored.
   */
  export class FoldingRange {
    /**
     * The zero-based start line of the range to fold. The folded area starts after the line's last character.
     * To be valid, the end must be zero or larger and smaller than the number of lines in the document.
     */
    start: number;

    /**
     * The zero-based end line of the range to fold. The folded area ends with the line's last character.
     * To be valid, the end must be zero or larger and smaller than the number of lines in the document.
     */
    end: number;

    /**
     * Describes the [Kind](#FoldingRangeKind) of the folding range such as [Comment](#FoldingRangeKind.Comment) or
     * [Region](#FoldingRangeKind.Region). The kind is used to categorize folding ranges and used by commands
     * like 'Fold all comments'. See
     * [FoldingRangeKind](#FoldingRangeKind) for an enumeration of all kinds.
     * If not set, the range is originated from a syntax element.
     */
    kind?: FoldingRangeKind;

    /**
     * Creates a new folding range.
     *
     * @param start The start line of the folded range.
     * @param end The end line of the folded range.
     * @param kind The kind of the folding range.
     */
    constructor(start: number, end: number, kind?: FoldingRangeKind);
  }

  /**
   * An enumeration of specific folding range kinds. The kind is an optional field of a [FoldingRange](#FoldingRange)
   * and is used to distinguish specific folding ranges such as ranges originated from comments. The kind is used by commands like
   * `Fold all comments` or `Fold all regions`.
   * If the kind is not set on the range, the range originated from a syntax element other than comments, imports or region markers.
   */
  export enum FoldingRangeKind {
    /**
     * Kind for folding range representing a comment.
     */
    Comment = 1,
    /**
     * Kind for folding range representing a import.
     */
    Imports = 2,
    /**
     * Kind for folding range representing regions originating from folding markers like `#region` and `#endregion`.
     */
    Region = 3,
  }

  /**
   * Folding context (for future use)
   */
  export interface FoldingContext {}

  /**
   * The folding range provider interface defines the contract between extensions and
   * [Folding](https://code.visualstudio.com/docs/editor/codebasics#_folding) in the editor.
   */
  export interface FoldingRangeProvider {
    /**
     * Returns a list of folding ranges or null and undefined if the provider
     * does not want to participate or was cancelled.
     * @param document The document in which the command was invoked.
     * @param context Additional context information (for future use)
     * @param token A cancellation token.
     */
    provideFoldingRanges(
      document: TextDocument,
      context: FoldingContext,
      token: CancellationToken,
    ): ProviderResult<FoldingRange[]>;
  }
  /**
   * Describes what to do with the indentation when pressing Enter.
   */
  export enum IndentAction {
    /**
     * Insert new line and copy the previous line's indentation.
     */
    None = 0,
    /**
     * Insert new line and indent once (relative to the previous line's indentation).
     */
    Indent = 1,
    /**
     * Insert two new lines:
     *  - the first one indented which will hold the cursor
     *  - the second one at the same indentation level
     */
    IndentOutdent = 2,
    /**
     * Insert new line and outdent once (relative to the previous line's indentation).
     */
    Outdent = 3,
  }
  export interface LanguageConfiguration {
    /**
     * The language's comment settings.
     */
    comments?: CommentRule;
    /**
     * The language's brackets.
     * This configuration implicitly affects pressing Enter around these brackets.
     */
    brackets?: CharacterPair[];
    /**
     * The language's word definition.
     * If the language supports Unicode identifiers (e.g. JavaScript), it is preferable
     * to provide a word definition that uses exclusion of known separators.
     * e.g.: A regex that matches anything except known separators (and dot is allowed to occur in a floating point number):
     *   /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
     */
    wordPattern?: RegExp;
    /**
     * The language's indentation settings.
     */
    indentationRules?: IndentationRule;
    /**
     * The language's rules to be evaluated when pressing Enter.
     */
    onEnterRules?: OnEnterRule[];

    /**
     * **Deprecated** Do not use.
     *
     * @deprecated Will be replaced by a better API soon.
     */
    __electricCharacterSupport?: {
      /**
       * This property is deprecated and will be **ignored** from
       * the editor.
       * @deprecated
       */
      brackets?: any;
      /**
       * This property is deprecated and not fully supported anymore by
       * the editor (scope and lineStart are ignored).
       * Use the autoClosingPairs property in the language configuration file instead.
       * @deprecated
       */
      docComment?: {
        scope: string;
        open: string;
        lineStart: string;
        close?: string;
      };
    };

    /**
     * **Deprecated** Do not use.
     *
     * @deprecated * Use the autoClosingPairs property in the language configuration file instead.
     */
    __characterPairSupport?: {
      autoClosingPairs: {
        open: string;
        close: string;
        notIn?: string[];
      }[];
    };
  }
  /**
   * Represents a location inside a resource, such as a line
   * inside a text file.
   */
  export class Location {
    /**
     * The resource identifier of this location.
     */
    uri: Uri;

    /**
     * The document range of this location.
     */
    range: Range;

    /**
     * Creates a new location object.
     *
     * @param uri The resource identifier.
     * @param rangeOrPosition The range or position. Positions will be converted to an empty range.
     */
    constructor(uri: Uri, rangeOrPosition: Range | Position);
  }

  /**
   * Represents the connection of two locations. Provides additional metadata over normal [locations](#Location),
   * including an origin range.
   */
  export interface LocationLink {
    /**
     * Span of the origin of this link.
     *
     * Used as the underlined span for mouse definition hover. Defaults to the word range at
     * the definition position.
     */
    originSelectionRange?: Range;

    /**
     * The target resource identifier of this link.
     */
    targetUri: Uri;

    /**
     * The full target range of this link.
     */
    targetRange: Range;

    /**
     * The span of this link.
     */
    targetSelectionRange?: Range;
  }
  /**
   * The MarkdownString represents human-readable text that supports formatting via the
   * markdown syntax. Standard markdown is supported, also tables, but no embedded html.
   *
   * When created with `supportThemeIcons` then rendering of [theme icons](#ThemeIcon) via
   * the `$(<name>)`-syntax is supported.
   */
  export class MarkdownString {
    /**
     * The markdown string.
     */
    value: string;

    /**
     * Indicates that this markdown string is from a trusted source. Only *trusted*
     * markdown supports links that execute commands, e.g. `[Run it](command:myCommandId)`.
     */
    isTrusted?: boolean;

    /**
     * Indicates that this markdown string can contain [ThemeIcons](#ThemeIcon), e.g. `$(zap)`.
     */
    readonly supportThemeIcons?: boolean;

    /**
     * Uri that relative paths are resolved relative to.
     *
     * If the `baseUri` ends with `/`, it is considered a directory and relative paths in the markdown are resolved relative to that directory:
     *
     * ```ts
     * const md = new vscode.MarkdownString(`[link](./file.js)`);
     * md.baseUri = vscode.Uri.file('/path/to/dir/');
     * // Here 'link' in the rendered markdown resolves to '/path/to/dir/file.js'
     * ```
     *
     * If the `baseUri` is a file, relative paths in the markdown are resolved relative to the parent dir of that file:
     *
     * ```ts
     * const md = new vscode.MarkdownString(`[link](./file.js)`);
     * md.baseUri = vscode.Uri.file('/path/to/otherFile.js');
     * // Here 'link' in the rendered markdown resolves to '/path/to/file.js'
     * ```
     */
    baseUri?: Uri;

    /**
     * Creates a new markdown string with the given value.
     *
     * @param value Optional, initial value.
     * @param supportThemeIcons Optional, Specifies whether [ThemeIcons](#ThemeIcon) are supported within the [`MarkdownString`](#MarkdownString).
     */
    constructor(value?: string, supportThemeIcons?: boolean);

    /**
     * Appends and escapes the given string to this markdown string.
     * @param value Plain text.
     */
    appendText(value: string): MarkdownString;

    /**
     * Appends the given string 'as is' to this markdown string. When [`supportThemeIcons`](#MarkdownString.supportThemeIcons) is `true`, [ThemeIcons](#ThemeIcon) in the `value` will be iconified.
     * @param value Markdown string.
     */
    appendMarkdown(value: string): MarkdownString;

    /**
     * Appends the given string as codeblock using the provided language.
     * @param value A code snippet.
     * @param language An optional [language identifier](#languages.getLanguages).
     */
    appendCodeblock(value: string, language?: string): MarkdownString;
  }

  /**
   * ~~MarkedString can be used to render human readable text. It is either a markdown string
   * or a code-block that provides a language and a code snippet. Note that
   * markdown strings will be sanitized - that means html will be escaped.~~
   *
   * @deprecated This type is deprecated, please use [`MarkdownString`](#MarkdownString) instead.
   */
  export type MarkedString = MarkdownString | string | { language: string; value: string };
  /**
   * Represents a line and character position, such as
   * the position of the cursor.
   *
   * Position objects are __immutable__. Use the [with](#Position.with) or
   * [translate](#Position.translate) methods to derive new positions
   * from an existing position.
   */
  export class Position {
    /**
     * The zero-based line value.
     */
    readonly line: number;

    /**
     * The zero-based character value.
     */
    readonly character: number;

    /**
     * @param line A zero-based line value.
     * @param character A zero-based character value.
     */
    constructor(line: number, character: number);

    /**
     * Check if this position is before `other`.
     *
     * @param other A position.
     * @return `true` if position is on a smaller line
     * or on the same line on a smaller character.
     */
    isBefore(other: Position): boolean;

    /**
     * Check if this position is before or equal to `other`.
     *
     * @param other A position.
     * @return `true` if position is on a smaller line
     * or on the same line on a smaller or equal character.
     */
    isBeforeOrEqual(other: Position): boolean;

    /**
     * Check if this position is after `other`.
     *
     * @param other A position.
     * @return `true` if position is on a greater line
     * or on the same line on a greater character.
     */
    isAfter(other: Position): boolean;

    /**
     * Check if this position is after or equal to `other`.
     *
     * @param other A position.
     * @return `true` if position is on a greater line
     * or on the same line on a greater or equal character.
     */
    isAfterOrEqual(other: Position): boolean;

    /**
     * Check if this position is equal to `other`.
     *
     * @param other A position.
     * @return `true` if the line and character of the given position are equal to
     * the line and character of this position.
     */
    isEqual(other: Position): boolean;

    /**
     * Compare this to `other`.
     *
     * @param other A position.
     * @return A number smaller than zero if this position is before the given position,
     * a number greater than zero if this position is after the given position, or zero when
     * this and the given position are equal.
     */
    compareTo(other: Position): number;

    /**
     * Create a new position relative to this position.
     *
     * @param lineDelta Delta value for the line value, default is `0`.
     * @param characterDelta Delta value for the character value, default is `0`.
     * @return A position which line and character is the sum of the current line and
     * character and the corresponding deltas.
     */
    translate(lineDelta?: number, characterDelta?: number): Position;

    /**
     * Derived a new position relative to this position.
     *
     * @param change An object that describes a delta to this position.
     * @return A position that reflects the given delta. Will return `this` position if the change
     * is not changing anything.
     */
    translate(change: { lineDelta?: number; characterDelta?: number }): Position;

    /**
     * Create a new position derived from this position.
     *
     * @param line Value that should be used as line value, default is the [existing value](#Position.line)
     * @param character Value that should be used as character value, default is the [existing value](#Position.character)
     * @return A position where line and character are replaced by the given values.
     */
    with(line?: number, character?: number): Position;

    /**
     * Derived a new position from this position.
     *
     * @param change An object that describes a change to this position.
     * @return A position that reflects the given change. Will return `this` position if the change
     * is not changing anything.
     */
    with(change: { line?: number; character?: number }): Position;
  }

  /**
   * A range represents an ordered pair of two positions.
   * It is guaranteed that [start](#Range.start).isBeforeOrEqual([end](#Range.end))
   *
   * Range objects are __immutable__. Use the [with](#Range.with),
   * [intersection](#Range.intersection), or [union](#Range.union) methods
   * to derive new ranges from an existing range.
   */
  export class Range {
    /**
     * The start position. It is before or equal to [end](#Range.end).
     */
    readonly start: Position;

    /**
     * The end position. It is after or equal to [start](#Range.start).
     */
    readonly end: Position;

    /**
     * Create a new range from two positions. If `start` is not
     * before or equal to `end`, the values will be swapped.
     *
     * @param start A position.
     * @param end A position.
     */
    constructor(start: Position, end: Position);

    /**
     * Create a new range from number coordinates. It is a shorter equivalent of
     * using `new Range(new Position(startLine, startCharacter), new Position(endLine, endCharacter))`
     *
     * @param startLine A zero-based line value.
     * @param startCharacter A zero-based character value.
     * @param endLine A zero-based line value.
     * @param endCharacter A zero-based character value.
     */
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);

    /**
     * `true` if `start` and `end` are equal.
     */
    isEmpty: boolean;

    /**
     * `true` if `start.line` and `end.line` are equal.
     */
    isSingleLine: boolean;

    /**
     * Check if a position or a range is contained in this range.
     *
     * @param positionOrRange A position or a range.
     * @return `true` if the position or range is inside or equal
     * to this range.
     */
    contains(positionOrRange: Position | Range): boolean;

    /**
     * Check if `other` equals this range.
     *
     * @param other A range.
     * @return `true` when start and end are [equal](#Position.isEqual) to
     * start and end of this range.
     */
    isEqual(other: Range): boolean;

    /**
     * Intersect `range` with this range and returns a new range or `undefined`
     * if the ranges have no overlap.
     *
     * @param range A range.
     * @return A range of the greater start and smaller end positions. Will
     * return undefined when there is no overlap.
     */
    intersection(range: Range): Range | undefined;

    /**
     * Compute the union of `other` with this range.
     *
     * @param other A range.
     * @return A range of smaller start position and the greater end position.
     */
    union(other: Range): Range;

    /**
     * Derived a new range from this range.
     *
     * @param start A position that should be used as start. The default value is the [current start](#Range.start).
     * @param end A position that should be used as end. The default value is the [current end](#Range.end).
     * @return A range derived from this range with the given start and end position.
     * If start and end are not different `this` range will be returned.
     */
    with(start?: Position, end?: Position): Range;

    /**
     * Derived a new range from this range.
     *
     * @param change An object that describes a change to this range.
     * @return A range that reflects the given change. Will return `this` range if the change
     * is not changing anything.
     */
    with(change: { start?: Position; end?: Position }): Range;
  }
  /**
   * A relative pattern is a helper to construct glob patterns that are matched
   * relatively to a base path. The base path can either be an absolute file path
   * or a [workspace folder](#WorkspaceFolder).
   */
  export class RelativePattern {
    /**
     * A base file path to which this pattern will be matched against relatively.
     */
    base: string;

    /**
     * A file glob pattern like `*.{ts,js}` that will be matched on file paths
     * relative to the base path.
     *
     * Example: Given a base of `/home/work/folder` and a file path of `/home/work/folder/index.js`,
     * the file glob pattern will match on `index.js`.
     */
    pattern: string;

    /**
     * Creates a new relative pattern object with a base path and pattern to match. This pattern
     * will be matched on file paths relative to the base path.
     *
     * @param base A base file path to which this pattern will be matched against relatively.
     * @param pattern A file glob pattern like `*.{ts,js}` that will be matched on file paths
     * relative to the base path.
     */
    constructor(base: WorkspaceFolder | string, pattern: string);
  }

  /**
   * A file glob pattern to match file paths against. This can either be a glob pattern string
   * (like `**​/*.{ts,js}` or `*.{ts,js}`) or a [relative pattern](#RelativePattern).
   *
   * Glob patterns can have the following syntax:
   * * `*` to match one or more characters in a path segment
   * * `?` to match on one character in a path segment
   * * `**` to match any number of path segments, including none
   * * `{}` to group conditions (e.g. `**​/*.{ts,js}` matches all TypeScript and JavaScript files)
   * * `[]` to declare a range of characters to match in a path segment (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
   * * `[!...]` to negate a range of characters to match in a path segment (e.g., `example.[!0-9]` to match on `example.a`, `example.b`, but not `example.0`)
   *
   * Note: a backslash (`\`) is not valid within a glob pattern. If you have an existing file
   * path to match against, consider to use the [relative pattern](#RelativePattern) support
   * that takes care of converting any backslash into slash. Otherwise, make sure to convert
   * any backslash to slash when creating the glob pattern.
   */
  export type GlobPattern = string | RelativePattern;

  /**
   * A document filter denotes a document by different properties like
   * the [language](#TextDocument.languageId), the [scheme](#Uri.scheme) of
   * its resource, or a glob-pattern that is applied to the [path](#TextDocument.fileName).
   *
   * @sample A language filter that applies to typescript files on disk: `{ language: 'typescript', scheme: 'file' }`
   * @sample A language filter that applies to all package.json paths: `{ language: 'json', scheme: 'untitled', pattern: '**​/package.json' }`
   */
  export interface DocumentFilter {
    /**
     * A language id, like `typescript`.
     */
    language?: string;

    /**
     * A Uri [scheme](#Uri.scheme), like `file` or `untitled`.
     */
    scheme?: string;

    /**
     * A [glob pattern](#GlobPattern) that is matched on the absolute path of the document. Use a [relative pattern](#RelativePattern)
     * to filter documents to a [workspace folder](#WorkspaceFolder).
     */
    pattern?: GlobPattern;
  }

  /**
   * A language selector is the combination of one or many language identifiers
   * and [language filters](#DocumentFilter).
   *
   * *Note* that a document selector that is just a language identifier selects *all*
   * documents, even those that are not saved on disk. Only use such selectors when
   * a feature works without further context, e.g. without the need to resolve related
   * 'files'.
   *
   * @sample `let sel:DocumentSelector = { scheme: 'file', language: 'typescript' }`;
   */
  export type DocumentSelector = DocumentFilter | string | Array<DocumentFilter | string>;

  /**
   * A provider result represents the values a provider, like the [`HoverProvider`](#HoverProvider),
   * may return. For once this is the actual result type `T`, like `Hover`, or a thenable that resolves
   * to that type `T`. In addition, `null` and `undefined` can be returned - either directly or from a
   * thenable.
   *
   * The snippets below are all valid implementations of the [`HoverProvider`](#HoverProvider):
   *
   * ```ts
   * let a: HoverProvider = {
   *   provideHover(doc, pos, token): ProviderResult<Hover> {
   *     return new Hover('Hello World');
   *   }
   * }
   *
   * let b: HoverProvider = {
   *   provideHover(doc, pos, token): ProviderResult<Hover> {
   *     return new Promise(resolve => {
   *       resolve(new Hover('Hello World'));
   *      });
   *   }
   * }
   *
   * let c: HoverProvider = {
   *   provideHover(doc, pos, token): ProviderResult<Hover> {
   *     return; // undefined
   *   }
   * }
   * ```
   */
  export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

  /**
   * Information about where a symbol is defined.
   *
   * Provides additional metadata over normal [location](#Location) definitions, including the range of
   * the defining symbol
   */
  export type DefinitionLink = LocationLink;

  /**
   * The definition of a symbol represented as one or many [locations](#Location).
   * For most programming languages there is only one location at which a symbol is
   * defined.
   */
  export type Definition = Location | Location[];

  /**
   * The definition provider interface defines the contract between extensions and
   * the [go to definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition)
   * and peek definition features.
   */
  export interface DefinitionProvider {
    /**
     * Provide the definition of the symbol at the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @return A definition or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideDefinition(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<Definition | DefinitionLink[]>;
  }

  /**
   * The implementation provider interface defines the contract between extensions and
   * the go to implementation feature.
   */
  export interface ImplementationProvider {
    /**
     * Provide the implementations of the symbol at the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @return A definition or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideImplementation(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<Definition | DefinitionLink[]>;
  }

  /**
   * The type definition provider defines the contract between extensions and
   * the go to type definition feature.
   */
  export interface TypeDefinitionProvider {
    /**
     * Provide the type definition of the symbol at the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @return A definition or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideTypeDefinition(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<Definition | DefinitionLink[]>;
  }
  /**
   * A snippet string is a template which allows to insert text
   * and to control the editor cursor when insertion happens.
   *
   * A snippet can define tab stops and placeholders with `$1`, `$2`
   * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
   * the end of the snippet. Variables are defined with `$name` and
   * `${name:default value}`. The full snippet syntax is documented
   * [here](http://code.visualstudio.com/docs/editor/userdefinedsnippets#_creating-your-own-snippets).
   */
  export class SnippetString {
    /**
     * The snippet string.
     */
    value: string;

    constructor(value?: string);

    /**
     * Builder-function that appends the given string to
     * the [`value`](#SnippetString.value) of this snippet string.
     *
     * @param text A value to append 'as given'. The string will be escaped.
     * @return This snippet string.
     */
    appendText(text: string): SnippetString;

    /**
     * Builder-function that appends a tabstop (`$1`, `$2` etc) to
     * the [`value`](#SnippetString.value) of this snippet string.
     *
     * @param num The number of this tabstop, defaults to an auto-increment
     * value starting at 1.
     * @return This snippet string.
     */
    appendTabstop(num?: number): SnippetString;

    /**
     * Builder-function that appends a placeholder (`${1:value}`) to
     * the [`value`](#SnippetString.value) of this snippet string.
     *
     * @param value The value of this placeholder - either a string or a function
     * with which a nested snippet can be created.
     * @param num The number of this tabstop, defaults to an auto-increment
     * value starting at 1.
     * @return This snippet string.
     */
    appendPlaceholder(value: string | ((snippet: SnippetString) => any), num?: number): SnippetString;

    /**
     * Builder-function that appends a choice (`${1|a,b,c}`) to
     * the [`value`](#SnippetString.value) of this snippet string.
     *
     * @param values The values for choices - the array of strings
     * @param number The number of this tabstop, defaults to an auto-increment
     * value starting at 1.
     * @return This snippet string.
     */
    appendChoice(values: string[], num?: number): SnippetString;

    /**
     * Builder-function that appends a variable (`${VAR}`) to
     * the [`value`](#SnippetString.value) of this snippet string.
     *
     * @param name The name of the variable - excluding the `$`.
     * @param defaultValue The default value which is used when the variable name cannot
     * be resolved - either a string or a function with which a nested snippet can be created.
     * @return This snippet string.
     */
    appendVariable(name: string, defaultValue: string | ((snippet: SnippetString) => any)): SnippetString;
  }
  /**
   * The rename provider interface defines the contract between extensions and
   * the [rename](https://code.visualstudio.com/docs/editor/editingevolved#_rename-symbol)-feature.
   */
  export interface RenameProvider {
    /**
     * Provide an edit that describes changes that have to be made to one
     * or many resources to rename a symbol to a different name.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param newName The new name of the symbol. If the given name is not valid, the provider must return a rejected promise.
     * @param token A cancellation token.
     * @return A workspace edit or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideRenameEdits(
      document: TextDocument,
      position: Position,
      newName: string,
      token: CancellationToken,
    ): ProviderResult<WorkspaceEdit>;

    /**
     * Optional function for resolving and validating a position *before* running rename. The result can
     * be a range or a range and a placeholder text. The placeholder text should be the identifier of the symbol
     * which is being renamed - when omitted the text in the returned range is used.
     *
     * @param document The document in which rename will be invoked.
     * @param position The position at which rename will be invoked.
     * @param token A cancellation token.
     * @return The range or range and placeholder text of the identifier that is to be renamed. The lack of a result can signaled by returning `undefined` or `null`.
     */
    prepareRename?(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<Range | { range: Range; placeholder: string }>;
  }

  /**
   * Value-object describing what options formatting should use.
   */
  export interface FormattingOptions {
    /**
     * Size of a tab in spaces.
     */
    tabSize: number;

    /**
     * Prefer spaces over tabs.
     */
    insertSpaces: boolean;

    /**
     * Signature for further properties.
     */
    [key: string]: boolean | number | string;
  }

  /**
   * The document formatting provider interface defines the contract between extensions and
   * the formatting-feature.
   */
  export interface DocumentFormattingEditProvider {
    /**
     * Provide formatting edits for a whole document.
     *
     * @param document The document in which the command was invoked.
     * @param options Options controlling formatting.
     * @param token A cancellation token.
     * @return A set of text edits or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentFormattingEdits(
      document: TextDocument,
      options: FormattingOptions,
      token: CancellationToken,
    ): ProviderResult<TextEdit[]>;
  }

  /**
   * The document formatting provider interface defines the contract between extensions and
   * the formatting-feature.
   */
  export interface DocumentRangeFormattingEditProvider {
    /**
     * Provide formatting edits for a range in a document.
     *
     * The given range is a hint and providers can decide to format a smaller
     * or larger range. Often this is done by adjusting the start and end
     * of the range to full syntax nodes.
     *
     * @param document The document in which the command was invoked.
     * @param range The range which should be formatted.
     * @param options Options controlling formatting.
     * @param token A cancellation token.
     * @return A set of text edits or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentRangeFormattingEdits(
      document: TextDocument,
      range: Range,
      options: FormattingOptions,
      token: CancellationToken,
    ): ProviderResult<TextEdit[]>;
  }

  /**
   * The document formatting provider interface defines the contract between extensions and
   * the formatting-feature.
   */
  export interface OnTypeFormattingEditProvider {
    /**
     * Provide formatting edits after a character has been typed.
     *
     * The given position and character should hint to the provider
     * what range the position to expand to, like find the matching `{`
     * when `}` has been entered.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param ch The character that has been typed.
     * @param options Options controlling formatting.
     * @param token A cancellation token.
     * @return A set of text edits or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideOnTypeFormattingEdits(
      document: TextDocument,
      position: Position,
      ch: string,
      options: FormattingOptions,
      token: CancellationToken,
    ): ProviderResult<TextEdit[]>;
  }
  export interface CompletionItemProvider {
    /**
     * Provide completion items for the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @param context How the completion was triggered.
     *
     * @return An array of completions, a [completion list](#CompletionList), or a thenable that resolves to either.
     * The lack of a result can be signaled by returning `undefined`, `null`, or an empty array.
     */
    provideCompletionItems(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
      context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList>;

    /**
     * Given a completion item fill in more data, like [doc-comment](#CompletionItem.documentation)
     * or [details](#CompletionItem.detail).
     *
     * The editor will only resolve a completion item once.
     *
     * *Note* that accepting a completion item will not wait for it to be resolved. Because of that [`insertText`](#CompletionItem.insertText),
     * [`additionalTextEdits`](#CompletionItem.additionalTextEdits), and [`command`](#CompletionItem.command) should not
     * be changed when resolving an item.
     *
     * @param item A completion item currently active in the UI.
     * @param token A cancellation token.
     * @return The resolved completion item or a thenable that resolves to of such. It is OK to return the given
     * `item`. When no result is returned, the given `item` will be used.
     */
    resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem>;
  }

  /**
   * Represents programming constructs like variables, classes, interfaces etc. that appear in a document. Document
   * symbols can be hierarchical and they have two ranges: one that encloses its definition and one that points to
   * its most interesting range, e.g. the range of an identifier.
   */
  export class DocumentSymbol {
    /**
     * The name of this symbol.
     */
    name: string;

    /**
     * More detail for this symbol, e.g. the signature of a function.
     */
    detail: string;

    /**
     * The kind of this symbol.
     */
    kind: SymbolKind;

    /**
     * The range enclosing this symbol not including leading/trailing whitespace but everything else, e.g. comments and code.
     */
    range: Range;

    /**
     * The range that should be selected and reveal when this symbol is being picked, e.g. the name of a function.
     * Must be contained by the [`range`](#DocumentSymbol.range).
     */
    selectionRange: Range;

    /**
     * Children of this symbol, e.g. properties of a class.
     */
    children: DocumentSymbol[];

    /**
     * Creates a new document symbol.
     *
     * @param name The name of the symbol.
     * @param detail Details for the symbol.
     * @param kind The kind of the symbol.
     * @param range The full range of the symbol.
     * @param selectionRange The range that should be reveal.
     */
    constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range);
  }

  /**
   * The document symbol provider interface defines the contract between extensions and
   * the [go to symbol](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-symbol)-feature.
   */
  export interface DocumentSymbolProvider {
    /**
     * Provide symbol information for the given document.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @return An array of document highlights or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideDocumentSymbols(
      document: TextDocument,
      token: CancellationToken,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]>;
  }

  /**
   * Metadata about a document symbol provider.
   */
  export interface DocumentSymbolProviderMetadata {
    /**
     * A human readable string that is shown when multiple outlines trees show for one document.
     */
    label?: string;
  }

  /**
   * Represents an end of line character sequence in a [document](#TextDocument).
   */
  export enum EndOfLine {
    /**
     * The line feed `\n` character.
     */
    LF = 1,
    /**
     * The carriage return line feed `\r\n` sequence.
     */
    CRLF = 2,
  }

  /**
   * Describes what to do when pressing Enter.
   */
  export interface EnterAction {
    /**
     * Describe what to do with the indentation.
     */
    indentAction: IndentAction;
    /**
     * Describes text to be appended after the new line and after the indentation.
     */
    appendText?: string;
    /**
     * Describes the number of characters to remove from the new line's indentation.
     */
    removeText?: number;
  }
  /**
   * The event that is fired when diagnostics change.
   */
  export interface DiagnosticChangeEvent {
    /**
     * An array of resources for which diagnostics have changed.
     */
    readonly uris: ReadonlyArray<Uri>;
  }

  export enum InlayHintKind {
    Type = 1,
    Parameter = 2,
  }

  /**
   * An inlay hint label part allows for interactive and composite labels of inlay hints.
   */
  export class InlayHintLabelPart {
    /**
     * The value of this label part.
     */
    value: string;

    /**
     * The tooltip text when you hover over this label part.
     *
     * *Note* that this property can be set late during
     * {@link InlayHintsProvider.resolveInlayHint resolving} of inlay hints.
     */
    tooltip?: string | MarkdownString | undefined;

    /**
     * An optional {@link Location source code location} that represents this label
     * part.
     *
     * The editor will use this location for the hover and for code navigation features: This
     * part will become a clickable link that resolves to the definition of the symbol at the
     * given location (not necessarily the location itself), it shows the hover that shows at
     * the given location, and it shows a context menu with further code navigation commands.
     *
     * *Note* that this property can be set late during
     * {@link InlayHintsProvider.resolveInlayHint resolving} of inlay hints.
     */
    location?: Location | undefined;

    /**
     * An optional command for this label part.
     *
     * The editor renders parts with commands as clickable links. The command is added to the context menu
     * when a label part defines {@link InlayHintLabelPart.location location} and {@link InlayHintLabelPart.command command} .
     *
     * *Note* that this property can be set late during
     * {@link InlayHintsProvider.resolveInlayHint resolving} of inlay hints.
     */
    command?: Command | undefined;

    /**
     * Creates a new inlay hint label part.
     *
     * @param value The value of the part.
     */
    constructor(value: string);
  }

  /**
   * Inlay hint information.
   */
  export class InlayHint {
    /**
     * The position of this hint.
     */
    position: Position;

    /**
     * The label of this hint. A human readable string or an array of {@link InlayHintLabelPart label parts}.
     *
     * *Note* that neither the string nor the label part can be empty.
     */
    label: string | InlayHintLabelPart[];

    /**
     * The tooltip text when you hover over this item.
     *
     * *Note* that this property can be set late during
     * {@link InlayHintsProvider.resolveInlayHint resolving} of inlay hints.
     */
    tooltip?: string | MarkdownString | undefined;

    /**
     * The kind of this hint. The inlay hint kind defines the appearance of this inlay hint.
     */
    kind?: InlayHintKind;

    /**
     * Optional {@link TextEdit text edits} that are performed when accepting this inlay hint. The default
     * gesture for accepting an inlay hint is the double click.
     *
     * *Note* that edits are expected to change the document so that the inlay hint (or its nearest variant) is
     * now part of the document and the inlay hint itself is now obsolete.
     *
     * *Note* that this property can be set late during
     * {@link InlayHintsProvider.resolveInlayHint resolving} of inlay hints.
     */
    textEdits?: TextEdit[];

    /**
     * Render padding before the hint. Padding will use the editor's background color,
     * not the background color of the hint itself. That means padding can be used to visually
     * align/separate an inlay hint.
     */
    paddingLeft?: boolean;

    /**
     * Render padding after the hint. Padding will use the editor's background color,
     * not the background color of the hint itself. That means padding can be used to visually
     * align/separate an inlay hint.
     */
    paddingRight?: boolean;

    /**
     * Creates a new inlay hint.
     *
     * @param position The position of the hint.
     * @param label The label of the hint.
     * @param kind The {@link InlayHintKind kind} of the hint.
     */
    constructor(position: Position, label: string | InlayHintLabelPart[], kind?: InlayHintKind);
  }

  /**
   * The inlay hints provider interface defines the contract between extensions and
   * the inlay hints feature.
   */
  export interface InlayHintsProvider<T extends InlayHint = InlayHint> {
    /**
     * An optional event to signal that inlay hints have changed.
     * @see {@link EventEmitter}
     */
    onDidChangeInlayHints?: Event<void>;

    /**
     *
     * @param model The document in which the command was invoked.
     * @param range The range for which inlay hints should be computed.
     * @param token A cancellation token.
     * @return A list of inlay hints or a thenable that resolves to such.
     */
    provideInlayHints(model: TextDocument, range: Range, token: CancellationToken): ProviderResult<T[]>;

    /**
     * Given an inlay hint fill in {@link InlayHint.tooltip tooltip}, {@link InlayHint.textEdits text edits},
     * or complete label {@link InlayHintLabelPart parts}.
     *
     * *Note* that the editor will resolve an inlay hint at most once.
     *
     * @param hint An inlay hint.
     * @param token A cancellation token.
     * @return The resolved inlay hint or a thenable that resolves to such. It is OK to return the given `item`. When no result is returned, the given `item` will be used.
     */
    resolveInlayHint?(hint: T, token: CancellationToken): ProviderResult<T>;
  }

  /**
   * A diagnostics collection is a container that manages a set of
   * [diagnostics](#Diagnostic). Diagnostics are always scopes to a
   * diagnostics collection and a resource.
   *
   * To get an instance of a `DiagnosticCollection` use
   * [createDiagnosticCollection](#languages.createDiagnosticCollection).
   */
  export interface DiagnosticCollection {
    /**
     * The name of this diagnostic collection, for instance `typescript`. Every diagnostic
     * from this collection will be associated with this name. Also, the task framework uses this
     * name when defining [problem matchers](https://code.visualstudio.com/docs/editor/tasks#_defining-a-problem-matcher).
     */
    readonly name: string;

    /**
     * Assign diagnostics for given resource. Will replace
     * existing diagnostics for that resource.
     *
     * @param uri A resource identifier.
     * @param diagnostics Array of diagnostics or `undefined`
     */
    set(uri: Uri, diagnostics: ReadonlyArray<Diagnostic> | undefined): void;

    /**
     * Replace all entries in this collection.
     *
     * Diagnostics of multiple tuples of the same uri will be merged, e.g
     * `[[file1, [d1]], [file1, [d2]]]` is equivalent to `[[file1, [d1, d2]]]`.
     * If a diagnostics item is `undefined` as in `[file1, undefined]`
     * all previous but not subsequent diagnostics are removed.
     *
     * @param entries An array of tuples, like `[[file1, [d1, d2]], [file2, [d3, d4, d5]]]`, or `undefined`.
     */
    set(entries: ReadonlyArray<[Uri, ReadonlyArray<Diagnostic> | undefined]>): void;

    /**
     * Remove all diagnostics from this collection that belong
     * to the provided `uri`. The same as `#set(uri, undefined)`.
     *
     * @param uri A resource identifier.
     */
    delete(uri: Uri): void;

    /**
     * Remove all diagnostics from this collection. The same
     * as calling `#set(undefined)`;
     */
    clear(): void;

    /**
     * Iterate over each entry in this collection.
     *
     * @param callback Function to execute for each entry.
     * @param thisArg The `this` context used when invoking the handler function.
     */
    forEach(
      callback: (uri: Uri, diagnostics: ReadonlyArray<Diagnostic>, collection: DiagnosticCollection) => any,
      thisArg?: any,
    ): void;

    /**
     * Get the diagnostics for a given resource. *Note* that you cannot
     * modify the diagnostics-array returned from this call.
     *
     * @param uri A resource identifier.
     * @returns An immutable array of [diagnostics](#Diagnostic) or `undefined`.
     */
    get(uri: Uri): ReadonlyArray<Diagnostic> | undefined;

    /**
     * Check if this collection contains diagnostics for a
     * given resource.
     *
     * @param uri A resource identifier.
     * @returns `true` if this collection has diagnostic for the given resource.
     */
    has(uri: Uri): boolean;

    /**
     * Dispose and free associated resources. Calls
     * [clear](#DiagnosticCollection.clear).
     */
    dispose(): void;
  }

  /**
   * The declaration of a symbol representation as one or many [locations](#Location)
   * or [location links][#LocationLink].
   */
  export type Declaration = Location | Location[] | LocationLink[];

  /**
   * The declaration provider interface defines the contract between extensions and
   * the go to declaration feature.
   */
  export interface DeclarationProvider {
    /**
     * Provide the declaration of the symbol at the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     * @return A declaration or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideDeclaration(
      document: TextDocument,
      position: Position,
      token: CancellationToken,
    ): ProviderResult<Declaration>;
  }

  /**
   * Value-object that contains additional information when
   * requesting references.
   */
  export interface ReferenceContext {
    /**
     * Include the declaration of the current symbol.
     */
    includeDeclaration: boolean;
  }

  /**
   * The reference provider interface defines the contract between extensions and
   * the [find references](https://code.visualstudio.com/docs/editor/editingevolved#_peek)-feature.
   */
  export interface ReferenceProvider {
    /**
     * Provide a set of project-wide references for the given position and document.
     *
     * @param document The document in which the command was invoked.
     * @param position The position at which the command was invoked.
     * @param token A cancellation token.
     *
     * @return An array of locations or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideReferences(
      document: TextDocument,
      position: Position,
      context: ReferenceContext,
      token: CancellationToken,
    ): ProviderResult<Location[]>;
  }
}
