/// <reference path="./../typings/vscode.editor.d.ts" />
/// <reference path="./vscode.theme.d.ts" />
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

declare module 'vscode' {

	/**
	 * The version of the editor.
	 */
  export const version: string;

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
		CRLF = 2
	}

	/**
	 * A text document content provider allows to add readonly documents
	 * to the editor, such as source from a dll or generated html from md.
	 *
	 * Content providers are [registered](#workspace.registerTextDocumentContentProvider)
	 * for a [uri-scheme](#Uri.scheme). When a uri with that scheme is to
	 * be [loaded](#workspace.openTextDocument) the content provider is
	 * asked.
	 */
	export interface TextDocumentContentProvider {

		/**
		 * An event to signal a resource has changed.
		 */
		onDidChange?: Event<Uri>;

		/**
		 * Provide textual content for a given uri.
		 *
		 * The editor will use the returned string-content to create a readonly
		 * [document](#TextDocument). Resources allocated should be released when
		 * the corresponding document has been [closed](#workspace.onDidCloseTextDocument).
		 *
		 * **Note**: The contents of the created [document](#TextDocument) might not be
		 * identical to the provided text due to end-of-line-sequence normalization.
		 *
		 * @param uri An uri which scheme matches the scheme this provider was [registered](#workspace.registerTextDocumentContentProvider) for.
		 * @param token A cancellation token.
		 * @return A string or a thenable that resolves to such.
		 */
		provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string>;
	}

	/**
	 * Options to configure the behaviour of the [workspace folder](#WorkspaceFolder) pick UI.
	 */
	export interface WorkspaceFolderPickOptions {

		/**
		 * An optional string to show as place holder in the input box to guide the user what to pick on.
		 */
		placeHolder?: string;

		/**
		 * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
		 */
		ignoreFocusOut?: boolean;
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
		provideDeclaration(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Declaration>;
	}


	/**
	 * A symbol kind.
	 */
	export enum SymbolKind {
		File = 0,
		Module = 1,
		Namespace = 2,
		Package = 3,
		Class = 4,
		Method = 5,
		Property = 6,
		Field = 7,
		Constructor = 8,
		Enum = 9,
		Interface = 10,
		Function = 11,
		Variable = 12,
		Constant = 13,
		String = 14,
		Number = 15,
		Boolean = 16,
		Array = 17,
		Object = 18,
		Key = 19,
		Null = 20,
		EnumMember = 21,
		Struct = 22,
		Event = 23,
		Operator = 24,
		TypeParameter = 25,
	}

	/**
	 * Represents information about programming constructs like variables, classes,
	 * interfaces etc.
	 */
	export class SymbolInformation {

		/**
		 * The name of this symbol.
		 */
		name: string;

		/**
		 * The name of the symbol containing this symbol.
		 */
		containerName: string;

		/**
		 * The kind of this symbol.
		 */
		kind: SymbolKind;

		/**
		 * The location of this symbol.
		 */
		location: Location;

		/**
		 * Creates a new symbol information object.
		 *
		 * @param name The name of the symbol.
		 * @param kind The kind of the symbol.
		 * @param containerName The name of the symbol containing the symbol.
		 * @param location The location of the symbol.
		 */
		constructor(name: string, kind: SymbolKind, containerName: string, location: Location);

		/**
		 * ~~Creates a new symbol information object.~~
		 *
		 * @deprecated Please use the constructor taking a [location](#Location) object.
		 *
		 * @param name The name of the symbol.
		 * @param kind The kind of the symbol.
		 * @param range The range of the location of the symbol.
		 * @param uri The resource of the location of symbol, defaults to the current document.
		 * @param containerName The name of the symbol containing the symbol.
		 */
		constructor(name: string, kind: SymbolKind, range: Range, uri?: Uri, containerName?: string);
	}

	/**
	 * Represents programming constructs like variables, classes, interfaces etc. that appear in a document. Document
	 * symbols can be hierarchical and they have two ranges: one that encloses its definition and one that points to
	 * its most interesting range, e.g. the range of an identifier.
	 * @寻壑
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
		provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]>;
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
	 * The workspace symbol provider interface defines the contract between extensions and
	 * the [symbol search](https://code.visualstudio.com/docs/editor/editingevolved#_open-symbol-by-name)-feature.
	 */
	export interface WorkspaceSymbolProvider {

		/**
		 * Project-wide search for a symbol matching the given query string.
		 *
		 * The `query`-parameter should be interpreted in a *relaxed way* as the editor will apply its own highlighting
		 * and scoring on the results. A good rule of thumb is to match case-insensitive and to simply check that the
		 * characters of *query* appear in their order in a candidate symbol. Don't use prefix, substring, or similar
		 * strict matching.
		 *
		 * To improve performance implementors can implement `resolveWorkspaceSymbol` and then provide symbols with partial
		 * [location](#SymbolInformation.location)-objects, without a `range` defined. The editor will then call
		 * `resolveWorkspaceSymbol` for selected symbols only, e.g. when opening a workspace symbol.
		 *
		 * @param query A query string, can be the empty string in which case all symbols should be returned.
		 * @param token A cancellation token.
		 * @return An array of document highlights or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined`, `null`, or an empty array.
		 */
		provideWorkspaceSymbols(query: string, token: CancellationToken): ProviderResult<SymbolInformation[]>;

		/**
		 * Given a symbol fill in its [location](#SymbolInformation.location). This method is called whenever a symbol
		 * is selected in the UI. Providers can implement this method and return incomplete symbols from
		 * [`provideWorkspaceSymbols`](#WorkspaceSymbolProvider.provideWorkspaceSymbols) which often helps to improve
		 * performance.
		 *
		 * @param symbol The symbol that is to be resolved. Guaranteed to be an instance of an object returned from an
		 * earlier call to `provideWorkspaceSymbols`.
		 * @param token A cancellation token.
		 * @return The resolved symbol or a thenable that resolves to that. When no result is returned,
		 * the given `symbol` is used.
		 */
		resolveWorkspaceSymbol?(symbol: SymbolInformation, token: CancellationToken): ProviderResult<SymbolInformation>;
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
		provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]>;
	}

	/**
	 * A text edit represents edits that should be applied
	 * to a document.
	 */
	export class TextEdit {

		/**
		 * Utility to create a replace edit.
		 *
		 * @param range A range.
		 * @param newText A string.
		 * @return A new text edit object.
		 */
		static replace(range: Range, newText: string): TextEdit;

		/**
		 * Utility to create an insert edit.
		 *
		 * @param position A position, will become an empty range.
		 * @param newText A string.
		 * @return A new text edit object.
		 */
		static insert(position: Position, newText: string): TextEdit;

		/**
		 * Utility to create a delete edit.
		 *
		 * @param range A range.
		 * @return A new text edit object.
		 */
		static delete(range: Range): TextEdit;

		/**
		 * Utility to create an eol-edit.
		 *
		 * @param eol An eol-sequence
		 * @return A new text edit object.
		 */
		static setEndOfLine(eol: EndOfLine): TextEdit;

		/**
		 * The range this edit applies to.
		 */
		range: Range;

		/**
		 * The string this edit will insert.
		 */
		newText: string;

		/**
		 * The eol-sequence used in the document.
		 *
		 * *Note* that the eol-sequence will be applied to the
		 * whole document.
		 */
		newEol: EndOfLine;

		/**
		 * Create a new TextEdit.
		 *
		 * @param range A range.
		 * @param newText A string.
		 */
		constructor(range: Range, newText: string);
	}

	/**
	 * A workspace edit is a collection of textual and files changes for
	 * multiple resources and documents.
	 *
	 * Use the [applyEdit](#workspace.applyEdit)-function to apply a workspace edit.
	 */
	export class WorkspaceEdit {

		/**
		 * The number of affected resources of textual or resource changes.
		 */
		readonly size: number;

		/**
		 * Replace the given range with given text for the given resource.
		 *
		 * @param uri A resource identifier.
		 * @param range A range.
		 * @param newText A string.
		 */
		replace(uri: Uri, range: Range, newText: string): void;

		/**
		 * Insert the given text at the given position.
		 *
		 * @param uri A resource identifier.
		 * @param position A position.
		 * @param newText A string.
		 */
		insert(uri: Uri, position: Position, newText: string): void;

		/**
		 * Delete the text at the given range.
		 *
		 * @param uri A resource identifier.
		 * @param range A range.
		 */
		delete(uri: Uri, range: Range): void;

		/**
		 * Check if a text edit for a resource exists.
		 *
		 * @param uri A resource identifier.
		 * @return `true` if the given resource will be touched by this edit.
		 */
		has(uri: Uri): boolean;

		/**
		 * Set (and replace) text edits for a resource.
		 *
		 * @param uri A resource identifier.
		 * @param edits An array of text edits.
		 */
		set(uri: Uri, edits: TextEdit[]): void;

		/**
		 * Get the text edits for a resource.
		 *
		 * @param uri A resource identifier.
		 * @return An array of text edits.
		 */
		get(uri: Uri): TextEdit[];

		/**
		 * Create a regular file.
		 *
		 * @param uri Uri of the new file..
		 * @param options Defines if an existing file should be overwritten or be
		 * ignored. When overwrite and ignoreIfExists are both set overwrite wins.
		 */
		createFile(uri: Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void;

		/**
		 * Delete a file or folder.
		 *
		 * @param uri The uri of the file that is to be deleted.
		 */
		deleteFile(uri: Uri, options?: { recursive?: boolean, ignoreIfNotExists?: boolean }): void;

		/**
		 * Rename a file or folder.
		 *
		 * @param oldUri The existing file.
		 * @param newUri The new location.
		 * @param options Defines if existing files should be overwritten or be
		 * ignored. When overwrite and ignoreIfExists are both set overwrite wins.
		 */
		renameFile(oldUri: Uri, newUri: Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void;

		/**
		 * Get all text edits grouped by resource.
		 *
		 * @return A shallow copy of `[Uri, TextEdit[]]`-tuples.
		 */
		entries(): [Uri, TextEdit[]][];
	}





	/**
	 * Represents a parameter of a callable-signature. A parameter can
	 * have a label and a doc-comment.
	 */
	export class ParameterInformation {

		/**
		 * The label of this signature.
		 *
		 * Either a string or inclusive start and exclusive end offsets within its containing
		 * [signature label](#SignatureInformation.label). *Note*: A label of type string must be
		 * a substring of its containing signature information's [label](#SignatureInformation.label).
		 */
		label: string | [number, number];

		/**
		 * The human-readable doc-comment of this signature. Will be shown
		 * in the UI but can be omitted.
		 */
		documentation?: string | MarkdownString;

		/**
		 * Creates a new parameter information object.
		 *
		 * @param label A label string or inclusive start and exclusive end offsets within its containing signature label.
		 * @param documentation A doc string.
		 */
		constructor(label: string | [number, number], documentation?: string | MarkdownString);
	}

	/**
	 * Represents the signature of something callable. A signature
	 * can have a label, like a function-name, a doc-comment, and
	 * a set of parameters.
	 */
	export class SignatureInformation {

		/**
		 * The label of this signature. Will be shown in
		 * the UI.
		 */
		label: string;

		/**
		 * The human-readable doc-comment of this signature. Will be shown
		 * in the UI but can be omitted.
		 */
		documentation?: string | MarkdownString;

		/**
		 * The parameters of this signature.
		 */
		parameters: ParameterInformation[];

		/**
		 * Creates a new signature information object.
		 *
		 * @param label A label string.
		 * @param documentation A doc string.
		 */
		constructor(label: string, documentation?: string | MarkdownString);
	}

	/**
	 * Signature help represents the signature of something
	 * callable. There can be multiple signatures but only one
	 * active and only one active parameter.
	 */
	export class SignatureHelp {

		/**
		 * One or more signatures.
		 */
		signatures: SignatureInformation[];

		/**
		 * The active signature.
		 */
		activeSignature: number;

		/**
		 * The active parameter of the active signature.
		 */
		activeParameter: number;
	}

	/**
	 * How a [`SignatureHelpProvider`](#SignatureHelpProvider) was triggered.
	 */
	export enum SignatureHelpTriggerKind {
		/**
		 * Signature help was invoked manually by the user or by a command.
		 */
		Invoke = 1,

		/**
		 * Signature help was triggered by a trigger character.
		 */
		TriggerCharacter = 2,

		/**
		 * Signature help was triggered by the cursor moving or by the document content changing.
		 */
		ContentChange = 3,
	}

	/**
	 * Additional information about the context in which a
	 * [`SignatureHelpProvider`](#SignatureHelpProvider.provideSignatureHelp) was triggered.
	 */
	export interface SignatureHelpContext {
		/**
		 * Action that caused signature help to be triggered.
		 */
		readonly triggerKind: SignatureHelpTriggerKind;

		/**
		 * Character that caused signature help to be triggered.
		 *
		 * This is `undefined` when signature help is not triggered by typing, such as when manually invoking
		 * signature help or when moving the cursor.
		 */
		readonly triggerCharacter?: string;

		/**
		 * `true` if signature help was already showing when it was triggered.
		 *
		 * Retriggers occur when the signature help is already active and can be caused by actions such as
		 * typing a trigger character, a cursor move, or document content changes.
		 */
		readonly isRetrigger: boolean;

		/**
		 * The currently active [`SignatureHelp`](#SignatureHelp).
		 *
		 * The `activeSignatureHelp` has its [`SignatureHelp.activeSignature`] field updated based on
		 * the user arrowing through available signatures.
		 */
		readonly activeSignatureHelp?: SignatureHelp;
	}

	/**
	 * The signature help provider interface defines the contract between extensions and
	 * the [parameter hints](https://code.visualstudio.com/docs/editor/intellisense)-feature.
	 */
	export interface SignatureHelpProvider {

		/**
		 * Provide help for the signature at the given position and document.
		 *
		 * @param document The document in which the command was invoked.
		 * @param position The position at which the command was invoked.
		 * @param token A cancellation token.
		 * @param context Information about how signature help was triggered.
		 *
		 * @return Signature help or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined` or `null`.
		 */
		provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp>;
	}

	/**
	 * Metadata about a registered [`SignatureHelpProvider`](#SignatureHelpProvider).
	 */
	export interface SignatureHelpProviderMetadata {
		/**
		 * List of characters that trigger signature help.
		 */
		readonly triggerCharacters: ReadonlyArray<string>;

		/**
		 * List of characters that re-trigger signature help.
		 *
		 * These trigger characters are only active when signature help is already showing. All trigger characters
		 * are also counted as re-trigger characters.
		 */
		readonly retriggerCharacters: ReadonlyArray<string>;
	}

	/**
	 * Completion item kinds.
	 */
	export enum CompletionItemKind {
		Text = 0,
		Method = 1,
		Function = 2,
		Constructor = 3,
		Field = 4,
		Variable = 5,
		Class = 6,
		Interface = 7,
		Module = 8,
		Property = 9,
		Unit = 10,
		Value = 11,
		Enum = 12,
		Keyword = 13,
		Snippet = 14,
		Color = 15,
		Reference = 17,
		File = 16,
		Folder = 18,
		EnumMember = 19,
		Constant = 20,
		Struct = 21,
		Event = 22,
		Operator = 23,
		TypeParameter = 24,
	}



	/**
	 * How a [completion provider](#CompletionItemProvider) was triggered
	 */
	export enum CompletionTriggerKind {
		/**
		 * Completion was triggered normally.
		 */
		Invoke = 0,
		/**
		 * Completion was triggered by a trigger character.
		 */
		TriggerCharacter = 1,
		/**
		 * Completion was re-triggered as current completion list is incomplete
		 */
		TriggerForIncompleteCompletions = 2,
	}

	/**
	 * Contains additional information about the context in which
	 * [completion provider](#CompletionItemProvider.provideCompletionItems) is triggered.
	 */
	export interface CompletionContext {
		/**
		 * How the completion was triggered.
		 */
		readonly triggerKind: CompletionTriggerKind;

		/**
		 * Character that triggered the completion item provider.
		 *
		 * `undefined` if provider was not triggered by a character.
		 *
		 * The trigger character is already in the document when the completion provider is triggered.
		 */
		readonly triggerCharacter?: string;
	}

	/**
	 * The completion item provider interface defines the contract between extensions and
	 * [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense).
	 *
	 * Providers can delay the computation of the [`detail`](#CompletionItem.detail)
	 * and [`documentation`](#CompletionItem.documentation) properties by implementing the
	 * [`resolveCompletionItem`](#CompletionItemProvider.resolveCompletionItem)-function. However, properties that
	 * are needed for the initial sorting and filtering, like `sortText`, `filterText`, `insertText`, and `range`, must
	 * not be changed during resolve.
	 *
	 * Providers are asked for completions either explicitly by a user gesture or -depending on the configuration-
	 * implicitly when typing words or trigger characters.
	 */



	/**
	 * A selection range represents a part of a selection hierarchy. A selection range
	 * may have a parent selection range that contains it.
	 */
	export class SelectionRange {

		/**
		 * The [range](#Range) of this selection range.
		 */
		range: Range;

		/**
		 * The parent selection range containing this range.
		 */
		parent?: SelectionRange;

		/**
		 * Creates a new selection range.
		 *
		 * @param range The range of the selection range.
		 * @param parent The parent of the selection range.
		 */
		constructor(range: Range, parent?: SelectionRange);
	}

	export interface SelectionRangeProvider {
		/**
		 * Provide selection ranges for the given positions.
		 *
		 * Selection ranges should be computed individually and independend for each position. The editor will merge
		 * and deduplicate ranges but providers must return hierarchies of selection ranges so that a range
		 * is [contained](#Range.contains) by its parent.
		 *
		 * @param document The document in which the command was invoked.
		 * @param positions The positions at which the command was invoked.
		 * @param token A cancellation token.
		 * @return Selection ranges or a thenable that resolves to such. The lack of a result can be
		 * signaled by returning `undefined` or `null`.
		 */
		provideSelectionRanges(document: TextDocument, positions: Position[], token: CancellationToken): ProviderResult<SelectionRange[]>;
	}

	/**
	 * A tuple of two characters, like a pair of
	 * opening and closing brackets.
	 */
	export type CharacterPair = [string, string];

	/**
	 * Describes how comments for a language work.
	 */
	export interface CommentRule {

		/**
		 * The line comment token, like `// this is a comment`
		 */
		lineComment?: string;

		/**
		 * The block comment character pair, like `/* block comment *&#47;`
		 */
		blockComment?: CharacterPair;
	}

	/**
	 * Describes indentation rules for a language.
	 */
	export interface IndentationRule {
		/**
		 * If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches).
		 */
		decreaseIndentPattern: RegExp;
		/**
		 * If a line matches this pattern, then all the lines after it should be indented once (until another rule matches).
		 */
		increaseIndentPattern: RegExp;
		/**
		 * If a line matches this pattern, then **only the next line** after it should be indented once.
		 */
		indentNextLinePattern?: RegExp;
		/**
		 * If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules.
		 */
		unIndentedLinePattern?: RegExp;
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
	 * Describes a rule to be evaluated when pressing Enter.
	 */
	export interface OnEnterRule {
		/**
		 * This rule will only execute if the text before the cursor matches this regular expression.
		 */
		beforeText: RegExp;
		/**
		 * This rule will only execute if the text after the cursor matches this regular expression.
		 */
		afterText?: RegExp;
		/**
		 * The action to execute.
		 */
		action: EnterAction;
	}

	/**
	 * Represents the configuration. It is a merged view of
	 *
	 * - Default configuration
	 * - Global configuration
	 * - Workspace configuration (if available)
	 * - Workspace folder configuration of the requested resource (if available)
	 *
	 * *Global configuration* comes from User Settings and shadows Defaults.
	 *
	 * *Workspace configuration* comes from Workspace Settings and shadows Global configuration.
	 *
	 * *Workspace Folder configuration* comes from `.vscode` folder under one of the [workspace folders](#workspace.workspaceFolders).
	 *
	 * *Note:* Workspace and Workspace Folder configurations contains `launch` and `tasks` settings. Their basename will be
	 * part of the section identifier. The following snippets shows how to retrieve all configurations
	 * from `launch.json`:
	 *
	 * ```ts
	 * // launch.json configuration
	 * const config = workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);
	 *
	 * // retrieve values
	 * const values = config.get('configurations');
	 * ```
	 *
	 * Refer to [Settings](https://code.visualstudio.com/docs/getstarted/settings) for more information.
	 */



	/**
	 * The event that is fired when diagnostics change.
	 */
	export interface DiagnosticChangeEvent {

		/**
		 * An array of resources for which diagnostics have changed.
		 */
		readonly uris: ReadonlyArray<Uri>;
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
		forEach(callback: (uri: Uri, diagnostics: ReadonlyArray<Diagnostic>, collection: DiagnosticCollection) => any, thisArg?: any): void;

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
	 * An output channel is a container for readonly textual information.
	 *
	 * To get an instance of an `OutputChannel` use
	 * [createOutputChannel](#window.createOutputChannel).
	 */
	/**
	 * Defines a generalized way of reporting progress updates.
	 */
	export interface Progress<T> {

		/**
		 * Report a progress update.
		 * @param value A progress item, like a message and/or an
		 * report on how much work finished
		 */
		report(value: T): void;
	}

	/**
	 * In a remote window the extension kind describes if an extension
	 * runs where the UI (window) runs or if an extension runs remotely.
	 */
	export enum ExtensionKind {

		/**
		 * Extension runs where the UI runs.
		 */
		UI = 1,

		/**
		 * Extension runs where the remote extension host runs.
		 */
		Workspace = 2,
	}

	/**
	 * Controls the behaviour of the terminal's visibility.
	 */
	export enum TaskRevealKind {
		/**
		 * Always brings the terminal to front if the task is executed.
		 */
		Always = 1,

		/**
		 * Only brings the terminal to front if a problem is detected executing the task
		 * (e.g. the task couldn't be started because).
		 */
		Silent = 2,

		/**
		 * The terminal never comes to front when the task is executed.
		 */
		Never = 3,
	}

	/**
	 * Controls how the task channel is used between tasks
	 */
	export enum TaskPanelKind {

		/**
		 * Shares a panel with other tasks. This is the default.
		 */
		Shared = 1,

		/**
		 * Uses a dedicated panel for this tasks. The panel is not
		 * shared with other tasks.
		 */
		Dedicated = 2,

		/**
		 * Creates a new panel whenever this task is executed.
		 */
		New = 3,
	}

	/**
	 * Controls how the task is presented in the UI.
	 */
	export interface TaskPresentationOptions {
		/**
		 * Controls whether the task output is reveal in the user interface.
		 * Defaults to `RevealKind.Always`.
		 */
		reveal?: TaskRevealKind;

		/**
		 * Controls whether the command associated with the task is echoed
		 * in the user interface.
		 */
		echo?: boolean;

		/**
		 * Controls whether the panel showing the task output is taking focus.
		 */
		focus?: boolean;

		/**
		 * Controls if the task panel is used for this task only (dedicated),
		 * shared between tasks (shared) or if a new panel is created on
		 * every task execution (new). Defaults to `TaskInstanceKind.Shared`
		 */
		panel?: TaskPanelKind;

		/**
		 * Controls whether to show the "Terminal will be reused by tasks, press any key to close it" message.
		 */
		showReuseMessage?: boolean;

		/**
		 * Controls whether the terminal is cleared before executing the task.
		 */
		clear?: boolean;
	}

	/**
	 * A grouping for tasks. The editor by default supports the
	 * 'Clean', 'Build', 'RebuildAll' and 'Test' group.
	 */
	export class TaskGroup {

		/**
		 * The clean task group;
		 */
		static Clean: TaskGroup;

		/**
		 * The build task group;
		 */
		static Build: TaskGroup;

		/**
		 * The rebuild all task group;
		 */
		static Rebuild: TaskGroup;

		/**
		 * The test all task group;
		 */
		static Test: TaskGroup;

		private constructor(id: string, label: string);
	}

	/**
	 * A structure that defines a task kind in the system.
	 * The value must be JSON-stringifyable.
	 */
	export interface TaskDefinition {
		/**
		 * The task definition describing the task provided by an extension.
		 * Usually a task provider defines more properties to identify
		 * a task. They need to be defined in the package.json of the
		 * extension under the 'taskDefinitions' extension point. The npm
		 * task definition for example looks like this
		 * ```typescript
		 * interface NpmTaskDefinition extends TaskDefinition {
		 *     script: string;
		 * }
		 * ```
		 *
		 * Note that type identifier starting with a '$' are reserved for internal
		 * usages and shouldn't be used by extensions.
		 */
		readonly type: string;

		/**
		 * Additional attributes of a concrete task definition.
		 */
		[name: string]: any;
	}

	/**
	 * Options for a process execution
	 */
	export interface ProcessExecutionOptions {
		/**
		 * The current working directory of the executed program or shell.
		 * If omitted the tools current workspace root is used.
		 */
		cwd?: string;

		/**
		 * The additional environment of the executed program or shell. If omitted
		 * the parent process' environment is used. If provided it is merged with
		 * the parent process' environment.
		 */
		env?: { [key: string]: string };
	}

	/**
	 * The execution of a task happens as an external process
	 * without shell interaction.
	 */
	export class ProcessExecution {

		/**
		 * Creates a process execution.
		 *
		 * @param process The process to start.
		 * @param options Optional options for the started process.
		 */
		constructor(process: string, options?: ProcessExecutionOptions);

		/**
		 * Creates a process execution.
		 *
		 * @param process The process to start.
		 * @param args Arguments to be passed to the process.
		 * @param options Optional options for the started process.
		 */
		constructor(process: string, args: string[], options?: ProcessExecutionOptions);

		/**
		 * The process to be executed.
		 */
		process: string;

		/**
		 * The arguments passed to the process. Defaults to an empty array.
		 */
		args: string[];

		/**
		 * The process options used when the process is executed.
		 * Defaults to undefined.
		 */
		options?: ProcessExecutionOptions;
	}

	/**
	 * The shell quoting options.
	 */
	export interface ShellQuotingOptions {

		/**
		 * The character used to do character escaping. If a string is provided only spaces
		 * are escaped. If a `{ escapeChar, charsToEscape }` literal is provide all characters
		 * in `charsToEscape` are escaped using the `escapeChar`.
		 */
		escape?: string | {
			/**
			 * The escape character.
			 */
			escapeChar: string;
			/**
			 * The characters to escape.
			 */
			charsToEscape: string;
		};

		/**
		 * The character used for strong quoting. The string's length must be 1.
		 */
		strong?: string;

		/**
		 * The character used for weak quoting. The string's length must be 1.
		 */
		weak?: string;
	}

	/**
	 * Options for a shell execution
	 */
	export interface ShellExecutionOptions {
		/**
		 * The shell executable.
		 */
		executable?: string;

		/**
		 * The arguments to be passed to the shell executable used to run the task. Most shells
		 * require special arguments to execute a command. For  example `bash` requires the `-c`
		 * argument to execute a command, `PowerShell` requires `-Command` and `cmd` requires both
		 * `/d` and `/c`.
		 */
		shellArgs?: string[];

		/**
		 * The shell quotes supported by this shell.
		 */
		shellQuoting?: ShellQuotingOptions;

		/**
		 * The current working directory of the executed shell.
		 * If omitted the tools current workspace root is used.
		 */
		cwd?: string;

		/**
		 * The additional environment of the executed shell. If omitted
		 * the parent process' environment is used. If provided it is merged with
		 * the parent process' environment.
		 */
		env?: { [key: string]: string };
	}

	/**
	 * Defines how an argument should be quoted if it contains
	 * spaces or unsupported characters.
	 */
	export enum ShellQuoting {

		/**
		 * Character escaping should be used. This for example
		 * uses \ on bash and ` on PowerShell.
		 */
		Escape = 1,

		/**
		 * Strong string quoting should be used. This for example
		 * uses " for Windows cmd and ' for bash and PowerShell.
		 * Strong quoting treats arguments as literal strings.
		 * Under PowerShell echo 'The value is $(2 * 3)' will
		 * print `The value is $(2 * 3)`
		 */
		Strong = 2,

		/**
		 * Weak string quoting should be used. This for example
		 * uses " for Windows cmd, bash and PowerShell. Weak quoting
		 * still performs some kind of evaluation inside the quoted
		 * string.  Under PowerShell echo "The value is $(2 * 3)"
		 * will print `The value is 6`
		 */
		Weak = 3,
	}

	/**
	 * A string that will be quoted depending on the used shell.
	 */
	export interface ShellQuotedString {
		/**
		 * The actual string value.
		 */
		value: string;

		/**
		 * The quoting style to use.
		 */
		quoting: ShellQuoting;
	}

	export class ShellExecution {
		/**
		 * Creates a shell execution with a full command line.
		 *
		 * @param commandLine The command line to execute.
		 * @param options Optional options for the started the shell.
		 */
		constructor(commandLine: string, options?: ShellExecutionOptions);

		/**
		 * Creates a shell execution with a command and arguments. For the real execution VS Code will
		 * construct a command line from the command and the arguments. This is subject to interpretation
		 * especially when it comes to quoting. If full control over the command line is needed please
		 * use the constructor that creates a `ShellExecution` with the full command line.
		 *
		 * @param command The command to execute.
		 * @param args The command arguments.
		 * @param options Optional options for the started the shell.
		 */
		constructor(command: string | ShellQuotedString, args: (string | ShellQuotedString)[], options?: ShellExecutionOptions);

		/**
		 * The shell command line. Is `undefined` if created with a command and arguments.
		 */
		commandLine: string;

		/**
		 * The shell command. Is `undefined` if created with a full command line.
		 */
		command: string | ShellQuotedString;

		/**
		 * The shell args. Is `undefined` if created with a full command line.
		 */
		args: (string | ShellQuotedString)[];

		/**
		 * The shell options used when the command line is executed in a shell.
		 * Defaults to undefined.
		 */
		options?: ShellExecutionOptions;
	}

	/**
	 * The scope of a task.
	 */
	export enum TaskScope {
		/**
		 * The task is a global task
		 */
		Global = 1,

		/**
		 * The task is a workspace task
		 */
		Workspace = 2,
	}

	/**
	 * Run options for a task.
	 */
	export interface RunOptions {
		/**
		 * Controls whether task variables are re-evaluated on rerun.
		 */
		reevaluateOnRerun?: boolean;
	}

	/**
	 * A task to execute
	 */
	export class Task {

		/**
		 * Creates a new task.
		 *
		 * @param definition The task definition as defined in the taskDefinitions extension point.
		 * @param scope Specifies the task's scope. It is either a global or a workspace task or a task for a specific workspace folder.
		 * @param name The task's name. Is presented in the user interface.
		 * @param source The task's source (e.g. 'gulp', 'npm', ...). Is presented in the user interface.
		 * @param execution The process or shell execution.
		 * @param problemMatchers the names of problem matchers to use, like '$tsc'
		 *  or '$eslint'. Problem matchers can be contributed by an extension using
		 *  the `problemMatchers` extension point.
		 */
		constructor(taskDefinition: TaskDefinition, scope: WorkspaceFolder | TaskScope.Global | TaskScope.Workspace, name: string, source: string, execution?: ProcessExecution | ShellExecution, problemMatchers?: string | string[]);

		/**
		 * ~~Creates a new task.~~
		 *
		 * @deprecated Use the new constructors that allow specifying a scope for the task.
		 *
		 * @param definition The task definition as defined in the taskDefinitions extension point.
		 * @param name The task's name. Is presented in the user interface.
		 * @param source The task's source (e.g. 'gulp', 'npm', ...). Is presented in the user interface.
		 * @param execution The process or shell execution.
		 * @param problemMatchers the names of problem matchers to use, like '$tsc'
		 *  or '$eslint'. Problem matchers can be contributed by an extension using
		 *  the `problemMatchers` extension point.
		 */
		constructor(taskDefinition: TaskDefinition, name: string, source: string, execution?: ProcessExecution | ShellExecution, problemMatchers?: string | string[]);

		/**
		 * The task's definition.
		 */
		definition: TaskDefinition;

		/**
		 * The task's scope.
		 */
		readonly scope?: TaskScope.Global | TaskScope.Workspace | WorkspaceFolder;

		/**
		 * The task's name
		 */
		name: string;

		/**
		 * The task's execution engine
		 */
		execution?: ProcessExecution | ShellExecution;

		/**
		 * Whether the task is a background task or not.
		 */
		isBackground: boolean;

		/**
		 * A human-readable string describing the source of this
		 * shell task, e.g. 'gulp' or 'npm'.
		 */
		source: string;

		/**
		 * The task group this tasks belongs to. See TaskGroup
		 * for a predefined set of available groups.
		 * Defaults to undefined meaning that the task doesn't
		 * belong to any special group.
		 */
		group?: TaskGroup;

		/**
		 * The presentation options. Defaults to an empty literal.
		 */
		presentationOptions: TaskPresentationOptions;

		/**
		 * The problem matchers attached to the task. Defaults to an empty
		 * array.
		 */
		problemMatchers: string[];

		/**
		 * Run options for the task
		 */
		runOptions: RunOptions;
	}

	/**
	 * A task provider allows to add tasks to the task service.
	 * A task provider is registered via #tasks.registerTaskProvider.
	 */
	export interface TaskProvider {
		/**
		 * Provides tasks.
		 * @param token A cancellation token.
		 * @return an array of tasks
		 */
		provideTasks(token?: CancellationToken): ProviderResult<Task[]>;

		/**
		 * Resolves a task that has no [`execution`](#Task.execution) set. Tasks are
		 * often created from information found in the `tasks.json`-file. Such tasks miss
		 * the information on how to execute them and a task provider must fill in
		 * the missing information in the `resolveTask`-method. This method will not be
		 * called for tasks returned from the above `provideTasks` method since those
		 * tasks are always fully resolved. A valid default implementation for the
		 * `resolveTask` method is to return `undefined`.
		 *
		 * @param task The task to resolve.
		 * @param token A cancellation token.
		 * @return The resolved task
		 */
		resolveTask(task: Task, token?: CancellationToken): ProviderResult<Task>;
	}

	/**
	 * An object representing an executed Task. It can be used
	 * to terminate a task.
	 *
	 * This interface is not intended to be implemented.
	 */
	export interface TaskExecution {
		/**
		 * The task that got started.
		 */
		task: Task;

		/**
		 * Terminates the task execution.
		 */
		terminate(): void;
	}

	/**
	 * An event signaling the start of a task execution.
	 *
	 * This interface is not intended to be implemented.
	 */
	interface TaskStartEvent {
		/**
		 * The task item representing the task that got started.
		 */
		readonly execution: TaskExecution;
	}

	/**
	 * An event signaling the end of an executed task.
	 *
	 * This interface is not intended to be implemented.
	 */
	interface TaskEndEvent {
		/**
		 * The task item representing the task that finished.
		 */
		readonly execution: TaskExecution;
	}

	/**
	 * An event signaling the start of a process execution
	 * triggered through a task
	 */
	export interface TaskProcessStartEvent {

		/**
		 * The task execution for which the process got started.
		 */
		readonly execution: TaskExecution;

		/**
		 * The underlying process id.
		 */
		readonly processId: number;
	}

	/**
	 * An event signaling the end of a process execution
	 * triggered through a task
	 */
	export interface TaskProcessEndEvent {

		/**
		 * The task execution for which the process got started.
		 */
		readonly execution: TaskExecution;

		/**
		 * The process's exit code.
		 */
		readonly exitCode: number;
	}

	export interface TaskFilter {
		/**
		 * The task version as used in the tasks.json file.
		 * The string support the package.json semver notation.
		 */
		version?: string;

		/**
		 * The task type to return;
		 */
		type?: string;
	}

	/**
	 * Namespace for tasks functionality.
	 */
	export namespace tasks {

		/**
		 * Register a task provider.
		 *
		 * @param type The task kind type this provider is registered for.
		 * @param provider A task provider.
		 * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
		 */
		export function registerTaskProvider(type: string, provider: TaskProvider): Disposable;

		/**
		 * Fetches all tasks available in the systems. This includes tasks
		 * from `tasks.json` files as well as tasks from task providers
		 * contributed through extensions.
		 *
		 * @param filter a filter to filter the return tasks.
		 */
		export function fetchTasks(filter?: TaskFilter): Thenable<Task[]>;

		/**
		 * Executes a task that is managed by VS Code. The returned
		 * task execution can be used to terminate the task.
		 *
		 * @param task the task to execute
		 */
		export function executeTask(task: Task): Thenable<TaskExecution>;

		/**
		 * The currently active task executions or an empty array.
		 */
		export const taskExecutions: ReadonlyArray<TaskExecution>;

		/**
		 * Fires when a task starts.
		 */
		export const onDidStartTask: Event<TaskStartEvent>;

		/**
		 * Fires when a task ends.
		 */
		export const onDidEndTask: Event<TaskEndEvent>;

		/**
		 * Fires when the underlying process has been started.
		 * This event will not fire for tasks that don't
		 * execute an underlying process.
		 */
		export const onDidStartTaskProcess: Event<TaskProcessStartEvent>;

		/**
		 * Fires when the underlying process has ended.
		 * This event will not fire for tasks that don't
		 * execute an underlying process.
		 */
		export const onDidEndTaskProcess: Event<TaskProcessEndEvent>;
	}

	/**
	 * Defines a port mapping used for localhost inside the webview.
	 */
	export interface WebviewPortMapping {
		/**
		 * Localhost port to remap inside the webview.
		 */
		readonly webviewPort: number;

		/**
		 * Destination port. The `webviewPort` is resolved to this port.
		 */
		readonly extensionHostPort: number;
	}

	/**
	 * Content settings for a webview.
	 */
	export interface WebviewOptions {
		/**
		 * Controls whether scripts are enabled in the webview content or not.
		 *
		 * Defaults to false (scripts-disabled).
		 */
		readonly enableScripts?: boolean;

		/**
		 * Controls whether command uris are enabled in webview content or not.
		 *
		 * Defaults to false.
		 */
		readonly enableCommandUris?: boolean;

		/**
		 * Root paths from which the webview can load local (filesystem) resources using the `vscode-resource:` scheme.
		 *
		 * Default to the root folders of the current workspace plus the extension's install directory.
		 *
		 * Pass in an empty array to disallow access to any local resources.
		 */
		readonly localResourceRoots?: ReadonlyArray<Uri>;

		/**
		 * Mappings of localhost ports used inside the webview.
		 *
		 * Port mapping allow webviews to transparently define how localhost ports are resolved. This can be used
		 * to allow using a static localhost port inside the webview that is resolved to random port that a service is
		 * running on.
		 *
		 * If a webview accesses localhost content, we recommend that you specify port mappings even if
		 * the `webviewPort` and `extensionHostPort` ports are the same.
		 *
		 * *Note* that port mappings only work for `http` or `https` urls. Websocket urls (e.g. `ws://localhost:3000`)
		 * cannot be mapped to another port.
		 */
		readonly portMapping?: ReadonlyArray<WebviewPortMapping>;
	}

	/**
	 * A webview displays html content, like an iframe.
	 */
	export interface Webview {
		/**
		 * Content settings for the webview.
		 */
		options: WebviewOptions;

		/**
		 * Contents of the webview.
		 *
		 * Should be a complete html document.
		 */
		html: string;

		/**
		 * Fired when the webview content posts a message.
		 */
		readonly onDidReceiveMessage: Event<any>;

		/**
		 * Post a message to the webview content.
		 *
		 * Messages are only delivered if the webview is visible.
		 *
		 * @param message Body of the message.
		 */
		postMessage(message: any): Thenable<boolean>;
	}

	/**
	 * Content settings for a webview panel.
	 */
	export interface WebviewPanelOptions {
		/**
		 * Controls if the find widget is enabled in the panel.
		 *
		 * Defaults to false.
		 */
		readonly enableFindWidget?: boolean;

		/**
		 * Controls if the webview panel's content (iframe) is kept around even when the panel
		 * is no longer visible.
		 *
		 * Normally the webview panel's html context is created when the panel becomes visible
		 * and destroyed when it is hidden. Extensions that have complex state
		 * or UI can set the `retainContextWhenHidden` to make VS Code keep the webview
		 * context around, even when the webview moves to a background tab. When a webview using
		 * `retainContextWhenHidden` becomes hidden, its scripts and other dynamic content are suspended.
		 * When the panel becomes visible again, the context is automatically restored
		 * in the exact same state it was in originally. You cannot send messages to a
		 * hidden webview, even with `retainContextWhenHidden` enabled.
		 *
		 * `retainContextWhenHidden` has a high memory overhead and should only be used if
		 * your panel's context cannot be quickly saved and restored.
		 */
		readonly retainContextWhenHidden?: boolean;
	}

	/**
	 * A panel that contains a webview.
	 */
	interface WebviewPanel {
		/**
		 * Identifies the type of the webview panel, such as `'markdown.preview'`.
		 */
		readonly viewType: string;

		/**
		 * Title of the panel shown in UI.
		 */
		title: string;

		/**
		 * Icon for the panel shown in UI.
		 */
		iconPath?: Uri | { light: Uri; dark: Uri };

		/**
		 * Webview belonging to the panel.
		 */
		readonly webview: Webview;

		/**
		 * Content settings for the webview panel.
		 */
		readonly options: WebviewPanelOptions;

		/**
		 * Editor position of the panel. This property is only set if the webview is in
		 * one of the editor view columns.
		 */
		readonly viewColumn?: ViewColumn;

		/**
		 * Whether the panel is active (focused by the user).
		 */
		readonly active: boolean;

		/**
		 * Whether the panel is visible.
		 */
		readonly visible: boolean;

		/**
		 * Fired when the panel's view state changes.
		 */
		readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

		/**
		 * Fired when the panel is disposed.
		 *
		 * This may be because the user closed the panel or because `.dispose()` was
		 * called on it.
		 *
		 * Trying to use the panel after it has been disposed throws an exception.
		 */
		readonly onDidDispose: Event<void>;

		/**
		 * Show the webview panel in a given column.
		 *
		 * A webview panel may only show in a single column at a time. If it is already showing, this
		 * method moves it to a new column.
		 *
		 * @param viewColumn View column to show the panel in. Shows in the current `viewColumn` if undefined.
		 * @param preserveFocus When `true`, the webview will not take focus.
		 */
		reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;

		/**
		 * Dispose of the webview panel.
		 *
		 * This closes the panel if it showing and disposes of the resources owned by the webview.
		 * Webview panels are also disposed when the user closes the webview panel. Both cases
		 * fire the `onDispose` event.
		 */
		dispose(): any;
	}

	/**
	 * Event fired when a webview panel's view state changes.
	 */
	export interface WebviewPanelOnDidChangeViewStateEvent {
		/**
		 * Webview panel whose view state changed.
		 */
		readonly webviewPanel: WebviewPanel;
	}

	/**
	 * Restore webview panels that have been persisted when vscode shuts down.
	 *
	 * There are two types of webview persistence:
	 *
	 * - Persistence within a session.
	 * - Persistence across sessions (across restarts of VS Code).
	 *
	 * A `WebviewPanelSerializer` is only required for the second case: persisting a webview across sessions.
	 *
	 * Persistence within a session allows a webview to save its state when it becomes hidden
	 * and restore its content from this state when it becomes visible again. It is powered entirely
	 * by the webview content itself. To save off a persisted state, call `acquireVsCodeApi().setState()` with
	 * any json serializable object. To restore the state again, call `getState()`
	 *
	 * ```js
	 * // Within the webview
	 * const vscode = acquireVsCodeApi();
	 *
	 * // Get existing state
	 * const oldState = vscode.getState() || { value: 0 };
	 *
	 * // Update state
	 * setState({ value: oldState.value + 1 })
	 * ```
	 *
	 * A `WebviewPanelSerializer` extends this persistence across restarts of VS Code. When the editor is shutdown,
	 * VS Code will save off the state from `setState` of all webviews that have a serializer. When the
	 * webview first becomes visible after the restart, this state is passed to `deserializeWebviewPanel`.
	 * The extension can then restore the old `WebviewPanel` from this state.
	 */
	interface WebviewPanelSerializer {
		/**
		 * Restore a webview panel from its serialized `state`.
		 *
		 * Called when a serialized webview first becomes visible.
		 *
		 * @param webviewPanel Webview panel to restore. The serializer should take ownership of this panel. The
		 * serializer must restore the webview's `.html` and hook up all webview events.
		 * @param state Persisted state from the webview content.
		 *
		 * @return Thenable indicating that the webview has been fully restored.
		 */
		deserializeWebviewPanel(webviewPanel: WebviewPanel, state: any): Thenable<void>;
	}

	/**
	 * The clipboard provides read and write access to the system's clipboard.
	 */
	export interface Clipboard {

		/**
		 * Read the current clipboard contents as text.
		 * @returns A thenable that resolves to a string.
		 */
		readText(): Thenable<string>;

		/**
		 * Writes text into the clipboard.
		 * @returns A thenable that resolves when writing happened.
		 */
		writeText(value: string): Thenable<void>;
	}

	/**
	 * Namespace for dealing with commands. In short, a command is a function with a
	 * unique identifier. The function is sometimes also called _command handler_.
	 *
	 * Commands can be added to the editor using the [registerCommand](#commands.registerCommand)
	 * and [registerTextEditorCommand](#commands.registerTextEditorCommand) functions. Commands
	 * can be executed [manually](#commands.executeCommand) or from a UI gesture. Those are:
	 *
	 * * palette - Use the `commands`-section in `package.json` to make a command show in
	 * the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
	 * * keybinding - Use the `keybindings`-section in `package.json` to enable
	 * [keybindings](https://code.visualstudio.com/docs/getstarted/keybindings#_customizing-shortcuts)
	 * for your extension.
	 *
	 * Commands from other extensions and from the editor itself are accessible to an extension. However,
	 * when invoking an editor command not all argument types are supported.
	 *
	 * This is a sample that registers a command handler and adds an entry for that command to the palette. First
	 * register a command handler with the identifier `extension.sayHello`.
	 * ```javascript
	 * commands.registerCommand('extension.sayHello', () => {
	 * 	window.showInformationMessage('Hello World!');
	 * });
	 * ```
	 * Second, bind the command identifier to a title under which it will show in the palette (`package.json`).
	 * ```json
	 * {
	 * 	"contributes": {
	 * 		"commands": [{
	 * 			"command": "extension.sayHello",
	 * 			"title": "Hello World"
	 * 		}]
	 * 	}
	 * }
	 * ```
	 */

	/**
	 * Represents the state of a window.
	 */
	export interface WindowState {

		/**
		 * Whether the current window is focused.
		 */
		readonly focused: boolean;
	}

	/**
	 * A uri handler is responsible for handling system-wide [uris](#Uri).
	 *
	 * @see [window.registerUriHandler](#window.registerUriHandler).
	 */
	export interface UriHandler {

		/**
		 * Handle the provided system-wide [uri](#Uri).
		 *
		 * @see [window.registerUriHandler](#window.registerUriHandler).
		 */
		handleUri(uri: Uri): ProviderResult<void>;
	}

	/**
	 * Options for creating a [TreeView](#TreeView)
	 */
	export interface TreeViewOptions<T> {

		/**
		 * A data provider that provides tree data.
		 */
		treeDataProvider: TreeDataProvider<T>;

		/**
		 * Whether to show collapse all action or not.
		 */
		showCollapseAll?: boolean;
	}

	/**
	 * The event that is fired when an element in the [TreeView](#TreeView) is expanded or collapsed
	 */
	export interface TreeViewExpansionEvent<T> {

		/**
		 * Element that is expanded or collapsed.
		 */
		readonly element: T;

	}

	/**
	 * The event that is fired when there is a change in [tree view's selection](#TreeView.selection)
	 */
	export interface TreeViewSelectionChangeEvent<T> {

		/**
		 * Selected elements.
		 */
		readonly selection: T[];

	}

	/**
	 * The event that is fired when there is a change in [tree view's visibility](#TreeView.visible)
	 */
	export interface TreeViewVisibilityChangeEvent {

		/**
		 * `true` if the [tree view](#TreeView) is visible otherwise `false`.
		 */
		readonly visible: boolean;

	}

	/**
	 * Represents a Tree view
	 */
	export interface TreeView<T> extends Disposable {

		/**
		 * Event that is fired when an element is expanded
		 */
		readonly onDidExpandElement: Event<TreeViewExpansionEvent<T>>;

		/**
		 * Event that is fired when an element is collapsed
		 */
		readonly onDidCollapseElement: Event<TreeViewExpansionEvent<T>>;

		/**
		 * Currently selected elements.
		 */
		readonly selection: T[];

		/**
		 * Event that is fired when the [selection](#TreeView.selection) has changed
		 */
		readonly onDidChangeSelection: Event<TreeViewSelectionChangeEvent<T>>;

		/**
		 * `true` if the [tree view](#TreeView) is visible otherwise `false`.
		 */
		readonly visible: boolean;

		/**
		 * Event that is fired when [visibility](#TreeView.visible) has changed
		 */
		readonly onDidChangeVisibility: Event<TreeViewVisibilityChangeEvent>;

		/**
		 * Reveals the given element in the tree view.
		 * If the tree view is not visible then the tree view is shown and element is revealed.
		 *
		 * By default revealed element is selected.
		 * In order to not to select, set the option `select` to `false`.
		 * In order to focus, set the option `focus` to `true`.
		 * In order to expand the revealed element, set the option `expand` to `true`. To expand recursively set `expand` to the number of levels to expand.
		 * **NOTE:** You can expand only to 3 levels maximum.
		 *
		 * **NOTE:** [TreeDataProvider](#TreeDataProvider) is required to implement [getParent](#TreeDataProvider.getParent) method to access this API.
		 */
		reveal(element: T, options?: { select?: boolean, focus?: boolean, expand?: boolean | number }): Thenable<void>;
	}

	/**
	 * A data provider that provides tree data
	 */
	export interface TreeDataProvider<T> {
		/**
		 * An optional event to signal that an element or root has changed.
		 * This will trigger the view to update the changed element/root and its children recursively (if shown).
		 * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
		 */
		onDidChangeTreeData?: Event<T | undefined | null>;

		/**
		 * Get [TreeItem](#TreeItem) representation of the `element`
		 *
		 * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
		 * @return [TreeItem](#TreeItem) representation of the element
		 */
		getTreeItem(element: T): TreeItem | Thenable<TreeItem>;

		/**
		 * Get the children of `element` or root if no element is passed.
		 *
		 * @param element The element from which the provider gets children. Can be `undefined`.
		 * @return Children of `element` or root if no element is passed.
		 */
		getChildren(element?: T): ProviderResult<T[]>;

		/**
		 * Optional method to return the parent of `element`.
		 * Return `null` or `undefined` if `element` is a child of root.
		 *
		 * **NOTE:** This method should be implemented in order to access [reveal](#TreeView.reveal) API.
		 *
		 * @param element The element for which the parent has to be returned.
		 * @return Parent of `element`.
		 */
		getParent?(element: T): ProviderResult<T>;
	}

	export class TreeItem {
		/**
		 * A human-readable string describing this item. When `falsy`, it is derived from [resourceUri](#TreeItem.resourceUri).
		 */
		label?: string;

		/**
		 * Optional id for the tree item that has to be unique across tree. The id is used to preserve the selection and expansion state of the tree item.
		 *
		 * If not provided, an id is generated using the tree item's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
		 */
		id?: string;

		/**
		 * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
		 * When `falsy`, [Folder Theme Icon](#ThemeIcon.Folder) is assigned, if item is collapsible otherwise [File Theme Icon](#ThemeIcon.File).
		 * When a [ThemeIcon](#ThemeIcon) is specified, icon is derived from the current file icon theme for the specified theme icon using [resourceUri](#TreeItem.resourceUri) (if provided).
		 */
		iconPath?: string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;

		/**
		 * A human readable string which is rendered less prominent.
		 * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
		 */
		description?: string | boolean;

		/**
		 * The [uri](#Uri) of the resource representing this item.
		 *
		 * Will be used to derive the [label](#TreeItem.label), when it is not provided.
		 * Will be used to derive the icon from current icon theme, when [iconPath](#TreeItem.iconPath) has [ThemeIcon](#ThemeIcon) value.
		 */
		resourceUri?: Uri;

		/**
		 * The tooltip text when you hover over this item.
		 */
		tooltip?: string | undefined;

		/**
		 * The [command](#Command) that should be executed when the tree item is selected.
		 */
		command?: Command;

		/**
		 * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
		 */
		collapsibleState?: TreeItemCollapsibleState;

		/**
		 * Context value of the tree item. This can be used to contribute item specific actions in the tree.
		 * For example, a tree item is given a context value as `folder`. When contributing actions to `view/item/context`
		 * using `menus` extension point, you can specify context value for key `viewItem` in `when` expression like `viewItem == folder`.
		 * ```
		 *	"contributes": {
		 *		"menus": {
		 *			"view/item/context": [
		 *				{
		 *					"command": "extension.deleteFolder",
		 *					"when": "viewItem == folder"
		 *				}
		 *			]
		 *		}
		 *	}
		 * ```
		 * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
		 */
		contextValue?: string;

		/**
		 * @param label A human-readable string describing this item
		 * @param collapsibleState [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item. Default is [TreeItemCollapsibleState.None](#TreeItemCollapsibleState.None)
		 */
		constructor(label: string, collapsibleState?: TreeItemCollapsibleState);

		/**
		 * @param resourceUri The [uri](#Uri) of the resource representing this item.
		 * @param collapsibleState [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item. Default is [TreeItemCollapsibleState.None](#TreeItemCollapsibleState.None)
		 */
		constructor(resourceUri: Uri, collapsibleState?: TreeItemCollapsibleState);
	}

	/**
	 * Collapsible state of the tree item
	 */
	export enum TreeItemCollapsibleState {
		/**
		 * Determines an item can be neither collapsed nor expanded. Implies it has no children.
		 */
		None = 0,
		/**
		 * Determines an item is collapsed
		 */
		Collapsed = 1,
		/**
		 * Determines an item is expanded
		 */
		Expanded = 2,
	}

	/**
	 * Value-object describing what options a terminal should use.
	 */
	export interface TerminalOptions {
		/**
		 * A human-readable string which will be used to represent the terminal in the UI.
		 */
		name?: string;

		/**
		 * A path to a custom shell executable to be used in the terminal.
		 */
		shellPath?: string;

		/**
		 * Args for the custom shell executable. A string can be used on Windows only which allows
		 * specifying shell args in [command-line format](https://msdn.microsoft.com/en-au/08dfcab2-eb6e-49a4-80eb-87d4076c98c6).
		 */
		shellArgs?: string[] | string;

		/**
		 * A path or Uri for the current working directory to be used for the terminal.
		 */
		cwd?: string | Uri;

		/**
		 * Object with environment variables that will be added to the VS Code process.
		 */
		env?: { [key: string]: string | null };

		/**
		 * Whether the terminal process environment should be exactly as provided in
		 * `TerminalOptions.env`. When this is false (default), the environment will be based on the
		 * window's environment and also apply configured platform settings like
		 * `terminal.integrated.windows.env` on top. When this is true, the complete environment
		 * must be provided as nothing will be inherited from the process or any configuration.
		 */
		strictEnv?: boolean;

		/**
		 * When enabled the terminal will run the process as normal but not be surfaced to the user
		 * until `Terminal.show` is called. The typical usage for this is when you need to run
		 * something that may need interactivity but only want to tell the user about it when
		 * interaction is needed. Note that the terminals will still be exposed to all extensions
		 * as normal.
		 */
		hideFromUser?: boolean;
	}

	/**
	 * A location in the editor at which progress information can be shown. It depends on the
	 * location how progress is visually represented.
	 */
	export enum ProgressLocation {

		/**
		 * Show progress for the source control viewlet, as overlay for the icon and as progress bar
		 * inside the viewlet (when visible). Neither supports cancellation nor discrete progress.
		 */
		SourceControl = 1,

		/**
		 * Show progress in the status bar of the editor. Neither supports cancellation nor discrete progress.
		 */
		Window = 10,

		/**
		 * Show progress as notification with an optional cancel button. Supports to show infinite and discrete progress.
		 */
		Notification = 15,
	}

	/**
	 * Value-object describing where and how progress should show.
	 */
	export interface ProgressOptions {

		/**
		 * The location at which progress should show.
		 */
		location: ProgressLocation;

		/**
		 * A human-readable string which will be used to describe the
		 * operation.
		 */
		title?: string;

		/**
		 * Controls if a cancel button should show to allow the user to
		 * cancel the long running operation.  Note that currently only
		 * `ProgressLocation.Notification` is supporting to show a cancel
		 * button.
		 */
		cancellable?: boolean;
	}

	/**
	 * An event describing an individual change in the text of a [document](#TextDocument).
	 */
	export interface TextDocumentContentChangeEvent {
		/**
		 * The range that got replaced.
		 */
		range: Range;
		/**
		 * The offset of the range that got replaced.
		 */
		rangeOffset: number;
		/**
		 * The length of the range that got replaced.
		 */
		rangeLength: number;
		/**
		 * The new text for the range.
		 */
		text: string;
	}


	/**
	 * Represents reasons why a text document is saved.
	 */
	export enum TextDocumentSaveReason {

		/**
		 * Manually triggered, e.g. by the user pressing save, by starting debugging,
		 * or by an API call.
		 */
		Manual = 1,

		/**
		 * Automatic after a delay.
		 */
		AfterDelay = 2,

		/**
		 * When the editor lost focus.
		 */
		FocusOut = 3,
	}

	/**
	 * An event that is fired when a [document](#TextDocument) will be saved.
	 *
	 * To make modifications to the document before it is being saved, call the
	 * [`waitUntil`](#TextDocumentWillSaveEvent.waitUntil)-function with a thenable
	 * that resolves to an array of [text edits](#TextEdit).
	 */
	export interface TextDocumentWillSaveEvent {

		/**
		 * The document that will be saved.
		 */
		readonly document: TextDocument;

		/**
		 * The reason why save was triggered.
		 */
		readonly reason: TextDocumentSaveReason;

		/**
		 * Allows to pause the event loop and to apply [pre-save-edits](#TextEdit).
		 * Edits of subsequent calls to this function will be applied in order. The
		 * edits will be *ignored* if concurrent modifications of the document happened.
		 *
		 * *Note:* This function can only be called during event dispatch and not
		 * in an asynchronous manner:
		 *
		 * ```ts
		 * workspace.onWillSaveTextDocument(event => {
		 * 	// async, will *throw* an error
		 * 	setTimeout(() => event.waitUntil(promise));
		 *
		 * 	// sync, OK
		 * 	event.waitUntil(promise);
		 * })
		 * ```
		 *
		 * @param thenable A thenable that resolves to [pre-save-edits](#TextEdit).
		 */
		waitUntil(thenable: Thenable<TextEdit[]>): void;

		/**
		 * Allows to pause the event loop until the provided thenable resolved.
		 *
		 * *Note:* This function can only be called during event dispatch.
		 *
		 * @param thenable A thenable that delays saving.
		 */
		waitUntil(thenable: Thenable<any>): void;
	}

	/**
	 * An event describing a change to the set of [workspace folders](#workspace.workspaceFolders).
	 */
	export interface WorkspaceFoldersChangeEvent {
		/**
		 * Added workspace folders.
		 */
		readonly added: ReadonlyArray<WorkspaceFolder>;

		/**
		 * Removed workspace folders.
		 */
		readonly removed: ReadonlyArray<WorkspaceFolder>;
	}

	/**
	 * A workspace folder is one of potentially many roots opened by the editor. All workspace folders
	 * are equal which means there is no notion of an active or master workspace folder.
	 */
	export interface WorkspaceFolder {

		/**
		 * The associated uri for this workspace folder.
		 *
		 * *Note:* The [Uri](#Uri)-type was intentionally chosen such that future releases of the editor can support
		 * workspace folders that are not stored on the local disk, e.g. `ftp://server/workspaces/foo`.
		 */
		readonly uri: Uri;

		/**
		 * The name of this workspace folder. Defaults to
		 * the basename of its [uri-path](#Uri.path)
		 */
		readonly name: string;

		/**
		 * The ordinal number of this workspace folder.
		 */
		readonly index: number;
	}

	/**
	 * Namespace for dealing with the current workspace. A workspace is the representation
	 * of the folder that has been opened. There is no workspace when just a file but not a
	 * folder has been opened.
	 *
	 * The workspace offers support for [listening](#workspace.createFileSystemWatcher) to fs
	 * events and for [finding](#workspace.findFiles) files. Both perform well and run _outside_
	 * the editor-process so that they should be always used instead of nodejs-equivalents.
	 */
	export namespace workspace {

	}

	/**
	 * An event describing the change in Configuration
	 */
	export interface ConfigurationChangeEvent {

		/**
		 * Returns `true` if the given section for the given resource (if provided) is affected.
		 *
		 * @param section Configuration name, supports _dotted_ names.
		 * @param resource A resource Uri.
		 * @return `true` if the given section for the given resource (if provided) is affected.
		 */
		affectsConfiguration(section: string, resource?: Uri): boolean;
	}

	/**
	 * Represents the input box in the Source Control viewlet.
	 */
	export interface SourceControlInputBox {

		/**
		 * Setter and getter for the contents of the input box.
		 */
		value: string;

		/**
		 * A string to show as place holder in the input box to guide the user.
		 */
		placeholder: string;
	}

	interface QuickDiffProvider {

		/**
		 * Provide a [uri](#Uri) to the original resource of any given resource uri.
		 *
		 * @param uri The uri of the resource open in a text editor.
		 * @param token A cancellation token.
		 * @return A thenable that resolves to uri of the matching original resource.
		 */
		provideOriginalResource?(uri: Uri, token: CancellationToken): ProviderResult<Uri>;
	}

	/**
	 * The theme-aware decorations for a
	 * [source control resource state](#SourceControlResourceState).
	 */
	export interface SourceControlResourceThemableDecorations {

		/**
		 * The icon path for a specific
		 * [source control resource state](#SourceControlResourceState).
		 */
		readonly iconPath?: string | Uri;
	}

	/**
	 * The decorations for a [source control resource state](#SourceControlResourceState).
	 * Can be independently specified for light and dark themes.
	 */
	export interface SourceControlResourceDecorations extends SourceControlResourceThemableDecorations {

		/**
		 * Whether the [source control resource state](#SourceControlResourceState) should
		 * be striked-through in the UI.
		 */
		readonly strikeThrough?: boolean;

		/**
		 * Whether the [source control resource state](#SourceControlResourceState) should
		 * be faded in the UI.
		 */
		readonly faded?: boolean;

		/**
		 * The title for a specific
		 * [source control resource state](#SourceControlResourceState).
		 */
		readonly tooltip?: string;

		/**
		 * The light theme decorations.
		 */
		readonly light?: SourceControlResourceThemableDecorations;

		/**
		 * The dark theme decorations.
		 */
		readonly dark?: SourceControlResourceThemableDecorations;
	}

	/**
	 * An source control resource state represents the state of an underlying workspace
	 * resource within a certain [source control group](#SourceControlResourceGroup).
	 */
	export interface SourceControlResourceState {

		/**
		 * The [uri](#Uri) of the underlying resource inside the workspace.
		 */
		readonly resourceUri: Uri;

		/**
		 * The [command](#Command) which should be run when the resource
		 * state is open in the Source Control viewlet.
		 */
		readonly command?: Command;

		/**
		 * The [decorations](#SourceControlResourceDecorations) for this source control
		 * resource state.
		 */
		readonly decorations?: SourceControlResourceDecorations;
	}

	/**
	 * A source control resource group is a collection of
	 * [source control resource states](#SourceControlResourceState).
	 */
	export interface SourceControlResourceGroup {

		/**
		 * The id of this source control resource group.
		 */
		readonly id: string;

		/**
		 * The label of this source control resource group.
		 */
		label: string;

		/**
		 * Whether this source control resource group is hidden when it contains
		 * no [source control resource states](#SourceControlResourceState).
		 */
		hideWhenEmpty?: boolean;

		/**
		 * This group's collection of
		 * [source control resource states](#SourceControlResourceState).
		 */
		resourceStates: SourceControlResourceState[];

		/**
		 * Dispose this source control resource group.
		 */
		dispose(): void;
	}

	/**
	 * An source control is able to provide [resource states](#SourceControlResourceState)
	 * to the editor and interact with the editor in several source control related ways.
	 */
	export interface SourceControl {

		/**
		 * The id of this source control.
		 */
		readonly id: string;

		/**
		 * The human-readable label of this source control.
		 */
		readonly label: string;

		/**
		 * The (optional) Uri of the root of this source control.
		 */
		readonly rootUri: Uri | undefined;

		/**
		 * The [input box](#SourceControlInputBox) for this source control.
		 */
		readonly inputBox: SourceControlInputBox;

		/**
		 * The UI-visible count of [resource states](#SourceControlResourceState) of
		 * this source control.
		 *
		 * Equals to the total number of [resource state](#SourceControlResourceState)
		 * of this source control, if undefined.
		 */
		count?: number;

		/**
		 * An optional [quick diff provider](#QuickDiffProvider).
		 */
		quickDiffProvider?: QuickDiffProvider;

		/**
		 * Optional commit template string.
		 *
		 * The Source Control viewlet will populate the Source Control
		 * input with this value when appropriate.
		 */
		commitTemplate?: string;

		/**
		 * Optional accept input command.
		 *
		 * This command will be invoked when the user accepts the value
		 * in the Source Control input.
		 */
		acceptInputCommand?: Command;

		/**
		 * Optional status bar commands.
		 *
		 * These commands will be displayed in the editor's status bar.
		 */
		statusBarCommands?: Command[];

		/**
		 * Create a new [resource group](#SourceControlResourceGroup).
		 */
		createResourceGroup(id: string, label: string): SourceControlResourceGroup;

		/**
		 * Dispose this source control.
		 */
		dispose(): void;
	}

	export namespace scm {

		/**
		 * ~~The [input box](#SourceControlInputBox) for the last source control
		 * created by the extension.~~
		 *
		 * @deprecated Use SourceControl.inputBox instead
		 */
		export const inputBox: SourceControlInputBox;

		/**
		 * Creates a new [source control](#SourceControl) instance.
		 *
		 * @param id An `id` for the source control. Something short, e.g.: `git`.
		 * @param label A human-readable string for the source control. E.g.: `Git`.
		 * @param rootUri An optional Uri of the root of the source control. E.g.: `Uri.parse(workspaceRoot)`.
		 * @return An instance of [source control](#SourceControl).
		 */
		export function createSourceControl(id: string, label: string, rootUri?: Uri): SourceControl;
	}

	/**
	 * Configuration for a debug session.
	 */
	export interface DebugConfiguration {
		/**
		 * The type of the debug session.
		 */
		type: string;

		/**
		 * The name of the debug session.
		 */
		name: string;

		/**
		 * The request type of the debug session.
		 */
		request: string;

		/**
		 * Additional debug type specific properties.
		 */
		[key: string]: any;
	}

	/**
	 * A debug session.
	 */
	export interface DebugSession {

		/**
		 * The unique ID of this debug session.
		 */
		readonly id: string;

		/**
		 * The debug session's type from the [debug configuration](#DebugConfiguration).
		 */
		readonly type: string;

		/**
		 * The debug session's name from the [debug configuration](#DebugConfiguration).
		 */
		readonly name: string;

		/**
		 * The workspace folder of this session or `undefined` for a folderless setup.
		 */
		readonly workspaceFolder: WorkspaceFolder | undefined;

		/**
		 * The "resolved" [debug configuration](#DebugConfiguration) of this session.
		 * "Resolved" means that
		 * - all variables have been substituted and
		 * - platform specific attribute sections have been "flattened" for the matching platform and removed for non-matching platforms.
		 */
		readonly configuration: DebugConfiguration;

		/**
		 * Send a custom request to the debug adapter.
		 */
		customRequest(command: string, args?: any): Thenable<any>;
	}

	/**
	 * A custom Debug Adapter Protocol event received from a [debug session](#DebugSession).
	 */
	export interface DebugSessionCustomEvent {
		/**
		 * The [debug session](#DebugSession) for which the custom event was received.
		 */
		readonly session: DebugSession;

		/**
		 * Type of event.
		 */
		readonly event: string;

		/**
		 * Event specific information.
		 */
		readonly body?: any;
	}

	/**
	 * A debug configuration provider allows to add the initial debug configurations to a newly created launch.json
	 * and to resolve a launch configuration before it is used to start a new debug session.
	 * A debug configuration provider is registered via #debug.registerDebugConfigurationProvider.
	 */
	export interface DebugConfigurationProvider {
		/**
		 * Provides initial [debug configuration](#DebugConfiguration). If more than one debug configuration provider is
		 * registered for the same type, debug configurations are concatenated in arbitrary order.
		 *
		 * @param folder The workspace folder for which the configurations are used or `undefined` for a folderless setup.
		 * @param token A cancellation token.
		 * @return An array of [debug configurations](#DebugConfiguration).
		 */
		provideDebugConfigurations?(folder: WorkspaceFolder | undefined, token?: CancellationToken): ProviderResult<DebugConfiguration[]>;

		/**
		 * Resolves a [debug configuration](#DebugConfiguration) by filling in missing values or by adding/changing/removing attributes.
		 * If more than one debug configuration provider is registered for the same type, the resolveDebugConfiguration calls are chained
		 * in arbitrary order and the initial debug configuration is piped through the chain.
		 * Returning the value 'undefined' prevents the debug session from starting.
		 * Returning the value 'null' prevents the debug session from starting and opens the underlying debug configuration instead.
		 *
		 * @param folder The workspace folder from which the configuration originates from or `undefined` for a folderless setup.
		 * @param debugConfiguration The [debug configuration](#DebugConfiguration) to resolve.
		 * @param token A cancellation token.
		 * @return The resolved debug configuration or undefined or null.
		 */
		resolveDebugConfiguration?(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration>;
	}

	/**
	 * Represents a debug adapter executable and optional arguments and runtime options passed to it.
	 */
	export class DebugAdapterExecutable {

		/**
		 * Creates a description for a debug adapter based on an executable program.
		 *
		 * @param command The command or executable path that implements the debug adapter.
		 * @param args Optional arguments to be passed to the command or executable.
		 * @param options Optional options to be used when starting the command or executable.
		 */
		constructor(command: string, args?: string[], options?: DebugAdapterExecutableOptions);

		/**
		 * The command or path of the debug adapter executable.
		 * A command must be either an absolute path of an executable or the name of an command to be looked up via the PATH environment variable.
		 * The special value 'node' will be mapped to VS Code's built-in Node.js runtime.
		 */
		readonly command: string;

		/**
		 * The arguments passed to the debug adapter executable. Defaults to an empty array.
		 */
		readonly args: string[];

		/**
		 * Optional options to be used when the debug adapter is started.
		 * Defaults to undefined.
		 */
		readonly options?: DebugAdapterExecutableOptions;
	}

	/**
	 * Options for a debug adapter executable.
	 */
	export interface DebugAdapterExecutableOptions {

		/**
		 * The additional environment of the executed program or shell. If omitted
		 * the parent process' environment is used. If provided it is merged with
		 * the parent process' environment.
		 */
		env?: { [key: string]: string };

		/**
		 * The current working directory for the executed debug adapter.
		 */
		cwd?: string;
	}

	/**
	 * Represents a debug adapter running as a socket based server.
	 */
	export class DebugAdapterServer {

		/**
		 * The port.
		 */
		readonly port: number;

		/**
		 * The host.
		 */
		readonly host?: string;

		/**
		 * Create a description for a debug adapter running as a socket based server.
		 */
		constructor(port: number, host?: string);
	}

	export type DebugAdapterDescriptor = DebugAdapterExecutable | DebugAdapterServer;

	export interface DebugAdapterDescriptorFactory {
		/**
		 * 'createDebugAdapterDescriptor' is called at the start of a debug session to provide details about the debug adapter to use.
		 * These details must be returned as objects of type [DebugAdapterDescriptor](#DebugAdapterDescriptor).
		 * Currently two types of debug adapters are supported:
		 * - a debug adapter executable is specified as a command path and arguments (see [DebugAdapterExecutable](#DebugAdapterExecutable)),
		 * - a debug adapter server reachable via a communication port (see [DebugAdapterServer](#DebugAdapterServer)).
		 * If the method is not implemented the default behavior is this:
		 *   createDebugAdapter(session: DebugSession, executable: DebugAdapterExecutable) {
		 *      if (typeof session.configuration.debugServer === 'number') {
		 *         return new DebugAdapterServer(session.configuration.debugServer);
		 *      }
		 *      return executable;
		 *   }
		 * @param session The [debug session](#DebugSession) for which the debug adapter will be used.
		 * @param executable The debug adapter's executable information as specified in the package.json (or undefined if no such information exists).
		 * @return a [debug adapter descriptor](#DebugAdapterDescriptor) or undefined.
		 */
		createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor>;
	}

	/**
	 * A Debug Adapter Tracker is a means to track the communication between VS Code and a Debug Adapter.
	 */
	export interface DebugAdapterTracker {
		/**
		 * A session with the debug adapter is about to be started.
		 */
		onWillStartSession?(): void;
		/**
		 * The debug adapter is about to receive a Debug Adapter Protocol message from VS Code.
		 */
		onWillReceiveMessage?(message: any): void;
		/**
		 * The debug adapter has sent a Debug Adapter Protocol message to VS Code.
		 */
		onDidSendMessage?(message: any): void;
		/**
		 * The debug adapter session is about to be stopped.
		 */
		onWillStopSession?(): void;
		/**
		 * An error with the debug adapter has occurred.
		 */
		onError?(error: Error): void;
		/**
		 * The debug adapter has exited with the given exit code or signal.
		 */
		onExit?(code: number | undefined, signal: string | undefined): void;
	}

	export interface DebugAdapterTrackerFactory {
		/**
		 * The method 'createDebugAdapterTracker' is called at the start of a debug session in order
		 * to return a "tracker" object that provides read-access to the communication between VS Code and a debug adapter.
		 *
		 * @param session The [debug session](#DebugSession) for which the debug adapter tracker will be used.
		 * @return A [debug adapter tracker](#DebugAdapterTracker) or undefined.
		 */
		createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker>;
	}

	/**
	 * Represents the debug console.
	 */
	export interface DebugConsole {
		/**
		 * Append the given value to the debug console.
		 *
		 * @param value A string, falsy values will not be printed.
		 */
		append(value: string): void;

		/**
		 * Append the given value and a line feed character
		 * to the debug console.
		 *
		 * @param value A string, falsy values will be printed.
		 */
		appendLine(value: string): void;
	}

	/**
	 * An event describing the changes to the set of [breakpoints](#Breakpoint).
	 */
	export interface BreakpointsChangeEvent {
		/**
		 * Added breakpoints.
		 */
		readonly added: ReadonlyArray<Breakpoint>;

		/**
		 * Removed breakpoints.
		 */
		readonly removed: ReadonlyArray<Breakpoint>;

		/**
		 * Changed breakpoints.
		 */
		readonly changed: ReadonlyArray<Breakpoint>;
	}

	/**
	 * The base class of all breakpoint types.
	 */
	export class Breakpoint {
		/**
		 * The unique ID of the breakpoint.
		 */
		readonly id: string;
		/**
		 * Is breakpoint enabled.
		 */
		readonly enabled: boolean;
		/**
		 * An optional expression for conditional breakpoints.
		 */
		readonly condition?: string;
		/**
		 * An optional expression that controls how many hits of the breakpoint are ignored.
		 */
		readonly hitCondition?: string;
		/**
		 * An optional message that gets logged when this breakpoint is hit. Embedded expressions within {} are interpolated by the debug adapter.
		 */
		readonly logMessage?: string;

		protected constructor(enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string);
	}

	/**
	 * A breakpoint specified by a source location.
	 */
	export class SourceBreakpoint extends Breakpoint {
		/**
		 * The source and line position of this breakpoint.
		 */
		readonly location: Location;

		/**
		 * Create a new breakpoint for a source location.
		 */
		constructor(location: Location, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string);
	}

	/**
	 * A breakpoint specified by a function name.
	 */
	export class FunctionBreakpoint extends Breakpoint {
		/**
		 * The name of the function to which this breakpoint is attached.
		 */
		readonly functionName: string;

		/**
		 * Create a new function breakpoint.
		 */
		constructor(functionName: string, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string);
	}

	/**
	 * Namespace for debug functionality.
	 */
	export namespace debug {

		/**
		 * The currently active [debug session](#DebugSession) or `undefined`. The active debug session is the one
		 * represented by the debug action floating window or the one currently shown in the drop down menu of the debug action floating window.
		 * If no debug session is active, the value is `undefined`.
		 */
		export let activeDebugSession: DebugSession | undefined;

		/**
		 * The currently active [debug console](#DebugConsole).
		 * If no debug session is active, output sent to the debug console is not shown.
		 */
		export let activeDebugConsole: DebugConsole;

		/**
		 * List of breakpoints.
		 */
		export let breakpoints: Breakpoint[];

		/**
		 * An [event](#Event) which fires when the [active debug session](#debug.activeDebugSession)
		 * has changed. *Note* that the event also fires when the active debug session changes
		 * to `undefined`.
		 */
		export const onDidChangeActiveDebugSession: Event<DebugSession | undefined>;

		/**
		 * An [event](#Event) which fires when a new [debug session](#DebugSession) has been started.
		 */
		export const onDidStartDebugSession: Event<DebugSession>;

		/**
		 * An [event](#Event) which fires when a custom DAP event is received from the [debug session](#DebugSession).
		 */
		export const onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent>;

		/**
		 * An [event](#Event) which fires when a [debug session](#DebugSession) has terminated.
		 */
		export const onDidTerminateDebugSession: Event<DebugSession>;

		/**
		 * An [event](#Event) that is emitted when the set of breakpoints is added, removed, or changed.
		 */
		export const onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;

		/**
		 * Register a [debug configuration provider](#DebugConfigurationProvider) for a specific debug type.
		 * More than one provider can be registered for the same type.
		 *
		 * @param type The debug type for which the provider is registered.
		 * @param provider The [debug configuration provider](#DebugConfigurationProvider) to register.
		 * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
		 */
		export function registerDebugConfigurationProvider(debugType: string, provider: DebugConfigurationProvider): Disposable;

		/**
		 * Register a [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) for a specific debug type.
		 * An extension is only allowed to register a DebugAdapterDescriptorFactory for the debug type(s) defined by the extension. Otherwise an error is thrown.
		 * Registering more than one DebugAdapterDescriptorFactory for a debug type results in an error.
		 *
		 * @param debugType The debug type for which the factory is registered.
		 * @param factory The [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) to register.
		 * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
		 */
		export function registerDebugAdapterDescriptorFactory(debugType: string, factory: DebugAdapterDescriptorFactory): Disposable;

		/**
		 * Register a debug adapter tracker factory for the given debug type.
		 *
		 * @param debugType The debug type for which the factory is registered or '*' for matching all debug types.
		 * @param factory The [debug adapter tracker factory](#DebugAdapterTrackerFactory) to register.
		 * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
		 */
		export function registerDebugAdapterTrackerFactory(debugType: string, factory: DebugAdapterTrackerFactory): Disposable;

		/**
		 * Start debugging by using either a named launch or named compound configuration,
		 * or by directly passing a [DebugConfiguration](#DebugConfiguration).
		 * The named configurations are looked up in '.vscode/launch.json' found in the given folder.
		 * Before debugging starts, all unsaved files are saved and the launch configurations are brought up-to-date.
		 * Folder specific variables used in the configuration (e.g. '${workspaceFolder}') are resolved against the given folder.
		 * @param folder The [workspace folder](#WorkspaceFolder) for looking up named configurations and resolving variables or `undefined` for a non-folder setup.
		 * @param nameOrConfiguration Either the name of a debug or compound configuration or a [DebugConfiguration](#DebugConfiguration) object.
		 * @param parent If specified the newly created debug session is registered as a "child" session of a "parent" debug session.
		 * @return A thenable that resolves when debugging could be successfully started.
		 */
		export function startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, parentSession?: DebugSession): Thenable<boolean>;

		/**
		 * Add breakpoints.
		 * @param breakpoints The breakpoints to add.
		*/
		export function addBreakpoints(breakpoints: Breakpoint[]): void;

		/**
		 * Remove breakpoints.
		 * @param breakpoints The breakpoints to remove.
		 */
		export function removeBreakpoints(breakpoints: Breakpoint[]): void;
	}

	//#region Comments

	/**
	 * Collapsible state of a [comment thread](#CommentThread)
	 */
	export enum CommentThreadCollapsibleState {
		/**
		 * Determines an item is collapsed
		 */
		Collapsed = 0,

		/**
		 * Determines an item is expanded
		 */
		Expanded = 1,
	}

	/**
	 * Comment mode of a [comment](#Comment)
	 */
	export enum CommentMode {
		/**
		 * Displays the comment editor
		 */
		Editing = 0,

		/**
		 * Displays the preview of the comment
		 */
		Preview = 1,
	}

	/**
	 * A collection of [comments](#Comment) representing a conversation at a particular range in a document.
	 */
	export interface CommentThread {
		/**
		 * The uri of the document the thread has been created on.
		 */
		readonly uri: Uri;

		/**
		 * The range the comment thread is located within the document. The thread icon will be shown
		 * at the first line of the range.
		 */
		range: Range;

		/**
		 * The ordered comments of the thread.
		 */
		comments: ReadonlyArray<Comment>;

		/**
		 * Whether the thread should be collapsed or expanded when opening the document.
		 * Defaults to Collapsed.
		 */
		collapsibleState: CommentThreadCollapsibleState;

		/**
		 * Context value of the comment thread. This can be used to contribute thread specific actions.
		 * For example, a comment thread is given a context value as `editable`. When contributing actions to `comments/commentThread/title`
		 * using `menus` extension point, you can specify context value for key `commentThread` in `when` expression like `commentThread == editable`.
		 * ```
		 *	"contributes": {
		 *		"menus": {
		 *			"comments/commentThread/title": [
		 *				{
		 *					"command": "extension.deleteCommentThread",
		 *					"when": "commentThread == editable"
		 *				}
		 *			]
		 *		}
		 *	}
		 * ```
		 * This will show action `extension.deleteCommentThread` only for comment threads with `contextValue` is `editable`.
		 */
		contextValue?: string;

		/**
		 * The optional human-readable label describing the [Comment Thread](#CommentThread)
		 */
		label?: string;

		/**
		 * Dispose this comment thread.
		 *
		 * Once disposed, this comment thread will be removed from visible editors and Comment Panel when approriate.
		 */
		dispose(): void;
	}

	/**
	 * Author information of a [comment](#Comment)
	 */
	export interface CommentAuthorInformation {
		/**
		 * The display name of the author of the comment
		 */
		name: string;

		/**
		 * The optional icon path for the author
		 */
		iconPath?: Uri;
	}

	/**
	 * Reactions of a [comment](#Comment)
	 */
	export interface CommentReaction {
		/**
		 * The human-readable label for the reaction
		 */
		readonly label: string;

		/**
		 * Icon for the reaction shown in UI.
		 */
		readonly iconPath: string | Uri;

		/**
		 * The number of users who have reacted to this reaction
		 */
		readonly count: number;

		/**
		 * Whether the [author](CommentAuthorInformation) of the comment has reacted to this reaction
		 */
		readonly authorHasReacted: boolean;
	}

	/**
	 * A comment is displayed within the editor or the Comments Panel, depending on how it is provided.
	 */
	export interface Comment {
		/**
		 * The human-readable comment body
		 */
		body: string | MarkdownString;

		/**
		 * [Comment mode](#CommentMode) of the comment
		 */
		mode: CommentMode;

		/**
		 * The [author information](#CommentAuthorInformation) of the comment
		 */
		author: CommentAuthorInformation;

		/**
		 * Context value of the comment. This can be used to contribute comment specific actions.
		 * For example, a comment is given a context value as `editable`. When contributing actions to `comments/comment/title`
		 * using `menus` extension point, you can specify context value for key `comment` in `when` expression like `comment == editable`.
		 * ```json
		 *	"contributes": {
		 *		"menus": {
		 *			"comments/comment/title": [
		 *				{
		 *					"command": "extension.deleteComment",
		 *					"when": "comment == editable"
		 *				}
		 *			]
		 *		}
		 *	}
		 * ```
		 * This will show action `extension.deleteComment` only for comments with `contextValue` is `editable`.
		 */
		contextValue?: string;

		/**
		 * Optional reactions of the [comment](#Comment)
		 */
		reactions?: CommentReaction[];

		/**
		 * Optional label describing the [Comment](#Comment)
		 * Label will be rendered next to authorName if exists.
		 */
		label?: string;
	}

	/**
	 * Command argument for actions registered in `comments/commentThread/context`.
	 */
	export interface CommentReply {
		/**
		 * The active [comment thread](#CommentThread)
		 */
		thread: CommentThread;

		/**
		 * The value in the comment editor
		 */
		text: string;
	}

	/**
	 * Commenting range provider for a [comment controller](#CommentController).
	 */
	export interface CommentingRangeProvider {
		/**
		 * Provide a list of ranges which allow new comment threads creation or null for a given document
		 */
		provideCommentingRanges(document: TextDocument, token: CancellationToken): ProviderResult<Range[]>;
	}

	/**
	 * A comment controller is able to provide [comments](#CommentThread) support to the editor and
	 * provide users various ways to interact with comments.
	 */
	export interface CommentController {
		/**
		 * The id of this comment controller.
		 */
		readonly id: string;

		/**
		 * The human-readable label of this comment controller.
		 */
		readonly label: string;

		/**
		 * Optional commenting range provider. Provide a list [ranges](#Range) which support commenting to any given resource uri.
		 *
		 * If not provided, users can leave comments in any document opened in the editor.
		 */
		commentingRangeProvider?: CommentingRangeProvider;

		/**
		 * Create a [comment thread](#CommentThread). The comment thread will be displayed in visible text editors (if the resource matches)
		 * and Comments Panel once created.
		 *
		 * @param uri The uri of the document the thread has been created on.
		 * @param range The range the comment thread is located within the document.
		 * @param comments The ordered comments of the thread.
		 */
		createCommentThread(uri: Uri, range: Range, comments: Comment[]): CommentThread;

		/**
		 * Optional reaction handler for creating and deleting reactions on a [comment](#Comment).
		 */
		reactionHandler?: (comment: Comment, reaction: CommentReaction) => Promise<void>;

		/**
		 * Dispose this comment controller.
		 *
		 * Once disposed, all [comment threads](#CommentThread) created by this comment controller will also be removed from the editor
		 * and Comments Panel.
		 */
		dispose(): void;
	}

	namespace comments {
		/**
		 * Creates a new [comment controller](#CommentController) instance.
		 *
		 * @param id An `id` for the comment controller.
		 * @param label A human-readable string for the comment controller.
		 * @return An instance of [comment controller](#CommentController).
		 */
		export function createCommentController(id: string, label: string): CommentController;
	}

	//#endregion
}

