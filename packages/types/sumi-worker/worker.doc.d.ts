declare module 'kaitian-worker';
declare module 'sumi-worker' {
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
    lineAt(position: Position | number): TextLine;

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

  export namespace workspace {
    /**
     * Opens a document. Will return early if this document is already open. Otherwise
     * the document is loaded and the [didOpen](#workspace.onDidOpenTextDocument)-event fires.
     *
     * The document is denoted by an [uri](#Uri). Depending on the [scheme](#Uri.scheme) the
     * following rules apply:
     * * `file`-scheme: Open a file on disk, will be rejected if the file does not exist or cannot be loaded.
     * * `untitled`-scheme: A new file that should be saved on disk, e.g. `untitled:c:\frodo\new.js`. The language
     * will be derived from the file name.
     * * For all other schemes the registered text document content [providers](#TextDocumentContentProvider) are consulted.
     *
     * *Note* that the lifecycle of the returned document is owned by the editor and not by the extension. That means an
     * [`onDidClose`](#workspace.onDidCloseTextDocument)-event can occur at any time after opening it.
     *
     * @param uri Identifies the resource to open.
     * @return A promise that resolves to a [document](#TextDocument).
     * @Owner 木农
     *
     * A short-hand for `openTextDocument(Uri.file(fileName))`.
     *
     * @see [openTextDocument](#openTextDocument)
     * @param fileName A name of a file on disk.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    export function openTextDocument(fileName: string | Uri): Thenable<TextDocument>;

    /**
     * Opens an untitled text document. The editor will prompt the user for a file
     * path when the document is to be saved. The `options` parameter allows to
     * specify the *language* and/or the *content* of the document.
     *
     * @param options Options to control how the document will be created.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    export function openTextDocument(options?: { language?: string; content?: string; }): Thenable<TextDocument>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is opened or when the language id
     * of a text document [has been changed](#languages.setTextDocumentLanguage).
     *
     * To add an event listener when a visible text document is opened, use the [TextEditor](#TextEditor) events in the
     * [window](#window) namespace. Note that:
     *
     * - The event is emitted before the [document](#TextDocument) is updated in the
     * [active text editor](#window.activeTextEditor)
     * - When a [text document](#TextDocument) is already open (e.g.: open in another [visible text editor](#window.visibleTextEditors)) this event is not emitted
     *
     */
    export const onDidOpenTextDocument: Event<TextDocument>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is disposed or when the language id
     * of a text document [has been changed](#languages.setTextDocumentLanguage).
     *
     * To add an event listener when a visible text document is closed, use the [TextEditor](#TextEditor) events in the
     * [window](#window) namespace. Note that this event is not emitted when a [TextEditor](#TextEditor) is closed
     * but the document remains open in another [visible text editor](#window.visibleTextEditors).
     */
    export const onDidCloseTextDocument: Event<TextDocument>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is changed. This usually happens
     * when the [contents](#TextDocument.getText) changes but also when other things like the
     * [dirty](#TextDocument.isDirty)-state changes.
     */
    export const onDidChangeTextDocument: Event<TextDocumentChangeEvent>;

    /**
     * An event that is emitted when a [text document](#TextDocument) will be saved to disk.
     *
     * *Note 1:* Subscribers can delay saving by registering asynchronous work. For the sake of data integrity the editor
     * might save without firing this event. For instance when shutting down with dirty files.
     *
     * *Note 2:* Subscribers are called sequentially and they can [delay](#TextDocumentWillSaveEvent.waitUntil) saving
     * by registering asynchronous work. Protection against misbehaving listeners is implemented as such:
     *  * there is an overall time budget that all listeners share and if that is exhausted no further listener is called
     *  * listeners that take a long time or produce errors frequently will not be called anymore
     *
     * The current thresholds are 1.5 seconds as overall time budget and a listener can misbehave 3 times before being ignored.
     */
    export const onWillSaveTextDocument: Event<TextDocumentWillSaveEvent>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is saved to disk.
     */
    export const onDidSaveTextDocument: Event<TextDocument>;

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
    waitUntil(thenable: Thenable<TextEdit[]> |  Thenable<any>): void;

  }

}
