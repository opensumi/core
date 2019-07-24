declare module 'vscode' {

	/**
 * Thenable is a common denominator between ES6 promises, Q, jquery.Deferred, WinJS.Promise,
 * and others. This API makes no assumption about what promise library is being used which
 * enables reusing existing code without migrating to a specific promise implementation. Still,
 * we recommend the use of native promises which are available in this editor.
 */
interface Thenable<T> {
	/**
	* Attaches callbacks for the resolution and/or rejection of the Promise.
	* @param onfulfilled The callback to execute when the Promise is resolved.
	* @param onrejected The callback to execute when the Promise is rejected.
	* @returns A Promise for the completion of which ever callback is executed.
	*/
	then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
	then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => void): Thenable<TResult>;
}

	/**
	 * Represents a line of text, such as a line of source code.
	 *
	 * TextLine objects are __immutable__. When a [document](#TextDocument) changes,
	 * previously retrieved lines will not represent the latest state.
	 */
	export interface TextLine {

		/**
		 * The zero-based line number.
		 */
		readonly lineNumber: number;

		/**
		 * The text of this line without the line separator characters.
		 */
		readonly text: string;

		/**
		 * The range this line covers without the line separator characters.
		 */
		readonly range: Range;

		/**
		 * The range this line covers with the line separator characters.
		 */
		readonly rangeIncludingLineBreak: Range;

		/**
		 * The offset of the first character which is not a whitespace character as defined
		 * by `/\s/`. **Note** that if a line is all whitespace the length of the line is returned.
		 */
		readonly firstNonWhitespaceCharacterIndex: number;

		/**
		 * Whether this line is whitespace only, shorthand
		 * for [TextLine.firstNonWhitespaceCharacterIndex](#TextLine.firstNonWhitespaceCharacterIndex) === [TextLine.text.length](#TextLine.text).
		 */
		readonly isEmptyOrWhitespace: boolean;
	}
	/**
	 * Represents a text document, such as a source file. Text documents have
	 * [lines](#TextLine) and knowledge about an underlying resource like a file.
	 */
	export interface TextDocument {

		/**
		 * The associated uri for this document.
		 *
		 * *Note* that most documents use the `file`-scheme, which means they are files on disk. However, **not** all documents are
		 * saved on disk and therefore the `scheme` must be checked before trying to access the underlying file or siblings on disk.
		 *
		 * @see [FileSystemProvider](#FileSystemProvider)
		 * @see [TextDocumentContentProvider](#TextDocumentContentProvider)
		 */
		readonly uri: Uri;

		/**
		 * The file system path of the associated resource. Shorthand
		 * notation for [TextDocument.uri.fsPath](#TextDocument.uri). Independent of the uri scheme.
		 */
		readonly fileName: string;

		/**
		 * Is this document representing an untitled file which has never been saved yet. *Note* that
		 * this does not mean the document will be saved to disk, use [`uri.scheme`](#Uri.scheme)
		 * to figure out where a document will be [saved](#FileSystemProvider), e.g. `file`, `ftp` etc.
		 */
		readonly isUntitled: boolean;

		/**
		 * The identifier of the language associated with this document.
		 */
		readonly languageId: string;

		/**
		 * The version number of this document (it will strictly increase after each
		 * change, including undo/redo).
		 */
		readonly version: number;

		/**
		 * `true` if there are unpersisted changes.
		 */
		readonly isDirty: boolean;

		/**
		 * `true` if the document have been closed. A closed document isn't synchronized anymore
		 * and won't be re-used when the same resource is opened again.
		 */
		readonly isClosed: boolean;

		/**
		 * Save the underlying file.
		 *
		 * @return A promise that will resolve to true when the file
		 * has been saved. If the file was not dirty or the save failed,
		 * will return false.
		 */
		save(): Thenable<boolean>;

		/**
		 * The [end of line](#EndOfLine) sequence that is predominately
		 * used in this document.
		 */
		readonly eol: EndOfLine;

		/**
		 * The number of lines in this document.
		 */
		readonly lineCount: number;

		/**
		 * Returns a text line denoted by the line number. Note
		 * that the returned object is *not* live and changes to the
		 * document are not reflected.
		 *
		 * @param line A line number in [0, lineCount).
		 * @return A [line](#TextLine).
		 */
		lineAt(line: number): TextLine;

		/**
		 * Returns a text line denoted by the position. Note
		 * that the returned object is *not* live and changes to the
		 * document are not reflected.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @see [TextDocument.lineAt](#TextDocument.lineAt)
		 * @param position A position.
		 * @return A [line](#TextLine).
		 */
		lineAt(position: Position): TextLine;

		/**
		 * Converts the position to a zero-based offset.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @param position A position.
		 * @return A valid zero-based offset.
		 */
		offsetAt(position: Position): number;

		/**
		 * Converts a zero-based offset to a position.
		 *
		 * @param offset A zero-based offset.
		 * @return A valid [position](#Position).
		 */
		positionAt(offset: number): Position;

		/**
		 * Get the text of this document. A substring can be retrieved by providing
		 * a range. The range will be [adjusted](#TextDocument.validateRange).
		 *
		 * @param range Include only the text included by the range.
		 * @return The text inside the provided range or the entire text.
		 */
		getText(range?: Range): string;

		/**
		 * Get a word-range at the given position. By default words are defined by
		 * common separators, like space, -, _, etc. In addition, per language custom
		 * [word definitions](#LanguageConfiguration.wordPattern) can be defined. It
		 * is also possible to provide a custom regular expression.
		 *
		 * * *Note 1:* A custom regular expression must not match the empty string and
		 * if it does, it will be ignored.
		 * * *Note 2:* A custom regular expression will fail to match multiline strings
		 * and in the name of speed regular expressions should not match words with
		 * spaces. Use [`TextLine.text`](#TextLine.text) for more complex, non-wordy, scenarios.
		 *
		 * The position will be [adjusted](#TextDocument.validatePosition).
		 *
		 * @param position A position.
		 * @param regex Optional regular expression that describes what a word is.
		 * @return A range spanning a word, or `undefined`.
		 */
		getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;

		/**
		 * Ensure a range is completely contained in this document.
		 *
		 * @param range A range.
		 * @return The given range or a new, adjusted range.
		 */
		validateRange(range: Range): Range;

		/**
		 * Ensure a position is contained in the range of this document.
		 *
		 * @param position A position.
		 * @return The given position or a new, adjusted position.
		 */
		validatePosition(position: Position): Position;
	}

	/**
	 * Represents a text selection in an editor.
	 */
	export class Selection extends Range {

		/**
		 * The position at which the selection starts.
		 * This position might be before or after [active](#Selection.active).
		 */
		anchor: Position;

		/**
		 * The position of the cursor.
		 * This position might be before or after [anchor](#Selection.anchor).
		 */
		active: Position;

		/**
		 * Create a selection from two positions.
		 *
		 * @param anchor A position.
		 * @param active A position.
		 */
		constructor(anchor: Position, active: Position);

		/**
		 * Create a selection from four coordinates.
		 *
		 * @param anchorLine A zero-based line value.
		 * @param anchorCharacter A zero-based character value.
		 * @param activeLine A zero-based line value.
		 * @param activeCharacter A zero-based character value.
		 */
		constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);

		/**
		 * A selection is reversed if [active](#Selection.active).isBefore([anchor](#Selection.anchor)).
		 */
		isReversed: boolean;
	}

	/**
	 * A complex edit that will be applied in one transaction on a TextEditor.
	 * This holds a description of the edits and if the edits are valid (i.e. no overlapping regions, document was not changed in the meantime, etc.)
	 * they can be applied on a [document](#TextDocument) associated with a [text editor](#TextEditor).
	 *
	 */

	/**
	 * A universal resource identifier representing either a file on disk
	 * or another resource, like untitled resources.
	 */
	export class Uri {

		/**
		 * Create an URI from a string, e.g. `http://www.msft.com/some/path`,
		 * `file:///usr/home`, or `scheme:with/path`.
		 *
		 * *Note* that for a while uris without a `scheme` were accepted. That is not correct
		 * as all uris should have a scheme. To avoid breakage of existing code the optional
		 * `strict`-argument has been added. We *strongly* advise to use it, e.g. `Uri.parse('my:uri', true)`
		 *
		 * @see [Uri.toString](#Uri.toString)
		 * @param value The string value of an Uri.
		 * @param strict Throw an error when `value` is empty or when no `scheme` can be parsed.
		 * @return A new Uri instance.
		 */
		static parse(value: string, strict?: boolean): Uri;

		/**
		 * Create an URI from a file system path. The [scheme](#Uri.scheme)
		 * will be `file`.
		 *
		 * The *difference* between `Uri#parse` and `Uri#file` is that the latter treats the argument
		 * as path, not as stringified-uri. E.g. `Uri.file(path)` is *not* the same as
		 * `Uri.parse('file://' + path)` because the path might contain characters that are
		 * interpreted (# and ?). See the following sample:
		 * ```ts
		const good = URI.file('/coding/c#/project1');
		good.scheme === 'file';
		good.path === '/coding/c#/project1';
		good.fragment === '';

		const bad = URI.parse('file://' + '/coding/c#/project1');
		bad.scheme === 'file';
		bad.path === '/coding/c'; // path is now broken
		bad.fragment === '/project1';
		```
		 *
		 * @param path A file system or UNC path.
		 * @return A new Uri instance.
		 */
		static file(path: string): Uri;

		/**
		 * Use the `file` and `parse` factory functions to create new `Uri` objects.
		 */
		private constructor(scheme: string, authority: string, path: string, query: string, fragment: string);

		/**
		 * Scheme is the `http` part of `http://www.msft.com/some/path?query#fragment`.
		 * The part before the first colon.
		 */
		readonly scheme: string;

		/**
		 * Authority is the `www.msft.com` part of `http://www.msft.com/some/path?query#fragment`.
		 * The part between the first double slashes and the next slash.
		 */
		readonly authority: string;

		/**
		 * Path is the `/some/path` part of `http://www.msft.com/some/path?query#fragment`.
		 */
		readonly path: string;

		/**
		 * Query is the `query` part of `http://www.msft.com/some/path?query#fragment`.
		 */
		readonly query: string;

		/**
		 * Fragment is the `fragment` part of `http://www.msft.com/some/path?query#fragment`.
		 */
		readonly fragment: string;

		/**
		 * The string representing the corresponding file system path of this Uri.
		 *
		 * Will handle UNC paths and normalize windows drive letters to lower-case. Also
		 * uses the platform specific path separator.
		 *
		 * * Will *not* validate the path for invalid characters and semantics.
		 * * Will *not* look at the scheme of this Uri.
		 * * The resulting string shall *not* be used for display purposes but
		 * for disk operations, like `readFile` et al.
		 *
		 * The *difference* to the [`path`](#Uri.path)-property is the use of the platform specific
		 * path separator and the handling of UNC paths. The sample below outlines the difference:
		 * ```ts
		const u = URI.parse('file://server/c$/folder/file.txt')
		u.authority === 'server'
		u.path === '/shares/c$/file.txt'
		u.fsPath === '\\server\c$\folder\file.txt'
		```
		 */
		readonly fsPath: string;

		/**
		 * Derive a new Uri from this Uri.
		 *
		 * ```ts
		 * let file = Uri.parse('before:some/file/path');
		 * let other = file.with({ scheme: 'after' });
		 * assert.ok(other.toString() === 'after:some/file/path');
		 * ```
		 *
		 * @param change An object that describes a change to this Uri. To unset components use `null` or
		 *  the empty string.
		 * @return A new Uri that reflects the given change. Will return `this` Uri if the change
		 *  is not changing anything.
		 */
		with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;

		/**
		 * Returns a string representation of this Uri. The representation and normalization
		 * of a URI depends on the scheme.
		 *
		 * * The resulting string can be safely used with [Uri.parse](#Uri.parse).
		 * * The resulting string shall *not* be used for display purposes.
		 *
		 * *Note* that the implementation will encode _aggressive_ which often leads to unexpected,
		 * but not incorrect, results. For instance, colons are encoded to `%3A` which might be unexpected
		 * in file-uri. Also `&` and `=` will be encoded which might be unexpected for http-uris. For stability
		 * reasons this cannot be changed anymore. If you suffer from too aggressive encoding you should use
		 * the `skipEncoding`-argument: `uri.toString(true)`.
		 *
		 * @param skipEncoding Do not percentage-encode the result, defaults to `false`. Note that
		 *	the `#` and `?` characters occurring in the path will always be encoded.
		 * @returns A string representation of this Uri.
		 */
		toString(skipEncoding?: boolean): string;

		/**
		 * Returns a JSON representation of this Uri.
		 *
		 * @return An object.
		 */
		toJSON(): any;
	}

		/**
	 * Represents a typed event.
	 *
	 * A function that represents an event to which you subscribe by calling it with
	 * a listener function as argument.
	 *
	 * @sample `item.onDidChange(function(event) { console.log("Event happened: " + event); });`
	 */
	export type Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => Disposable;

	/**
	 * An event emitter can be used to create and manage an [event](#Event) for others
	 * to subscribe to. One emitter always owns one event.
	 *
	 * Use this class if you want to provide event from within your extension, for instance
	 * inside a [TextDocumentContentProvider](#TextDocumentContentProvider) or when providing
	 * API to other extensions.
	 */
	export class EventEmitter<T> {

		/**
		 * The event listeners can subscribe to.
		 */
		event: Event<T>;

		/**
		 * Notify all subscribers of the [event](#EventEmitter.event). Failure
		 * of one or more listener will not fail this function call.
		 *
		 * @param data The event object.
		 */
		fire(data?: T): void;

		/**
		 * Dispose this object and free resources.
		 */
		dispose(): void;
	}

	/**
	 * A cancellation token is passed to an asynchronous or long running
	 * operation to request cancellation, like cancelling a request
	 * for completion items because the user continued to type.
	 *
	 * To get an instance of a `CancellationToken` use a
	 * [CancellationTokenSource](#CancellationTokenSource).
	 */
	export interface CancellationToken {

		/**
		 * Is `true` when the token has been cancelled, `false` otherwise.
		 */
		isCancellationRequested: boolean;

		/**
		 * An [event](#Event) which fires upon cancellation.
		 */
		onCancellationRequested: Event<any>;
	}

	/**
	 * A cancellation source creates and controls a [cancellation token](#CancellationToken).
	 * @墨蛰
	 *
	 */
	export class CancellationTokenSource {

		/**
		 * The cancellation token of this source.
		 */
		token: CancellationToken;

		/**
		 * Signal cancellation on the token.
		 */
		cancel(): void;

		/**
		 * Dispose object and free resources.
		 */
		dispose(): void;
	}

	/**
	 * An event describing a transactional [document](#TextDocument) change.
	 */
	export interface TextDocumentChangeEvent {

		/**
		 * The affected document.
		 */
		readonly document: TextDocument;

		/**
		 * An array of content changes.
		 */
		readonly contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>;
	}
	
	/**
	 * Represents a related message and source code location for a diagnostic. This should be
	 * used to point to code locations that cause or related to a diagnostics, e.g. when duplicating
	 * a symbol in a scope.
	 * @寻壑
	 */
	export class DiagnosticRelatedInformation {

		/**
		 * The location of this related diagnostic information.
		 */
		location: Location;

		/**
		 * The message of this related diagnostic information.
		 */
		message: string;

		/**
		 * Creates a new related diagnostic information object.
		 *
		 * @param location The location.
		 * @param message The message.
		 */
		constructor(location: Location, message: string);
	}

	/**
	 * Additional metadata about the type of a diagnostic.
	 */
	export enum DiagnosticTag {
		/**
		 * Unused or unnecessary code.
		 *
		 * Diagnostics with this tag are rendered faded out. The amount of fading
		 * is controlled by the `"editorUnnecessaryCode.opacity"` theme color. For
		 * example, `"editorUnnecessaryCode.opacity": "#000000c0"` will render the
		 * code with 75% opacity. For high contrast themes, use the
		 * `"editorUnnecessaryCode.border"` theme color to underline unnecessary code
		 * instead of fading it out.
		 */
		Unnecessary = 1,
	}

	/**
	 * Represents the severity of diagnostics.
	 */
	export enum DiagnosticSeverity {

		/**
		 * Something not allowed by the rules of a language or other means.
		 */
		Error = 0,

		/**
		 * Something suspicious but allowed.
		 */
		Warning = 1,

		/**
		 * Something to inform about but not a problem.
		 */
		Information = 2,

		/**
		 * Something to hint to a better way of doing it, like proposing
		 * a refactoring.
		 */
		Hint = 3,
	}

	/**
	 * Represents a diagnostic, such as a compiler error or warning. Diagnostic objects
	 * are only valid in the scope of a file.
	 * @寻壑
	 */
	export class Diagnostic {

		/**
		 * The range to which this diagnostic applies.
		 */
		range: Range;

		/**
		 * The human-readable message.
		 */
		message: string;

		/**
		 * The severity, default is [error](#DiagnosticSeverity.Error).
		 */
		severity: DiagnosticSeverity;

		/**
		 * A human-readable string describing the source of this
		 * diagnostic, e.g. 'typescript' or 'super lint'.
		 */
		source?: string;

		/**
		 * A code or identifier for this diagnostic.
		 * Should be used for later processing, e.g. when providing [code actions](#CodeActionContext).
		 */
		code?: string | number;

		/**
		 * An array of related diagnostic information, e.g. when symbol-names within
		 * a scope collide all definitions can be marked via this property.
		 */
		relatedInformation?: DiagnosticRelatedInformation[];

		/**
		 * Additional metadata about the diagnostic.
		 */
		tags?: DiagnosticTag[];

		/**
		 * Creates a new diagnostic object.
		 *
		 * @param range The range to which this diagnostic applies.
		 * @param message The human-readable message.
		 * @param severity The severity, default is [error](#DiagnosticSeverity.Error).
		 */
		constructor(range: Range, message: string, severity?: DiagnosticSeverity);
	}
  /**
	 * Represents a type which can release resources, such
	 * as event listening or a timer.
	 */
	export class Disposable {

		/**
		 * Combine many disposable-likes into one. Use this method
		 * when having objects with a dispose function which are not
		 * instances of Disposable.
		 *
		 * @param disposableLikes Objects that have at least a `dispose`-function member.
		 * @return Returns a new disposable which, upon dispose, will
		 * dispose all provided disposables.
		 */
		static from(...disposableLikes: { dispose: () => any }[]): Disposable;

		/**
		 * Creates a new Disposable calling the provided function
		 * on dispose.
		 * @param callOnDispose Function that disposes something.
		 */
		constructor(callOnDispose: Function);

		/**
		 * Dispose this object.
		 */
		dispose(): any;
	}

	/**
	 * Represents an extension.
	 *
	 * To get an instance of an `Extension` use [getExtension](#extensions.getExtension).
	 */
	export interface Extension<T> {

		/**
		 * The canonical extension identifier in the form of: `publisher.name`.
		 */
		readonly id: string;

		/**
		 * The absolute file path of the directory containing this extension.
		 */
		readonly extensionPath: string;

		/**
		 * `true` if the extension has been activated.
		 */
		readonly isActive: boolean;

		/**
		 * The parsed contents of the extension's package.json.
		 */
		readonly packageJSON: any;

		/**
		 * The extension kind describes if an extension runs where the UI runs
		 * or if an extension runs where the remote extension host runs. The extension kind
		 * if defined in the `package.json` file of extensions but can also be refined
		 * via the the `remote.extensionKind`-setting. When no remote extension host exists,
		 * the value is [`ExtensionKind.UI`](#ExtensionKind.UI).
		 */
		extensionKind: ExtensionKind;

		/**
		 * The public API exported by this extension. It is an invalid action
		 * to access this field before this extension has been activated.
		 */
		readonly exports: T;

		/**
		 * Activates this extension and returns its public API.
		 *
		 * @return A promise that will resolve when this extension has been activated.
		 */
		activate(): Thenable<T>;
	}

	/**
	 * An extension context is a collection of utilities private to an
	 * extension.
	 *
	 * An instance of an `ExtensionContext` is provided as the first
	 * parameter to the `activate`-call of an extension.
	 */
	export interface ExtensionContext {

		/**
		 * An array to which disposables can be added. When this
		 * extension is deactivated the disposables will be disposed.
		 */
		readonly subscriptions: { dispose(): any }[];

		/**
		 * The absolute file path of the directory containing the extension.
		 */
		readonly extensionPath: string;

		/**
		 * Get the absolute path of a resource contained in the extension.
		 *
		 * @param relativePath A relative path to a resource contained in the extension.
		 * @return The absolute path of the resource.
		 */
		asAbsolutePath(relativePath: string): string;
	}

	/**
	 * A memento represents a storage utility. It can store and retrieve
	 * values.
	 */
	export interface Memento {

		/**
		 * Return a value.
		 *
		 * @param key A string.
		 * @return The stored value or `undefined`.
		 */
		get<T>(key: string): T | undefined;

		/**
		 * Return a value.
		 *
		 * @param key A string.
		 * @param defaultValue A value that should be returned when there is no
		 * value (`undefined`) with the given key.
		 * @return The stored value or the defaultValue.
		 */
		get<T>(key: string, defaultValue: T): T;

		/**
		 * Store a value. The value must be JSON-stringifyable.
		 *
		 * @param key A string.
		 * @param value A value. MUST not contain cyclic references.
		 */
		update(key: string, value: any): Thenable<void>;
  }

	export interface Terminal {

		/**
		 * The name of the terminal.
		 */
		readonly name: string;

		/**
		 * The process ID of the shell process.
		 */
		readonly processId: Thenable<number>;

		/**
		 * Send text to the terminal. The text is written to the stdin of the underlying pty process
		 * (shell) of the terminal.
		 *
		 * @param text The text to send.
		 * @param addNewLine Whether to add a new line to the text being sent, this is normally
		 * required to run a command in the terminal. The character(s) added are \n or \r\n
		 * depending on the platform. This defaults to `true`.
		 */
		sendText(text: string, addNewLine?: boolean): void;

		/**
		 * Show the terminal panel and reveal this terminal in the UI.
		 *
		 * @param preserveFocus When `true` the terminal will not take focus.
		 */
		show(preserveFocus?: boolean): void;

		/**
		 * Hide the terminal panel if this terminal is currently showing.
		 */
		hide(): void;

		/**
		 * Dispose and free associated resources.
		 */
		dispose(): void;
	}

	export interface env {}
}

/**
 * Thenable is a common denominator between ES6 promises, Q, jquery.Deferred, WinJS.Promise,
 * and others. This API makes no assumption about what promise library is being used which
 * enables reusing existing code without migrating to a specific promise implementation. Still,
 * we recommend the use of native promises which are available in this editor.
 */
interface Thenable<T> {
	/**
	* Attaches callbacks for the resolution and/or rejection of the Promise.
	* @param onfulfilled The callback to execute when the Promise is resolved.
	* @param onrejected The callback to execute when the Promise is rejected.
	* @returns A Promise for the completion of which ever callback is executed.
	*/
	then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
	then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => void): Thenable<TResult>;
}
